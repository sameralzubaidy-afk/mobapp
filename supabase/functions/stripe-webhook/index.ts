// File: supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

import { mapStripePayoutEventToUpdate } from '../_shared/payouts/webhookReconcile.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

serve(async (req) => {
  const sig = req.headers.get('stripe-signature');

  if (!sig || !endpointSecret) {
    return new Response('Webhook Secret missing', { status: 400 });
  }

  const body = await req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`[stripe-webhook] Error verifying webhook signature: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseClient = createClient(supabaseUrl!, supabaseServiceKey!);

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      // TAX-STATUS-LIFECYCLE (2026-07-23): Handle charge.captured to idempotently mark
      // tax as collected when Stripe confirms a successful capture. This is the webhook
      // safety net — the primary capture happens in complete-trade or auto-complete EFs,
      // but if those miss the tax mark step, this webhook ensures it doesn't get lost.
      case 'charge.captured': {
        const capturedCharge = event.data.object as Stripe.Charge;
        const paymentIntentId = capturedCharge.payment_intent as string;

        if (paymentIntentId) {
          const { data: trade } = await supabaseClient
            .from('trades')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

          if (trade) {
            const chargeId = capturedCharge.id;
            console.log(`[stripe-webhook] charge.captured for PI ${paymentIntentId} — trade ${trade.id}`);

            // Idempotent: rpc_mark_tax_collected is safe to call multiple times
            await supabaseClient.rpc('rpc_mark_tax_collected', {
              p_trade_id: trade.id,
              p_stripe_capture_id: chargeId,
            });
          }
        }
        break;
      }

      // TAX-REFUND-INTEGRITY (2026-07-24): charge.refunded webhook now uses
      // rpc_record_stripe_refund which is idempotent and handles succeeded/pending/failed
      // refund statuses. It ONLY reverses tax after Stripe confirms the refund.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        
        if (paymentIntentId) {
          // Find trade by payment intent ID
          const { data: trade, error: tradeError } = await supabaseClient
            .from('trades')
            .select('id, status, stripe_refund_id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

          if (trade) {
            console.log(`[stripe-webhook] charge.refunded for PI ${paymentIntentId} — trade ${trade.id}`);

            // Extract refund info from the charge
            const refundAmountCents = Math.round((charge.amount_refunded ?? 0));
            const refundId = charge.refunds?.data?.[0]?.id ?? `webhook_${charge.id}_refund`;

            // Record the refund on the tax ledger (idempotent — safe to call multiple times)
            if (refundAmountCents > 0) {
              try {
                await supabaseClient.rpc('rpc_record_stripe_refund', {
                  p_trade_id: trade.id,
                  p_stripe_refund_id: refundId,
                  p_refund_amount_cents: refundAmountCents,
                  p_refund_status: 'succeeded',
                  p_refund_reason: 'stripe_webhook_refund',
                  p_initiating_actor: 'stripe_webhook',
                });
              } catch (taxRefundErr: unknown) {
                const msg = taxRefundErr instanceof Error ? taxRefundErr.message : 'Unknown error';
                console.error(`[stripe-webhook] Tax refund record error for trade ${trade.id}:`, msg);
              }

              // PAY-317 (2026-08-01): sync the payments reconciliation ledger. Idempotent —
              // skips refunds already recorded by the trade-refund EF; records FULL refunds
              // from any path (force-cancel / dispute / cancel / manual Stripe).
              try {
                await supabaseClient.rpc('rpc_sync_payment_refund_webhook', {
                  p_trade_id: trade.id,
                  p_stripe_refund_id: refundId,
                  p_refund_amount_cents: refundAmountCents,
                  p_status: 'succeeded',
                });
              } catch (paySyncErr: unknown) {
                const msg = paySyncErr instanceof Error ? paySyncErr.message : 'Unknown error';
                console.error(`[stripe-webhook] Payments ledger sync error for trade ${trade.id}:`, msg);
              }
            }

            // Cancel the trade if it's not already cancelled
            if (trade.status !== 'cancelled') {
              await supabaseClient.rpc('cancel_trade_v2', {
                p_trade_id: trade.id,
                p_user_id: null, // System action
                p_reason: 'External Stripe refund'
              });
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const tradeId = pi.metadata.supabase_trade_id;

        if (tradeId) {
          console.log(`[stripe-webhook] Marking trade ${tradeId} as payment_failed`);
          await supabaseClient
            .from('trades')
            .update({ 
              status: 'payment_failed', 
              last_status_change_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', tradeId);
        }
        break;
      }

      // Stripe Connect account update events (PAY-004)
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        
        // Find payout method by Stripe account ID
        const { data: method, error: methodError } = await supabaseClient
          .from('seller_payout_methods')
          .select('*')
          .eq('stripe_account_id', account.id)
          .eq('method_type', 'stripe_connect')
          .maybeSingle();

        if (method) {
          const updates: any = {
            updated_at: new Date().toISOString()
          };

          // Treat onboarding as complete once Stripe marks details submitted.
          // Note: `charges_enabled` can remain false for some setups; payouts onboarding
          // is still considered complete when details are submitted.
          if (account.details_submitted) {
            updates.stripe_onboarding_complete = true;
          }

          // Check if payouts are enabled
          if (account.payouts_enabled) {
            updates.stripe_payouts_enabled = true;
            updates.is_verified = true;
          }

          console.log(`[stripe-webhook] Updating payout method ${method.id} for account ${account.id}`);
          await supabaseClient
            .from('seller_payout_methods')
            .update(updates)
            .eq('id', method.id);
        }
        break;
      }

      // Stripe Connect payout events (PAY-007)
      case 'payout.created':
      case 'payout.updated':
      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        const update = mapStripePayoutEventToUpdate(event.type, {
          failure_message: payout.failure_message,
        });

        if (!update) break;

        // Find seller payout by provider reference ID
        const { data: sellerPayout } = await supabaseClient
          .from('seller_payouts')
          .select('id, status')
          .eq('provider_reference_id', payout.id)
          .maybeSingle();

        if (!sellerPayout) break;

        console.log(`[stripe-webhook] Updating seller payout ${sellerPayout.id} status to ${update.status}`);
        await supabaseClient
          .from('seller_payouts')
          .update(update)
          .eq('id', sellerPayout.id);

        break;
      }

      // Add other events as needed (e.g., subscription events from MODULE-11)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[stripe-webhook] Error processing event ${event.type}:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
