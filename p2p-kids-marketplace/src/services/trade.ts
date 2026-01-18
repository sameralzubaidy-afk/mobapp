/**
 * File: p2p-kids-marketplace/src/services/trade.ts
 * MODULE-06 TRADE-FLOW-V2: Service functions for trade lifecycle
 * 
 * Implements:
 * - TRADE-V2-002: Initiate Trade with Subscription & SP Context
 */

import { supabase } from '../config/supabase';
import { Trade, TradeStatus } from '../types/trade';
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
    reviews.forEach(review => {
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

/**
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 * 
 * V2 Rules:
 * 1. Validates item availability and self-purchase.
 * 2. Integrates MODULE-11 subscription summary to determine fee ($0.99 vs $2.99).
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
    const { data: { user } } = await supabase.auth.getUser();
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

    const itemData = item as { id: string; status: string; seller_id: string; price: number; accepts_swap_points: boolean };

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
      const wallet = (Array.isArray(walletSummary) ? walletSummary[0] : walletSummary) as { available_points?: number } | null;
      availablePoints = wallet?.available_points ?? 0;
    }

    // 5. Clamp requested SP discount based on rules
    let appliedPoints = 0;

    if (canSpendSp && availablePoints > 0 && sp_amount > 0) {
      // Rule: SP cannot exceed dynamic percentage of item price (default 50%)
      const config = await getAdminConfig();
      const spCap = Math.round((config?.sp_max_percentage_per_purchase ?? 50) / 100 * itemPriceCents);
      
      appliedPoints = Math.min(sp_amount, availablePoints, spCap);
    }

    // 6. Calculate fees and cash amount
    const spAmountCents = appliedPoints;
    const cashAmountCents = itemPriceCents - spAmountCents;
    
    // Transaction fee (buyer pays fee on cash portion)
    const feePercentage = (buyerStatus === 'active') ? 0.99 : 2.99;
    const transactionFeeCents = Math.ceil(cashAmountCents * (feePercentage / 100));

    // 7. Create trade record
    const { data: tradeData, error: tradeError } = await supabase
      .from('trades')
      .insert({
        buyer_id: buyerId,
        seller_id: itemData.seller_id,
        listing_id: item_id,
        sp_amount: appliedPoints,
        cash_amount_cents: cashAmountCents,
        buyer_transaction_fee_cents: transactionFeeCents,
        cash_currency: 'usd',
        status: 'pending',
      })
      .select()
      .single();

    if (tradeError) {
      console.error('[trade] Error creating trade:', tradeError);
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
export async function completeTradeV2(tradeId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('[trade] Completing trade:', tradeId, 'by user:', user.id);

    // Call the complete-trade Edge Function
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/complete-trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ tradeId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[trade] Complete trade error:', errorData);
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}: Failed to complete trade` 
      };
    }

    const data = await response.json();
    
    console.log('[trade] Trade completion response:', data);

    return {
      success: data.success,
      error: data.error,
      message: data.message,
    };
  } catch (error) {
    console.error('[trade] Error completing trade:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to complete trade' 
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
export async function cancelTradeV2(tradeId: string, reason?: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('[trade] Cancelling trade:', tradeId, 'by user:', user.id, 'reason:', reason);

    // Call the cancel-trade Edge Function
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/cancel-trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ tradeId, reason: reason || 'User requested cancellation' }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[trade] Cancel trade error:', errorData);
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}: Failed to cancel trade` 
      };
    }

    const data = await response.json();
    
    console.log('[trade] Trade cancellation response:', data);

    return {
      success: data.success,
      error: data.error,
      message: data.message,
    };
  } catch (error) {
    console.error('[trade] Error cancelling trade:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel trade' 
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
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[trade] Calling trade-payment Edge Function for:', tradeId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
    }

    // Get the user's JWT token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call the Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/trade-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tradeId,
        paymentMethodId,
      }),
    });

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      console.error('[trade] Edge Function error:', {
        status: response.status,
        error: data.error,
        details: data.details,
      });
      return {
        success: false,
        error: data.error || `Payment failed (HTTP ${response.status})`,
      };
    }

    console.log('[trade] Payment successful:', {
      tradeId: data.tradeId,
      status: data.status,
      paymentIntentId: data.payment_intent_id,
    });

    return { success: true };
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
 * TODO: Implement subscription change monitoring during active trade
 */
export async function monitorMidTradeSubscriptionChanges(userId: string): Promise<void> {
  try {
    console.log('[trade] Monitoring subscription changes for user:', userId);
    // TODO: Implement subscription change monitoring
  } catch (error) {
    console.error('[trade] Error monitoring subscription changes:', error);
  }
}
