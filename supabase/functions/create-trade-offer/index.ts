// File: supabase/functions/create-trade-offer/index.ts
// TFV2-012A (D-30 CRITICAL): Atomic offer creation with Stripe pre-authorization hold + SP soft-reserve.
//
// Flow:
//   1. JWT validation + buyer lookup
//   2. Item validation (available, not self-purchase)
//   3. Duplicate active offer check (same buyer + listing)
//   4. Max 3 pending offers PER SELLER check (2026-07-18) — bundle counts as 1 slot
//   5. Validate buyer Stripe payment method (D-30)
//   6. Create Stripe PaymentIntent with capture_method='manual' (pre-auth, not captured)
//   7. Insert trade record (triggers fn_reserve_sp_on_offer automatically via DB trigger)
//   8. Rollback: if trade insert fails → cancel Stripe PI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';

// NOTE (BP-41, 2026-08-09): logTradeEvent, resolveSellerProfile, logFinancialAudit
// are INLINED below from their ../_shared/* sources (kept in sync) because the
// MCP deploy bundler cannot resolve ../_shared/* relative imports.

// ── inlined from ../_shared/trade-events.ts ────────────────────────────────
type TradeEventType =
  | 'offer_submitted'
  | 'offer_accepted'
  | 'offer_cancelled'
  | 'seller_cancelled'
  | 'trade_completed'
  | 'trade_disputed'
  | 'payment_captured'
  | 'payment_failed'
  | 'payout_initiated'
  | 'payout_sent'
  | 'payout_failed';

async function logTradeEvent(
  supabase: { from: (table: string) => any },
  tradeId: string,
  eventType: TradeEventType,
  actorId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.from('trade_events').insert({
      trade_id: tradeId,
      event_type: eventType,
      actor_id: actorId,
      metadata: metadata ?? {},
    });
    if (error) {
      console.warn(`[logTradeEvent] failed to write event=${eventType} trade=${tradeId}:`, error.message);
    }
  } catch (err) {
    console.warn(`[logTradeEvent] unexpected error:`, err);
  }
}

// ── inlined from ../_shared/node.ts ────────────────────────────────────────
interface SellerProfile {
  user_id: string | null;
  node_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSellerProfile(client: any, sellerId: string): Promise<SellerProfile | null> {
  const { data } = await client
    .from('profiles')
    .select('user_id, node_id')
    .or(`user_id.eq.${sellerId},id.eq.${sellerId}`)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    user_id: (data as { user_id?: string | null }).user_id ?? null,
    node_id: (data as { node_id?: string | null }).node_id ?? null,
  };
}

// ── inlined from ../_shared/audit.ts ───────────────────────────────────────
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
async function logFinancialAudit(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => any },
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

// N2 — Idempotency & Audit: deterministic content hash used to build a stable
// Stripe idempotency key per offer attempt. Two identical double-taps produce the
// same key (Stripe dedupes to a single PaymentIntent); a legitimately different
// offer (different SP/amount) produces a different key. djb2 — fast, stable, and
// only used to build a key string, never for crypto.
function hashContent(...parts: Array<string | number>): string {
  let h = 5381;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
  }
  return h.toString(36);
}

// D-31 (Option B, 2026-07-18): Supabase Edge Runtime global for background tasks.
// Not part of default Deno types, so it's declared here. See docs/flow-registry.md
// FLOW-08 D-31 entry for the full background-processing design.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// PER-SELLER CAP (2026-07-18): Buyer can have max N pending offers per seller,
// where N is read live from admin_config.max_pending_offers_per_seller.
// A bundle offer (multiple items from the same seller) counts as 1 slot.
// Expired offers free the slot immediately (status changes to 'cancelled').
// No hardcoded fallback — if config is unavailable, offer submission is rejected
// with a clear error rather than silently using a stale default.

/**
 * Read max_pending_offers_per_seller from admin_config at runtime.
 * Must be called fresh per request — no caching, so admin changes take effect immediately.
 * Returns the cap value (1-10) or throws a structured error.
 */
async function getMaxPendingOffersPerSeller(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
): Promise<number> {
  const { data, error } = await supabaseClient
    .from('admin_config')
    .select('value')
    .eq('key', 'max_pending_offers_per_seller')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('[create-trade-offer] Failed to read max_pending_offers_per_seller from admin_config:', error);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Offer limit configuration is unavailable. Please try again.' };
  }

  const row = data as { value: string };
  const parsed = parseInt(row.value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    console.error('[create-trade-offer] Invalid max_pending_offers_per_seller value:', row.value);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Offer limit configuration is invalid. Please contact support.' };
  }

  return parsed;
}

/**
 * Count pending offer SLOTS for a buyer-seller pair.
 *
 * A "slot" is one pending offer:
 *   - Single-item offer (bundle_id IS NULL) = 1 slot
 *   - Bundle offer (items sharing same bundle_id) = 1 slot total, regardless of item count
 *
 * Never use simple row count for this — that would count N items in a bundle as N slots.
 */
async function countPendingSlotsForSeller(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  buyerId: string,
  sellerId: string,
): Promise<number> {
  const { data: pendingTrades, error } = await supabaseClient
    .from('trades')
    .select('id, bundle_id')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .eq('status', 'pending');

  if (error) {
    console.error('[create-trade-offer] Failed to count pending slots:', error);
    throw { code: 'COUNT_FAILED', message: 'Failed to check pending offer count.' };
  }

  // Deduplicate by bundle_id: same bundle = 1 slot. Null bundle_id = each its own slot.
  const uniqueSlots = new Set<string>();
  for (const row of pendingTrades ?? []) {
    uniqueSlots.add(row.bundle_id ?? row.id);
  }
  return uniqueSlots.size;
}

/**
 * Read seller fee config from admin_config at runtime.
 * Returns the base seller percentage and both discount percentages (freemium, KC+).
 */
async function getSellerFeeConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
): Promise<{ basePct: number; discountFreePct: number; discountKcpPct: number }> {
  // BP-11 (2026-07-27): Direct key lookup — NEVER rely on is_active filter
  // because secure_upsert_admin_config may not set is_active = true on upsert.
  // Since admin_config.key has a UNIQUE constraint, omitting the is_active filter
  // is safe — at most one row per key.
  const { data, error } = await supabaseClient
    .from('admin_config')
    .select('key, value')
    .in('key', [
      'platform_fee_seller_percentage',
      'platform_fee_seller_discount_percentage_freemium',
      'platform_fee_seller_discount_percentage_kids_club_plus',
    ]);

  if (error) {
    console.error('[create-trade-offer] Failed to read seller fee config:', error);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Fee configuration is unavailable. Please try again.' };
  }

  const configMap: Record<string, string> = {};
  for (const row of data ?? []) {
    configMap[row.key] = row.value;
  }

  const basePctStr = configMap['platform_fee_seller_percentage'];
  if (!basePctStr) {
    console.warn('[create-trade-offer] platform_fee_seller_percentage not found in admin_config, defaulting to 0');
    return { basePct: 0, discountFreePct: 0, discountKcpPct: 0 };
  }

  const basePct = parseInt(basePctStr, 10);
  if (!Number.isFinite(basePct) || basePct < 0 || basePct > 100) {
    console.error('[create-trade-offer] Invalid platform_fee_seller_percentage:', basePctStr);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Seller fee configuration is invalid. Please contact support.' };
  }

  const discountFreePct = parseInt(configMap['platform_fee_seller_discount_percentage_freemium'] ?? '0', 10);
  const discountKcpPct = parseInt(configMap['platform_fee_seller_discount_percentage_kids_club_plus'] ?? '0', 10);

  return { basePct, discountFreePct, discountKcpPct };
}

/**
 * Calculate seller transaction fee in cents.
 * SEL-FEE-SEMANTICS (2026-07-27): Config fields are now interpreted as ABSOLUTE percentages per tier:
 * - platform_fee_seller_percentage = % for FREE users
 * - platform_fee_seller_discount_percentage_kids_club_plus = % for SUBSCRIBED users
 * (NOT base + discount model — each field is a direct percentage for that tier)
 * 
 * SEL-FEE-BASE (2026-07-27): Fee is calculated on item price (after SP),
 * excluding buyer transaction fee.
 */
async function calculateSellerFeeCents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  sellerUserId: string,
  itemPriceAfterSP: number,
  sellerFeeConfig: { basePct: number; discountFreePct: number; discountKcpPct: number },
): Promise<number> {
  // Determine seller's subscription tier
  let sellerIsSubscriber = false;
  try {
    const { data: sellerSub } = await supabaseClient
      .from('subscriptions')
      .select('status')
      .eq('user_id', sellerUserId)
      .maybeSingle();
    sellerIsSubscriber = (sellerSub as { status?: string } | null)?.status === 'active'
      || (sellerSub as { status?: string } | null)?.status === 'trial';
  } catch {
    // Non-fatal: default to free tier if subscription lookup fails
    console.warn(`[create-trade-offer] Failed to read seller subscription for ${sellerUserId}, defaulting to free tier`);
  }

  // SEL-FEE-SEMANTICS: Use absolute percentage for the seller's tier
  // basePct = % for free users, discountKcpPct = % for subscribed users
  const effectivePct = sellerIsSubscriber ? sellerFeeConfig.discountKcpPct : sellerFeeConfig.basePct;
  return Math.round(itemPriceAfterSP * effectivePct / 100);
}

/**
 * R1 — Tiered Buyer-Fee Engine (first-trade protection): authoritative buyer fee
 * resolution. Calls fn_get_buyer_fee_for_checkout (SECURITY DEFINER) — the SAME
 * function the mobile order summary uses, so the preview and the charge always
 * agree. The buyer fee is NEVER trusted from the client.
 *
 * Tiers (all amounts dynamic from admin_config 'fees' category):
 *   - active_member (trial|active)           -> flat active-member fee
 *   - no_completed_trade / first_trade_in_progress -> flat first-trade fee
 *   - first_trade_completed / subsequent_free -> % of cash portion + fixed, capped
 *
 * BP-28: fail loud (CONFIG_UNAVAILABLE) when the fee cannot be resolved — no
 * hardcoded fallback.
 */
async function resolveBuyerFee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  buyerId: string,
  cashPortionCents: number,
): Promise<{ feeCents: number; feeState: string; label: string }> {
  const { data, error } = await supabaseClient.rpc('fn_get_buyer_fee_for_checkout', {
    p_user_id: buyerId,
    p_cash_portion_cents: Math.max(0, Math.round(cashPortionCents)),
  });

  if (error) {
    console.error('[create-trade-offer] Failed to resolve buyer fee:', error);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Fee configuration is unavailable. Please try again.' };
  }

  // RPC returns TABLE (array of rows).
  const row = Array.isArray(data) ? data[0] : data;
  const rawFee = (row as { fee_cents?: number | null } | null)?.fee_cents ?? null;
  const feeCents = rawFee === null ? NaN : Number(rawFee);
  if (!Number.isFinite(feeCents) || feeCents < 0) {
    console.error('[create-trade-offer] Invalid buyer fee resolution:', row);
    throw { code: 'CONFIG_UNAVAILABLE', message: 'Fee configuration is invalid. Please contact support.' };
  }

  return {
    feeCents,
    feeState: (row as { fee_state?: string } | null)?.fee_state ?? 'no_completed_trade',
    label: (row as { label?: string } | null)?.label ?? 'Safety & Platform Fee',
  };
}

// R11 + R6 (2026-08-09): server-side SP redemption enforcement shared by the
// single-item and bundle offer paths. Runs BEFORE any SP is accepted so the
// Edge Function returns a clean structured error instead of relying on the DB
// trigger alone:
//   * R6  entitlement — fn_get_sp_entitlement(buyerId): grace users CAN spend
//     existing SP (can_spend_sp=true); free/expired/frozen cannot.
//   * R11 cap — fn_item_effective_sp_cap(itemId): category spend-cap %
//     (overrides global 50%) bounded by the category absolute cap.
// Returns null when SP is not used (spAmt <= 0) or when the check passes;
// otherwise an object matching the caller's { error, code, status } shape.
async function resolveSpRedemption(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  buyerId: string,
  itemId: string,
  spAmt: number
): Promise<{ error: string; code: string; status: number } | null> {
  if (!spAmt || spAmt <= 0) return null;

  // R6 entitlement (server-authoritative — never trust client subscription state)
  const { data: entData, error: entError } = await supabaseClient.rpc('fn_get_sp_entitlement', {
    p_user_id: buyerId,
  });
  if (entError) {
    console.error('[create-trade-offer] fn_get_sp_entitlement error:', entError.message);
    return { error: 'Unable to verify Swap Points access. Please try again.', code: 'ENTITLEMENT_UNAVAILABLE', status: 500 };
  }
  const entRow = (Array.isArray(entData) ? entData[0] : entData) as
    | { can_spend_sp?: boolean; wallet_state?: string }
    | null
    | undefined;
  if (entRow && entRow.can_spend_sp === false) {
    const walletState = entRow.wallet_state ?? 'unknown';
    return {
      error:
        walletState === 'frozen'
          ? 'Your Swap Points balance is frozen. Renew your subscription to use SP again.'
          : 'Swap Points are not available on your current plan.',
      code: 'SP_NOT_ENTITLED',
      status: 403,
    };
  }

  // R11 category cap (server-authoritative — never trust client max-sp)
  const { data: capData, error: capError } = await supabaseClient.rpc('fn_item_effective_sp_cap', {
    p_listing_id: itemId,
  });
  if (capError) {
    console.error('[create-trade-offer] fn_item_effective_sp_cap error:', capError.message);
    return { error: 'Unable to verify the Swap Points cap. Please try again.', code: 'CAP_UNAVAILABLE', status: 500 };
  }
  const cap = Number((capData as { fn_item_effective_sp_cap?: number } | null)?.fn_item_effective_sp_cap ?? capData);
  if (Number.isFinite(cap) && spAmt > cap) {
    return {
      error: `This item accepts up to ${cap} Swap Points. Reduce the amount and try again.`,
      code: 'SP_CAP_EXCEEDED',
      status: 400,
    };
  }

  return null;
}

function jsonError(message: string, code: string, status: number, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, ...(details ? { details } : {}) } }),
    { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[create-trade-offer] Missing Supabase env vars');
    return jsonError('Server configuration error', 'CONFIG_ERROR', 500);
  }
  if (!stripeKey || !stripeKey.startsWith('sk_')) {
    console.error('[create-trade-offer] STRIPE_SECRET_KEY missing or invalid');
    return jsonError('Payment system not configured', 'STRIPE_CONFIG_ERROR', 500);
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader) return jsonError('Missing authorization', 'UNAUTHORIZED', 401);

  // Use service-role client for all DB writes; anon key + user JWT for identity verification
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseKey = supabaseAnonKey || supabaseServiceKey;
  const userClient = createClient(supabaseUrl, supabaseKey);

  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1]?.trim();
  if (!token) return jsonError('Malformed authorization header', 'UNAUTHORIZED', 401);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);
  if (userError || !user) return jsonError('Invalid or expired token', 'UNAUTHORIZED', 401);

  const buyerId = user.id;
  const requestId = crypto.randomUUID();
  // SERVER-SIDE ENFORCEMENT (2026-08-01): set in the batch branch by reading
  // charge_one_fee_per_bundle; shared with the background PI metadata. Single-item
  // offers never set it (stays false).
  let oneFeePerBundle = false;
  console.log(`[create-trade-offer] req=${requestId} buyer=${buyerId}`);

  let body: {
    // Single-item mode (backward compatible)
    item_id?: string;
    sp_amount?: number;
    payment_method_id?: string;
    cash_amount_cents?: number;
    transaction_fee_cents?: number;
    buyer_subscription_status?: string;
    tax_amount_cents?: number;
    bundle_id?: string;
    // Batch mode (for bundle checkout — single EF call for all items)
    items?: Array<{
      item_id: string;
      cash_amount_cents: number;
      sp_amount?: number;
      transaction_fee_cents?: number;
      tax_amount_cents?: number;
    }>;
    // Warmup flag — CartCheckoutScreen pings this on mount to avoid cold start
    __warmup?: boolean;
    // DT-18 (2026-08-28): per-submission nonce generated ONCE by the client per
    // submission attempt and reused for retries of that SAME attempt (double-tap).
    // Incorporated into the Stripe PaymentIntent idempotency key so a genuine re-offer
    // (e.g. after a cancelled trade) gets a fresh key instead of colliding with the
    // prior attempt (Stripe 409 "same parameters"). See submissionNonce below.
    submission_nonce?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body', 'INVALID_BODY', 400);
  }

  // PERF: Warmup shortcut — no-op to warm the Deno container
  if (body.__warmup === true) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
  }

  const {
    item_id,
    sp_amount = 0,
    payment_method_id,
    cash_amount_cents,
    // DT-54 (2026-08-29): transaction_fee_cents is deliberately NOT destructured — the
    // server no longer derives any money amount from the client's fee estimate. The cash
    // portion is computed server-side from the item's DB price minus SP; the client fee
    // field remains accepted (and documented in the body type below) purely for backward
    // compatibility with existing clients, but it is ignored for all arithmetic.
    buyer_subscription_status = 'free',
    tax_amount_cents = 0,
    bundle_id,
    items,
    submission_nonce,
  } = body;

  // DT-18 (2026-08-28): effective per-submission nonce. The client sends one nonce per
  // submission attempt; a retry/double-tap of that SAME attempt reuses it so Stripe still
  // dedupes to a single PaymentIntent (original idempotency purpose preserved). A genuine
  // re-offer (new attempt) sends a fresh nonce → new key → no 409 collision with a prior
  // cancelled attempt on the same listing. Server-side random fallback covers legacy/direct
  // callers that omit the field: it loses cross-request dedupe but never collides.
  const submissionNonce =
    typeof submission_nonce === 'string' && submission_nonce.trim()
      ? submission_nonce.trim()
      : crypto.randomUUID();

  // Determine mode: batch if items array is provided, single otherwise
  const isBatch = Array.isArray(items) && items.length > 0;

  if (!isBatch) {
    // ── Single-item mode (original flow) ──────────────────────────────
    if (!item_id) return jsonError('item_id is required', 'MISSING_ITEM_ID', 400);
    if (typeof cash_amount_cents !== 'number' || cash_amount_cents < 0) {
      return jsonError('cash_amount_cents must be a non-negative integer', 'INVALID_AMOUNT', 400);
    }
    if (cash_amount_cents > 0 && !payment_method_id) {
      return jsonError('A saved payment method is required to submit an offer', 'NO_PAYMENT_METHOD', 400);
    }
  } else {
    // ── Batch mode: validate items array ──────────────────────────────
    if (!payment_method_id) {
      return jsonError('A saved payment method is required to submit offers', 'NO_PAYMENT_METHOD', 400);
    }
    for (const [idx, it] of items.entries()) {
      if (!it.item_id) return jsonError(`items[${idx}].item_id is required`, 'MISSING_ITEM_ID', 400);
      if (typeof it.cash_amount_cents !== 'number' || it.cash_amount_cents < 0) {
        return jsonError(`items[${idx}].cash_amount_cents must be non-negative`, 'INVALID_AMOUNT', 400);
      }
    }
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  // ── Shared: validate payment method (done once for single & batch) ──
  let stripeCustomerId: string | null = null;
  // DT-69 (Item 6) / DEV-TASK-80: capture the buyer's card brand/last4 at offer time.
  // Stored for admin/support/dispute purposes only — NEVER displayed to the seller
  // (DEV-TASK-80 removed the Review Offer disclosure as a privacy fix; the columns
  // and capture-at-completion logic stay). Set only when the PM is retrieved below;
  // stays null for $0-cash (donate) offers.
  let capturedPmBrand: string | null = null;
  let capturedPmLast4: string | null = null;
  const needsPmCheck = isBatch
    ? items!.some((it) => it.cash_amount_cents > 0)
    : (cash_amount_cents ?? 0) > 0;

  if (needsPmCheck) {
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', buyerId)
      .maybeSingle();

    stripeCustomerId = (subRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;

    // DEV-TASK-33 (2026-08-28): A buyer can reach offer submission with a valid
    // saved PaymentMethod id but no Stripe customer yet — e.g. a free-tier buyer
    // whose `subscriptions` row carries stripe_payment_method_id but a null
    // stripe_customer_id (partial/legacy row or post-drift state). This used to
    // hard-fail the FIRST cash offer with a raw NO_STRIPE_CUSTOMER error even
    // though their card was usable. Instead, lazily create the Stripe customer
    // now (mirrors the trade-payment pattern), persist it, and continue so the
    // offer succeeds. Creating a customer is a no-charge, non-financial
    // operation; the Stripe pre-auth hold is created afterwards as usual.
    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email ?? '',
          metadata: { supabase_user_id: buyerId, user_id: buyerId },
        });
        stripeCustomerId = customer.id;
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: buyerId,
              stripe_customer_id: stripeCustomerId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        if (upsertError) {
          // Customer exists in Stripe and the offer can still proceed; the next
          // read picks it up. Log loudly for investigation (BP-4).
          console.error(
            `[create-trade-offer] req=${requestId} failed to persist new Stripe customer for ${buyerId}:`,
            upsertError.message,
          );
        }
      } catch (createErr: unknown) {
        console.error(`[create-trade-offer] req=${requestId} Stripe customer creation failed:`, createErr);
        return jsonError(
          'No Stripe customer found. Please add a payment method first.',
          'NO_STRIPE_CUSTOMER',
          400
        );
      }
    }

    // Verify & attach payment method once (shared by all items in batch/single)
    try {
      const pm = await stripe.paymentMethods.retrieve(payment_method_id!);
      // DT-69 (Item 6) / DEV-TASK-80: snapshot brand/last4 for admin/support/dispute
      // purposes only — never surfaced to the seller (DEV-TASK-80 removed the
      // Review Offer disclosure).
      capturedPmBrand = pm.card?.brand ?? null;
      capturedPmLast4 = pm.card?.last4 ?? null;
      if (pm.customer === null) {
        await stripe.paymentMethods.attach(payment_method_id!, { customer: stripeCustomerId });
      } else if (pm.customer !== stripeCustomerId) {
        // CUSTOMER-DRIFT RECOVERY (2026-08-02): A saved PM can end up attached to a different
        // Stripe customer than subscriptions.stripe_customer_id when a flow that creates a new
        // customer (trade-payment / create-subscription-payment / setup-subscription-payment)
        // overwrites the stored customer id while an older saved card stays attached to the
        // original customer. This hard-reject made every offer fail with "Payment method not
        // found on your account" even though the card visibly belongs to the user.
        // Mirror the existing trade-payment detach+reattach pattern: move the user's own card
        // (just retrieved successfully above) onto the canonical customer so the pre-auth hold
        // can proceed. A card that cannot be moved (detach/attach failure) is still rejected.
        try {
          await stripe.paymentMethods.detach(payment_method_id!);
        } catch (detachErr: unknown) {
          console.error(`[create-trade-offer] req=${requestId} pm detach error:`, detachErr);
          return jsonError('Payment method not found on your account', 'INVALID_PAYMENT_METHOD', 400);
        }
        await stripe.paymentMethods.attach(payment_method_id!, { customer: stripeCustomerId });
      }
    } catch (err: unknown) {
      console.error(`[create-trade-offer] req=${requestId} pm verify error:`, err);
      return jsonError('Payment method is invalid or expired', 'INVALID_PAYMENT_METHOD', 400);
    }
  }

  // ── Helper: create a single trade offer ──────────────────────────────
  async function createSingleOffer(params: {
    itemId: string;
    cashCents: number;
    spAmt: number;
    txFeeCents: number;
    buyerFeeState: string;
    taxCents: number;
  }) {
    // DT-58 (2026-08-30): taxCents (client-supplied tax_amount_cents) is deliberately
    // NOT destructured — the client's tax value is NEVER trusted. Tax is computed
    // server-side; if the server cannot compute it, the offer fails closed below.
    const { itemId, cashCents, spAmt, txFeeCents, buyerFeeState } = params;

    // PERF-DIAG (temporary): timing instrumentation to locate the source of multi-second
    // bundle checkout latency. Safe to remove once root cause is confirmed — logging only,
    // no behavior change. See handoff notes dated 2026-07-18.
    const tStart = Date.now();
    console.log(`[perf][${itemId}] start t=0ms`);

    // Load item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`id, status, seller_id, price, accepts_swap_points, title, category_id, categories:category_id(sp_earning_multiplier)`)
      .eq('id', itemId)
      .single();
    console.log(`[perf][${itemId}] itemLookup done t=${Date.now() - tStart}ms`);

    if (itemError || !item) return { error: 'Item not found', code: 'ITEM_NOT_FOUND', status: 404 };
    if (item.status !== 'available') return { error: 'Item is no longer available', code: 'ITEM_NOT_AVAILABLE', status: 409 };
    if (item.seller_id === buyerId) return { error: 'Cannot buy your own item', code: 'SELF_PURCHASE', status: 400 };

    const categoryMultiplier =
      (item.categories as { sp_earning_multiplier?: number } | null)?.sp_earning_multiplier ?? 1.0;

    // R11 + R6 (2026-08-09): server-side SP cap + entitlement enforcement.
    const spCheck = await resolveSpRedemption(supabase, buyerId, itemId, spAmt);
    if (spCheck) return spCheck;

    // Resolve seller (N6: node resolution on write via shared helper — same query/semantics)
    const sellerProfile = await resolveSellerProfile(supabase, item.seller_id);
    console.log(`[perf][${itemId}] sellerLookup done t=${Date.now() - tStart}ms`);

    const sellerUserId = sellerProfile?.user_id ?? null;
    if (!sellerUserId) return { error: 'Seller account not found', code: 'SELLER_NOT_FOUND', status: 422 };
    const sellerNodeId = sellerProfile?.node_id ?? null;

    // Duplicate offer check
    const ACTIVE_STATUSES = ['pending', 'payment_failed', 'in_progress'];
    const { data: existingOffer } = await supabase
      .from('trades')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('listing_id', itemId)
      .in('status', ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();
    console.log(`[perf][${itemId}] dupCheck done t=${Date.now() - tStart}ms`);

    if (existingOffer) return { error: 'You already have an active offer on this item', code: 'DUPLICATE_OFFER', status: 409 };

    // TAX-STATUS-LIFECYCLE (2026-07-23): Calculate tax using category-level rules +
    // include_fee_in_tax_base toggle. Tax is calculated on the full item price (SP does
    // NOT reduce taxable amount — SP is payment tender, not a price discount).
    //
    // For each item: look up its tax_category_id, find the applicable tax rule (category,
    // jurisdiction, effective date), determine if the category is taxable, and calculate
    // the item-level tax. The platform fee is included in taxable base only when the
    // `include_fee_in_tax_base` admin_config flag is true.
    let vTaxAmountCents = 0;
    let vTaxableAmountCents = 0;
    let vTaxRate = 0;
    let vTaxJurisdiction: string | null = null;
    let vTaxSnapshot: Record<string, unknown> | null = null;
    let vIncludeFeeInBase = false;
    // BP-FIX (2026-07-27): Tracks whether the server intentionally calculated tax (even if $0).
    // Without this flag, vTaxAmountCents === 0 could mean either "exempt item" or "calc error",
    // and the finalTaxCents fallback would wrongly use the client's non-category-aware value.
    let vServerCalculatedTax = false;

    if (sellerNodeId && cashCents > 0) {
      vTaxableAmountCents = Math.round(item.price * 100);

      // DT-68 (2026-08-30): GLOBAL TAX TOGGLE — read sales_tax_enabled. When false, the
      // whole tax calc is overridden to $0 below (the calc still runs — read-only RPCs —
      // then is overridden, keeping this a minimal non-reindenting edit). Previously the
      // EF never read the flag, so disabling tax had NO effect on new offers (QA O03/P04).
      let vGlobalTaxEnabled = true;
      try {
        const { data: globalTaxConfig } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'sales_tax_enabled')
          .eq('is_active', true)
          .maybeSingle();
        vGlobalTaxEnabled = (globalTaxConfig as { value?: string } | null)?.value !== 'false';
      } catch (taxFlagErr: unknown) {
        console.warn(`[create-trade-offer] req=${requestId} global tax flag read failed — assuming enabled:`, taxFlagErr);
      }

      try {
        // Fetch include_fee_in_tax_base toggle
        const { data: feeBaseConfig } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'include_fee_in_tax_base')
          .eq('is_active', true)
          .maybeSingle();

        vIncludeFeeInBase = (feeBaseConfig as { value?: string } | null)?.value === 'true';

        // Fetch the item's tax category and applicable rule
        const { data: itemWithCategory } = await supabase
          .from('items')
          .select('tax_category_id, categories:tax_category_id(key, name)')
          .eq('id', itemId)
          .maybeSingle();

        const taxCategoryId = (itemWithCategory as { tax_category_id?: string } | null)?.tax_category_id ?? null;
        const taxCategoryKey = ((itemWithCategory as { categories?: { key?: string } } | null)?.categories as { key?: string } | null)?.key ?? 'general_tangible_goods';

        // Get the applicable tax rule for this item's category
        let vRuleId: string | null = null;
        let vRuleVersion: number | null = null;
        let vIsTaxable = true;
        let vRuleTaxRate: number | null = null;

        if (taxCategoryId) {
          // BP-fix (2026-07-29): pass item price so price-threshold rules
          // (min_item_price_cents/max_item_price_cents) are actually enforced,
          // not just stored and ignored.
          const { data: ruleData } = await supabase.rpc('get_applicable_tax_rule', {
            p_tax_category_id: taxCategoryId,
            p_check_date: new Date().toISOString(),
            p_item_price_cents: vTaxableAmountCents,
          });

          // BP-35: get_applicable_tax_rule returns TABLE (array). Extract first row.
          const rulesArray = (ruleData as Array<{
            id?: string;
            version?: number;
            is_taxable?: boolean;
            tax_rate?: number | null;
            jurisdiction?: string;
          }> | null) ?? [];

          const rule = rulesArray.length > 0 ? rulesArray[0] : null;

          if (rule) {
            vRuleId = rule.id ?? null;
            vRuleVersion = rule.version ?? null;
            vIsTaxable = rule.is_taxable !== false;
            vRuleTaxRate = rule.tax_rate ?? null;

            // If the rule has a jurisdiction override, use it
            if (rule.jurisdiction) {
              vTaxJurisdiction = rule.jurisdiction;
            }

            // Use the rule's tax rate if specified, otherwise fall through to node rate
            if (vRuleTaxRate !== null && vRuleTaxRate !== undefined) {
              vTaxRate = vRuleTaxRate;
            }
          } else {
            // BP-35: No rule found for this category — treat as non-taxable (fail-safe: exempt rather than overtax)
            // This handles the case where get_applicable_tax_rule returns zero rows (empty array)
            // for categories like tax_exempt_goods when no active rule exists.
            console.warn(`[create-trade-offer] No applicable tax rule found for category ${taxCategoryId} (${taxCategoryKey}) — treating as non-taxable`);
            vIsTaxable = false;
          }
        }

        // If the item is not taxable, skip tax entirely
        if (!vIsTaxable) {
          vTaxAmountCents = 0;
          vTaxRate = 0;
          vTaxableAmountCents = 0;
          vServerCalculatedTax = true;
        } else {
          // Determine the taxable base:
          // Base = item price (always)
          let taxableBase = vTaxableAmountCents;

          // If include_fee_in_tax_base is true, add the platform fee
          if (vIncludeFeeInBase) {
            taxableBase = taxableBase + txFeeCents;
          }

          // Use node rate as fallback if rule didn't specify a rate
          if (vTaxRate === 0) {
            const { data: taxData } = await supabase.rpc('calculate_tax', {
              p_node_id: sellerNodeId,
              p_taxable_amount_cents: taxableBase,
            });
            const parsed = taxData as { success?: boolean; data?: { tax_amount_cents?: number; tax_rate?: number; tax_jurisdiction?: string | null } } | null;
            if (parsed?.success && parsed?.data) {
              vTaxAmountCents = parsed.data.tax_amount_cents ?? 0;
              if (vTaxRate === 0) vTaxRate = parsed.data.tax_rate ?? 0;
              if (!vTaxJurisdiction) vTaxJurisdiction = parsed.data.tax_jurisdiction ?? null;
            }
          } else {
            // Use rule-specified rate directly
            vTaxAmountCents = Math.floor((taxableBase * vTaxRate) + 0.5);
          }

          vServerCalculatedTax = true;

          // Store the tax snapshot for this item
          vTaxSnapshot = {
            items: [{
              item_id: itemId,
              tax_category_id: taxCategoryId,
              tax_category_key: taxCategoryKey,
              applied_rule_id: vRuleId,
              applied_rule_version: vRuleVersion,
              item_price_cents: vTaxableAmountCents,
              taxable_item_subtotal_cents: vTaxableAmountCents,
              is_taxable: vIsTaxable,
              tax_rate: vTaxRate,
              jurisdiction: vTaxJurisdiction,
              tax_amount_cents: vTaxAmountCents,
            }],
            platform_fee_cents: txFeeCents,
            include_fee_in_tax_base: vIncludeFeeInBase,
            calculation_timestamp: new Date().toISOString(),
          };
        }
      } catch (taxErr) {
        console.error(`[create-trade-offer] req=${requestId} tax calc error for ${itemId}:`, taxErr);
      }

      // DT-68: enforce the global toggle on the write path — tax is $0 when disabled.
      // vServerCalculatedTax is forced true so DT-58's FAIL-CLOSED guard does not reject
      // the offer: a $0 when tax is globally disabled is intentional, not a calc error.
      // vTaxSnapshot is cleared so the persisted tax_snapshot matches the 0 tax columns.
      if (!vGlobalTaxEnabled) {
        vTaxAmountCents = 0;
        vTaxableAmountCents = 0;
        vTaxRate = 0;
        vTaxJurisdiction = null;
        vTaxSnapshot = null;
        vServerCalculatedTax = true;
        console.log(`[create-trade-offer] req=${requestId} sales_tax_enabled=false → tax 0 for ${itemId}`);
      }
    }
    console.log(`[perf][${itemId}] taxCalc done t=${Date.now() - tStart}ms`);
    // DT-58 (2026-08-30): FAIL CLOSED on tax — the client's tax_amount_cents is never
    // trusted. When the item has a price but the server could not compute tax (seller has
    // no node_id, or the server-side calc threw), the offer is rejected outright instead of
    // accepting a client-controlled tax amount into the Stripe hold + trade row. Free /
    // donation items (price $0) have no cash to tax, so tax is provably 0.
    let finalTaxCents: number;
    if (Math.round(item.price * 100) > 0) {
      if (!vServerCalculatedTax) {
        console.error(`[create-trade-offer] req=${requestId} refusing offer for ${itemId}: server could not compute tax (sellerNodeId=${sellerNodeId})`);
        return { error: 'We could not calculate the tax for this offer. Please try again in a moment.', code: 'TAX_CALC_UNAVAILABLE', status: 500 };
      }
      finalTaxCents = vTaxAmountCents;
    } else {
      finalTaxCents = 0;
    }

    // SEL-005: Calculate seller transaction fee (platform commission deducted from seller's payout).
    // SEL-FEE-BASE (2026-07-27): Fee is based on item price (after SP), EXCLUDING buyer transaction fee.
    // The buyer's platform fee goes to the platform, not to the seller, so it should not be part of the seller's commission base.
    let sellerTransactionFeeCents = 0;
    if (cashCents > 0) {
      try {
        const sellerFeeConfig = await getSellerFeeConfig(supabase);
        // Calculate on item price only: cashCents - txFeeCents (buyer's fee is not part of seller's revenue)
        const itemPriceAfterSP = cashCents - txFeeCents;
        sellerTransactionFeeCents = await calculateSellerFeeCents(supabase, sellerUserId, itemPriceAfterSP, sellerFeeConfig);
      } catch (feeErr) {
        console.error(`[create-trade-offer] req=${requestId} seller fee calc error for ${itemId}:`, feeErr);
        // Non-fatal: seller fee defaults to 0 if config unavailable (graceful degradation for existing flows)
      }
    }

    // Stripe pre-auth hold
    let paymentIntentId: string | null = null;
    let authExpiresAt: string | null = null;
    if (cashCents > 0) {
      const stripeAmount = cashCents + finalTaxCents;
      // STRIPE-AMOUNT-GUARD (defense-in-depth, 2026-08-27): Stripe requires `amount` to be
      // a finite positive integer (whole cents). Number.isInteger() already excludes NaN and
      // ±Infinity. If this ever fires, an upstream calculation produced a malformed amount —
      // fail loud (structured 500) rather than hand Stripe a bad value, which would either 400
      // or authorize the wrong amount.
      if (!Number.isInteger(stripeAmount) || stripeAmount <= 0) {
        console.error(`[create-trade-offer] req=${requestId} INVALID stripeAmount=${stripeAmount} (cashCents=${cashCents}, finalTaxCents=${finalTaxCents}) — refusing to call Stripe`);
        return { error: 'Internal payment calculation error. Please try again.', code: 'INVALID_PAYMENT_AMOUNT', status: 500 };
      }
      // PAYMENT-ITEMIZATION (2026-07-30): Surface the money breakdown (item price after
      // SP, platform fee, sales tax, SP) to Stripe via a human-readable description + rich
      // metadata, so the Stripe dashboard is auditable without querying Postgres.
      // Note: trade_id is NOT available yet (trade row is inserted after the hold); the
      // reverse mapping lives in trades.stripe_payment_intent_id. Bundle-path PIs include trade_id.
      const itemPriceAfterSp = cashCents - txFeeCents;
      const itemTitle = (item as { title?: string }).title ?? 'item';
      try {
        const tStripeStart = Date.now();
        // N2 idempotency: key per (buyer, item, submission nonce, offer content). A
        // double-tap/retry of the SAME submission (same nonce) dedupes to one PaymentIntent
        // on Stripe's side — no orphaned duplicate auth holds.
        // DT-18 (2026-08-28): submissionNonce breaks the re-offer collision — the old key
        // was fully deterministic (buyer+item+amounts), so re-offering identical terms on
        // the same listing after cancelling hit Stripe 409. Same-attempt retries keep the
        // same nonce → same key → still one PaymentIntent (double-tap protection intact).
        const piKey = `pi_offer_${buyerId}_${itemId}_${submissionNonce}_${hashContent(cashCents, spAmt, txFeeCents, finalTaxCents, payment_method_id ?? '')}`;
        // STRIPE-IDEMPOTENCY-FIX (2026-08-27): idempotencyKey MUST be the OPTIONS argument,
        // never inside the create params. Stripe SDK v14 (esm.sh denonext) detects
        // `idempotencyKey` inside params as an options-object signal and silently DROPS all
        // params (amount, currency, ...) -> Stripe returns "Missing required param: amount."
        // (reproduced with stripe@14.11.0 on Deno; fix verified).
        const pi = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency: 'usd',
          customer: stripeCustomerId!,
          payment_method: payment_method_id!,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          capture_method: 'manual',
          off_session: true,
          confirm: true,
          description: `Kids P2P · ${itemTitle.slice(0, 60)}`,
          metadata: {
            type: 'trade_offer_hold',
            buyer_id: buyerId,
            item_id: itemId,
            bundle_id: bundle_id ?? '',
            request_id: requestId,
            item_price_cents: String(itemPriceAfterSp),
            platform_fee_cents: String(txFeeCents),
            tax_amount_cents: String(finalTaxCents),
            sp_amount: String(spAmt),
            idempotency_key: piKey,
          },
        }, { idempotencyKey: piKey });
        console.log(`[perf][${itemId}] stripeCreate done t=${Date.now() - tStart}ms (stripe call itself took ${Date.now() - tStripeStart}ms)`);

        if (pi.status !== 'requires_capture') {
          const declineMsg = pi.last_payment_error?.message ?? 'Your card was declined. Please try another card.';
          return { error: declineMsg, code: 'STRIPE_HOLD_FAILED', status: 402 };
        }
        paymentIntentId = pi.id;
        authExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } catch (err: unknown) {
        const stripeErr = err as { raw?: { message?: string; code?: string }; message?: string };
        const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Payment hold failed';
        return { error: msg, code: 'STRIPE_ERROR', status: 402 };
      }
    }

    // Insert trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerUserId,
        listing_id: itemId,
        sp_amount: spAmt,
        cash_amount_cents: cashCents - txFeeCents,
        buyer_subscription_status,
        buyer_fee_state: buyerFeeState, // R1: tiered fee-state snapshot (server-resolved)
        buyer_transaction_fee_cents: txFeeCents,
        cash_currency: 'usd',
        tax_amount_cents: finalTaxCents,
        taxable_amount_cents: finalTaxCents > 0 ? vTaxableAmountCents : 0,
        tax_rate_applied: finalTaxCents > 0 ? vTaxRate : null,
        tax_jurisdiction: finalTaxCents > 0 ? vTaxJurisdiction : null,
        status: 'pending',
        stripe_payment_intent_id: paymentIntentId,
        authorization_expires_at: authExpiresAt,
        total_fee_cents: txFeeCents,
        seller_transaction_fee_cents: sellerTransactionFeeCents,
        sp_category_multiplier: categoryMultiplier,
        stripe_payment_method_brand: capturedPmBrand,
        stripe_payment_method_last4: capturedPmLast4,
        ...(bundle_id ? { bundle_id } : {}),
      })
      .select()
      .single();

    if (tradeError || !trade) {
      console.error(`[create-trade-offer] req=${requestId} trade insert error for ${itemId}:`, tradeError);
      // N2 idempotency: a concurrent double-tap can hit the unique index on
      // trades.stripe_payment_intent_id (both taps deduped to the same PI on
      // Stripe's side). Replay the winner instead of erroring or cancelling the
      // shared PaymentIntent.
      if (tradeError?.code === '23505') {
        const { data: existing } = await supabase
          .from('trades')
          .select('id, status')
          .eq('buyer_id', buyerId)
          .eq('listing_id', itemId)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          console.warn(`[create-trade-offer] req=${requestId} duplicate offer (idempotent replay) trade=${(existing as { id: string }).id}`);
          return {
            trade_id: (existing as { id: string }).id,
            status: (existing as { status: string }).status,
            sp_amount: spAmt,
            cash_amount_cents: cashCents,
            idempotent: true,
          };
        }
      }
      if (paymentIntentId) {
        try { await stripe.paymentIntents.cancel(paymentIntentId); } catch { /* ignore rollback error */ }
      }
      if (tradeError?.code === '23503') {
        return { error: 'This listing seller account could not be verified', code: 'SELLER_FK_ERROR', status: 422 };
      }
      return { error: 'Failed to create offer. Please try again.', code: 'TRADE_INSERT_ERROR', status: 500 };
    }
    console.log(`[perf][${itemId}] tradeInsert done t=${Date.now() - tStart}ms (TOTAL for this item)`);

    // Tax record insert (non-blocking) — includes tax_snapshot + tax_status
    if (finalTaxCents > 0) {
      supabase.from('tax_records').insert({
        trade_id: trade.id, buyer_id: buyerId, node_id: sellerNodeId,
        taxable_amount_cents: vTaxableAmountCents, tax_rate: vTaxRate,
        tax_amount_cents: finalTaxCents, tax_jurisdiction: vTaxJurisdiction,
        tax_status: 'quoted',
        tax_snapshot: vTaxSnapshot ?? null,
      }).then(() => {}, (e: unknown) => {
        console.error(`[create-trade-offer] req=${requestId} tax_records insert error:`, e);
      });
    }

    logTradeEvent(supabase, trade.id, 'offer_submitted', buyerId, {
      item_id: itemId, sp_amount: spAmt, cash_amount_cents: cashCents, tax_amount_cents: finalTaxCents, request_id: requestId,
    }).catch(() => {});

    // N2 — Idempotency & Audit: audit the offer + fee + payment-intent + tax
    // transitions (best-effort, idempotent via deterministic keys).
    logFinancialAudit(supabase, {
      mutationType: 'offer_created',
      entityType: 'trade',
      entityId: trade.id,
      actorId: buyerId,
      afterState: { item_id: itemId, sp_amount: spAmt, cash_amount_cents: cashCents - txFeeCents, status: 'pending' },
      idempotencyKey: `offer_${trade.id}`,
      nodeId: sellerNodeId,
    });
    if (txFeeCents > 0) {
      logFinancialAudit(supabase, {
        mutationType: 'buyer_fee_charged',
        entityType: 'trade',
        entityId: trade.id,
        actorId: buyerId,
        afterState: { platform_fee_cents: txFeeCents, charged_at_offer: true },
        amountCents: txFeeCents,
        idempotencyKey: `fee_${trade.id}`,
        nodeId: sellerNodeId,
      });
    }
    if (paymentIntentId) {
      logFinancialAudit(supabase, {
        mutationType: 'payment_intent_created',
        entityType: 'trade',
        entityId: trade.id,
        actorId: buyerId,
        afterState: { stripe_payment_intent_id: paymentIntentId, capture_method: 'manual', amount_cents: cashCents + finalTaxCents },
        amountCents: cashCents + finalTaxCents,
        idempotencyKey: `pi_${trade.id}`,
        nodeId: sellerNodeId,
      });
    }
    if (finalTaxCents > 0) {
      logFinancialAudit(supabase, {
        mutationType: 'tax_quoted',
        entityType: 'trade',
        entityId: trade.id,
        actorId: buyerId,
        afterState: { tax_amount_cents: finalTaxCents, tax_rate: vTaxRate, taxable_amount_cents: vTaxableAmountCents },
        amountCents: finalTaxCents,
        idempotencyKey: `tax_quoted_${trade.id}`,
        nodeId: sellerNodeId,
      });
    }

    return { trade_id: trade.id, status: trade.status, sp_amount: spAmt, cash_amount_cents: cashCents };
  }

  // ── D-31 (Option B, 2026-07-18): Bundle offer creation, split into two phases ──────
  //
  // Phase 1 (awaited, fast — ~1s for a 5-item bundle): validate + insert each trade row
  // immediately with stripe_payment_intent_id=null. The buyer gets a success response as
  // soon as phase 1 finishes for all items — they never wait on Stripe.
  //
  // Phase 2 (background, via EdgeRuntime.waitUntil — runs AFTER the response is sent):
  // create the actual Stripe pre-auth hold for each cash item, then attach it to the
  // trade row. If the hold fails, the trade flips to 'payment_failed', the item is
  // explicitly confirmed 'available' (safety net — it was never locked in the first
  // place, since items only lock on accept), and the buyer gets a clear notification.
  //
  // Why this is safe: transactions-update / transactions-accept-bundle now refuse to
  // accept an offer with cash_amount_cents > 0 and no stripe_payment_intent_id yet
  // ("still processing" error) — this prevents a seller from accepting an offer whose
  // payment was never actually held/charged. See those files for the matching guard.
  interface BundlePhase1Success {
    trade_id: string;
    status: string;
    sp_amount: number;
    cash_amount_cents: number;
    itemId: string;
    needsStripeHold: boolean;
    stripeAmount: number;
    listingTitle: string;
    // PAYMENT-ITEMIZATION (2026-07-30): money breakdown carried into the background
    // Stripe hold so description/metadata can be attached to the PaymentIntent.
    itemPriceCents: number;
    platformFeeCents: number;
    taxCents: number;
  }
  interface BundlePhase1Error {
    error: string;
    code: string;
    status: number;
  }

  async function createBundleOfferItemPhase1(params: {
    itemId: string;
    cashCents: number;
    spAmt: number;
    txFeeCents: number;
    buyerFeeState: string;
    taxCents: number;
  }): Promise<BundlePhase1Success | BundlePhase1Error> {
    // DT-58 (2026-08-30): taxCents (client-supplied tax_amount_cents) is deliberately
    // NOT destructured — the client's tax value is NEVER trusted. Tax is computed
    // server-side; if the server cannot compute it, this item fails closed below.
    const { itemId, cashCents, spAmt, txFeeCents, buyerFeeState } = params;
    const tStart = Date.now();
    console.log(`[perf][${itemId}] (bundle) phase1 start t=0ms`);

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`id, status, seller_id, price, accepts_swap_points, title, category_id, categories:category_id(sp_earning_multiplier)`)
      .eq('id', itemId)
      .single();
    console.log(`[perf][${itemId}] (bundle) itemLookup done t=${Date.now() - tStart}ms`);

    if (itemError || !item) return { error: 'Item not found', code: 'ITEM_NOT_FOUND', status: 404 };
    if (item.status !== 'available') return { error: 'Item is no longer available', code: 'ITEM_NOT_AVAILABLE', status: 409 };
    if (item.seller_id === buyerId) return { error: 'Cannot buy your own item', code: 'SELF_PURCHASE', status: 400 };

    const categoryMultiplier =
      (item.categories as { sp_earning_multiplier?: number } | null)?.sp_earning_multiplier ?? 1.0;

    // R11 + R6 (2026-08-09): server-side SP cap + entitlement enforcement (bundle path).
    const spCheck = await resolveSpRedemption(supabase, buyerId, itemId, spAmt);
    if (spCheck) return spCheck;

    const sellerProfile = await resolveSellerProfile(supabase, item.seller_id);
    console.log(`[perf][${itemId}] (bundle) sellerLookup done t=${Date.now() - tStart}ms`);

    const sellerUserId = sellerProfile?.user_id ?? null;
    if (!sellerUserId) return { error: 'Seller account not found', code: 'SELLER_NOT_FOUND', status: 422 };
    const sellerNodeId = sellerProfile?.node_id ?? null;

    const ACTIVE_STATUSES = ['pending', 'payment_failed', 'in_progress'];
    const { data: existingOffer } = await supabase
      .from('trades')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('listing_id', itemId)
      .in('status', ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();
    console.log(`[perf][${itemId}] (bundle) dupCheck done t=${Date.now() - tStart}ms`);

    if (existingOffer) return { error: 'You already have an active offer on this item', code: 'DUPLICATE_OFFER', status: 409 };

    // TAX-STATUS-LIFECYCLE: Same as single-item but per-item within a bundle.
    // Each item gets its own tax calculation with its own tax_category_id and rule.
    let vTaxAmountCents = 0;
    let vTaxableAmountCents = 0;
    let vTaxRate = 0;
    let vTaxJurisdiction: string | null = null;
    let vTaxSnapshot: Record<string, unknown> | null = null;
    let vIncludeFeeInBase = false;
    let vServerCalculatedTax = false;

    if (sellerNodeId && cashCents > 0) {
      vTaxableAmountCents = Math.round(item.price * 100);

      // DT-68 (2026-08-30): GLOBAL TAX TOGGLE (bundle path — mirrors single-item).
      let vGlobalTaxEnabled = true;
      try {
        const { data: globalTaxConfig } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'sales_tax_enabled')
          .eq('is_active', true)
          .maybeSingle();
        vGlobalTaxEnabled = (globalTaxConfig as { value?: string } | null)?.value !== 'false';
      } catch (taxFlagErr: unknown) {
        console.warn(`[create-trade-offer] req=${requestId} (bundle) global tax flag read failed — assuming enabled:`, taxFlagErr);
      }

      try {
        const { data: feeBaseConfig } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'include_fee_in_tax_base')
          .eq('is_active', true)
          .maybeSingle();

        vIncludeFeeInBase = (feeBaseConfig as { value?: string } | null)?.value === 'true';

        const { data: itemWithCategory } = await supabase
          .from('items')
          .select('tax_category_id, categories:tax_category_id(key, name)')
          .eq('id', itemId)
          .maybeSingle();

        const taxCategoryId = (itemWithCategory as { tax_category_id?: string } | null)?.tax_category_id ?? null;
        const taxCategoryKey = ((itemWithCategory as { categories?: { key?: string } } | null)?.categories as { key?: string } | null)?.key ?? 'general_tangible_goods';

        let vRuleId: string | null = null;
        let vRuleVersion: number | null = null;
        let vIsTaxable = true;
        let vRuleTaxRate: number | null = null;

        if (taxCategoryId) {
          // BP-fix (2026-07-29): pass item price so price-threshold rules
          // (min_item_price_cents/max_item_price_cents) are actually enforced,
          // not just stored and ignored.
          const { data: ruleData } = await supabase.rpc('get_applicable_tax_rule', {
            p_tax_category_id: taxCategoryId,
            p_check_date: new Date().toISOString(),
            p_item_price_cents: vTaxableAmountCents,
          });

          // BP-35: get_applicable_tax_rule returns TABLE (array). Extract first row.
          const rulesArray = (ruleData as Array<{
            id?: string;
            version?: number;
            is_taxable?: boolean;
            tax_rate?: number | null;
            jurisdiction?: string;
          }> | null) ?? [];

          const rule = rulesArray.length > 0 ? rulesArray[0] : null;

          if (rule) {
            vRuleId = rule.id ?? null;
            vRuleVersion = rule.version ?? null;
            vIsTaxable = rule.is_taxable !== false;
            vRuleTaxRate = rule.tax_rate ?? null;

            if (rule.jurisdiction) {
              vTaxJurisdiction = rule.jurisdiction;
            }

            if (vRuleTaxRate !== null && vRuleTaxRate !== undefined) {
              vTaxRate = vRuleTaxRate;
            }
          } else {
            console.warn(`[create-trade-offer] No applicable tax rule found for category ${taxCategoryId} (${taxCategoryKey}) — treating as non-taxable`);
            vIsTaxable = false;
          }
        }

        if (!vIsTaxable) {
          vTaxAmountCents = 0;
          vTaxRate = 0;
          vTaxableAmountCents = 0;
          vServerCalculatedTax = true;
        } else {
          let taxableBase = vTaxableAmountCents;
          if (vIncludeFeeInBase) {
            taxableBase = taxableBase + txFeeCents;
          }

          if (vTaxRate === 0) {
            const { data: taxData } = await supabase.rpc('calculate_tax', {
              p_node_id: sellerNodeId,
              p_taxable_amount_cents: taxableBase,
            });
            const parsed = taxData as { success?: boolean; data?: { tax_amount_cents?: number; tax_rate?: number; tax_jurisdiction?: string | null } } | null;
            if (parsed?.success && parsed?.data) {
              vTaxAmountCents = parsed.data.tax_amount_cents ?? 0;
              if (vTaxRate === 0) vTaxRate = parsed.data.tax_rate ?? 0;
              if (!vTaxJurisdiction) vTaxJurisdiction = parsed.data.tax_jurisdiction ?? null;
            }
          } else {
            vTaxAmountCents = Math.floor((taxableBase * vTaxRate) + 0.5);
          }

          vServerCalculatedTax = true;

          vTaxSnapshot = {
            items: [{
              item_id: itemId,
              tax_category_id: taxCategoryId,
              tax_category_key: taxCategoryKey,
              applied_rule_id: vRuleId,
              applied_rule_version: vRuleVersion,
              item_price_cents: vTaxableAmountCents,
              taxable_item_subtotal_cents: vTaxableAmountCents,
              is_taxable: vIsTaxable,
              tax_rate: vTaxRate,
              jurisdiction: vTaxJurisdiction,
              tax_amount_cents: vTaxAmountCents,
            }],
            platform_fee_cents: txFeeCents,
            include_fee_in_tax_base: vIncludeFeeInBase,
            calculation_timestamp: new Date().toISOString(),
          };
        }
      } catch (taxErr) {
        console.error(`[create-trade-offer] req=${requestId} (bundle) tax calc error for ${itemId}:`, taxErr);
      }

      // DT-68: enforce the global toggle on the write path — tax is $0 when disabled.
      // vServerCalculatedTax is forced true so DT-58's FAIL-CLOSED guard does not reject
      // the item; vTaxSnapshot is cleared so the persisted snapshot matches the 0 columns.
      if (!vGlobalTaxEnabled) {
        vTaxAmountCents = 0;
        vTaxableAmountCents = 0;
        vTaxRate = 0;
        vTaxJurisdiction = null;
        vTaxSnapshot = null;
        vServerCalculatedTax = true;
        console.log(`[create-trade-offer] req=${requestId} (bundle) sales_tax_enabled=false → tax 0 for ${itemId}`);
      }
    }
    console.log(`[perf][${itemId}] (bundle) taxCalc done t=${Date.now() - tStart}ms`);
    // DT-58 (2026-08-30): FAIL CLOSED on tax (bundle path — same rule as single-item).
    // The client's tax_amount_cents is never trusted. When the item has a price but the
    // server could not compute tax (no seller node_id, or the server-side calc threw),
    // this item is rejected and surfaces in the bundle `errors` array like any other
    // per-item failure. Free / donation items (price $0) have no cash to tax → tax is 0.
    let finalTaxCents: number;
    if (Math.round(item.price * 100) > 0) {
      if (!vServerCalculatedTax) {
        console.error(`[create-trade-offer] req=${requestId} refusing bundle item ${itemId}: server could not compute tax (sellerNodeId=${sellerNodeId})`);
        return { error: 'We could not calculate the tax for this item. Please try again in a moment.', code: 'TAX_CALC_UNAVAILABLE', status: 500 };
      }
      finalTaxCents = vTaxAmountCents;
    } else {
      finalTaxCents = 0;
    }
    const needsStripeHold = cashCents > 0;

    // SEL-005: Calculate seller transaction fee for bundle item
    // SEL-FEE-BASE (2026-07-27): Fee is based on item price (after SP), EXCLUDING buyer transaction fee.
    // The buyer's platform fee goes to the platform, not to the seller, so it should not be part of the seller's commission base.
    let sellerTransactionFeeCents = 0;
    if (cashCents > 0) {
      try {
        const sellerFeeConfig = await getSellerFeeConfig(supabase);
        // Calculate on item price only: cashCents - txFeeCents (buyer's fee is not part of seller's revenue)
        const itemPriceAfterSP = cashCents - txFeeCents;
        sellerTransactionFeeCents = await calculateSellerFeeCents(supabase, sellerUserId, itemPriceAfterSP, sellerFeeConfig);
      } catch (feeErr) {
        console.error(`[create-trade-offer] req=${requestId} (bundle) seller fee calc error for ${itemId}:`, feeErr);
      }
    }

    // Phase 1 insert — stripe_payment_intent_id stays NULL; Phase 2 (background) fills it in.
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerUserId,
        listing_id: itemId,
        sp_amount: spAmt,
        cash_amount_cents: cashCents - txFeeCents,
        buyer_subscription_status,
        buyer_fee_state: buyerFeeState, // R1: tiered fee-state snapshot (server-resolved)
        buyer_transaction_fee_cents: txFeeCents,
        cash_currency: 'usd',
        tax_amount_cents: finalTaxCents,
        taxable_amount_cents: finalTaxCents > 0 ? vTaxableAmountCents : 0,
        tax_rate_applied: finalTaxCents > 0 ? vTaxRate : null,
        tax_jurisdiction: finalTaxCents > 0 ? vTaxJurisdiction : null,
        status: 'pending',
        stripe_payment_intent_id: null,
        authorization_expires_at: null,
        total_fee_cents: txFeeCents,
        seller_transaction_fee_cents: sellerTransactionFeeCents,
        sp_category_multiplier: categoryMultiplier,
        stripe_payment_method_brand: capturedPmBrand,
        stripe_payment_method_last4: capturedPmLast4,
        ...(bundle_id ? { bundle_id } : {}),
      })
      .select()
      .single();

    if (tradeError || !trade) {
      console.error(`[create-trade-offer] req=${requestId} (bundle) trade insert error for ${itemId}:`, tradeError);
      if (tradeError?.code === '23503') {
        return { error: 'This listing seller account could not be verified', code: 'SELLER_FK_ERROR', status: 422 };
      }
      return { error: 'Failed to create offer. Please try again.', code: 'TRADE_INSERT_ERROR', status: 500 };
    }
    console.log(`[perf][${itemId}] (bundle) tradeInsert done t=${Date.now() - tStart}ms (phase1 TOTAL for this item)`);

    if (finalTaxCents > 0) {
      supabase.from('tax_records').insert({
        trade_id: trade.id, buyer_id: buyerId, node_id: sellerNodeId,
        taxable_amount_cents: vTaxableAmountCents, tax_rate: vTaxRate,
        tax_amount_cents: finalTaxCents, tax_jurisdiction: vTaxJurisdiction,
        tax_status: 'quoted',
        tax_snapshot: vTaxSnapshot ?? null,
      }).then(() => {}, (e: unknown) => {
        console.error(`[create-trade-offer] req=${requestId} (bundle) tax_records insert error:`, e);
      });
    }

    logTradeEvent(supabase, trade.id, 'offer_submitted', buyerId, {
      item_id: itemId, sp_amount: spAmt, cash_amount_cents: cashCents, tax_amount_cents: finalTaxCents, request_id: requestId,
    }).catch(() => {});

    // N2 — Idempotency & Audit: bundle phase-1 audit (offer + fee + tax quoted).
    // The PaymentIntent audit is written in Phase 2 once the hold is attached.
    logFinancialAudit(supabase, {
      mutationType: 'offer_created',
      entityType: 'trade',
      entityId: trade.id,
      actorId: buyerId,
      afterState: { item_id: itemId, sp_amount: spAmt, cash_amount_cents: cashCents - txFeeCents, status: 'pending', bundle_id: bundle_id ?? null },
      idempotencyKey: `offer_${trade.id}`,
      nodeId: sellerNodeId,
    });
    if (txFeeCents > 0) {
      logFinancialAudit(supabase, {
        mutationType: 'buyer_fee_charged',
        entityType: 'trade',
        entityId: trade.id,
        actorId: buyerId,
        afterState: { platform_fee_cents: txFeeCents, charged_at_offer: true, bundle_id: bundle_id ?? null },
        amountCents: txFeeCents,
        idempotencyKey: `fee_${trade.id}`,
        nodeId: sellerNodeId,
      });
    }
    if (finalTaxCents > 0) {
      logFinancialAudit(supabase, {
        mutationType: 'tax_quoted',
        entityType: 'trade',
        entityId: trade.id,
        actorId: buyerId,
        afterState: { tax_amount_cents: finalTaxCents, tax_rate: vTaxRate, taxable_amount_cents: vTaxableAmountCents },
        amountCents: finalTaxCents,
        idempotencyKey: `tax_quoted_${trade.id}`,
        nodeId: sellerNodeId,
      });
    }

    return {
      trade_id: trade.id,
      status: trade.status,
      sp_amount: spAmt,
      cash_amount_cents: cashCents,
      itemId,
      needsStripeHold,
      stripeAmount: cashCents + finalTaxCents,
      listingTitle: (item as { title?: string }).title ?? 'this item',
      itemPriceCents: cashCents - txFeeCents,
      platformFeeCents: txFeeCents,
      taxCents: finalTaxCents,
    };
  }

  // ── Phase 2 helper: notify buyer + release the item on a background hold failure ──
  async function handleBackgroundHoldFailure(tradeId: string, itemId: string, listingTitle: string, reason: string) {
    console.error(`[create-trade-offer] req=${requestId} background hold FAILED trade=${tradeId} item=${itemId}: ${reason}`);

    await supabase.from('trades').update({
      status: 'payment_failed',
      cancellation_reason: 'payment_hold_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', tradeId);

    // Safety net: the item must stay available on the marketplace. It was never locked in
    // the first place (items only lock at accept-time), but we explicitly re-affirm it here
    // so the seller never silently loses the chance to sell, guarded so we never resurrect a
    // listing that has genuinely sold/been removed since. (Explicit requirement, 2026-07-18.)
    await supabase.from('items').update({
      status: 'available',
      updated_at: new Date().toISOString(),
    }).eq('id', itemId).not('status', 'in', '(sold,removed)');

    try {
      await supabase.rpc('create_trade_notification', {
        p_user_id: buyerId,
        p_notification_type: 'offer_payment_hold_failed',
        p_title: 'Payment Issue',
        p_body: `Payment issue on "${listingTitle}" — update your payment method to retry.`,
        p_data: JSON.stringify({ trade_id: tradeId, listing_id: itemId, type: 'offer_payment_hold_failed' }),
      });
    } catch (e) {
      console.error(`[create-trade-offer] req=${requestId} in-app notification error for ${tradeId}:`, e);
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-trade-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          trade_id: tradeId,
          event_type: 'offer_payment_hold_failed',
          recipient_user_id: buyerId,
          extra_data: { listing_title: listingTitle },
        }),
      });
      const result = (await resp.json().catch(() => ({}))) as { sent?: number };
      if (!result.sent) {
        console.warn(`[create-trade-offer] req=${requestId} push not sent for trade=${tradeId}: ${JSON.stringify(result)}`);
      }
    } catch (e) {
      console.error(`[create-trade-offer] req=${requestId} push notification error for ${tradeId}:`, e);
    }

    logTradeEvent(supabase, tradeId, 'payment_failed', buyerId, { item_id: itemId, reason }).catch(() => {});
  }

  // ── Phase 2: create the Stripe pre-auth hold in the background, after the buyer already
  // has their response. Attaches the hold only if the trade is still 'pending' — if the
  // seller already declined it while the hold was being created, the hold is cancelled
  // immediately instead of being left as an orphaned authorization on the buyer's card.
  async function processStripeHoldInBackground(job: BundlePhase1Success) {
    const {
      trade_id: tradeId,
      itemId,
      stripeAmount,
      listingTitle,
      itemPriceCents,
      platformFeeCents,
      taxCents,
      sp_amount: jobSpAmount,
    } = job;
    // PAYMENT-ITEMIZATION: bundle_fee_mode is read once in the batch branch (server-side
    // enforcement) and shared here for the PI metadata. Single-item offers leave it false.
    const bundleFeeMode = oneFeePerBundle;
    // STRIPE-AMOUNT-GUARD (defense-in-depth, 2026-08-27): Stripe requires `amount` to be
    // a finite positive integer (whole cents). Number.isInteger() already excludes NaN and
    // ±Infinity. If this ever fires, an upstream calculation produced a malformed amount —
    // fail loud through the same failure path as a declined hold (mark payment_failed,
    // re-affirm item availability, notify buyer) rather than hand Stripe a bad value.
    if (!Number.isInteger(stripeAmount) || stripeAmount <= 0) {
      await handleBackgroundHoldFailure(
        tradeId,
        itemId,
        listingTitle,
        `Internal payment calculation error — invalid hold amount (${stripeAmount}).`
      );
      return;
    }
    try {
      const tStripeStart = Date.now();
      // N2 idempotency: deterministic key per (bundle, item, hold content) so a
      // re-run of this background job cannot create a second orphaned hold.
      // DT-18 (2026-08-28): same re-offer-collision fix as the single-item path — the
      // per-submission nonce keeps each new offer attempt's key unique even when the
      // bundle/amounts match a prior cancelled attempt.
      const piKey = `pi_bundle_${bundle_id ?? ''}_${itemId}_${submissionNonce}_${hashContent(stripeAmount, platformFeeCents, taxCents, jobSpAmount)}`;
      // STRIPE-IDEMPOTENCY-FIX (2026-08-27): idempotencyKey MUST be the OPTIONS argument,
      // never inside the create params (see note above — SDK v14 drops all params otherwise).
      const pi = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: 'usd',
        customer: stripeCustomerId!,
        payment_method: payment_method_id!,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        capture_method: 'manual',
        off_session: true,
        confirm: true,
        description: `Kids P2P · Bundle · ${listingTitle.slice(0, 50)}`,
        metadata: {
          type: 'trade_offer_hold',
          buyer_id: buyerId,
          item_id: itemId,
          trade_id: tradeId,
          bundle_id: bundle_id ?? '',
          request_id: requestId,
          item_price_cents: String(itemPriceCents),
          platform_fee_cents: String(platformFeeCents),
          tax_amount_cents: String(taxCents),
          sp_amount: String(jobSpAmount),
          bundle_fee_mode: bundleFeeMode ? 'one_per_bundle' : 'per_item',
          idempotency_key: piKey,
        },
      }, { idempotencyKey: piKey });
      console.log(`[perf][${itemId}] (bundle) background stripeCreate done in ${Date.now() - tStripeStart}ms`);

      if (pi.status !== 'requires_capture') {
        const declineMsg = pi.last_payment_error?.message ?? 'Your card was declined. Please try another card.';
        await handleBackgroundHoldFailure(tradeId, itemId, listingTitle, declineMsg);
        return;
      }

      const authExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: attached, error: updateErr } = await supabase
        .from('trades')
        .update({
          stripe_payment_intent_id: pi.id,
          authorization_expires_at: authExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updateErr || !attached) {
        console.warn(`[create-trade-offer] req=${requestId} trade=${tradeId} no longer pending — cancelling orphaned Stripe hold ${pi.id}`);
        try { await stripe.paymentIntents.cancel(pi.id); } catch { /* best-effort */ }
        return;
      }

      // N2 — Idempotency & Audit: hold attached — audit payment_intent_created.
      logFinancialAudit(supabase, {
        mutationType: 'payment_intent_created',
        entityType: 'trade',
        entityId: tradeId,
        actorId: buyerId,
        afterState: { stripe_payment_intent_id: pi.id, capture_method: 'manual', amount_cents: stripeAmount, bundle_id: bundle_id ?? null },
        amountCents: stripeAmount,
        idempotencyKey: `pi_${tradeId}`,
      });
    } catch (err: unknown) {
      const stripeErr = err as { raw?: { message?: string }; message?: string };
      const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Payment hold failed';
      await handleBackgroundHoldFailure(tradeId, itemId, listingTitle, msg);
    }
  }

  // ── Route: batch or single ──────────────────────────────────────────
  if (isBatch) {
    // PER-SELLER CAP (2026-07-18): Bundle counts as 1 offer slot, not N.
    // Resolve seller from first item (all items in batch are same-seller, enforced by cart).
    // Cap is read live from admin_config.
    const firstItemId = items![0].item_id;
    const { data: batchSeller } = await supabase
      .from('items')
      .select('seller_id')
      .eq('id', firstItemId)
      .single();

    if (batchSeller) {
      let pendingSlots: number;
      let maxOffers: number;
      try {
        pendingSlots = await countPendingSlotsForSeller(supabase, buyerId, batchSeller.seller_id);
        maxOffers = await getMaxPendingOffersPerSeller(supabase);
      } catch (configErr: unknown) {
        const ce = configErr as { code?: string; message?: string };
        return jsonError(ce.message ?? 'Offer limit configuration is unavailable.', ce.code ?? 'CONFIG_UNAVAILABLE', 500);
      }

      if (pendingSlots >= maxOffers) {
        return jsonError(
          `You have ${pendingSlots} pending ${pendingSlots === 1 ? 'offer' : 'offers'} with this seller. Cancel one to make a new offer.`,
          'MAX_PENDING_OFFERS',
          409
        );
      }
    }

    console.log(`[perf][batch] kicking off ${items!.length} items at t=0 (baseline)`);
    const tBatchStart = Date.now();

    // SERVER-SIDE ENFORCEMENT (2026-08-01): The server is authoritative for
    // charge_one_fee_per_bundle. If enabled, the fee (and the fee the client embedded
    // in the cash amount) is dropped from every item beyond the first — even if a stale
    // client still sends a per-item fee. Single-item mode is unaffected.
    try {
      const { data: feeMode } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'charge_one_fee_per_bundle')
        .eq('is_active', true)
        .maybeSingle();
      oneFeePerBundle = (feeMode as { value?: string } | null)?.value === 'true';
    } catch (feeModeErr) {
      console.warn(`[create-trade-offer] req=${requestId} charge_one_fee_per_bundle read failed, defaulting to per-item:`, feeModeErr);
    }

    // DT-54 (2026-08-29): SERVER-AUTHORITATIVE CASH PORTION — derive the cash
    // portion from the item's CURRENT DB price minus SP, never the client's
    // cash_amount_cents. A stale/tampered client can send fee-not-embedded cash
    // (e.g. cash_amount_cents=price, transaction_fee_cents=149) and under-count the
    // cash by the fee per item. Honest clients embed the fee, so
    // (client cash − client fee) == (DB price − SP) — identical result, no behavior
    // change for the real app. Also aligns cash with the tax base, which is already
    // server-authoritative on item.price.
    const { data: priceRows, error: priceErr } = await supabase
      .from('items')
      .select('id, price')
      .in('id', items!.map((it) => it.item_id));
    if (priceErr) {
      console.error(`[create-trade-offer] req=${requestId} bundle price lookup failed:`, priceErr.message);
      return jsonError('Unable to verify item prices. Please try again.', 'PRICE_LOOKUP_ERROR', 500);
    }
    const priceRowsArr = (priceRows as Array<{ id: string; price: number }> | null) ?? [];
    const priceCentsById = new Map(priceRowsArr.map((r) => [r.id, Math.round(r.price * 100)]));
    // Owner decision (2026-08-29): items that no longer exist in the DB are SKIPPED,
    // not whole-bundle rejection. They surface in the response `errors` array as
    // ITEM_NOT_FOUND (same partial-success shape as DUPLICATE_OFFER/L11), so the buyer
    // is told exactly which item was dropped, and the valid items still complete.
    const validItems = items!.filter((it) => priceCentsById.has(it.item_id));
    const missingItems = items!.filter((it) => !priceCentsById.has(it.item_id));
    if (missingItems.length > 0) {
      console.warn(`[create-trade-offer] req=${requestId} bundle references missing item(s), skipping:`, missingItems.map((it) => it.item_id));
    }

    // R1 — Tiered Buyer-Fee Engine: server-authoritative buyer fee for the whole
    // checkout. Per-bundle mode (charge_one_fee_per_bundle) = ONE fee on the total
    // cash portion, applied to the first item (items 2..n carry $0). Per-item mode
    // = each item's cash portion gets its own tiered fee. Mirrors the resolver the
    // mobile order summary calls, so preview and charge always agree.
    const itemCashPortions = validItems.map((it) => {
      // DT-54: cash portion = DB price − SP (server-authoritative). sp_amount arrives
      // in SP POINTS (1 SP = $1 = 100¢), so convert to cents to keep the cash portion
      // in cents — matches the client invariant (client cash = price¢ − sp×100 + fee).
      return Math.max(0, (priceCentsById.get(it.item_id) ?? 0) - (it.sp_amount ?? 0) * 100);
    });
    const totalCashPortion = itemCashPortions.reduce((sum, v) => sum + v, 0);

    let resolvedBuyerFees: Array<{ feeCents: number; feeState: string }>;
    try {
      if (oneFeePerBundle) {
        const bundleFee = await resolveBuyerFee(supabase, buyerId, totalCashPortion);
        // DT-54: fee array must line up with validItems (missing items carry no fee).
        resolvedBuyerFees = validItems.map((_, idx) => ({
          feeCents: idx === 0 ? bundleFee.feeCents : 0,
          feeState: bundleFee.feeState,
        }));
      } else {
        resolvedBuyerFees = await Promise.all(
          itemCashPortions.map((cashPortion) => resolveBuyerFee(supabase, buyerId, cashPortion))
        );
      }
    } catch (feeErr: unknown) {
      const fe = feeErr as { code?: string; message?: string };
      return jsonError(fe.message ?? 'Fee configuration is unavailable. Please try again.', fe.code ?? 'CONFIG_UNAVAILABLE', 500);
    }

    // DEV-TASK-48 (K10): server-side SP availability enforcement for bundles.
    // Fee distribution on items 2..N is already zeroed server-side (verified), but
    // a stale/outdated client can also send sp_amount on EVERY bundle item. If the
    // total exceeds the buyer's wallet available_balance, the per-item
    // fn_reserve_sp_on_offer AFTER INSERT trigger raises 'Insufficient available SP',
    // which this EF maps to TRADE_INSERT_ERROR and can leave a PARTIAL bundle (some
    // trades inserted, others failed). Validate the total up front so a malicious or
    // outdated client gets a clean structured error instead of breaking the insert.
    // DT-54: only valid items reserve SP (missing items are skipped), so validate SP
    // against the valid subset — otherwise a missing item's SP would over-reject the
    // bundle and defeat the skip-missing-item partial-success behavior.
    const totalRequestedSp = validItems.reduce((sum, it) => sum + (it.sp_amount ?? 0), 0);
    if (totalRequestedSp > 0) {
      const { data: walletRow } = await supabase
        .from('sp_wallets')
        .select('available_balance')
        .eq('user_id', buyerId)
        .maybeSingle();
      const availableSp = Number((walletRow as { available_balance?: number } | null)?.available_balance ?? 0);
      if (totalRequestedSp > availableSp) {
        console.error(
          `[create-trade-offer] req=${requestId} bundle SP ${totalRequestedSp} exceeds wallet available ${availableSp} — rejecting before insert`
        );
        return jsonError(
          `You don't have enough Swap Points for this bundle. You have ${availableSp} SP available.`,
          'SP_INSUFFICIENT',
          409
        );
      }
    }

    const phase1Results = await Promise.allSettled(
      validItems.map((it, idx) => {
        const cashPortion = itemCashPortions[idx];
        const serverFee = resolvedBuyerFees[idx].feeCents;
        const serverCash = cashPortion + serverFee;
        return createBundleOfferItemPhase1({
          itemId: it.item_id,
          cashCents: serverCash,
          spAmt: it.sp_amount ?? 0,
          txFeeCents: serverFee,
          buyerFeeState: resolvedBuyerFees[idx].feeState,
          taxCents: it.tax_amount_cents ?? 0,
        });
      })
    );
    console.log(`[perf][batch] phase1 (DB inserts) settled for ${validItems.length} valid items (${missingItems.length} missing) at t=${Date.now() - tBatchStart}ms`);

    const trades: Array<{ trade_id: string; status: string; sp_amount: number; cash_amount_cents: number }> = [];
    // DT-54: missing items surface here exactly like per-item phase-1 failures, so the
    // buyer is told which item was dropped (client maps errors via buildCheckoutWarning).
    const errors: Array<{ item_id: string; error: string; code: string }> = missingItems.map((it) => ({
      item_id: it.item_id,
      error: 'Item not found',
      code: 'ITEM_NOT_FOUND',
    }));
    const stripeJobs: BundlePhase1Success[] = [];

    for (let i = 0; i < phase1Results.length; i++) {
      const itemId = validItems[i].item_id;
      const result = phase1Results[i];
      if (result.status === 'fulfilled') {
        const value = result.value;
        if ('trade_id' in value) {
          trades.push({ trade_id: value.trade_id, status: value.status, sp_amount: value.sp_amount, cash_amount_cents: value.cash_amount_cents });
          if (value.needsStripeHold) stripeJobs.push(value);
        } else {
          errors.push({ item_id: itemId, error: value.error, code: value.code });
          console.error(`[create-trade-offer] req=${requestId} batch item ${itemId} failed:`, value.error);
        }
      } else {
        errors.push({ item_id: itemId, error: result.reason?.message ?? 'Unexpected error', code: 'UNEXPECTED' });
        console.error(`[create-trade-offer] req=${requestId} batch item ${itemId} unexpected error:`, result.reason);
      }
    }

    const response = jsonOk({
      trades,
      errors: errors.length > 0 ? errors : undefined,
      bundle_id: bundle_id ?? null,
      created_count: trades.length,
      failed_count: errors.length,
    });

    // Phase 2 runs AFTER the response is built, so the buyer never waits on Stripe.
    if (stripeJobs.length > 0) {
      const bgWork = Promise.allSettled(stripeJobs.map(j => processStripeHoldInBackground(j))).then(() => {
        console.log(`[perf][batch] background stripe processing complete req=${requestId} t=${Date.now() - tBatchStart}ms`);
      });
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(bgWork);
      } else {
        console.warn(`[create-trade-offer] req=${requestId} EdgeRuntime.waitUntil unavailable — running background work without keep-alive guarantee (expected only in local dev)`);
        bgWork.catch(() => {});
      }
    }

    return response;
  }

  // ── Single-item mode (original flow, backward compatible) ────────────
  // PER-SELLER CAP (2026-07-18): Resolve seller first, then check pending offers
  // for this buyer-seller pair only (not globally). Cap is read live from admin_config.
  // Bundle mode cap is checked separately in the batch block below.
  if (!bundle_id) {
    const { data: capItemSeller } = await supabase
      .from('items')
      .select('seller_id')
      .eq('id', item_id!)
      .single();

    if (capItemSeller) {
      const sellerUserId = capItemSeller.seller_id;
      let pendingSlots: number;
      let maxOffers: number;
      try {
        pendingSlots = await countPendingSlotsForSeller(supabase, buyerId, sellerUserId);
        maxOffers = await getMaxPendingOffersPerSeller(supabase);
      } catch (configErr: unknown) {
        const ce = configErr as { code?: string; message?: string };
        return jsonError(ce.message ?? 'Offer limit configuration is unavailable.', ce.code ?? 'CONFIG_UNAVAILABLE', 500);
      }

      if (pendingSlots >= maxOffers) {
        return jsonError(
          `You have ${pendingSlots} pending ${pendingSlots === 1 ? 'offer' : 'offers'} with this seller. Cancel one to make a new offer.`,
          'MAX_PENDING_OFFERS',
          409
        );
      }
    }
  }

  // R1 — Tiered Buyer-Fee Engine: the buyer fee is computed SERVER-SIDE and is
  // authoritative. DT-54 (2026-08-29): the cash portion is now derived from the
  // item's CURRENT DB price minus SP (server-authoritative), never from the client's
  // cash_amount_cents — a stale/tampered client can send fee-not-embedded cash and
  // under-count by the fee. Honest clients embed the fee, so
  // (client cash − client fee) == (DB price − SP) — identical result, no behavior
  // change. Also aligns cash with the tax base (already server-authoritative).
  const { data: singleItemRow, error: singleItemErr } = await supabase
    .from('items')
    .select('price')
    .eq('id', item_id!)
    .maybeSingle();
  if (singleItemErr || !singleItemRow) {
    return jsonError('Item not found', 'ITEM_NOT_FOUND', 404);
  }
  const serverItemPriceCents = Math.round((singleItemRow as { price: number }).price * 100);
  // DT-54: sp_amount is in SP POINTS (1 SP = $1 = 100¢) — convert to cents so the cash
  // portion stays in cents (matches client invariant: client cash = price¢ − sp×100 + fee).
  const cashPortionCents = Math.max(0, serverItemPriceCents - sp_amount * 100);
  let buyerFee: { feeCents: number; feeState: string; label: string };
  try {
    buyerFee = await resolveBuyerFee(supabase, buyerId, cashPortionCents);
  } catch (feeErr: unknown) {
    const fe = feeErr as { code?: string; message?: string };
    return jsonError(fe.message ?? 'Fee configuration is unavailable. Please try again.', fe.code ?? 'CONFIG_UNAVAILABLE', 500);
  }

  const singleResult = await createSingleOffer({
    itemId: item_id!,
    cashCents: cashPortionCents + buyerFee.feeCents,
    spAmt: sp_amount,
    txFeeCents: buyerFee.feeCents,
    buyerFeeState: buyerFee.feeState,
    taxCents: tax_amount_cents,
  });

  if (singleResult.error) {
    return jsonError(singleResult.error, singleResult.code!, singleResult.status!);
  }

  return jsonOk({
    trade_id: singleResult.trade_id,
    status: singleResult.status,
    authorization_id: singleResult.trade_id,
    authorization_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    sp_amount,
    cash_amount_cents,
  });
});
