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
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        
        if (paymentIntentId) {
          // Find trade by payment intent ID
          const { data: trade, error: tradeError } = await supabaseClient
            .from('trades')
            .select('id, status')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single();

          if (trade && trade.status !== 'cancelled') {
            console.log(`[stripe-webhook] Marking trade ${trade.id} as cancelled due to external refund`);
            await supabaseClient.rpc('cancel_trade_v2', {
              p_trade_id: trade.id,
              p_user_id: null, // System action
              p_reason: 'External Stripe refund'
            });
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
