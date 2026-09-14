// File: supabase/functions/trade-refund/index.ts
// Admin-initiated PARTIAL refund for a single trade (line-item refunds).
//
// Why this exists: full refunds (force-cancel / dispute-refund) return the entire
// PI. Product wants to refund one component at a time — e.g. refund the item price
// but keep the platform fee, or refund price + tax but keep the fee.
//
// This function does NOT change the trade status (a partial refund is a payment
// adjustment, not a cancellation). It:
//   1. Validates per-component remaining amounts against the payments ledger.
//   2. Cancels the PI if still uncaptured, else issues a partial Stripe refund
//      (amount = selected price + fee + tax).
//   3. Records the outcome atomically — branch by Stripe action (FIX-Task-32
//      item 3):
//        * PI was CANCELLED while still an uncaptured authorization hold
//          (`cancelled_uncaptured`) -> void: `rpc_void_uncaptured_payment` voids
//          the tax record and marks the payment row cancelled, writing NO
//          `refunded_*` totals, because no money ever moved;
//        * a real refund (`refunded`) / DB-only record (`skip`, `no_pi`)
//          -> `rpc_record_payment_refund` (payments + trade_refunds +
//          proportional tax reversal).
//
// Auth: service-role key in Authorization/apikey/x-admin-api-key, or ADMIN_UI_SECRET
// in x-admin-ui-secret, or a user JWT whose app_metadata/user_metadata has role=admin.
// Mirrors admin-trade-action.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';
import { logFinancialAudit } from '../_shared/audit.ts';
import { hashContent } from '../_shared/idempotency.ts';
// FIX-Task-32 item 3: the void-vs-refund discriminator, kept in a pure helper so
// it is covered by an always-running unit test (no staging / Stripe needed).
import { classifyRefundLedgerLeg } from '../_shared/refund-decision.ts';
// FIX-Task-34 item 4: drift-proof service-role acceptance (BP-87 rule 2).
import { isValidServiceCredential } from '../_shared/service-credential.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-api-key, x-admin-ui-secret',
};

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, code: string, status: number, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, ...(details ? { details } : {}) } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const adminUiSecret = Deno.env.get('ADMIN_UI_SECRET')?.trim();
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('[trade-refund] Missing environment variables');
    return jsonError('Server configuration error', 'CONFIG_ERROR', 500);
  }
  if (!stripeKey || !stripeKey.startsWith('sk_')) {
    console.error('[trade-refund] STRIPE_SECRET_KEY missing or invalid');
    return jsonError('Payment system not configured', 'STRIPE_CONFIG_ERROR', 500);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Auth (service-role acceptance deliberately DIVERGES from admin-trade-action) ──
  //
  // FIX-Task-34 item 4 (BP-87 rule 2): this function used to accept a service-role
  // caller only when the presented bearer was the EXACT string in this function's
  // injected `SUPABASE_SERVICE_ROLE_KEY`. That silently 401s every caller holding
  // the project's legacy service JWT (the key in p2p-kids-marketplace/.env, and the
  // one DB triggers post from admin_config) as soon as the injected env key becomes
  // a different string. Verified live 2026-09-14: that same key returned HTTP 200
  // from /rest/v1/admin_config while this function returned 401.
  //
  // The env comparison is kept as a cheap first check, and a credential that fails
  // it is VERIFIED against the project instead of string-compared (see
  // _shared/service-credential.ts). Security is unchanged: only a credential the
  // platform itself accepts as service-role passes, and every failure fails closed.
  let user: { id: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;
  const authHeader = (req.headers.get('Authorization') || '').trim();
  const apiKey = (req.headers.get('apikey') || '').trim();
  const adminApiKey = (req.headers.get('x-admin-api-key') || '').trim();
  const clientAdminSecret = (req.headers.get('x-admin-ui-secret') || '').trim();
  const cleanAuthHeader = authHeader.replace('Bearer ', '').trim();

  const matchesEnvKey = (v: string) => !!(supabaseServiceKey && v && v === supabaseServiceKey);
  const serviceKeyCandidate = [cleanAuthHeader, apiKey, adminApiKey].find((v) => v.length > 0) ?? '';
  const hasServiceRoleCredential =
    matchesEnvKey(cleanAuthHeader) ||
    matchesEnvKey(apiKey) ||
    matchesEnvKey(adminApiKey) ||
    (await isValidServiceCredential(supabaseUrl, serviceKeyCandidate));
  const hasValidAdminSecret = !!(adminUiSecret && clientAdminSecret === adminUiSecret);
  const hasAdminCredential = hasServiceRoleCredential || hasValidAdminSecret;
  console.log(
    `[trade-refund] auth: service_credential=${hasServiceRoleCredential} admin_secret=${hasValidAdminSecret}`,
  );

  if (hasAdminCredential) {
    user = { id: null, app_metadata: { role: 'admin' }, user_metadata: { is_admin: true } };
  } else {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authUser, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      console.error('[trade-refund] Auth error:', authError?.message || 'No user found');
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401);
    }
    user = authUser as unknown as typeof user;
  }

  const isAdmin = hasAdminCredential ||
    (user?.app_metadata?.role === 'admin') ||
    (user?.user_metadata?.role === 'admin') ||
    (user?.user_metadata?.is_admin === true);
  if (!isAdmin) {
    console.warn(`[trade-refund] Forbidden: user ${user?.id} is not an admin`);
    return jsonError('Forbidden: Admin access required', 'FORBIDDEN', 403);
  }

  // ── Parse + validate request ────────────────────────────────────────────
  let body: {
    trade_id?: string;
    refund_price_cents?: number;
    refund_fee_cents?: number;
    refund_tax_cents?: number;
    reason?: string;
    admin_user_id?: string | null;
    issue_refund?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body', 'INVALID_BODY', 400);
  }

  const {
    trade_id,
    refund_price_cents = 0,
    refund_fee_cents = 0,
    refund_tax_cents = 0,
    reason = 'Admin partial refund',
    admin_user_id,
    issue_refund = true,
  } = body;

  if (!trade_id) return jsonError('trade_id is required', 'MISSING_TRADE_ID', 400);

  const rp = Math.max(0, Math.round(refund_price_cents));
  const rf = Math.max(0, Math.round(refund_fee_cents));
  const rt = Math.max(0, Math.round(refund_tax_cents));
  const totalRefundCents = rp + rf + rt;
  if (totalRefundCents <= 0) {
    return jsonError('Refund amount must be greater than zero', 'INVALID_AMOUNT', 400);
  }
  const effectiveAdminId = (user?.id === null && admin_user_id) ? admin_user_id : user?.id ?? null;

  // ── Load trade + tax + payments ledger ──────────────────────────────────
  const { data: trade, error: tradeErr } = await adminClient
    .from('trades')
    .select('id, status, buyer_id, seller_id, listing_id, stripe_payment_intent_id, stripe_refund_id, cash_amount_cents, buyer_transaction_fee_cents, tax_amount_cents, sp_amount')
    .eq('id', trade_id)
    .single();
  if (tradeErr || !trade) {
    return jsonError('Trade not found', 'TRADE_NOT_FOUND', 404);
  }

  const { data: paymentRow } = await adminClient
    .from('payments')
    .select('id, refunded_price_cents, refunded_fee_cents, refunded_tax_cents, refunded_cents, total_charged_cents')
    .eq('trade_id', trade_id)
    .maybeSingle();

  const alreadyRefundedPrice = paymentRow?.refunded_price_cents ?? 0;
  const alreadyRefundedFee = paymentRow?.refunded_fee_cents ?? 0;
  const alreadyRefundedTax = paymentRow?.refunded_tax_cents ?? 0;

  const priceCollected = (trade as { cash_amount_cents: number }).cash_amount_cents;
  const feeCollected = (trade as { buyer_transaction_fee_cents: number }).buyer_transaction_fee_cents;
  const taxCollected = (trade as { tax_amount_cents: number }).tax_amount_cents;

  // Per-component remaining validation (server-side, mirrors DB RPC)
  if (rp > priceCollected - alreadyRefundedPrice) {
    return jsonError('Refund price exceeds remaining item price', 'REFUND_EXCEEDS_PRICE', 400, {
      collected: priceCollected, already_refunded: alreadyRefundedPrice,
    });
  }
  if (rf > feeCollected - alreadyRefundedFee) {
    return jsonError('Refund fee exceeds remaining platform fee', 'REFUND_EXCEEDS_FEE', 400, {
      collected: feeCollected, already_refunded: alreadyRefundedFee,
    });
  }
  if (rt > taxCollected - alreadyRefundedTax) {
    return jsonError('Refund tax exceeds remaining sales tax', 'REFUND_EXCEEDS_TAX', 400, {
      collected: taxCollected, already_refunded: alreadyRefundedTax,
    });
  }

  const piId = (trade as { stripe_payment_intent_id: string | null }).stripe_payment_intent_id;

  // ── Issue Stripe refund / cancel (skip if issue_refund=false) ───────────
  let stripeRefundId: string | null = null;
  let stripeRefundStatus = 'succeeded';
  let stripeAction = 'none';

  if (issue_refund && piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);

      if (pi.status === 'requires_capture' || pi.status === 'processing') {
        // Uncaptured authorization — cancel the whole hold (can't partially cancel).
        const cancelled = await stripe.paymentIntents.cancel(piId, { cancellation_reason: 'requested_by_customer' });
        stripeRefundId = `cancelled_${cancelled.id}`;
        stripeRefundStatus = 'succeeded';
        stripeAction = 'cancelled_uncaptured';
        console.log(`[trade-refund] PI ${piId} cancelled (uncaptured) for trade ${trade_id}`);
      } else if (pi.status === 'succeeded') {
        // Captured payment — issue a PARTIAL refund for the selected amount.
        // DEV-TASK-6 (2026-08-27): content-derived idempotency key so a timeout-retry
        // of the SAME partial refund (same price/fee/tax amounts) is deduped by Stripe,
        // while a distinct partial refund (different amounts) gets a different key.
        // STRIPE-IDEMPOTENCY-FIX: key must be the OPTIONS arg, never inside params (BP-65).
        const refund = await stripe.refunds.create(
          {
            payment_intent: piId,
            amount: totalRefundCents,
            reason: 'requested_by_customer',
            metadata: {
              supabase_trade_id: trade_id,
              admin_action: 'partial_refund',
              admin_user_id: effectiveAdminId ?? '',
              refund_price_cents: String(rp),
              refund_fee_cents: String(rf),
              refund_tax_cents: String(rt),
            },
          },
          { idempotencyKey: `refund_${trade_id}_${hashContent(rp, rf, rt)}` },
        );
        stripeRefundId = refund.id;
        stripeRefundStatus = refund.status;
        stripeAction = 'refunded';
        console.log(`[trade-refund] Partial Stripe refund ${refund.id} (amount=${totalRefundCents}, status=${refund.status}) for trade ${trade_id}`);
      } else {
        // canceled / requires_payment_method / etc — nothing to refund
        console.log(`[trade-refund] PI ${piId} status is ${pi.status} — no refund/cancel issued`);
        stripeRefundStatus = 'noop';
        stripeAction = 'none';
      }
    } catch (stripeErr: unknown) {
      const msg = (stripeErr as { message?: string }).message ?? 'Stripe refund failed';
      console.error(`[trade-refund] Stripe error for trade ${trade_id}:`, msg);
      return jsonError(`Stripe refund failed: ${msg}`, 'STRIPE_REFUND_FAILED', 502);
    }
  } else {
    // Zero-cash / donate trade, or issue_refund=false — record DB-side only.
    stripeAction = piId ? 'skip' : 'no_pi';
  }

  // ── Atomic DB record ────────────────────────────────────────────────────
  // FIX-Task-32 item 3 (2026-09-14): branch on the Stripe action — the long
  // rationale lives in _shared/refund-decision.ts. When the PI was still an
  // UNCAPTURED authorization hold we CANCELLED it, so no money ever moved: the
  // ledger leg is a VOID (void the tax record + mark the payment row cancelled,
  // writing NO `refunded_*`), never a refund for money that was never charged.
  const ledgerLeg = classifyRefundLedgerLeg(stripeAction);

  let rpcData: any = null;

  if (ledgerLeg === 'void_uncaptured') {
    const { data: voidData, error: voidErr } = await adminClient.rpc('rpc_void_uncaptured_payment', {
      p_trade_id: trade_id,
      p_reason: reason,
    });

    if (voidErr) {
      console.error(`[trade-refund] rpc_void_uncaptured_payment error:`, voidErr.message);
      return jsonError('Failed to void the uncaptured hold', 'VOID_UNCAPTURED_FAILED', 500, {
        stripe_refund_id: stripeRefundId,
      });
    }
    if (voidData?.success === false) {
      console.error(`[trade-refund] void RPC rejected:`, voidData);
      return jsonError(
        voidData?.error?.message ?? 'Failed to void the uncaptured hold',
        voidData?.error?.code ?? 'VOID_UNCAPTURED_REJECTED',
        409,
        voidData ?? undefined,
      );
    }

    rpcData = {
      success: true,
      action: 'voided_uncaptured',
      refunded_cents: 0,
      tax_result: voidData?.tax_result ?? null,
    };
    console.log(
      `[trade-refund] PI ${piId} was cancelled (uncaptured) — tax voided and payment marked cancelled for trade ${trade_id}; NO refund recorded`,
    );
  } else {
    const { data: refundData, error: rpcErr } = await adminClient.rpc('rpc_record_payment_refund', {
      p_trade_id: trade_id,
      p_stripe_refund_id: stripeRefundId,
      p_refund_price_cents: rp,
      p_refund_fee_cents: rf,
      p_refund_tax_cents: rt,
      p_reason: reason,
      p_initiating_actor: 'admin',
      p_refund_status: stripeRefundStatus === 'noop' ? 'canceled' : stripeRefundStatus,
    });

    if (rpcErr) {
      console.error(`[trade-refund] rpc_record_payment_refund error:`, rpcErr.message);
      return jsonError('Failed to record refund', 'REFUND_RECORD_FAILED', 500, { stripe_refund_id: stripeRefundId });
    }
    if (!refundData?.success) {
      console.error(`[trade-refund] RPC rejected:`, refundData);
      return jsonError(
        refundData?.message ?? 'Refund rejected',
        refundData?.code ?? 'REFUND_REJECTED',
        409,
        refundData ?? undefined,
      );
    }
    rpcData = refundData;
  }

  // N2 — Idempotency & Audit: refund issued (keyed by Stripe refund id so a
  // retry of the SAME refund can never double-log, while distinct partial refunds
  // each get their own row).
  logFinancialAudit(adminClient, {
    mutationType: stripeAction === 'cancelled_uncaptured' ? 'payment_cancelled' : 'refund_issued',
    entityType: 'trade',
    entityId: trade_id,
    actorId: effectiveAdminId ?? null,
    afterState: {
      stripe_refund_id: stripeRefundId,
      refund_price_cents: rp,
      refund_fee_cents: rf,
      refund_tax_cents: rt,
      status: stripeRefundStatus,
      stripe_action: stripeAction,
    },
    amountCents: totalRefundCents,
    idempotencyKey: stripeRefundId ? `refund_${stripeRefundId}` : `refund_${trade_id}_noop`,
  });
  if (ledgerLeg === 'void_uncaptured') {
    // FIX-Task-32 item 3: the tax leg was VOIDED, not refunded — audit it as such
    // so the financial trail never claims a refund for money that never moved.
    logFinancialAudit(adminClient, {
      mutationType: 'tax_voided',
      entityType: 'trade',
      entityId: trade_id,
      actorId: effectiveAdminId ?? null,
      afterState: {
        voided_tax_cents: rt,
        stripe_refund_id: stripeRefundId,
        stripe_action: stripeAction,
      },
      amountCents: rt,
      idempotencyKey: `tax_voided_${trade_id}`,
    });
  } else if (rt > 0) {
    logFinancialAudit(adminClient, {
      mutationType: 'tax_refunded',
      entityType: 'trade',
      entityId: trade_id,
      actorId: effectiveAdminId ?? null,
      afterState: { refund_tax_cents: rt, stripe_refund_id: stripeRefundId },
      amountCents: rt,
      idempotencyKey: stripeRefundId ? `tax_refunded_${stripeRefundId}` : `tax_refunded_${trade_id}_noop`,
    });
  }

  // ── Audit log ───────────────────────────────────────────────────────────
  try {
    await adminClient.from('admin_audit_logs').insert({
      actor_id: effectiveAdminId,
      action_type: 'manual_refund',
      entity_type: 'trade',
      entity_id: trade_id,
      reason,
      payload: {
        stripe_refund_id: stripeRefundId,
        refund_price_cents: rp,
        refund_fee_cents: rf,
        refund_tax_cents: rt,
        total_refund_cents: totalRefundCents,
        stripe_action: stripeAction,
        ledger_leg: ledgerLeg,
      },
    });
  } catch (auditErr) {
    console.error('[trade-refund] audit log insert failed (non-fatal):', (auditErr as { message?: string }).message);
  }

  return jsonOk({
    trade_id,
    stripe_refund_id: stripeRefundId,
    stripe_action: stripeAction,
    ledger_leg: ledgerLeg,
    refund_price_cents: rp,
    refund_fee_cents: rf,
    refund_tax_cents: rt,
    total_refund_cents: totalRefundCents,
    ledger: rpcData,
  });
});
