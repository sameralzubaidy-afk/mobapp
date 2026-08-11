// File: supabase/functions/trade-extension/index.ts
// R15 — Re-Authorization on Extension (Wave 7, Post-Day-1)
//
// Either party (buyer or seller) may request ONE extra-time extension during the
// post-acceptance PICKUP WINDOW (trade.status = 'in_progress'). The request is
// sent to the counterparty, who must accept within `extension_response_window_hours`
// (default 4h). On mutual acceptance the existing Stripe payment hold is VOIDED
// and a brand-new authorization is placed (fresh PaymentIntent with manual
// capture, fresh 7-day authorization window, fresh pickup deadline). On explicit
// denial, 4h timeout (handled by the process-extension-timeouts cron), or
// re-authorization failure, the trade immediately AUTO-CANCELS and the hold is
// released through the SAME shared path R2's expiry flows use
// (`rpc_auto_cancel_trade` → status='cancelled' + `rpc_void_tax_for_trade`;
// existing triggers fire SP release + notifications). Exactly ONE extension per
// trade — any second request is rejected regardless of outcome.
//
// Auth: user JWT + anon key (participants only; RPCs are SECURITY DEFINER and
// re-validate participant + state + one-time-use). Service role is used for the
// Stripe + DB mutations after the participant checks below.
//
// Input:  { action: 'request' | 'accept' | 'decline', trade_id, payment_method_id? }
//   - request:  opens the request + notifies the counterparty (extension_requested)
//   - accept:   voids the old hold, places a fresh authorization, grants the
//               extension (payment_method_id required) + notifies the requester
//               (extension_accepted); on re-auth failure auto-cancels + notifies
//   - decline:  cancels the old hold, auto-cancels the trade + notifies the
//               requester (extension_denied)
// Output: { success: true, data } | { success: false, error: { code, message } }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// NOTE (BP-41, 2026-08-10): logFinancialAudit + FinancialMutationType +
// FinancialAuditInput are INLINED below from ../_shared/audit.ts (kept in sync)
// because the MCP deploy bundler cannot resolve ../_shared/* relative imports
// (same canonical pattern as create-trade-offer).

// ── inlined from ../_shared/audit.ts ──────────────────────────────────────
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
  | 'trade_completed'
  // N3 (2026-08-10): dispute evidence packaged + staged via the Stripe Disputes
  // API (submit=false). Additive union member — old callers unaffected.
  | 'dispute_evidence_staged'
  // R15 (2026-08-10): trade-extension re-authorization — a DISTINCT event from the
  // original authorization (payment_intent_created), with its own idempotency key
  // (extension_reauth_<tradeId>) so a retry never double-logs the void+fresh-auth.
  | 'trade_extension_reauth'
  | 'extension_requested';

interface FinancialAuditInput {
  mutationType: FinancialMutationType;
  entityType?: string;
  entityId?: string | null;
  actorId?: string | null;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  amountCents?: number | null;
  idempotencyKey?: string | null;
  nodeId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditClient = { rpc: (fn: string, args: Record<string, unknown>) => any };

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
// ── end inlined from ../_shared/audit.ts ──────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errResp(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function okResp(payload: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({ success: true, ...payload }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// R15 notification copy (also mirrored in send-trade-notifications EVENT_COPY).
const EVENT_TITLES: Record<string, string> = {
  extension_requested: 'Extension Request',
  extension_accepted: 'Extension Granted',
  extension_denied: 'Extension Declined',
  extension_auto_denied: 'Extension Request Expired',
  extension_reauth_failed: 'Extension Could Not Be Confirmed',
  trade_cancelled: 'Trade Cancelled',
};

function buildBody(eventType: string, data?: Record<string, unknown>): string {
  const title = data?.listing_title ? `"${data.listing_title}"` : 'this item';
  switch (eventType) {
    case 'extension_requested':
      return `The other party asked for more time to complete pickup on ${title}. Respond within 4 hours or the request expires.`;
    case 'extension_accepted':
      return `Your request to extend the pickup window on ${title} was accepted. You now have until ${data?.auto_complete_at_label ?? 'the new deadline'} to complete the trade.`;
    case 'extension_denied':
      return `Your request to extend the pickup window on ${title} was declined, so the trade was cancelled.`;
    case 'extension_auto_denied':
      return `Your request to extend the pickup window on ${title} timed out (no response), so the trade was cancelled.`;
    case 'extension_reauth_failed':
      return `We couldn't place a new payment hold to extend the pickup window on ${title}, so the trade was cancelled.`;
    case 'trade_cancelled':
      return `The trade for ${title} was cancelled because an extension request was not confirmed.`;
    default:
      return 'There is an update on your trade.';
  }
}

interface NotifyItem {
  trade_id: string;
  event_type: string;
  recipient_user_id: string;
  extra_data?: Record<string, unknown>;
}

/** R2 reminder-system reuse: in-app via create_trade_notification + push via
 *  send-trade-notifications (BP-17: check sent > 0; never trust resp.ok alone). */
async function sendNotifications(
  supabaseUrl: string,
  serviceRoleKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svcClient: any,
  notifications: NotifyItem[],
): Promise<void> {
  for (const n of notifications) {
    try {
      await svcClient.rpc('create_trade_notification', {
        p_user_id: n.recipient_user_id,
        p_notification_type: n.event_type,
        p_title: EVENT_TITLES[n.event_type] ?? 'Trade Update',
        p_body: buildBody(n.event_type, n.extra_data),
        p_data: JSON.stringify({ trade_id: n.trade_id, type: n.event_type, ...(n.extra_data ?? {}) }),
      });
    } catch (err) {
      console.warn('[trade-extension] in-app notification error', n.event_type, n.trade_id, err);
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-trade-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify(n),
      });
      if (!resp.ok) {
        console.warn('[trade-extension] push failed', n.event_type, n.trade_id, resp.status);
      } else {
        const result = await resp.json().catch(() => ({}));
        if ((result?.sent ?? -1) === 0) {
          console.warn('[trade-extension] push NOT delivered (no tokens or push failed)', n.event_type, n.trade_id);
        }
      }
    } catch (err) {
      console.warn('[trade-extension] push error', n.event_type, n.trade_id, err);
    }
  }
}

/** Resolve + attach the buyer's saved payment method to their canonical Stripe
 *  customer (mirrors create-trade-offer, incl. customer-drift recovery). */
async function ensurePaymentMethod(
  stripe: Stripe,
  pmId: string,
  customerId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer === null) {
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
    } else if (pm.customer !== customerId) {
      try {
        await stripe.paymentMethods.detach(pmId);
      } catch (detachErr: unknown) {
        console.warn('[trade-extension] pm detach error:', detachErr);
        return { ok: false, code: 'INVALID_PAYMENT_METHOD', message: 'Payment method not found on your account' };
      }
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
    }
    return { ok: true };
  } catch (err: unknown) {
    console.warn('[trade-extension] pm verify error:', err);
    return { ok: false, code: 'INVALID_PAYMENT_METHOD', message: 'Payment method is invalid or expired' };
  }
}

/** Void an uncaptured pre-auth hold if it is still cancellable (shared R2 idiom). */
async function voidHeldPayment(stripe: Stripe, piId: string | null): Promise<void> {
  if (!piId) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(pi.status)) {
      await stripe.paymentIntents.cancel(piId);
      console.log(`[trade-extension] old PI ${piId} cancelled (void + re-authorize)`);
    }
  } catch (err: unknown) {
    // Non-fatal: an already-cancelled/captured PI is fine — the trade state machine
    // + rpc_auto_cancel_trade handle the outcome.
    console.warn('[trade-extension] old PI void error (non-fatal):', err instanceof Error ? err.message : err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errResp(405, 'METHOD_NOT_ALLOWED', 'POST required');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseSvcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSvcKey) {
    return errResp(500, 'CONFIG_ERROR', 'Server configuration error');
  }

  // ── Auth: user JWT (participant-only flow) ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return errResp(401, 'UNAUTHORIZED', 'Invalid or missing auth token');

  let body: { action?: string; trade_id?: string; payment_method_id?: string };
  try { body = await req.json(); } catch { return errResp(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const { action, trade_id } = body;
  if (!trade_id) return errResp(400, 'MISSING_TRADE_ID', 'trade_id is required');
  if (action !== 'request' && action !== 'accept' && action !== 'decline') {
    return errResp(400, 'INVALID_ACTION', "action must be 'request', 'accept' or 'decline'");
  }

  const svcClient = createClient(supabaseUrl, supabaseSvcKey);
  const requestId = crypto.randomUUID();
  console.log(`[trade-extension] req=${requestId} action=${action} trade=${trade_id} user=${user.id}`);

  // ── Load trade (service role; participant + state checks below) ──
  const { data: trade, error: tradeErr } = await svcClient
    .from('trades')
    .select('id, status, buyer_id, seller_id, listing_id, stripe_payment_intent_id, cash_amount_cents, tax_amount_cents, sp_amount, auto_complete_at, extension_status, extension_requested_by, extension_granted_at, extension_request_expires_at')
    .eq('id', trade_id)
    .single();

  if (tradeErr || !trade) return errResp(404, 'TRADE_NOT_FOUND', 'We couldn\'t find this trade.');
  if (trade.buyer_id !== user.id && trade.seller_id !== user.id) {
    return errResp(403, 'FORBIDDEN', 'You are not a participant in this trade.');
  }

  // ── R15-1: pickup window only ──
  if (trade.status !== 'in_progress') {
    return errResp(400, 'INVALID_STATE', 'Extensions can only be requested during the pickup window (after the offer is accepted).');
  }

  // ── R15-3: exactly one extension per trade (any prior activity blocks) ──
  if (trade.extension_status !== null) {
    return errResp(409, 'EXTENSION_ALREADY_USED', 'This trade has already used its one extension.');
  }

  if (action === 'request') {
    // Idempotent duplicate: a concurrent double-tap returns the same pending request.
    if (trade.extension_status === 'requested') {
      return okResp({
        data: {
          extension_status: 'requested',
          extension_request_expires_at: trade.extension_request_expires_at,
          idempotent: true,
        },
      });
    }

    const { data: rpcData, error: rpcErr } = await svcClient.rpc('rpc_request_trade_extension', {
      p_trade_id: trade_id,
      p_requester_id: user.id,
    });
    if (rpcErr) {
      console.error('[trade-extension] request RPC error', rpcErr.message);
      return errResp(500, 'RPC_FAILED', 'Could not request an extension. Please try again.');
    }
    const rpc = rpcData as { success: boolean; error?: { code: string; message: string }; data?: Record<string, unknown> };
    if (!rpc.success) {
      return errResp(rpc.error?.code === 'EXTENSION_ALREADY_USED' ? 409 : 400, rpc.error?.code ?? 'REQUEST_FAILED', rpc.error?.message ?? 'Could not request an extension.');
    }

    const data = rpc.data ?? {};
    const counterpartyId = (data.counterparty_id as string) ?? (trade.buyer_id === user.id ? trade.seller_id : trade.buyer_id);
    const listingTitle = await resolveListingTitle(svcClient, trade.listing_id);

    // R15-5: notify the counterparty the moment the request is made.
    await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
      {
        trade_id: trade_id,
        event_type: 'extension_requested',
        recipient_user_id: counterpartyId,
        extra_data: { listing_title: listingTitle, expires_at: data.extension_request_expires_at },
      },
    ]);

    return okResp({ data });
  }

  // ── accept / decline: only the COUNTERPARTY may respond, and only to a pending request ──
  if (trade.extension_status !== 'requested') {
    return errResp(409, 'NO_PENDING_REQUEST', 'There is no pending extension request on this trade.');
  }
  if (trade.extension_requested_by === user.id) {
    return errResp(400, 'CANNOT_SELF_RESPOND', 'You cannot respond to your own extension request.');
  }

  const requesterId = trade.extension_requested_by;
  const counterpartyId = user.id;
  const listingTitle = await resolveListingTitle(svcClient, trade.listing_id);

  if (action === 'decline') {
    const stripe = stripeKey.startsWith('sk_') ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;

    // Release the payment hold (shared R2 idiom) before cancelling the trade.
    if (stripe) {
      await voidHeldPayment(stripe, trade.stripe_payment_intent_id);
    }

    // Record the explicit denial.
    await svcClient
      .from('trades')
      .update({ extension_status: 'denied', extension_responded_by: user.id, extension_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', trade_id)
      .eq('extension_status', 'requested');

    // R15-6: auto-cancel + release through the SHARED R2 path (voids tax, triggers
    // SP release + notifications). Idempotent.
    await svcClient.rpc('rpc_auto_cancel_trade', {
      p_trade_id: trade_id,
      p_reason: 'extension_denied',
    });

    // R15-5/8: notify requester (extension_denied) + counterparty (trade_cancelled).
    await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
      {
        trade_id,
        event_type: 'extension_denied',
        recipient_user_id: requesterId,
        extra_data: { listing_title: listingTitle },
      },
      {
        trade_id,
        event_type: 'trade_cancelled',
        recipient_user_id: counterpartyId,
        extra_data: { listing_title: listingTitle },
      },
    ]);

    logFinancialAudit(svcClient, {
      mutationType: 'trade_cancelled',
      entityType: 'trade',
      entityId: trade_id,
      actorId: user.id,
      afterState: { reason: 'extension_denied', status: 'cancelled' },
      idempotencyKey: `trade_cancelled_extension_denied_${trade_id}`,
    });

    return okResp({ data: { status: 'cancelled', cancellation_reason: 'extension_denied' } });
  }

  // ── ACCEPT: void old hold + place a FRESH authorization ──
  const amountCents = (trade.cash_amount_cents ?? 0) + (trade.tax_amount_cents ?? 0);

  if (amountCents <= 0) {
    // Zero-cash trade (e.g. donation) — no Stripe hold exists to re-authorize.
    // Grant the extension by pushing the pickup deadline directly (single-table,
    // guarded update; participant/one-time checks already passed above).
    const extensionWindowHours = await readConfigInt(svcClient, 'extension_window_hours', 72);
    const newAutoCompleteAt = new Date(Date.now() + extensionWindowHours * 60 * 60 * 1000).toISOString();
    const { error: grantErr } = await svcClient
      .from('trades')
      .update({
        extension_status: 'accepted',
        extension_granted_at: new Date().toISOString(),
        extension_responded_by: user.id,
        extension_responded_at: new Date().toISOString(),
        auto_complete_at: newAutoCompleteAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trade_id)
      .eq('extension_status', 'requested');

    if (grantErr) {
      console.error('[trade-extension] zero-cash grant error', grantErr.message);
      return errResp(500, 'UPDATE_FAILED', 'Could not grant the extension. Please try again.');
    }

    logFinancialAudit(svcClient, {
      mutationType: 'trade_extension_reauth',
      entityType: 'trade',
      entityId: trade_id,
      actorId: user.id,
      beforeState: { auto_complete_at: trade.auto_complete_at, has_hold: false },
      afterState: { auto_complete_at: newAutoCompleteAt, extension_status: 'accepted' },
      amountCents: 0,
      idempotencyKey: `extension_reauth_${trade_id}`,
    });

    await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
      {
        trade_id,
        event_type: 'extension_accepted',
        recipient_user_id: requesterId,
        extra_data: { listing_title: listingTitle, auto_complete_at_label: new Date(newAutoCompleteAt).toLocaleString() },
      },
    ]);

    return okResp({ data: { extension_status: 'accepted', auto_complete_at: newAutoCompleteAt } });
  }

  // ── Cash trade: void old hold + fresh authorization ──
  if (!stripeKey.startsWith('sk_')) {
    return errResp(500, 'STRIPE_NOT_CONFIGURED', 'Payments are not configured right now. Please try again later.');
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const paymentMethodId = body.payment_method_id;
  if (!paymentMethodId) {
    return errResp(400, 'NO_PAYMENT_METHOD', 'A saved payment method is required to extend the pickup window.');
  }

  // Buyer's canonical Stripe customer (mirror create-trade-offer).
  const { data: subRow } = await svcClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', trade.buyer_id)
    .maybeSingle();
  const stripeCustomerId = (subRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    return errResp(400, 'NO_STRIPE_CUSTOMER', 'No Stripe customer found. Please add a payment method first.');
  }

  const pmCheck = await ensurePaymentMethod(stripe, paymentMethodId, stripeCustomerId);
  if (!pmCheck.ok) return errResp(400, pmCheck.code, pmCheck.message);

  // 1) Void the existing hold.
  await voidHeldPayment(stripe, trade.stripe_payment_intent_id);

  // 2) Place a FRESH authorization (manual capture, off_session, new idempotency key).
  let newPiId: string | null = null;
  try {
    const piKey = `pi_ext_${trade_id}`;
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      capture_method: 'manual',
      off_session: true,
      confirm: true,
      idempotencyKey: piKey,
      description: `Kids P2P · extension re-auth · ${trade_id.slice(0, 8)}`,
      metadata: {
        type: 'trade_extension_hold',
        trade_id,
        request_id: requestId,
        original_pi: trade.stripe_payment_intent_id ?? '',
        item_price_cents: String(trade.cash_amount_cents ?? 0),
        tax_amount_cents: String(trade.tax_amount_cents ?? 0),
        sp_amount: String(trade.sp_amount ?? 0),
        idempotency_key: piKey,
      },
    });
    if (pi.status !== 'requires_capture') {
      const declineMsg = pi.last_payment_error?.message ?? 'Your card was declined. Please try another card.';
      console.warn('[trade-extension] fresh PI not requires_capture', pi.status, declineMsg);
      // R15-6: re-auth failed → auto-cancel + release.
      await svcClient
        .from('trades')
        .update({ extension_status: 'reauth_failed', extension_responded_by: user.id, extension_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', trade_id)
        .eq('extension_status', 'requested');
      await svcClient.rpc('rpc_auto_cancel_trade', { p_trade_id: trade_id, p_reason: 'extension_reauth_failed' });
      await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
        { trade_id, event_type: 'extension_reauth_failed', recipient_user_id: requesterId, extra_data: { listing_title: listingTitle } },
        { trade_id, event_type: 'trade_cancelled', recipient_user_id: counterpartyId, extra_data: { listing_title: listingTitle } },
      ]);
      return errResp(402, 'STRIPE_HOLD_FAILED', declineMsg);
    }
    newPiId = pi.id;
    console.log(`[trade-extension] fresh PI ${newPiId} requires_capture for trade ${trade_id} (old ${trade.stripe_payment_intent_id} voided)`);
  } catch (err: unknown) {
    const stripeErr = err as { raw?: { message?: string }; message?: string };
    const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Payment hold failed';
    console.error('[trade-extension] fresh PI error', msg);
    // R15-6: re-auth failed → auto-cancel + release.
    await svcClient
      .from('trades')
      .update({ extension_status: 'reauth_failed', extension_responded_by: user.id, extension_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', trade_id)
      .eq('extension_status', 'requested');
    await svcClient.rpc('rpc_auto_cancel_trade', { p_trade_id: trade_id, p_reason: 'extension_reauth_failed' });
    await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
      { trade_id, event_type: 'extension_reauth_failed', recipient_user_id: requesterId, extra_data: { listing_title: listingTitle } },
      { trade_id, event_type: 'trade_cancelled', recipient_user_id: counterpartyId, extra_data: { listing_title: listingTitle } },
    ]);
    return errResp(402, 'STRIPE_HOLD_FAILED', msg);
  }

  // 3) Commit the grant atomically (guards + PI swap + fresh clocks + N2 audit).
  const { data: applyData, error: applyErr } = await svcClient.rpc('rpc_apply_trade_extension', {
    p_trade_id: trade_id,
    p_actor_id: user.id,
    p_new_pi_id: newPiId,
    p_new_pi_amount_cents: amountCents,
  });
  if (applyErr) {
    console.error('[trade-extension] apply RPC error', applyErr.message);
    // The fresh PI exists but the grant failed to commit — cancel the trade to
    // release both the old (voided) and new holds; trade stays consistent.
    await svcClient.rpc('rpc_auto_cancel_trade', { p_trade_id: trade_id, p_reason: 'extension_reauth_failed' });
    return errResp(500, 'APPLY_FAILED', 'Could not finalize the extension. Please try again.');
  }
  const apply = applyData as { success: boolean; error?: { code: string; message: string }; data?: Record<string, unknown> };
  if (!apply.success) {
    // Guard failure (e.g. race) — cancel to keep the holds consistent.
    await svcClient.rpc('rpc_auto_cancel_trade', { p_trade_id: trade_id, p_reason: 'extension_reauth_failed' });
    return errResp(409, apply.error?.code ?? 'APPLY_REJECTED', apply.error?.message ?? 'Could not grant the extension.');
  }

  // R15-5: notify the requester that the extension was granted.
  const applyDataVal = apply.data ?? {};
  await sendNotifications(supabaseUrl, supabaseSvcKey, svcClient, [
    {
      trade_id,
      event_type: 'extension_accepted',
      recipient_user_id: requesterId,
      extra_data: {
        listing_title: listingTitle,
        auto_complete_at: applyDataVal.auto_complete_at,
        auto_complete_at_label: applyDataVal.auto_complete_at ? new Date(applyDataVal.auto_complete_at as string).toLocaleString() : undefined,
      },
    },
  ]);

  return okResp({ data: apply.data });
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function resolveListingTitle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svcClient: any,
  listingId: string | null,
): Promise<string> {
  if (!listingId) return '';
  try {
    const { data } = await svcClient.from('items').select('title').eq('id', listingId).maybeSingle();
    return (data as { title?: string } | null)?.title ?? '';
  } catch {
    return '';
  }
}

async function readConfigInt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svcClient: any,
  key: string,
  fallback: number,
): Promise<number> {
  try {
    const { data } = await svcClient.from('admin_config').select('value').eq('key', key).maybeSingle();
    const parsed = Number((data as { value?: string } | null)?.value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}
