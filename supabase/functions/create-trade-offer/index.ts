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
import { logTradeEvent } from '../_shared/trade-events.ts';

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
    transaction_fee_cents = 0,
    buyer_subscription_status = 'free',
    tax_amount_cents = 0,
    bundle_id,
    items,
  } = body;

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
    if (!stripeCustomerId) {
      return jsonError('No Stripe customer found. Please add a payment method first.', 'NO_STRIPE_CUSTOMER', 400);
    }

    // Verify & attach payment method once (shared by all items in batch/single)
    try {
      const pm = await stripe.paymentMethods.retrieve(payment_method_id!);
      if (pm.customer === null) {
        await stripe.paymentMethods.attach(payment_method_id!, { customer: stripeCustomerId });
      } else if (pm.customer !== stripeCustomerId) {
        return jsonError('Payment method not found on your account', 'INVALID_PAYMENT_METHOD', 400);
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
    taxCents: number;
  }) {
    const { itemId, cashCents, spAmt, txFeeCents, taxCents: clientTaxCents } = params;

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

    // Resolve seller
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('user_id, node_id')
      .or(`user_id.eq.${item.seller_id},id.eq.${item.seller_id}`)
      .limit(1)
      .maybeSingle();
    console.log(`[perf][${itemId}] sellerLookup done t=${Date.now() - tStart}ms`);

    const sellerUserId = (sellerProfile as { user_id?: string } | null)?.user_id ?? null;
    if (!sellerUserId) return { error: 'Seller account not found', code: 'SELLER_NOT_FOUND', status: 422 };
    const sellerNodeId = (sellerProfile as { node_id?: string } | null)?.node_id ?? null;

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

    if (sellerNodeId && cashCents > 0) {
      vTaxableAmountCents = Math.round(item.price * 100);

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
          const { data: ruleData } = await supabase.rpc('get_applicable_tax_rule', {
            p_tax_category_id: taxCategoryId,
            p_taxable_timestamp: new Date().toISOString(),
          });

          const rule = ruleData as {
            id?: string;
            version?: number;
            is_taxable?: boolean;
            tax_rate?: number | null;
            jurisdiction?: string;
          } | null;

          if (rule) {
            vRuleId = rule.id ?? null;
            vRuleVersion = rule.version ?? null;
            vIsTaxable = rule.is_taxable !== false; // default to taxable if null
            vRuleTaxRate = rule.tax_rate ?? null;

            // If the rule has a jurisdiction override, use it
            if (rule.jurisdiction) {
              vTaxJurisdiction = rule.jurisdiction;
            }

            // Use the rule's tax rate if specified, otherwise fall through to node rate
            if (vRuleTaxRate !== null && vRuleTaxRate !== undefined) {
              vTaxRate = vRuleTaxRate;
            }
          }
        }

        // If the item is not taxable, skip tax entirely
        if (!vIsTaxable) {
          vTaxAmountCents = 0;
          vTaxRate = 0;
          vTaxableAmountCents = 0;
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
    }
    console.log(`[perf][${itemId}] taxCalc done t=${Date.now() - tStart}ms`);
    const finalTaxCents = vTaxAmountCents > 0 ? vTaxAmountCents : clientTaxCents;

    // Stripe pre-auth hold
    let paymentIntentId: string | null = null;
    let authExpiresAt: string | null = null;
    if (cashCents > 0) {
      const stripeAmount = cashCents + finalTaxCents;
      try {
        const tStripeStart = Date.now();
        const pi = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency: 'usd',
          customer: stripeCustomerId!,
          payment_method: payment_method_id!,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          capture_method: 'manual',
          off_session: true,
          confirm: true,
          metadata: { type: 'trade_offer_hold', buyer_id: buyerId, item_id: itemId, request_id: requestId },
        });
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
        sp_category_multiplier: categoryMultiplier,
        ...(bundle_id ? { bundle_id } : {}),
      })
      .select()
      .single();

    if (tradeError || !trade) {
      console.error(`[create-trade-offer] req=${requestId} trade insert error for ${itemId}:`, tradeError);
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
    taxCents: number;
  }): Promise<BundlePhase1Success | BundlePhase1Error> {
    const { itemId, cashCents, spAmt, txFeeCents, taxCents: clientTaxCents } = params;
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

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('user_id, node_id')
      .or(`user_id.eq.${item.seller_id},id.eq.${item.seller_id}`)
      .limit(1)
      .maybeSingle();
    console.log(`[perf][${itemId}] (bundle) sellerLookup done t=${Date.now() - tStart}ms`);

    const sellerUserId = (sellerProfile as { user_id?: string } | null)?.user_id ?? null;
    if (!sellerUserId) return { error: 'Seller account not found', code: 'SELLER_NOT_FOUND', status: 422 };
    const sellerNodeId = (sellerProfile as { node_id?: string } | null)?.node_id ?? null;

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

    if (sellerNodeId && cashCents > 0) {
      vTaxableAmountCents = Math.round(item.price * 100);

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
          const { data: ruleData } = await supabase.rpc('get_applicable_tax_rule', {
            p_tax_category_id: taxCategoryId,
            p_taxable_timestamp: new Date().toISOString(),
          });

          const rule = ruleData as {
            id?: string;
            version?: number;
            is_taxable?: boolean;
            tax_rate?: number | null;
            jurisdiction?: string;
          } | null;

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
          }
        }

        if (!vIsTaxable) {
          vTaxAmountCents = 0;
          vTaxRate = 0;
          vTaxableAmountCents = 0;
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
    }
    console.log(`[perf][${itemId}] (bundle) taxCalc done t=${Date.now() - tStart}ms`);
    const finalTaxCents = vTaxAmountCents > 0 ? vTaxAmountCents : clientTaxCents;
    const needsStripeHold = cashCents > 0;

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
        sp_category_multiplier: categoryMultiplier,
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

    return {
      trade_id: trade.id,
      status: trade.status,
      sp_amount: spAmt,
      cash_amount_cents: cashCents,
      itemId,
      needsStripeHold,
      stripeAmount: cashCents + finalTaxCents,
      listingTitle: (item as { title?: string }).title ?? 'this item',
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
    const { trade_id: tradeId, itemId, stripeAmount, listingTitle } = job;
    try {
      const tStripeStart = Date.now();
      const pi = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: 'usd',
        customer: stripeCustomerId!,
        payment_method: payment_method_id!,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        capture_method: 'manual',
        off_session: true,
        confirm: true,
        metadata: { type: 'trade_offer_hold', buyer_id: buyerId, item_id: itemId, request_id: requestId },
      });
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
          'You have many pending offers with this seller. Cancel one to make a new offer.',
          'MAX_PENDING_OFFERS',
          409
        );
      }
    }

    console.log(`[perf][batch] kicking off ${items!.length} items at t=0 (baseline)`);
    const tBatchStart = Date.now();

    const phase1Results = await Promise.allSettled(
      items!.map(it =>
        createBundleOfferItemPhase1({
          itemId: it.item_id,
          cashCents: it.cash_amount_cents,
          spAmt: it.sp_amount ?? 0,
          txFeeCents: it.transaction_fee_cents ?? 0,
          taxCents: it.tax_amount_cents ?? 0,
        })
      )
    );
    console.log(`[perf][batch] phase1 (DB inserts) settled for all ${items!.length} items at t=${Date.now() - tBatchStart}ms`);

    const trades: Array<{ trade_id: string; status: string; sp_amount: number; cash_amount_cents: number }> = [];
    const errors: Array<{ item_id: string; error: string; code: string }> = [];
    const stripeJobs: BundlePhase1Success[] = [];

    for (let i = 0; i < phase1Results.length; i++) {
      const itemId = items![i].item_id;
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
          'You have many pending offers with this seller. Cancel one to make a new offer.',
          'MAX_PENDING_OFFERS',
          409
        );
      }
    }
  }

  const singleResult = await createSingleOffer({
    itemId: item_id!,
    cashCents: cash_amount_cents!,
    spAmt: sp_amount,
    txFeeCents: transaction_fee_cents,
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
