// File: supabase/functions/process-auto-complete/index.ts
// TAX-STATUS-LIFECYCLE (2026-07-23): Before auto-completing trades, capture the Stripe
// PaymentIntent for each eligible trade. Tax is marked collected ONLY after capture succeeds.
// If capture fails, the trade stays in_progress and tax is marked capture_failed.
//
// Flow:
//   1. Find eligible trades (in_progress, auto_complete_at <= now, no active dispute)
//   2. For each trade with a PI, capture it via Stripe
//   3. On capture success, mark tax collected, then call rpc_process_auto_complete
//   4. On capture failure, mark tax capture_failed — trade stays in_progress for recovery

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      success: false,
      error: {
        code: 'CONFIG_MISSING',
        message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      },
    });
  }

  const requestId = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

  if (!stripe) {
    console.warn('[process-auto-complete] STRIPE_SECRET_KEY not configured — running without payment capture');
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBatchSize = Number(body?.batch_size);
    const batchSize =
      Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
        ? Math.min(Math.floor(requestedBatchSize), 500)
        : 100;

    // TAX-STATUS-LIFECYCLE: Find eligible trades and capture PIs before auto-completing
    const { data: eligibleTrades, error: fetchErr } = await supabase
      .from('trades')
      .select('id, stripe_payment_intent_id, cash_amount_cents')
      .eq('status', 'in_progress')
      .not('auto_complete_at', 'is', null)
      .lte('auto_complete_at', new Date().toISOString())
      .is('stripe_refund_id', null)
      .limit(batchSize);

    if (fetchErr) {
      console.error('[process-auto-complete] Fetch error:', fetchErr);
      return jsonResponse(500, {
        success: false,
        error: { code: 'FETCH_ERROR', message: fetchErr.message, details: { requestId } },
      });
    }

    const trades = (eligibleTrades ?? []) as Array<{
      id: string;
      stripe_payment_intent_id: string | null;
      cash_amount_cents: number;
    }>;

    console.log(`[process-auto-complete] Found ${trades.length} eligible trades for auto-complete (batch=${batchSize})`);

    const captureResults: Array<{
      trade_id: string;
      capture_success: boolean;
      error?: string;
    }> = [];

    // Step 1: Capture PIs for all eligible trades
    for (const trade of trades) {
      const piId = trade.stripe_payment_intent_id;
      const cashCents = trade.cash_amount_cents ?? 0;

      if (piId && cashCents > 0 && stripe) {
        try {
          const captured = await stripe.paymentIntents.capture(piId);
          if (captured.status === 'succeeded') {
            const chargeId = captured.latest_charge ?? null;
            console.log(`[process-auto-complete] PI ${piId} captured for trade ${trade.id}`);

            // Mark tax as collected
            try {
              await supabase.rpc('rpc_mark_tax_collected', {
                p_trade_id: trade.id,
                p_stripe_capture_id: chargeId,
              });
            } catch (taxErr: unknown) {
              const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
              console.error(`[process-auto-complete] Tax mark error for ${trade.id}:`, msg);
            }

            captureResults.push({ trade_id: trade.id, capture_success: true });
          } else {
            console.error(`[process-auto-complete] PI ${piId} capture returned status: ${captured.status}`);

            try {
              await supabase.rpc('rpc_mark_tax_capture_failed', {
                p_trade_id: trade.id,
                p_failure_reason: `stripe_status_${captured.status}`,
              });
            } catch (e) {
              console.error(`[process-auto-complete] Tax capture_failed mark error for ${trade.id}:`, e);
            }

            captureResults.push({
              trade_id: trade.id,
              capture_success: false,
              error: `Stripe status: ${captured.status}`,
            });
          }
        } catch (stripeErr: unknown) {
          const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
          console.error(`[process-auto-complete] Capture error for trade ${trade.id} PI ${piId}:`, msg);

          try {
            await supabase.rpc('rpc_mark_tax_capture_failed', {
              p_trade_id: trade.id,
              p_failure_reason: msg,
            });
          } catch (e) {
            console.error(`[process-auto-complete] Tax capture_failed mark error for ${trade.id}:`, e);
          }

          captureResults.push({
            trade_id: trade.id,
            capture_success: false,
            error: msg,
          });
        }
      } else if (cashCents === 0) {
        // Zero-cash trade — no capture needed
        captureResults.push({ trade_id: trade.id, capture_success: true });
      } else if (!stripe) {
        // Stripe not configured — proceed without capture (dev mode)
        captureResults.push({ trade_id: trade.id, capture_success: true });
      } else {
        // No PI yet — skip
        console.warn(`[process-auto-complete] Trade ${trade.id} has cash but no PI — skipping`);
        captureResults.push({
          trade_id: trade.id,
          capture_success: false,
          error: 'No payment_intent_id',
        });
      }
    }

    // Step 2: Call rpc_process_auto_complete for trades whose capture succeeded
    // The existing RPC handles the status transition to 'completed'
    const successfulTradeIds = captureResults
      .filter(r => r.capture_success)
      .map(r => r.trade_id);

    let autoCompleteResult: Record<string, unknown> | null = null;
    let autoCompleteError: string | null = null;

    if (successfulTradeIds.length > 0) {
      const { data, error } = await supabase.rpc('rpc_process_auto_complete', {
        p_batch_size: successfulTradeIds.length,
      });

      if (error) {
        autoCompleteError = error.message;
        console.error('[process-auto-complete] rpc_process_auto_complete error:', error);
      } else {
        autoCompleteResult = data as Record<string, unknown> ?? null;
      }
    }

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      eligible_count: trades.length,
      capture_results: captureResults,
      auto_complete: autoCompleteResult,
      auto_complete_error: autoCompleteError,
      captured_count: captureResults.filter(r => r.capture_success).length,
      failed_count: captureResults.filter(r => !r.capture_success).length,
    });
  } catch (error) {
    console.error('[process-auto-complete] unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(500, {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { requestId },
      },
    });
  }
});
