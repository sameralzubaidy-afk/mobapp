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

// ============================================================================
// INLINED from supabase/functions/_shared/audit.ts — KEEP IN SYNC with the
// canonical source. Do NOT re-import from '../_shared/audit.ts'.
//
// Why inlined: the bundler has historically failed on `../_shared/*` parent-dir
// imports for this function (BP-41 / PAY-004-005), and the deployed version
// (v12+) already runs the inlined pattern safely. This repo copy was reverted
// (2026-08-09) to the fragile value-import; re-applying the inlined helper so a
// future redeploy cannot reintroduce the Module-not-found failure.
// ============================================================================

type FinancialMutationType =
  | 'offer_created'
  | 'payment_intent_created'
  | 'payment_captured'
  | 'payment_capture_failed'
  | 'payment_cancelled'
  | 'refund_issued'
  | 'refund_voided'
  | 'payout_initiated'
  | 'payout_paid'
  | 'payout_requires_action'
  | 'payout_failed'
  | 'payout_scheduled'
  | 'sp_reserved'
  | 'sp_restored'
  | 'sp_released'
  | 'sp_issued'
  | 'sp_deducted'
  | 'sp_frozen'
  | 'sp_unfrozen'
  | 'sp_expired'
  | 'buyer_fee_charged'
  | 'seller_fee_deducted'
  | 'tax_quoted'
  | 'tax_collected'
  | 'tax_voided'
  | 'tax_refunded'
  | 'trade_cancelled'
  | 'trade_completed';

interface FinancialAuditInput {
  mutationType: FinancialMutationType;
  /** e.g. 'trade' | 'refund' | 'payment' | 'payout' | 'wallet' | 'listing' */
  entityType?: string;
  entityId?: string | null;
  /** auth.users.id; null for cron/system events */
  actorId?: string | null;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  /** signed: + credit, - debit */
  amountCents?: number | null;
  /** deterministic key derived from the mutation (e.g. `capture_<tradeId>`); a
   *  retried call with the same key never double-logs. */
  idempotencyKey?: string | null;
  /** N6 node id (resolved by DB trigger when omitted) */
  nodeId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditClient = { rpc: (fn: string, args: Record<string, unknown>) => any };

/**
 * Write a financial audit row (non-blocking — errors logged but not thrown).
 * Idempotent: same `idempotencyKey` twice => single row.
 */
async function logFinancialAudit(
  supabase: AuditClient,
  input: FinancialAuditInput,
): Promise<void> {
  try {
    const { error } = (await supabase.rpc('fn_log_financial_audit', {
      p_mutation_type: input.mutationType,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_actor_id: input.actorId ?? null,
      p_before_state: input.beforeState ?? {},
      p_after_state: input.afterState ?? {},
      p_amount_cents: input.amountCents ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_node_id: input.nodeId ?? null,
    })) ?? { error: null };

    if (error) {
      console.warn(
        `[logFinancialAudit] failed mutation=${input.mutationType} entity=${input.entityId}:`,
        error.message,
      );
    }
  } catch (err) {
    console.warn('[logFinancialAudit] unexpected error:', err);
  }
}

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

  // FIX-Task-35 item 2 (2026-09-14): FAIL CLOSED when Stripe is unavailable.
  //
  // This function previously treated "STRIPE_SECRET_KEY not configured" as a
  // reason to keep going, and (worse) marked every eligible trade
  // `capture_success: true` on that basis — so the cron flipped them to
  // `completed` and scheduled seller payouts against authorizations that were
  // never captured. `complete-trade` and `resolve-dispute` both refuse to
  // complete against an uncaptured hold; this path did the opposite. A missing
  // payment credential must stop the money path, not silently disable it.
  const stripe = stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

  if (!stripe) {
    console.error(
      '[process-auto-complete] STRIPE_SECRET_KEY missing or invalid — refusing to auto-complete (fail closed)',
    );
    return jsonResponse(500, {
      success: false,
      error: {
        code: 'STRIPE_CONFIG_ERROR',
        message: 'Payment system not configured — auto-complete refused rather than completing uncaptured trades.',
        details: { requestId },
      },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBatchSize = Number(body?.batch_size);
    const batchSize =
      Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
        ? Math.min(Math.floor(requestedBatchSize), 500)
        : 100;

    // TAX-STATUS-LIFECYCLE: Find eligible trades and capture PIs before auto-completing
    // FIX-Task-7 (P1): an OPEN dispute (reported/under_review) must be excluded at
    // the fetch stage — the rpc_process_auto_complete guard is the backstop, but the
    // EF must NOT Stripe-capture a disputed trade's authorization hold either.
    const { data: eligibleTrades, error: fetchErr } = await supabase
      .from('trades')
      .select('id, stripe_payment_intent_id, cash_amount_cents, dispute_status')
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

    const trades = ((eligibleTrades ?? []) as Array<{
      id: string;
      stripe_payment_intent_id: string | null;
      cash_amount_cents: number;
      dispute_status: string | null;
    }>).filter(
      (t) => !['reported', 'under_review'].includes(t.dispute_status ?? 'none')
    ) as Array<{
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

      if (piId && cashCents > 0) {
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

            // N2 — Idempotency & Audit: auto-complete capture.
            logFinancialAudit(supabase, {
              mutationType: 'payment_captured',
              entityType: 'trade',
              entityId: trade.id,
              afterState: { stripe_payment_intent_id: piId, stripe_charge_id: chargeId, source: 'auto_complete' },
              amountCents: cashCents,
              idempotencyKey: `capture_${trade.id}`,
            });
            logFinancialAudit(supabase, {
              mutationType: 'tax_collected',
              entityType: 'trade',
              entityId: trade.id,
              afterState: { stripe_charge_id: chargeId },
              idempotencyKey: `tax_collected_${trade.id}`,
            });

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
        // Zero-cash trade — genuinely nothing to capture.
        captureResults.push({ trade_id: trade.id, capture_success: true });
      } else {
        // Cash is owed but there is no PaymentIntent to collect it from. This is
        // NOT a success: FIX-Task-35 item 2 removed the "Stripe not configured →
        // pretend it worked" branch that used to sit here.
        console.error(
          `[process-auto-complete] Trade ${trade.id} owes ${cashCents}¢ but has no PaymentIntent — skipping completion`,
        );
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

    // Step 2: Complete ONLY the trades whose capture actually succeeded.
    //
    // FIX-Task-35 item 5 (2026-09-14): this used to pass
    // `p_batch_size: successfulTradeIds.length` — a COUNT standing in for a SET.
    // The RPC re-selects its own batch (`auto_complete_at ASC LIMIT p_batch_size`),
    // so its window was ordered by a completely different key than the capture
    // loop's. Any eligible trade that happened to sort into that window was
    // completed even when its capture had FAILED — the mirror image of the bug in
    // item 2, and the second half of how a trade ends up `completed` with an
    // uncaptured authorization. The ids are now passed explicitly so the RPC can
    // only ever complete the trades this loop verified.
    if (successfulTradeIds.length > 0) {
      const { data, error } = await supabase.rpc('rpc_process_auto_complete', {
        p_batch_size: successfulTradeIds.length,
        p_trade_ids: successfulTradeIds,
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
