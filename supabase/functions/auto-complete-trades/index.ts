// File: supabase/functions/auto-complete-trades/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  const stripe = stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

  if (!stripe) {
    console.warn('[auto-complete-trades] STRIPE_SECRET_KEY not configured — running without payment capture');
  }

  try {
    // 1. Find trades in_progress for > 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data: trades, error: fetchError } = await supabaseClient
      .from('trades')
      .select('id, created_at, last_status_change_at, seller_marked_completed_at, dispute_status, disputed_at, stripe_payment_intent_id, cash_amount_cents')
      .eq('status', 'in_progress');

    if (fetchError) {
      throw fetchError;
    }

    // Filter trades where the reference timestamp is older than cutoff.
    // Reference timestamp order: seller_marked_completed_at -> last_status_change_at -> created_at
    // Skip any trade with an UNRESOLVED dispute (dispute_status = reported/under_review OR disputed_at is set)
    const candidates = (trades || []).filter((t: any) => {
      // Skip disputed trades with no resolution
      const hasActiveDispute =
        (t.dispute_status && !['none', 'resolved'].includes(t.dispute_status)) ||
        (t.disputed_at && !t.dispute_resolution);
      if (hasActiveDispute) return false;

      const refTs = t.seller_marked_completed_at || t.last_status_change_at || t.created_at;
      if (!refTs) return false;
      const refDate = new Date(refTs);
      return refDate < cutoff;
    });

    console.log(`[auto-complete-trades] Found ${candidates.length || 0} trades to auto-complete (out of ${trades?.length || 0} in_progress)`);

    const results: any[] = [];

    // 2. Complete each candidate trade (with PI capture first)
    for (const trade of candidates) {
      // TAX-STATUS-LIFECYCLE: Capture PI before completing the trade
      const piId = trade.stripe_payment_intent_id;
      const cashCents = trade.cash_amount_cents ?? 0;
      let captureSuccess = true;

      if (piId && cashCents > 0 && stripe) {
        try {
          const captured = await stripe.paymentIntents.capture(piId);
          if (captured.status === 'succeeded') {
            const chargeId = captured.latest_charge ?? null;
            console.log(`[auto-complete-trades] PI ${piId} captured for trade ${trade.id}`);

            // Mark tax as collected
            try {
              await supabaseClient.rpc('rpc_mark_tax_collected', {
                p_trade_id: trade.id,
                p_stripe_capture_id: chargeId,
              });
            } catch (taxErr: unknown) {
              const msg = taxErr instanceof Error ? taxErr.message : 'Unknown error';
              console.error(`[auto-complete-trades] Tax mark error for ${trade.id}:`, msg);
            }
          } else {
            console.error(`[auto-complete-trades] PI ${piId} capture returned status: ${captured.status}`);
            captureSuccess = false;

            try {
              await supabaseClient.rpc('rpc_mark_tax_capture_failed', {
                p_trade_id: trade.id,
                p_failure_reason: `stripe_status_${captured.status}`,
              });
            } catch (e) {
              console.error(`[auto-complete-trades] Tax capture_failed mark error:`, e);
            }
          }
        } catch (stripeErr: unknown) {
          const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
          console.error(`[auto-complete-trades] Capture error for trade ${trade.id}:`, msg);
          captureSuccess = false;

          try {
            await supabaseClient.rpc('rpc_mark_tax_capture_failed', {
              p_trade_id: trade.id,
              p_failure_reason: msg,
            });
          } catch (e) {
            console.error(`[auto-complete-trades] Tax capture_failed mark error:`, e);
          }
        }
      }

      // Only complete the trade if capture succeeded (or no capture needed)
      if (captureSuccess) {
        try {
          const { data, error: rpcError } = await supabaseClient.rpc('complete_trade_v2', {
            p_trade_id: trade.id,
            p_user_id: null // System action
          });

          if (rpcError) {
            console.error(`[auto-complete-trades] Error completing trade ${trade.id}:`, rpcError);
            results.push({ tradeId: trade.id, success: false, error: rpcError.message });
          } else {
            results.push({ tradeId: trade.id, success: data?.success ?? false, error: data?.error ?? null });
          }
        } catch (err) {
          console.error(`[auto-complete-trades] Unexpected error completing trade ${trade.id}:`, err);
          results.push({ tradeId: trade.id, success: false, error: err?.message ?? String(err) });
        }
      } else {
        results.push({
          tradeId: trade.id,
          success: false,
          error: 'Stripe capture failed — trade kept in_progress for recovery',
        });
      }
    }

    // Create audit/log entry for this run
    const processedCount = results.length;
    const errorsCount = results.filter((r: any) => !r.success).length;
    try {
      const { error: insertErr } = await supabaseClient.from('auto_complete_runs').insert({
        invoked_by: 'edge_function',
        job_payload: { cutoff_days: 7, schedule: '12h' },
        result: { processed_count: processedCount, errors_count: errorsCount, results },
        processed_count: processedCount,
        errors_count: errorsCount,
      });
      if (insertErr) console.error('[auto-complete-trades] Failed to write run log:', insertErr);
      else console.log('[auto-complete-trades] Run log written');
    } catch (err) {
      console.error('[auto-complete-trades] Unexpected error writing run log:', err);
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[auto-complete-trades] error:', error);

    // Attempt to write an error run log
    try {
      const { error: insertErr } = await supabaseClient.from('auto_complete_runs').insert({
        invoked_by: 'edge_function',
        job_payload: { cutoff_days: 7, schedule: '12h' },
        result: { processed_count: 0, errors_count: 1, results: [], error: error?.message ?? String(error) },
        processed_count: 0,
        errors_count: 1,
        error: error?.message ?? String(error),
      });
      if (insertErr) console.error('[auto-complete-trades] Failed to write error run log:', insertErr);
      else console.log('[auto-complete-trades] Error run log written');
    } catch (err) {
      console.error('[auto-complete-trades] Unexpected error writing error run log:', err);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
