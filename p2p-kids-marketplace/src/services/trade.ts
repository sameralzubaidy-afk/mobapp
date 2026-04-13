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
    return 'Payment failed: the card was declined. Try a different card or payment method.';
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

/**
 * TASK TRADE-V2-004: Complete a trade (mark as completed/delivered)
 *
 * Rules:
 * 1. Buyer or seller can mark as completed
 * 2. If seller initiates: records seller_marked_completed_at, awaits buyer confirmation
 * 3. If buyer initiates OR seller already marked: completes trade, updates item to 'sold', awards SP to seller
 * 4. Calls complete_trade_v2 RPC for atomic transaction handling
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
      body: { tradeId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('[trade] Complete trade error:', error);
      console.error('[trade] Error details:', {
        message: error.message,
        code: error.code,
        details: error,
      });

      // Best-effort: FunctionsHttpError sometimes contains a Response in error.context
      // which includes the real JSON error body from the Edge Function.
      try {
        const anyError = error as any;
        const context = anyError?.context;

        if (context?.body) {
          console.error('[trade] Edge Function response body (context.body):', context.body);
        }

        const response: Response | undefined = context?.response;
        if (response) {
          const resForRead =
            typeof (response as any).clone === 'function' ? (response as any).clone() : response;
          const text = await resForRead.text();
          console.error('[trade] Edge Function response body (response.text):', text);
        }
      } catch (parseErr) {
        console.error('[trade] Failed to read Edge Function error body:', parseErr);
      }

      return {
        success: false,
        error: error.message || 'Failed to complete trade',
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
 * @returns { success: boolean, error?: string, message?: string }
 */
export async function cancelTradeV2(
  tradeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; message?: string; sp_refunded?: boolean }> {
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
