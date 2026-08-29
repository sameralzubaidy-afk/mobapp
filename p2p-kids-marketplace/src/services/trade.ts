/**
 * File: p2p-kids-marketplace/src/services/trade.ts
 * MODULE-06 TRADE-FLOW-V2: Service functions for trade lifecycle
 *
 * Implements:
 * - TRADE-V2-002: Initiate Trade with Subscription & SP Context
 */

import { supabase } from '../config/supabase';
import { Trade } from '../types/trade';
import { getSubscriptionSummary } from './subscription';
import { getAdminConfig } from './adminConfig';
import { getUserReviews } from './review';
import { getSimulatedCardDeclineMode, getSimulatedConfigFetchFailure } from './devTestingService';
import { captureException, captureMessage } from './errorReporter';
import { trackEvent } from './analytics';

const ACTIVE_OFFER_STATUSES = ['pending', 'payment_failed', 'in_progress'];

/**
 * Check if there is an active trade between buyer and seller
 * Active trades include: pending, in_progress statuses
 *
 * @param buyerId - Current user (buyer)
 * @param sellerId - Seller of the item
 * @returns True if active trade exists
 */
export async function hasActiveTradeBetween(buyerId: string, sellerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('id', { count: 'exact' })
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .in('status', ['pending', 'in_progress'])
      .limit(1);

    if (error) {
      console.error('[trade] Error checking active trades:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('[trade] Error in hasActiveTradeBetween:', error);
    return false;
  }
}

/**
 * Check if buyer already has an active offer for a specific listing.
 * This is used by Item Details to prevent duplicate offers on the same item only.
 */
export async function hasActiveOfferForItem(buyerId: string, listingId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('listing_id', listingId)
      .in('status', ACTIVE_OFFER_STATUSES)
      .limit(1);

    if (error) {
      console.error('[trade] Error checking active offer for listing:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('[trade] Error in hasActiveOfferForItem:', error);
    return false;
  }
}

/**
 * Count the user's ACTIVE trades for the Trades tab badge.
 *
 * "Active" = any status that is NOT a terminal state (completed / cancelled),
 * i.e. pending, payment_processing, payment_failed, in_progress. This matches
 * the spec's "anything not yet completed/cancelled/archived" and the live
 * trades_status_check constraint (which still allows payment_processing).
 * Completed and cancelled trades never count toward the badge.
 *
 * @param userId - Current user ID (buyer or seller)
 * @returns Count of active trades
 */
export async function getActiveTradeCount(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const { count, error } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .not('status', 'in', '("completed","cancelled")');

    if (error) {
      console.error('[trade] Error counting active trades:', error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error('[trade] Error in getActiveTradeCount:', error);
    return 0;
  }
}

/**
 * Get seller rating summary
 * Returns average rating and total reviews
 *
 * @param sellerId - Seller user ID
 * @returns Rating info with average and count
 */
export async function getSellerRating(sellerId: string): Promise<{
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown?: Record<number, number>;
}> {
  try {
    const result = await getUserReviews(sellerId);

    if (!result.success || result.reviews.length === 0) {
      return {
        averageRating: null,
        totalReviews: 0,
      };
    }

    const reviews = result.reviews;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Build rating breakdown
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      breakdown[review.rating] = (breakdown[review.rating] || 0) + 1;
    });

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
      ratingBreakdown: breakdown,
    };
  } catch (error) {
    console.error('[trade] Error getting seller rating:', error);
    return {
      averageRating: null,
      totalReviews: 0,
    };
  }
}

/**
 * Map Stripe error codes to user-friendly messages
 * @param error - Stripe error message or code
 * @returns User-friendly error message
 */
export function mapStripeErrorToMessage(error?: string): string {
  if (!error) {
    return 'Payment failed. Please try again.';
  }

  const lowerError = error.toLowerCase();

  if (lowerError.includes('card_declined') || lowerError.includes('declined')) {
    // DEV-TASK-31 (F3): reconcile with the canonical TRD-TC-B06 copy.
    return 'Payment method declined. Please update your card.';
  }

  if (lowerError.includes('expired_card')) {
    return 'Your card has expired. Please use a different payment method.';
  }

  if (lowerError.includes('incorrect_cvc')) {
    return 'The security code (CVC) is incorrect. Please check and try again.';
  }

  if (lowerError.includes('insufficient_funds')) {
    return 'Insufficient funds. Please try a different payment method.';
  }

  if (lowerError.includes('lost_card') || lowerError.includes('stolen_card')) {
    return 'This card has been blocked. Please use a different payment method.';
  }

  // Pass through non-Stripe errors as-is
  return error;
}

function extractMessageFromPayload(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const directError = record.error;

  if (typeof directError === 'string' && directError.trim()) {
    return directError;
  }

  if (directError && typeof directError === 'object') {
    const nestedMessage = (directError as Record<string, unknown>).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  const message = record.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

async function extractEdgeInvokeErrorMessage(
  invokeError: unknown,
  invokeData: unknown,
  fallbackMessage: string
): Promise<string> {
  const messageFromData = extractMessageFromPayload(invokeData);
  if (messageFromData) {
    return messageFromData;
  }

  const anyError = invokeError as any;
  const context = anyError?.context;

  const messageFromContext = extractMessageFromPayload(context);
  if (messageFromContext) {
    return messageFromContext;
  }

  const messageFromBody = extractMessageFromPayload(context?.body);
  if (messageFromBody) {
    return messageFromBody;
  }

  const responseCandidates = [context, context?.response].filter(Boolean);

  for (const candidate of responseCandidates) {
    try {
      const readable = typeof candidate.clone === 'function' ? candidate.clone() : candidate;

      if (typeof readable.json === 'function') {
        const jsonPayload = await readable.json();
        const jsonMessage = extractMessageFromPayload(jsonPayload);
        if (jsonMessage) {
          return jsonMessage;
        }
      }

      if (typeof readable.text === 'function') {
        const rawText = await readable.text();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            const parsedMessage = extractMessageFromPayload(parsed);
            if (parsedMessage) {
              return parsedMessage;
            }
          } catch {
            const textMessage = extractMessageFromPayload(rawText);
            if (textMessage) {
              return textMessage;
            }
          }
        }
      }
    } catch {
      // Continue trying other candidates.
    }
  }

  if (typeof anyError?.message === 'string' && anyError.message.trim()) {
    return anyError.message;
  }

  return fallbackMessage;
}

export interface InitiateTradeInput {
  item_id: string;
  sp_amount: number;
}

export interface InitiateTradeResult {
  success: boolean;
  trade_id?: string;
  error?: string;
  trade?: Trade;
  appliedPoints?: number;
  cashAmountCents?: number;
  transactionFeeCents?: number;
  buyerSubscriptionStatus?: string;
}

async function resolveSellerUserIdForTrade(rawSellerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id')
    .or(`user_id.eq.${rawSellerId},id.eq.${rawSellerId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[trade] Error resolving seller profile mapping:', error);
    return null;
  }

  const profile = data as { id?: string; user_id?: string } | null;
  if (!profile?.user_id) {
    return null;
  }

  return profile.user_id;
}

/**
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 *
 * V2 Rules:
 * 1. Validates item availability and self-purchase.
 * 2. Integrates MODULE-11 subscription summary to determine dynamic fee from admin config.
 * 3. Integrates MODULE-09 SP wallet summary to validate SP balance if SP is used.
 * 4. Enforces the 50% SP cap (SP cannot exceed 50% of item price).
 * 5. Creates the trade record in 'pending' status.
 * 6. Non-subscribers cannot apply SP discounts (clamped to 0).
 *
 * @param input - Trade initiation input
 * @returns Trade initiation result
 * @throws Error if validation fails
 */
export async function initiateTradeV2(input: InitiateTradeInput): Promise<InitiateTradeResult> {
  const { item_id, sp_amount } = input;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    const buyerId = user.id;

    // 1. Load item and ensure it is still available and not self-purchase
    // NOTE: do NOT select non-existent 'node_id' from items; seller node is stored on profiles.node_id
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, status, seller_id, price, accepts_swap_points')
      .eq('id', item_id)
      .single();

    if (itemError) {
      console.error('[trade] Error fetching item:', itemError);
    }

    if (itemError || !item) {
      return { success: false, error: 'Item not found' };
    }

    const itemData = item as {
      id: string;
      status: string;
      seller_id: string;
      price: number;
      accepts_swap_points: boolean;
    };

    if (itemData.status !== 'available') {
      return { success: false, error: 'Item is no longer available' };
    }

    if (itemData.seller_id === buyerId) {
      return { success: false, error: 'Cannot buy your own item' };
    }

    // Prevent duplicate active offers for the same buyer + listing.
    const { data: existingTrade, error: existingTradeError } = await supabase
      .from('trades')
      .select('id, status')
      .eq('buyer_id', buyerId)
      .eq('listing_id', item_id)
      .in('status', ACTIVE_OFFER_STATUSES)
      .limit(1)
      .maybeSingle();

    if (existingTradeError) {
      console.error('[trade] Error validating existing offers:', existingTradeError);
      return {
        success: false,
        error: 'Unable to validate existing offers right now. Please try again.',
      };
    }

    if (existingTrade) {
      return {
        success: false,
        error: 'You already have an active offer on this item. Open Trade History to continue.',
      };
    }

    const itemPriceCents = Math.round(itemData.price * 100);

    // 2. Get buyer subscription summary (MODULE-11)
    const subscriptionSummary = await getSubscriptionSummary(buyerId);
    const buyerStatus = subscriptionSummary.status;

    // 3. Determine if buyer can spend SP
    const canSpendSp = subscriptionSummary.can_spend_sp;

    // 4. Load SP wallet summary from MODULE-09 only when needed.
    // Offline-first tests and non-subscribers should not require this RPC.
    let availablePoints = 0;
    if (sp_amount > 0 && canSpendSp) {
      const { data: walletSummary, error: walletError } = await supabase.rpc(
        'get_user_sp_wallet_summary',
        { p_user_id: buyerId }
      );

      if (walletError) {
        console.error('[trade] Error fetching SP wallet:', walletError);
        return { success: false, error: 'Failed to verify Swap Points balance' };
      }

      // RPC returns an array or single object depending on implementation
      const wallet = (Array.isArray(walletSummary) ? walletSummary[0] : walletSummary) as {
        available_points?: number;
      } | null;
      availablePoints = wallet?.available_points ?? 0;
    }

    // 5. Clamp requested SP discount based on rules
    let appliedPoints = 0;

    if (canSpendSp && sp_amount > 0) {
      // Rule: SP cannot exceed dynamic percentage of item price (default 50%)
      const config = await getAdminConfig();
      const spCapPercentage = config?.sp_max_percentage_per_purchase ?? 50;
      // Convert item price cents to dollars, apply percentage, get SP cap
      const itemPriceDollars = itemPriceCents / 100;
      const spCapPoints = Math.round((spCapPercentage / 100) * itemPriceDollars);

      // Cap: cannot exceed available points, cannot exceed SP cap, cannot exceed requested amount
      appliedPoints = Math.min(sp_amount, availablePoints, spCapPoints);
    }

    // 6. Calculate fees and cash amount
    // SP units are converted to cents (1 SP = $1 = 100 cents)
    const spAmountCents = appliedPoints * 100;
    const cashBeforeFee = itemPriceCents - spAmountCents;

    // Transaction fee is resolved dynamically from admin config via subscription summary RPC.
    const transactionFeeCentsRaw = Number(subscriptionSummary.transaction_fee_cents);
    const transactionFeeCents =
      Number.isFinite(transactionFeeCentsRaw) && transactionFeeCentsRaw >= 0
        ? Math.round(transactionFeeCentsRaw)
        : 299;

    // Total cash amount includes fee (for display to user)
    const cashAmountCents = cashBeforeFee + transactionFeeCents;

    // 7. Resolve seller ID to canonical auth user ID before insert.
    const sellerUserId = await resolveSellerUserIdForTrade(itemData.seller_id);
    if (!sellerUserId) {
      return {
        success: false,
        error: 'This listing is no longer linked to an active seller account.',
      };
    }

    // 8. Create trade record
    const { data: tradeData, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerUserId,
        listing_id: item_id,
        sp_amount: appliedPoints,
        cash_amount_cents: cashBeforeFee,
        buyer_subscription_status: buyerStatus,
        buyer_transaction_fee_cents: transactionFeeCents,
        cash_currency: 'usd',
        status: 'pending',
      })
      .select()
      .single();

    if (tradeError) {
      console.error('[trade] Error creating trade:', tradeError);

      if (
        tradeError.code === '23503' &&
        typeof tradeError.message === 'string' &&
        tradeError.message.includes('fk_trades_seller_id')
      ) {
        return {
          success: false,
          error: 'This listing seller account could not be verified. Please try another listing.',
        };
      }

      return { success: false, error: 'Failed to create trade' };
    }

    return {
      success: true,
      trade_id: tradeData?.id,
      trade: tradeData as Trade,
      appliedPoints: appliedPoints,
      cashAmountCents: cashAmountCents,
      transactionFeeCents: transactionFeeCents,
      buyerSubscriptionStatus: buyerStatus,
    };
  } catch (error) {
    console.error('[trade] Unexpected error in initiateTradeV2:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TFV2-012A: D-30 Pre-Authorization Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Count the number of 'pending' offers the buyer has open.
 * PER-SELLER CAP (2026-07-18): When sellerId is provided, counts only
 * offers with that specific seller. When omitted, counts globally
 * (backward compat for UI badges/summary displays).
 */
export async function countPendingOffersByBuyer(buyerId: string, sellerId?: string): Promise<number> {
  try {
    let query = supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('status', 'pending');

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[trade] countPendingOffersByBuyer error:', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[trade] countPendingOffersByBuyer unexpected error:', err);
    return 0;
  }
}

export interface PendingOfferSummary {
  id: string;
  title: string;
  cash_amount_cents: number;
  sp_amount: number;
  offer_expires_at?: string | null;
}

/**
 * Dev Task 41 item 7: fetch the current user's pending offers with a specific
 * seller so the "Too Many Open Offers" alert can NAME the open offers instead of
 * making the buyer guess which one to cancel.
 */
export async function getBuyerPendingOffersForSeller(
  sellerId: string
): Promise<PendingOfferSummary[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const buyerId = session?.user?.id;
    if (!buyerId || !sellerId) return [];

    const { data, error } = await supabase
      .from('trades')
      .select(
        `
        id,
        cash_amount_cents,
        sp_amount,
        offer_expires_at,
        listing:items(title)
      `
      )
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[trade] getBuyerPendingOffersForSeller error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.listing?.title ?? 'Item',
      cash_amount_cents: row.cash_amount_cents ?? 0,
      sp_amount: row.sp_amount ?? 0,
      offer_expires_at: row.offer_expires_at ?? null,
    }));
  } catch (err) {
    console.error('[trade] getBuyerPendingOffersForSeller unexpected error:', err);
    return [];
  }
}

export interface CreateTradeOfferInput {
  /** ID of the listing item */
  item_id: string;
  /** SP units to apply (1 SP = $1). 0 if none. */
  sp_amount: number;
  /** Stripe saved payment method ID. Required when cash_amount_cents > 0. */
  payment_method_id?: string;
  /**
   * Pre-tax Stripe charge amount in cents = (item_price - sp_discount) + transaction_fee.
   * 0 for SP-only or free trades.
   */
  cash_amount_cents: number;
  /** Platform/transaction fee in cents (already included in cash_amount_cents). */
  transaction_fee_cents: number;
  /** 'active' | 'free' | etc. from subscription summary */
  buyer_subscription_status: string;
  /**
   * Sales tax amount in cents. Added to cash_amount_cents for the Stripe PaymentIntent.
   * Pass 0 or omit if no tax applies.
   */
  tax_amount_cents?: number;
}

export interface CreateTradeOfferResult {
  success: boolean;
  trade_id?: string;
  authorization_id?: string | null;
  authorization_expires_at?: string | null;
  error?: string;
  error_code?: string;
}

function extractErrorCodeFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const code = (error as Record<string, unknown>).code;
  return typeof code === 'string' && code.trim() ? code : undefined;
}

async function getFreshAccessToken(): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return null;
  }

  let accessToken = session.access_token;
  const nowEpoch = Math.floor(Date.now() / 1000);

  if (session.expires_at && session.expires_at <= nowEpoch + 60) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData?.session?.access_token) {
      accessToken = refreshData.session.access_token;
    }
  }

  return accessToken;
}

/**
 * TFV2-012A (D-30 CRITICAL): Atomic offer creation with Stripe pre-authorization.
 *
 * Replaces the two-step initiateTradeV2 + processTradePayment pattern.
 * - Creates a Stripe PaymentIntent with capture_method='manual' (hold on card, not a charge).
 * - Inserts the trade record; DB trigger fn_reserve_sp_on_offer handles SP reservation.
 * - If Stripe hold fails → offer is NOT created (no charge, no SP reserve).
 * - If trade insert fails → Stripe PI is cancelled atomically.
 *
 * The hold is captured later by trade-payment edge function when the SELLER accepts.
 */
export async function createTradeOfferWithHold(
  input: CreateTradeOfferInput
): Promise<CreateTradeOfferResult> {
  try {
    // QA TRD-TC-B06 (dev-only, session-local): forced decline at the
    // hold-creation step. Bypasses the real Edge Function so no offer is
    // created and no SP is reserved — exercises the UI's "Payment Hold Failed"
    // path with a normal valid saved card (fail-closed outside dev/test).
    const cardDeclineMode = await getSimulatedCardDeclineMode();
    if (cardDeclineMode === 'hold_decline') {
      // eslint-disable-next-line no-console
      console.warn(
        '[trade] QA card-decline simulation armed — returning STRIPE_HOLD_FAILED without invoking create-trade-offer'
      );
      return {
        success: false,
        error: 'Your card was declined.',
        error_code: 'STRIPE_HOLD_FAILED',
      };
    }

    // QA TRD-TC-B05i (dev-only, session-local): simulate the Edge Function's
    // admin_config fetch failing (server rejects with CONFIG_UNAVAILABLE)
    // without touching shared-staging admin_config. Fail-closed outside dev/test.
    const configFetchFailure = await getSimulatedConfigFetchFailure();
    if (configFetchFailure === 'fetch_failure') {
      // eslint-disable-next-line no-console
      console.warn(
        '[trade] QA config-fetch-failure simulation armed — returning CONFIG_UNAVAILABLE without invoking create-trade-offer'
      );
      return {
        success: false,
        error: 'Offer limit configuration is unavailable. Please try again.',
        error_code: 'CONFIG_UNAVAILABLE',
      };
    }

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    const accessToken = await getFreshAccessToken();

    if (!accessToken) {
      return { success: false, error: 'User not authenticated', error_code: 'UNAUTHORIZED' };
    }

    const invokeCreateTradeOffer = async (token: string) =>
      supabase.functions.invoke('create-trade-offer', {
        body: {
          item_id: input.item_id,
          sp_amount: input.sp_amount,
          payment_method_id: input.payment_method_id,
          cash_amount_cents: input.cash_amount_cents,
          transaction_fee_cents: input.transaction_fee_cents,
          buyer_subscription_status: input.buyer_subscription_status,
          tax_amount_cents: input.tax_amount_cents ?? 0,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          ...(anonKey ? { apikey: anonKey } : {}),
        },
      });

    let { data, error } = await invokeCreateTradeOffer(accessToken);

    if (error) {
      let message = await extractEdgeInvokeErrorMessage(
        error,
        data,
        'Failed to submit your offer. Please try again.'
      );
      let code = extractErrorCodeFromPayload(data);
      // When HTTP error (non-2xx), `data` may be null — try extracting code from error context
      if (!code && error) {
        const ctx = (error as any)?.context;
        // ctx may be a Response object (FunctionsHttpError) — parse JSON body
        if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
          try {
            const cloned = ctx.clone();
            const parsed = await cloned.json();
            code = extractErrorCodeFromPayload(parsed);
          } catch {
            // not a Response with parseable JSON — fall through
          }
        }
        if (!code) {
          code = extractErrorCodeFromPayload(ctx?.body ?? ctx);
        }
      }

      const normalizedMessage = message.toLowerCase();
      const shouldRetryAuth =
        code === 'UNAUTHORIZED' ||
        normalizedMessage.includes('invalid or expired token') ||
        normalizedMessage.includes('jwt');

      if (shouldRetryAuth) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData?.session?.access_token) {
          const retryResult = await invokeCreateTradeOffer(refreshData.session.access_token);
          data = retryResult.data;
          error = retryResult.error;

          if (!error) {
            code = extractErrorCodeFromPayload(data);
          } else {
            message = await extractEdgeInvokeErrorMessage(
              error,
              data,
              'Failed to submit your offer. Please try again.'
            );
            code = extractErrorCodeFromPayload(data);
          }
        }
      }

      if (error) {
        console.error('[trade] createTradeOfferWithHold invoke error:', message);
        return { success: false, error: message, error_code: code };
      }
    }

    const result = data as {
      success?: boolean;
      trade_id?: string;
      authorization_id?: string | null;
      authorization_expires_at?: string | null;
      error?: { code?: string; message?: string };
    };

    if (!result?.success) {
      const msg = result?.error?.message ?? 'Offer could not be created. Please try again.';
      const code = result?.error?.code;
      return { success: false, error: msg, error_code: code };
    }

    return {
      success: true,
      trade_id: result.trade_id,
      authorization_id: result.authorization_id ?? null,
      authorization_expires_at: result.authorization_expires_at ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error submitting offer';
    console.error('[trade] createTradeOfferWithHold unexpected error:', err);
    return { success: false, error: message, error_code: 'UNEXPECTED_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * TASK TRADE-V2-004: Complete a trade (mark as completed/delivered)
 *
 * Rules:
 * 1. Buyer-only completion is enforced server-side.
 * 2. Trade must be in_progress and not have an unresolved dispute.
 * 3. Calls complete-trade Edge Function (which invokes DB completion logic).
 *
 * @param tradeId - Trade UUID
 * @returns { success: boolean, error?: string, message?: string }
 */
export async function completeTradeV2(
  tradeId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!user || !session) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('[trade] Completing trade:', tradeId, 'by user:', user.id);

    // Call the complete-trade Edge Function
    const { data, error } = await supabase.functions.invoke('complete-trade', {
      body: { tradeId, trade_id: tradeId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      const errorMessage = await extractEdgeInvokeErrorMessage(
        error,
        data,
        'Failed to complete trade'
      );

      console.error('[trade] Complete trade error:', {
        tradeId,
        error,
        errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log('[trade] Trade completion response:', data);

    if (!data.success) {
      console.error('[trade] RPC returned failure:', data);
      return {
        success: false,
        error: data.error || 'Failed to complete trade',
        message: data.message,
      };
    }

    // MODULE-15.3-PART3 TAX-013: apply sales tax to the now-completed trade.
    // Idempotent; truly non-blocking (fire-and-forget) so the completion screen
    // is not delayed by an extra RPC round-trip. Tax failures never undo a
    // successful trade — it is reconciled asynchronously.
    void (async () => {
      try {
        const { applyTaxToTrade } = await import('./tax');
        const taxRes = await applyTaxToTrade(tradeId);
        if (!taxRes.success) {
          console.warn('[trade] tax application failed (non-blocking):', taxRes.error);
        } else {
          console.log(
            '[trade] tax applied:',
            taxRes.data.tax_amount_cents,
            'cents (idempotent_hit=',
            taxRes.data.idempotent_hit,
            ')'
          );
        }
      } catch (taxErr) {
        console.warn('[trade] tax application threw (non-blocking):', taxErr);
      }
    })();

    return {
      success: data.success,
      error: data.error,
      message: data.message,
    };
  } catch (error) {
    console.error('[trade] Error completing trade:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete trade',
    };
  }
}

/**
 * TASK TRADE-V2-005: Cancel a trade
 *
 * Rules:
 * 1. Can cancel before payment (pending status): no refunds needed
 * 2. Can cancel after payment (in_progress status): refund cash + re-credit SP
 * 3. Cancellation reason is tracked in audit logs
 * 4. Calls cancel-trade Edge Function for atomic transaction handling
 *
 * @param tradeId - Trade UUID
 * @param reason - Cancellation reason
 * @returns { success, error?, message?, sp_refunded?, consequenceLevel? }
 */
export async function cancelTradeV2(
  tradeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; message?: string; sp_refunded?: boolean; consequenceLevel?: number | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('[trade] Cancelling trade:', tradeId, 'reason:', reason);

    // Truncate reason to 500 chars
    const truncatedReason = reason ? reason.substring(0, 500) : 'User requested cancellation';

    // Call the cancel-trade Edge Function
    const { data, error } = await supabase.functions.invoke('cancel-trade', {
      body: { tradeId, reason: truncatedReason },
    });

    if (error) {
      console.error('[trade] Cancel trade error:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel trade',
      };
    }

    console.log('[trade] Trade cancellation response:', data);

    return {
      success: data.success,
      error: data.error,
      message: data.message,
      sp_refunded: data.sp_refunded,
      // TFV2-023: consequence level returned by cancel-trade Edge Function
      consequenceLevel: data.consequence_level ?? null,
    };
  } catch (error) {
    console.error('[trade] Error cancelling trade:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel trade',
    };
  }
}

/**
 * TASK TRADE-V2-003: Process Trade Payment via Stripe
 *
 * Calls the trade-payment Edge Function to:
 * 1. Create/attach Stripe PaymentMethod to customer
 * 2. Create PaymentIntent and authorize (manual capture)
 * 3. Debit SP wallet if applicable (atomic)
 * 4. Capture Stripe payment
 * 5. Transition trade from 'pending' → 'in_progress'
 *
 * @param tradeId - Trade UUID
 * @param paymentMethodId - Stripe PaymentMethod ID (pm_...)
 * @returns Success status with error message if failed
 */
export async function processTradePayment(
  tradeId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string; status?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    console.log('[trade] Calling trade-payment Edge Function for:', tradeId);

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('trade-payment', {
      body: {
        tradeId,
        paymentMethodId,
      },
    });

    if (error) {
      const errorMessage = await extractEdgeInvokeErrorMessage(error, data, 'Payment failed');

      const normalizedMessage = errorMessage.toLowerCase();
      const isHandledBusinessBlock =
        normalizedMessage.includes('cannot spend sp') ||
        normalizedMessage.includes('cannot earn sp') ||
        normalizedMessage.includes('wallet is frozen') ||
        normalizedMessage.includes('wallet is suspended') ||
        normalizedMessage.includes('insufficient balance');

      if (isHandledBusinessBlock) {
        console.warn('[trade] Payment blocked by business rule:', {
          tradeId,
          errorMessage,
        });
      } else {
        console.error('[trade] Edge Function error:', {
          tradeId,
          error,
          errorMessage,
        });
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log('[trade] Payment successful:', {
      tradeId: data.tradeId,
      status: data.status,
      paymentIntentId: data.payment_intent_id,
    });

    return { success: true, status: data.status };
  } catch (error) {
    console.error('[trade] Error processing payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed',
    };
  }
}

/**
 * Monitor mid-trade subscription changes (grace period, cancellation)
 * Scans active trades and flags those where buyer/seller subscription status changed
 * Returns result with flagged count for admin dashboard
 */
export async function monitorMidTradeSubscriptionChanges(): Promise<{
  success: boolean;
  flagged_count?: number;
  error?: string;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('[trade] Monitoring subscription changes for user:', user.id);

    // TODO: Implement subscription change monitoring logic
    // For now, return a placeholder response
    return {
      success: true,
      flagged_count: 0,
    };
  } catch (error) {
    console.error('[trade] Error monitoring subscription changes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring failed',
    };
  }
}

/**
 * DT-52 (2026-08-29): Record a trade liability-disclaimer acknowledgment (best effort).
 *
 * Fire-and-forget semantics preserved: never throws, never blocks the trade flow.
 * But it must NOT fail silently — DT-45 showed that when the
 * `acknowledge_trade_disclaimer` RPC is missing/unavailable the failure went
 * undetected for a while because only a `console.warn` logged it. Every failure is
 * now surfaced to Sentry (captureMessage/captureException) AND emitted as an
 * `analytics_events` row (trackEvent → analytics-track EF) so a future
 * RPC-missing / RPC-error scenario is caught immediately, not silently.
 *
 * @param tradeId  the just-created trade id to acknowledge the disclaimer for
 * @param policyId the disclaimer policy id that was shown/accepted
 * @param source   the calling screen (for triage)
 */
export async function acknowledgeTradeDisclaimer(
  tradeId: string,
  policyId: string,
  source = 'trade_flow'
): Promise<void> {
  try {
    const { error } = await supabase.rpc('acknowledge_trade_disclaimer', {
      p_trade_id: tradeId,
      p_disclaimer_policy_id: policyId,
    });
    if (error) {
      console.error('[trade] acknowledge_trade_disclaimer RPC failed:', error);
      captureMessage('acknowledge_trade_disclaimer RPC failed', 'error');
      trackEvent('disclaimer_ack_failed', {
        source,
        trade_id: tradeId,
        code: error.code ?? 'RPC_ERROR',
        message: error.message,
      });
    }
  } catch (disclaimerErr) {
    console.error('[trade] acknowledge_trade_disclaimer threw:', disclaimerErr);
    captureException(disclaimerErr, {
      tags: { action: 'acknowledge_trade_disclaimer', source },
      extra: { tradeId, policyId },
    });
    trackEvent('disclaimer_ack_failed', {
      source,
      trade_id: tradeId,
      code: 'UNEXPECTED',
      message: disclaimerErr instanceof Error ? disclaimerErr.message : String(disclaimerErr),
    });
  }
}
