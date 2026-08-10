// File: supabase/functions/release-due-payouts/index.ts
// R3 — Delayed Seller Payout + Buffer: scheduler that releases payouts whose
// `payout_release_at` has passed.
//
// Called by the `release-due-payouts` pg_cron job (hourly) via net.http_post.
// Flow: call `rpc_release_due_payouts` (moves seller_balance pending → available
// for due trades and returns the due trade ids), then dispatch each due trade to
// the existing `initiate-payout` Edge Function (Stripe Connect transfer / provider
// dispatch). `initiate-payout` is idempotent (checks payout_status + idempotency
// key), so re-runs never double-pay.
//
// verify_jwt = false (BP-19) — cron-invoked; reads SUPABASE_SERVICE_ROLE_KEY
// internally, so gateway-level JWT verification is not required.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.1';

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

function errResp(status: number, code: string, message: string) {
  return jsonResponse(status, {
    success: false,
    error: { code, message },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errResp(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return errResp(500, 'CONFIG_MISSING', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const requestId = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBatchSize = Number(body?.batch_size);
    const batchSize =
      Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
        ? Math.min(Math.floor(requestedBatchSize), 500)
        : 100;

    // 1. Release due payouts (data + seller_balance pending → available)
    const { data, error } = await supabase.rpc('rpc_release_due_payouts', {
      p_batch_size: batchSize,
    });

    if (error) {
      console.error('[release-due-payouts]', {
        requestId,
        batchSize,
        error: error.message,
      });
      return errResp(500, 'RPC_RELEASE_DUE_PAYOUTS_FAILED', error.message);
    }

    const tradeIds: string[] = data?.trade_ids ?? [];
    const releasedCount = data?.released_count ?? 0;

    // 2. Dispatch each due trade to initiate-payout (idempotent)
    let dispatched = 0;
    let failed = 0;
    const failures: { trade_id: string; error: string }[] = [];

    for (const tradeId of tradeIds) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/initiate-payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ trade_id: tradeId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload?.success !== false) {
          dispatched += 1;
        } else {
          failed += 1;
          failures.push({
            trade_id: tradeId,
            error: payload?.error?.message ?? `HTTP ${res.status}`,
          });
        }
      } catch (dispatchErr: unknown) {
        failed += 1;
        failures.push({
          trade_id: tradeId,
          error: dispatchErr instanceof Error ? dispatchErr.message : 'Unknown error',
        });
      }
    }

    console.log('[release-due-payouts]', {
      requestId,
      released_count: releasedCount,
      trade_ids: tradeIds.length,
      dispatched,
      failed,
      failures,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      released_count: releasedCount,
      trade_ids: tradeIds,
      dispatched,
      failed,
      failures,
    });
  } catch (error) {
    console.error('[release-due-payouts] unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return errResp(500, 'UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
});
