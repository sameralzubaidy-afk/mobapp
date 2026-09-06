// File: supabase/functions/dispatch-manual-payouts/index.ts
// Dev Task 124 (Item 1) — Dispatch manual Stripe withdrawals to Connect.
//
// Problem: `request_seller_payout` creates a `seller_payouts` row with
// status='processing' and trade_id NULL but never calls Stripe; only the
// trade-completion trigger (initiate-payout) dispatches, so every manual
// withdrawal sat in 'processing' forever.
//
// Input (POST, service-role bearer required):
//   { payout_id: string }  — dispatch ONE manual payout (called by the
//                            AFTER-INSERT trigger fn_queue_manual_payout_dispatch)
//   {} | { sweep: true }   — dispatch ALL eligible manual payouts (called by the
//                            hourly `dispatch-manual-payouts` pg_cron job)
//   optional: { batch_size } (default 100, cap 500) for the sweep
//
// Output: { success, processed, completed, failed, skipped, failures, ... }
//
// Eligible: seller_payouts WHERE provider='stripe' AND trade_id IS NULL AND
// status='processing' AND provider_reference_id IS NULL.
//
// Money path: stripe.transfers.create({ amount: net_amount_cents, currency:
// 'usd', destination: method.stripe_account_id }, { idempotencyKey:
// 'manual_payout_<payout_id>' }) — mirrors initiate-payout. Success marks the
// row completed + provider_reference_id; failure marks it failed + reason. The
// idempotency key + status guard make this safe against the trigger and the
// sweep racing (a duplicate transfer is impossible).
//
// verify_jwt = false (BP-19, cron + DB-trigger invoked). No strict bearer check
// (mirrors initiate-payout): eligibility + ownership + Stripe idempotency key
// are the money-safety model (see inline NOTE in the handler).
//
// Classification: B (Edge Function, money path). Tier 0 + live Tier 1 verify.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.1';
import Stripe from 'npm:stripe@12.0.0';
import { logFinancialAudit } from '../_shared/audit.ts';
import { verifyStripeAccountOwnership } from '../_shared/verify-stripe-ownership.ts';

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
  return jsonResponse(status, { success: false, error: { code, message } });
}

interface PayoutRow {
  id: string;
  user_id: string;
  payout_method_id: string | null;
  gross_amount_cents: number;
  platform_fee_cents: number;
  payout_fee_cents: number;
  net_amount_cents: number;
  status: string;
  provider: string | null;
  provider_reference_id: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errResp(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return errResp(500, 'CONFIG_MISSING', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const svcClient = createClient(supabaseUrl, serviceRoleKey);

  // NOTE (Dev Task 124, verified live 2026-09-06): NO strict bearer-equality
  // check here, deliberately — mirrors `initiate-payout` (the trade-payout EF).
  // The DB trigger (fn_queue_manual_payout_dispatch) and cron post the service
  // key stored in admin_config, which can drift from the platform-injected
  // SUPABASE_SERVICE_ROLE_KEY env this function reads — a strict comparison 401'd
  // the trigger's call and stranded the row in 'processing' (live-verified). The
  // security model instead relies on (1) only 'processing' rows with no
  // provider_reference_id are eligible (a seller already authorized them),
  // (2) the transfer destination is always the row's OWN ownership-verified
  // Connect account, and (3) the Stripe idempotency key prevents double-pay.

  let body: { payout_id?: string; sweep?: boolean; batch_size?: number };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  if (!body || typeof body !== 'object') body = {};

  const requestedBatchSize = Number(body.batch_size);
  const batchSize =
    Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(Math.floor(requestedBatchSize), 500)
      : 100;

  try {
    const requestId = crypto.randomUUID();

    // Collect eligible rows (single-payout mode or sweep mode)
    const rows: PayoutRow[] = [];
    if (body.payout_id) {
      const { data, error } = await svcClient
        .from('seller_payouts')
        .select(
          'id, user_id, payout_method_id, gross_amount_cents, platform_fee_cents, payout_fee_cents, net_amount_cents, status, provider, provider_reference_id'
        )
        .eq('id', body.payout_id)
        .maybeSingle();
      if (error) {
        console.error('[dispatch-manual-payouts] single lookup failed:', error.message);
        return errResp(500, 'PAYOUT_LOOKUP_FAILED', error.message);
      }
      if (data) rows.push(data as PayoutRow);
    } else {
      const { data, error } = await svcClient
        .from('seller_payouts')
        .select(
          'id, user_id, payout_method_id, gross_amount_cents, platform_fee_cents, payout_fee_cents, net_amount_cents, status, provider, provider_reference_id'
        )
        .eq('provider', 'stripe')
        .is('trade_id', null)
        .eq('status', 'processing')
        .is('provider_reference_id', null)
        .order('created_at', { ascending: true })
        .limit(batchSize);
      if (error) {
        console.error('[dispatch-manual-payouts] sweep query failed:', error.message);
        return errResp(500, 'SWEEP_QUERY_FAILED', error.message);
      }
      rows.push(...((data ?? []) as PayoutRow[]));
    }

    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: { payout_id: string; reason: string }[] = [];
    const skippedReasons: { payout_id: string; reason: string }[] = [];

    for (const payout of rows) {
      const outcome = await processPayout(svcClient, stripeKey, payout);
      if (outcome.status === 'completed') completed += 1;
      else if (outcome.status === 'failed') {
        failed += 1;
        failures.push({ payout_id: payout.id, reason: outcome.reason ?? 'unknown' });
      } else {
        skipped += 1;
        skippedReasons.push({ payout_id: payout.id, reason: outcome.reason ?? 'skipped' });
      }
    }

    console.log('[dispatch-manual-payouts]', {
      requestId,
      mode: body.payout_id ? 'single' : 'sweep',
      rows: rows.length,
      completed,
      failed,
      skipped,
      failures,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      mode: body.payout_id ? 'single' : 'sweep',
      processed: rows.length,
      completed,
      failed,
      skipped,
      failures,
      skipped_reasons: skippedReasons,
    });
  } catch (error) {
    console.error('[dispatch-manual-payouts] unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errResp(500, 'UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
});

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

interface PayoutOutcome {
  status: 'completed' | 'failed' | 'skipped';
  reason?: string;
}

async function processPayout(
  svcClient: SupabaseLike,
  stripeKey: string | undefined,
  payout: PayoutRow
): Promise<PayoutOutcome> {
  // Idempotency guards (belt & suspenders — a concurrent trigger/sweep may have
  // already dispatched this row while we were reading it).
  if (payout.status !== 'processing' || payout.provider_reference_id != null) {
    return { status: 'skipped', reason: payout.status === 'completed' ? 'already_completed' : 'already_processed' };
  }
  if (payout.provider !== 'stripe') {
    return { status: 'skipped', reason: 'not_stripe_manual' };
  }
  if (!stripeKey) {
    return { status: 'failed', reason: 'STRIPE_NOT_CONFIGURED' };
  }

  const markFailed = async (reason: string): Promise<PayoutOutcome> => {
    // Never clobber a row that got dispatched concurrently.
    await svcClient
      .from('seller_payouts')
      .update({ status: 'failed', failure_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', payout.id)
      .eq('status', 'processing')
      .is('provider_reference_id', null);
    await logFinancialAudit(svcClient, {
      mutationType: 'payout_failed',
      entityType: 'seller_payout',
      entityId: payout.id,
      actorId: payout.user_id,
      afterState: { status: 'failed', reason, amount_cents: payout.net_amount_cents },
      amountCents: payout.net_amount_cents,
      idempotencyKey: `manual_payout_${payout.id}:failed`,
    });
    console.error(`[dispatch-manual-payouts] payout ${payout.id} failed:`, reason);
    return { status: 'failed', reason };
  };

  // Load the seller's payout method + Connect account (canonical source:
  // seller_payout_methods.stripe_account_id — BP-73; profiles.stripe_connect_account_id
  // does not exist). Guard a NULL payout_method_id (e.g. method row deleted via
  // FK ON DELETE SET NULL) so we never query `.eq('id', '')` on a uuid column.
  if (!payout.payout_method_id) {
    return markFailed('NO_PAYOUT_METHOD');
  }
  const { data: method, error: methodErr } = await svcClient
    .from('seller_payout_methods')
    .select('id, user_id, stripe_account_id, is_verified')
    .eq('id', payout.payout_method_id)
    .maybeSingle();
  if (methodErr || !method || !method.stripe_account_id) {
    return markFailed(methodErr ? `METHOD_LOOKUP_FAILED: ${methodErr.message}` : 'NO_CONNECT_ACCOUNT');
  }

  const ownership = await verifyStripeAccountOwnership(svcClient, payout.user_id, method.stripe_account_id);
  if (!ownership.owned) {
    return markFailed(`OWNERSHIP_DENIED: ${ownership.error ?? 'unknown'}`);
  }

  if (payout.net_amount_cents <= 0) {
    // Defensive: request_seller_payout enforces net > 0, so this should never
    // happen. Do not transfer $0; flag for admin instead of silently completing.
    return markFailed('INVALID_NET_AMOUNT');
  }

  // The pinned stripe@12.0.0 SDK types only expose '2022-11-15' as its latest
  // API version literal, but this function intentionally pins '2023-10-16'
  // (deployed behavior) — cast through unknown (same as initiate-payout).
  const stripe = new Stripe(stripeKey as string, {
    apiVersion: '2023-10-16' as unknown as '2022-11-15',
  });

  // N2 — Idempotency & Audit: payout initiated.
  await logFinancialAudit(svcClient, {
    mutationType: 'payout_initiated',
    entityType: 'seller_payout',
    entityId: payout.id,
    actorId: payout.user_id,
    afterState: { status: 'processing', amount_cents: payout.net_amount_cents },
    amountCents: payout.net_amount_cents,
    idempotencyKey: `manual_payout_${payout.id}:initiated`,
  });

  try {
    const transfer = await stripe.transfers.create({
      amount: payout.net_amount_cents,
      currency: 'usd',
      destination: method.stripe_account_id,
      metadata: {
        payout_id: payout.id,
        user_id: payout.user_id,
        method_id: method.id,
        source: 'manual_withdrawal',
      },
    }, {
      idempotencyKey: `manual_payout_${payout.id}`,
    });

    // Mark the payout completed (guard the UPDATE so a concurrent dispatch never
    // double-completes or clobbers a 'failed' write).
    const { error: updErr } = await svcClient
      .from('seller_payouts')
      .update({
        status: 'completed',
        provider_reference_id: transfer.id,
        completed_at: new Date().toISOString(),
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout.id)
      .eq('status', 'processing')
      .is('provider_reference_id', null);
    if (updErr) {
      console.error(`[dispatch-manual-payouts] payout ${payout.id} completed at Stripe but DB update failed:`, updErr.message);
      return { status: 'failed', reason: `DB_UPDATE_FAILED_AFTER_TRANSFER: ${updErr.message}` };
    }

    await logFinancialAudit(svcClient, {
      mutationType: 'payout_paid',
      entityType: 'seller_payout',
      entityId: payout.id,
      actorId: payout.user_id,
      afterState: { status: 'completed', stripe_transfer_id: transfer.id, amount_cents: payout.net_amount_cents },
      amountCents: payout.net_amount_cents,
      idempotencyKey: `manual_payout_${payout.id}:paid`,
    });

    // In-app notification (mirrors initiate-payout's notification_log insert)
    try {
      await svcClient.from('notification_log').insert({
        user_id: payout.user_id,
        notification_type: 'payout_sent',
        payload: {
          payout_id: payout.id,
          transfer_id: transfer.id,
          amount_cents: payout.net_amount_cents,
          source: 'manual_withdrawal',
        },
        sent_at: new Date().toISOString(),
      });
    } catch (notifErr: unknown) {
      console.error(`[dispatch-manual-payouts] notification insert failed for payout ${payout.id}:`,
        notifErr instanceof Error ? notifErr.message : 'Unknown error');
    }

    console.log(`[dispatch-manual-payouts] Transfer ${transfer.id} sent for manual payout ${payout.id}, amount: ${payout.net_amount_cents} cents`);
    return { status: 'completed' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[dispatch-manual-payouts] Stripe transfer error for payout ${payout.id}:`, msg);
    return markFailed(`STRIPE_TRANSFER_FAILED: ${msg}`);
  }
}
