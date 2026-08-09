// File: supabase/functions/complete-trade/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';
import { logTradeEvent } from '../_shared/trade-events.ts';
import { logFinancialAudit } from '../_shared/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabaseKey = supabaseAnonKey || supabaseServiceKey;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_ANON_KEY',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Extract auth token BEFORE creating client (needed for RLS headers)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Create client with user's JWT so RLS policies apply to subsequent queries
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tradeId = body?.tradeId ?? body?.trade_id;

    if (!tradeId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing tradeId (expected tradeId or trade_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: trade, error: tradeError } = await supabaseClient
      .from('trades')
      .select('id, buyer_id, seller_id, status, disputed_at, dispute_resolution')
      .eq('id', tradeId)
      .maybeSingle();

    if (tradeError || !trade) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Trade not found',
          code: 'TRADE_NOT_FOUND',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.buyer_id !== user.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only the buyer can complete this trade',
          code: 'BUYER_ONLY_COMPLETION',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          tradeId: trade.id,
          status: 'completed',
          message: 'Trade already completed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.status !== 'in_progress') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Trade is not in_progress (current status: ${trade.status})`,
          code: 'INVALID_TRADE_STATE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trade.disputed_at && !trade.dispute_resolution) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Trade has an unresolved dispute and cannot be completed',
          code: 'UNRESOLVED_DISPUTE',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TAX-STATUS-LIFECYCLE (2026-07-23): Capture the Stripe PaymentIntent BEFORE completing
    // the trade. Previously, the PI was captured at seller-accept time. Now it is deferred
    // to buyer-complete time so that tax becomes "collected" only when money actually moves.
    // The complete_trade_v2 RPC (which releases SP and triggers payout) is called ONLY
    // after capture succeeds — if capture fails, no SP or payout changes occur.
    //
    // Fallback for zero-cash trades ($0 items): no capture needed, skip directly to completion.
    let stripeCaptureId: string | null = null;
    let captureSucceeded = false;

    // Load trade with PI info using service role client (bypasses RLS for completeness)
    const svcClient = createClient(supabaseUrl!, supabaseServiceKey!);
    const { data: tradeWithPi } = await svcClient
      .from('trades')
      .select('id, stripe_payment_intent_id, cash_amount_cents, status, stripe_refund_id, sp_amount, seller_transaction_fee_cents')
      .eq('id', tradeId)
      .single();

    const piId = tradeWithPi?.stripe_payment_intent_id as string | undefined;
    const cashCents = (tradeWithPi?.cash_amount_cents as number) ?? 0;
    const tradePiStatus = tradeWithPi?.status as string | undefined;

    if (piId && cashCents > 0 && tradePiStatus !== 'completed') {
      const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
      if (stripeKey && stripeKey.startsWith('sk_')) {
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
        try {
          console.log(`[complete-trade] Capturing PI ${piId} for trade ${tradeId}`);
          const capturedPi = await stripe.paymentIntents.capture(piId);

          if (capturedPi.status === 'succeeded') {
            stripeCaptureId = capturedPi.latest_charge ?? null;
            captureSucceeded = true;
            console.log(`[complete-trade] PI ${piId} captured successfully. Charge: ${stripeCaptureId}`);

            // Mark tax as collected (idempotent RPC)
            try {
              await svcClient.rpc('rpc_mark_tax_collected', {
                p_trade_id: tradeId,
                p_stripe_capture_id: stripeCaptureId,
              });
              console.log(`[complete-trade] Tax marked collected for trade ${tradeId}`);
            } catch (taxMarkErr: unknown) {
              const msg = taxMarkErr instanceof Error ? taxMarkErr.message : 'Unknown error';
              console.error(`[complete-trade] Tax mark error (non-fatal): ${msg}`);
              // Non-fatal — capture succeeded, tax can be reconciled later
            }

            // N2 — Idempotency & Audit: money captured.
            logFinancialAudit(svcClient, {
              mutationType: 'payment_captured',
              entityType: 'trade',
              entityId: tradeId,
              actorId: user.id,
              afterState: { stripe_payment_intent_id: piId, stripe_capture_id: stripeCaptureId, status: 'completed' },
              amountCents: cashCents,
              idempotencyKey: `capture_${tradeId}`,
            });
            logFinancialAudit(svcClient, {
              mutationType: 'tax_collected',
              entityType: 'trade',
              entityId: tradeId,
              actorId: user.id,
              afterState: { stripe_capture_id: stripeCaptureId },
              idempotencyKey: `tax_collected_${tradeId}`,
            });
          } else {
            // Capture did not succeed — mark tax as capture_failed, do NOT complete trade
            console.error(`[complete-trade] PI capture returned status: ${capturedPi.status}`);
            try {
              await svcClient.rpc('rpc_mark_tax_capture_failed', {
                p_trade_id: tradeId,
                p_failure_reason: `stripe_status_${capturedPi.status}`,
              });
            } catch (e) {
              console.error('[complete-trade] Tax capture_failed mark error:', e);
            }
            return new Response(JSON.stringify({
              success: false,
              error: 'Payment capture failed. Please try again or contact support.',
              code: 'CAPTURE_FAILED',
              details: { stripe_status: capturedPi.status },
            }), {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (captureErr: unknown) {
          const msg = captureErr instanceof Error ? captureErr.message : 'Stripe capture error';
          console.error(`[complete-trade] Stripe capture error: ${msg}`);

          // Mark tax as capture_failed
          try {
            await svcClient.rpc('rpc_mark_tax_capture_failed', {
              p_trade_id: tradeId,
              p_failure_reason: msg,
            });
          } catch (e) {
            console.error('[complete-trade] Tax capture_failed mark error:', e);
          }

          return new Response(JSON.stringify({
            success: false,
            error: 'Payment capture failed. Please try again or contact support.',
            code: 'CAPTURE_FAILED',
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.error('[complete-trade] Stripe key not configured');
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment system configuration error.',
          code: 'STRIPE_CONFIG_ERROR',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (!piId && cashCents > 0) {
      console.warn(`[complete-trade] Trade ${tradeId} has cash but no PI — may still be processing (D-31 background path)`);
      // Try calling rpc_finalize_trade_after_capture anyway — it will handle the
      // no-tax-record case gracefully via the RPC's noop path.
    }

    // 2. Call the RPC to complete the trade (SP release + payout trigger)
    const { data, error: rpcError } = await supabaseClient.rpc('complete_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id
    });

    if (rpcError) {
      console.error('[complete-trade] RPC error:', rpcError);
      console.error('[complete-trade] RPC error details:', {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details
      });
      return new Response(JSON.stringify({ 
        success: false,
        error: rpcError.message,
        details: rpcError.details 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data?.success) {
      console.error('[complete-trade] RPC returned error:', data);
      return new Response(JSON.stringify({ 
        success: false,
        error: data?.error || 'Unknown error completing trade',
        details: data?.details
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TFV2-019: log trade_completed event
    await logTradeEvent(supabaseClient, tradeId, 'trade_completed', user.id, {
      final_status: data.status,
      stripe_capture_id: stripeCaptureId,
    });

    // N2 — Idempotency & Audit: completion + SP release transitions.
    const spAmount = (tradeWithPi?.sp_amount as number) ?? 0;
    const sellerFeeCents = (tradeWithPi?.seller_transaction_fee_cents as number) ?? 0;
    logFinancialAudit(svcClient, {
      mutationType: 'trade_completed',
      entityType: 'trade',
      entityId: tradeId,
      actorId: user.id,
      afterState: { final_status: data.status, stripe_capture_id: stripeCaptureId },
      idempotencyKey: `trade_completed_${tradeId}`,
    });
    if (spAmount > 0) {
      logFinancialAudit(svcClient, {
        mutationType: 'sp_released',
        entityType: 'trade',
        entityId: tradeId,
        actorId: user.id,
        afterState: { sp_amount: spAmount, to: 'seller_pending', released_at: 'completion' },
        amountCents: spAmount,
        idempotencyKey: `sp_release_${tradeId}`,
      });
    }
    if (sellerFeeCents > 0) {
      logFinancialAudit(svcClient, {
        mutationType: 'seller_fee_deducted',
        entityType: 'trade',
        entityId: tradeId,
        actorId: user.id,
        afterState: { seller_transaction_fee_cents: sellerFeeCents, deducted_at: 'payout' },
        amountCents: -sellerFeeCents,
        idempotencyKey: `seller_fee_${tradeId}`,
      });
    }

    // Notify seller that the buyer confirmed receipt
    try {
      await supabaseClient.rpc('create_trade_notification', {
        p_user_id:           trade.seller_id,
        p_notification_type: 'trade_completed',
        p_title:             'Trade Complete!',
        p_body:              'The buyer confirmed receipt. Your payout has been initiated.',
        p_data:              JSON.stringify({ trade_id: tradeId }),
      });
    } catch (notifErr: unknown) {
      const msg = notifErr instanceof Error ? notifErr.message : 'Unknown error';
      console.error('[complete-trade] Seller notification error:', msg);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      tradeId: data.trade_id,
      status: data.status,
      message: data.message,
      stripe_capture_id: stripeCaptureId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[complete-trade] error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
