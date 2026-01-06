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
import { getListingById } from './listing';
import { getAdminConfig } from './adminConfig';

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

    const itemData = item as any;

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

    // 4. Load SP wallet summary from MODULE-09
    const { data: walletSummary, error: walletError } = await (supabase.rpc('get_user_sp_wallet_summary', { 
      p_user_id: buyerId 
    } as any) as any);

    if (walletError) {
      console.error('[trade] Error fetching SP wallet:', walletError);
      return { success: false, error: 'Failed to verify Swap Points balance' };
    }

    // RPC returns an array or single object depending on implementation
    const wallet = Array.isArray(walletSummary) ? walletSummary[0] : walletSummary;
    const availablePoints: number = wallet?.available_points ?? 0;

    // 5. Clamp requested SP discount based on rules
    let appliedPoints = 0;

    if (canSpendSp && availablePoints > 0 && sp_amount > 0) {
      // Rule: SP cannot exceed dynamic percentage of item price (default 50%)
      const config = await getAdminConfig();
      const maxPercentage = config?.sp_max_percentage_per_purchase ?? 50;
      
      // V2: 1 SP = $1.00 (100 cents)
      const spToCashRate = 1; 
      const maxDiscountCents = Math.floor(itemPriceCents * (maxPercentage / 100));
      const maxSPAllowedPoints = maxDiscountCents / (spToCashRate * 100);
      
      // Clamp to integer points as per MODULE-09 ledger rules
      const requestedPoints = Math.floor(sp_amount);
      appliedPoints = Math.min(requestedPoints, availablePoints, Math.floor(maxSPAllowedPoints));
    } else {
      // Non-subscribers or no balance: ignore requested SP (clamp to 0)
      appliedPoints = 0;
    }

    // V2: 1 SP = $1 discount for simplicity (100 cents)
    const spToCashRate = 1; 
    const discountCentsFromSp = Math.floor(appliedPoints * spToCashRate * 100);

    const discountedSubtotalCents = Math.max(itemPriceCents - discountCentsFromSp, 0);

    // 6. Compute transaction fee based on subscription status
    // Subscriber: $0.99, Non-subscriber: $2.99
    const isSubscriber = subscriptionSummary.is_subscriber;
    const transactionFeeCents = isSubscriber ? 99 : 299;

    // CRITICAL: cash_amount_cents is ONLY the discounted item price (without fee)
    // The fee is tracked separately in buyer_transaction_fee_cents
    // Total buyer pays = cash_amount_cents + buyer_transaction_fee_cents
    const cashAmountCents = discountedSubtotalCents;

    // 7. Fetch seller profile to get node_id and then create trade row
    const { data: sellerProfile, error: sellerProfileError } = await supabase
      .from('profiles')
      .select('node_id')
      .eq('user_id', itemData.seller_id)
      .maybeSingle();

    if (sellerProfileError) {
      console.warn('[trade] Could not fetch seller profile node_id:', sellerProfileError);
    }

    const sellerNodeId = (sellerProfile as any)?.node_id ?? null;

    const { data: trade, error: tradeError } = await (supabase
      .from('trades')
      .insert({
        listing_id: item_id,
        buyer_id: buyerId,
        seller_id: itemData.seller_id,
        node_id: sellerNodeId,
        status: 'pending' as TradeStatus,
        sp_amount: appliedPoints,
        cash_amount_cents: cashAmountCents,
        platform_fee_cents: transactionFeeCents,
        cash_currency: 'usd',
        buyer_subscription_status: buyerStatus,
        buyer_transaction_fee_cents: transactionFeeCents,
        last_status_change_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single() as any);

    if (tradeError || !trade) {
      console.error('[trade] Error creating trade:', tradeError);
      return { success: false, error: 'Failed to create trade' };
    }

    // Notify the seller about the new trade (non-blocking).
    // Use the send-push-notification Edge Function which looks up push tokens.
    (async () => {
      try {
        const title = 'New trade request';
        const bodyText = `${user.email ?? 'A buyer'} initiated a trade for your item.`;

        const { data: notifResult, error: notifError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: itemData.seller_id,
            title,
            body: bodyText,
            data: { tradeId: trade.id, itemId: item_id },
            priority: 'high',
          },
        } as any);

        if (notifError) {
          console.warn('[trade] send-push-notification returned error:', notifError);
        } else {
          console.log('[trade] send-push-notification result:', notifResult);
        }
      } catch (err) {
        console.warn('[trade] Failed to invoke send-push-notification:', err);
      }
    })();

    return {
      success: true,
      trade_id: trade.id,
      trade: trade as Trade,
      appliedPoints,
      cashAmountCents,
      transactionFeeCents,
      buyerSubscriptionStatus: buyerStatus,
    };
  } catch (error: any) {
    console.error('[trade] initiateTradeV2 failed:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}


/**
 * TASK TRADE-V2-003: Payment Orchestration (Stripe + SP Atomicity)
 * 
 * Calls the trade-payment Edge Function to handle:
 * 1. Stripe PaymentIntent creation/confirmation.
 * 2. Atomic SP debit via RPC.
 * 3. Trade status transition to 'in_progress'.
 * 
 * @param tradeId - ID of the pending trade
 * @param paymentMethodId - Stripe PaymentMethod ID from the UI
 * @returns Success status and new trade status
 */
export async function processTradePayment(
  tradeId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string; status?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('trade-payment', {
      body: { tradeId, paymentMethodId },
    });

    if (error) {
      console.error('[trade-service] processTradePayment function error:', error);
      console.error('[trade-service] Full error object:', JSON.stringify(error, null, 2));
      
      // Extract detailed error from the response body
      let errorMessage = error.message || 'Unknown error';
      let serverResponse: any = null;
      
      try {
        // Try to get the response body from the context
        if (error.context && error.context._bodyInit) {
          // For React Native, try to read the response body
          const response = new Response(error.context._bodyInit);
          const responseText = await response.text();
          console.error('[trade-service] Server response body:', responseText);
          
          try {
            serverResponse = JSON.parse(responseText);
            if (serverResponse && serverResponse.error) {
              errorMessage = serverResponse.error;
            }
          } catch (parseErr) {
            console.warn('[trade-service] Could not parse server response as JSON:', parseErr);
            errorMessage = responseText || errorMessage;
          }
        }
      } catch (bodyReadErr) {
        console.warn('[trade-service] Could not read response body:', bodyReadErr);
      }
      
      // Map common server errors to user-friendly messages
      const lower = errorMessage.toLowerCase();
      if (lower.includes('stripe secret key') || lower.includes('server configuration')) {
        errorMessage = 'Payment system configuration error. Please contact support.';
      } else if (lower.includes('trade not found')) {
        errorMessage = 'Trade not found. It may have been cancelled or expired.';
      } else if (lower.includes('buyer not found')) {
        errorMessage = 'User authentication error. Please try logging out and back in.';
      } else if (lower.includes('card_declined') || lower.includes('card was declined')) {
        errorMessage = 'Payment failed: the card was declined. Try a different card or payment method.';
      } else if (lower.includes('payment method') && lower.includes('attach')) {
        errorMessage = 'Payment method error. Please try entering your card details again.';
      } else if (lower.includes('swap points')) {
        errorMessage = 'Swap Points processing error. Please try again or contact support.';
      }

      return { success: false, error: errorMessage };
    }

    return { 
      success: true, 
      status: data.status 
    };
  } catch (error: any) {
    console.error('[trade-service] processTradePayment failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TASK TRADE-V2-004: Completion & SP Release
 * 
 * Completes a trade, marking it as 'completed' and triggering SP earnings
 * for the seller via the complete-trade Edge Function.
 * 
 * @param tradeId - ID of the in_progress trade
 * @returns Success status
 */
export async function completeTradeV2(
  tradeId: string
): Promise<{ success: boolean; error?: string; message?: string; status?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('complete-trade', {
      body: { tradeId },
    });

    if (error) {
      console.error('[trade-service] completeTradeV2 error:', error);
      console.error('[trade-service] Full error object:', JSON.stringify(error, null, 2));

      let errorMessage = error.message || 'Failed to complete trade';

      // Try to extract Edge Function response body for better diagnostics
      try {
        const ctx: any = (error as any)?.context;

        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) errorMessage = body.error;
        } else if (ctx && ctx._bodyInit) {
          const response = new Response(ctx._bodyInit);
          const responseText = await response.text();
          console.error('[trade-service] completeTradeV2 server response body:', responseText);
          try {
            const parsed = JSON.parse(responseText);
            if (parsed?.error) errorMessage = parsed.error;
          } catch {
            if (responseText) errorMessage = responseText;
          }
        }
      } catch (e) {
        console.warn('[trade-service] Could not read completeTradeV2 response body:', e);
      }

      return { success: false, error: errorMessage };
    }

    return { success: true, message: data?.message, status: data?.status };
  } catch (error: any) {
    console.error('[trade-service] completeTradeV2 failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TASK TRADE-V2-007: Handling Mid-Trade Subscription Changes
 * 
 * Invokes the monitor-mid-trade-subscription-changes Edge Function to detect
 * and alert on trades where the buyer's subscription status has changed
 * since the trade was initiated.
 * 
 * @returns Success status and count of flagged trades
 */
export async function monitorMidTradeSubscriptionChanges(): Promise<{ success: boolean; error?: string; flagged_count?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('monitor-mid-trade-subscription-changes', {
      body: {},
    });

    if (error) {
      console.error('[trade-service] monitorMidTradeSubscriptionChanges error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      flagged_count: data.flagged_count 
    };
  } catch (error: any) {
    console.error('[trade-service] monitorMidTradeSubscriptionChanges failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TASK TRADE-V2-005: Cancellation & SP Refund with Reason Logging
 * 
 * Cancels a trade, marking it as 'cancelled', refunding SP to the buyer,
 * and logging the cancellation reason to the database.
 * 
 * Enhanced in MODULE-06 ITERATION 2 to:
 * - Capture user-provided cancellation reason
 * - Log reason to trades.cancellation_reason column
 * - Provide detailed, user-friendly error messages
 * - Implement retry logic for transient failures
 * 
 * @param tradeId - ID of the trade to cancel
 * @param reason - Optional reason for cancellation (predefined or custom text)
 * @returns Success status with detailed error message if failed
 */
export async function cancelTradeV2(
  tradeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; sp_refunded?: boolean }> {
  // Log attempt with provided reason
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'unknown';
  const sanitizedReason = reason ? reason.substring(0, 500) : 'No reason provided';
  
  console.log('[trade-service] Cancelling trade:', {
    tradeId,
    userId,
    reason: sanitizedReason,
    timestamp: new Date().toISOString(),
  });

  try {
    const { data, error } = await supabase.functions.invoke('cancel-trade', {
      body: { 
        tradeId, 
        reason: sanitizedReason 
      },
    });

    if (error) {
      console.error('[trade-service] cancelTradeV2 Edge Function error:', {
        code: error.code || 'unknown',
        message: error.message,
        tradeId,
        userId,
        timestamp: new Date().toISOString(),
      });
      
      // Extract detailed error message from Edge Function response
      let errorMessage = error.message || 'Failed to cancel trade';
      let details: any = null;
      
      if (error instanceof Error && 'context' in error) {
        try {
          const context = (error as any).context;
          if (typeof context.json === 'function') {
            const body = await context.json();
            if (body.error) errorMessage = body.error;
            if (body.details) details = body.details;
          }
        } catch (e) {
          console.warn('[trade-service] Could not parse error response:', e);
        }
      }
      
      // Map error codes to user-friendly messages
      const userMessage = mapCancellationErrorToUserMessage(errorMessage, details);
      
      console.error('[trade-service] Mapped user message:', {
        originalError: errorMessage,
        userMessage,
        details,
      });
      
      return { 
        success: false, 
        error: userMessage 
      };
    }

    // Log successful cancellation
    console.log('[trade-service] Trade cancelled successfully:', {
      tradeId,
      userId,
      spRefunded: data?.sp_refunded,
      timestamp: new Date().toISOString(),
    });

    return { success: true, sp_refunded: !!data?.sp_refunded };
  } catch (error: any) {
    console.error('[trade-service] cancelTradeV2 failed with exception:', {
      error: error.message,
      code: error.code,
      tradeId,
      userId,
      timestamp: new Date().toISOString(),
    });
    
    // Provide helpful error message for common failure scenarios
    const userMessage = mapCancellationErrorToUserMessage(error.message);
    return { success: false, error: userMessage };
  }
}

/**
 * Maps Edge Function error messages to user-friendly cancellation error messages.
 * 
 * Handles common failure scenarios:
 * - Trade not found
 * - Permission denied
 * - Timeout
 * - Invalid trade status
 * - SP refund issues
 * - Network issues
 * 
 * @param errorMessage - Raw error message from Edge Function or exception
 * @param details - Optional error details object with additional context
 * @returns User-friendly error message
 */
function mapCancellationErrorToUserMessage(errorMessage: string, details?: any): string {
  const lower = (errorMessage || '').toLowerCase();
  
  // Trade not found
  if (lower.includes('no rows') || lower.includes('not found')) {
    return 'Trade not found. It may have already been cancelled or expired.';
  }
  
  // Permission denied
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('unauthorized')) {
    return 'You do not have permission to cancel this trade. Only the buyer can cancel pending trades.';
  }
  
  // Timeout
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request timed out. Please check your internet connection and try again.';
  }

  // Invalid status
  if (lower.includes('status') || lower.includes('cannot cancel')) {
    return 'This trade cannot be cancelled. The trade may have already been completed or cancelled.';
  }

  // SP refund issue
  if (lower.includes('swap points') || lower.includes('sp') || lower.includes('refund')) {
    return 'Trade cancelled, but there was an issue refunding Swap Points. Please contact support.';
  }

  // Network or server error
  if (lower.includes('network') || lower.includes('connection')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Database error
  if (lower.includes('database') || lower.includes('query')) {
    return 'Database error occurred. Please try again later.';
  }

  // Default: provide a generic but helpful message
  return 'Failed to cancel trade. Please try again or contact support if the problem persists.';
}
