// File: supabase/functions/create-trade-offer/index.ts
// TFV2-012A (D-30 CRITICAL): Atomic offer creation with Stripe pre-authorization hold + SP soft-reserve.
//
// Flow:
//   1. JWT validation + buyer lookup
//   2. Item validation (available, not self-purchase)
//   3. Max 3 pending offers check (D-30)
//   4. Buyer must have valid Stripe payment method (D-30)
//   5. Duplicate active offer check (same buyer + listing)
//   6. Create Stripe PaymentIntent with capture_method='manual' (pre-auth, not captured)
//   7. Insert trade record (triggers fn_reserve_sp_on_offer automatically via DB trigger)
//   8. Rollback: if trade insert fails → cancel Stripe PI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.11.0';
import { logTradeEvent } from '../_shared/trade-events.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PENDING_OFFERS = 3;

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing authorization', 'UNAUTHORIZED', 401);

  // Use service-role client for all DB writes; user JWT only for identity verification
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return jsonError('Invalid or expired token', 'UNAUTHORIZED', 401);

  const buyerId = user.id;
  const requestId = crypto.randomUUID();
  console.log(`[create-trade-offer] req=${requestId} buyer=${buyerId}`);

  let body: {
    item_id?: string;
    sp_amount?: number;
    payment_method_id?: string;
    cash_amount_cents?: number;
    transaction_fee_cents?: number;
    buyer_subscription_status?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body', 'INVALID_BODY', 400);
  }

  const {
    item_id,
    sp_amount = 0,
    payment_method_id,
    cash_amount_cents,
    transaction_fee_cents = 0,
    buyer_subscription_status = 'free',
  } = body;

  if (!item_id) return jsonError('item_id is required', 'MISSING_ITEM_ID', 400);
  if (typeof cash_amount_cents !== 'number' || cash_amount_cents < 0) {
    return jsonError('cash_amount_cents must be a non-negative integer', 'INVALID_AMOUNT', 400);
  }
  if (cash_amount_cents > 0 && !payment_method_id) {
    return jsonError(
      'A saved payment method is required to submit an offer',
      'NO_PAYMENT_METHOD',
      400
    );
  }

  // ── 1. Load item ──────────────────────────────────────────────────────
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, status, seller_id, price, accepts_swap_points, title')
    .eq('id', item_id)
    .single();

  if (itemError || !item) return jsonError('Item not found', 'ITEM_NOT_FOUND', 404);
  if (item.status !== 'available') {
    return jsonError('Item is no longer available', 'ITEM_NOT_AVAILABLE', 409);
  }
  if (item.seller_id === buyerId) {
    return jsonError('Cannot buy your own item', 'SELF_PURCHASE', 400);
  }

  // ── 2. Resolve seller → canonical user_id ────────────────────────────
  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('user_id')
    .or(`user_id.eq.${item.seller_id},id.eq.${item.seller_id}`)
    .limit(1)
    .maybeSingle();

  const sellerUserId = (sellerProfile as { user_id?: string } | null)?.user_id ?? null;
  if (!sellerUserId) {
    return jsonError('Seller account not found', 'SELLER_NOT_FOUND', 422);
  }

  // ── 3. Duplicate offer check ──────────────────────────────────────────
  const ACTIVE_STATUSES = ['pending', 'payment_processing', 'payment_failed', 'in_progress'];
  const { data: existingOffer } = await supabase
    .from('trades')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('listing_id', item_id)
    .in('status', ACTIVE_STATUSES)
    .limit(1)
    .maybeSingle();

  if (existingOffer) {
    return jsonError(
      'You already have an active offer on this item',
      'DUPLICATE_OFFER',
      409
    );
  }

  // ── 4. Max pending offers check (D-30) ───────────────────────────────
  const { count: pendingCount } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', buyerId)
    .eq('status', 'pending');

  if ((pendingCount ?? 0) >= MAX_PENDING_OFFERS) {
    return jsonError(
      'You have 3 pending offers. Cancel one to make a new offer.',
      'MAX_PENDING_OFFERS',
      409
    );
  }

  // ── 5. Validate payment method belongs to buyer (D-30) ───────────────
  let stripeCustomerId: string | null = null;
  if (cash_amount_cents > 0) {
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', buyerId)
      .maybeSingle();

    stripeCustomerId = (subRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      return jsonError(
        'No Stripe customer found. Please add a payment method first.',
        'NO_STRIPE_CUSTOMER',
        400
      );
    }

    // Verify payment method is attached to this customer
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    try {
      const pm = await stripe.paymentMethods.retrieve(payment_method_id!);
      if (pm.customer !== stripeCustomerId) {
        return jsonError('Payment method not found on your account', 'INVALID_PAYMENT_METHOD', 400);
      }
    } catch (err: unknown) {
      console.error(`[create-trade-offer] req=${requestId} pm verify error:`, err);
      return jsonError('Payment method is invalid or expired', 'INVALID_PAYMENT_METHOD', 400);
    }
  }

  // ── 6. Stripe pre-authorization hold (D-30) ──────────────────────────
  let paymentIntentId: string | null = null;
  let authExpiresAt: string | null = null;

  if (cash_amount_cents > 0) {
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    try {
      const pi = await stripe.paymentIntents.create({
        amount: cash_amount_cents, // cash + fee, in cents
        currency: 'usd',
        customer: stripeCustomerId!,
        payment_method: payment_method_id!,
        capture_method: 'manual', // D-30: pre-auth only, capture at seller acceptance
        confirm: true, // places the hold immediately
        confirmation_method: 'automatic',
        metadata: {
          type: 'trade_offer_hold',
          buyer_id: buyerId,
          item_id,
          request_id: requestId,
        },
      });

      if (pi.status !== 'requires_capture') {
        // Hold failed (card declined, etc.)
        console.error(`[create-trade-offer] req=${requestId} PI status=${pi.status}`);
        const declineMsg =
          pi.last_payment_error?.message ?? 'Your card was declined. Please try another card.';
        return jsonError(declineMsg, 'STRIPE_HOLD_FAILED', 402);
      }

      paymentIntentId = pi.id;
      // Stripe pre-auth expires in 7 days
      authExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[create-trade-offer] req=${requestId} PI created=${paymentIntentId}`);
    } catch (err: unknown) {
      const stripeErr = err as { raw?: { message?: string; code?: string }; message?: string };
      const msg = stripeErr?.raw?.message ?? stripeErr?.message ?? 'Payment hold failed';
      console.error(`[create-trade-offer] req=${requestId} Stripe error:`, msg);
      return jsonError(msg, 'STRIPE_ERROR', 402);
    }
  }

  // ── 7. Insert trade record ────────────────────────────────────────────
  // DB trigger fn_reserve_sp_on_offer fires automatically on INSERT with status='pending'
  // DB trigger fn_set_offer_expires_at fires automatically on INSERT
  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerUserId,
      listing_id: item_id,
      sp_amount: sp_amount,
      cash_amount_cents: cash_amount_cents - transaction_fee_cents, // item price portion
      buyer_subscription_status,
      buyer_transaction_fee_cents: transaction_fee_cents,
      cash_currency: 'usd',
      status: 'pending',
      stripe_payment_intent_id: paymentIntentId,
      authorization_expires_at: authExpiresAt,
      total_fee_cents: transaction_fee_cents,
    })
    .select()
    .single();

  if (tradeError || !trade) {
    console.error(`[create-trade-offer] req=${requestId} trade insert error:`, tradeError);

    // Rollback: cancel Stripe PI if it was created (D-30)
    if (paymentIntentId) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
        console.log(`[create-trade-offer] req=${requestId} PI cancelled (rollback) ${paymentIntentId}`);
      } catch (cancelErr) {
        console.error(`[create-trade-offer] req=${requestId} PI cancel failed:`, cancelErr);
      }
    }

    if (tradeError?.code === '23503') {
      return jsonError('This listing seller account could not be verified', 'SELLER_FK_ERROR', 422);
    }
    return jsonError('Failed to create offer. Please try again.', 'TRADE_INSERT_ERROR', 500);
  }

  console.log(`[create-trade-offer] req=${requestId} trade=${trade.id} created`);

  // TFV2-019: Log trade event (non-blocking)
  await logTradeEvent(supabase, trade.id, 'offer_submitted', buyerId, {
    item_id,
    sp_amount,
    cash_amount_cents,
    request_id: requestId,
  });

  return jsonOk({
    trade_id: trade.id,
    status: trade.status,
    authorization_id: paymentIntentId,
    authorization_expires_at: authExpiresAt,
    sp_amount,
    cash_amount_cents,
  });
});
