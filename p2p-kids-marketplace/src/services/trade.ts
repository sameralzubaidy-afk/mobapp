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
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, status, seller_id, price')
      .eq('id', item_id)
      .single();

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
      
      // Clamp to 2 decimal places to avoid floating point issues
      const requestedPoints = Math.floor(sp_amount * 100) / 100;
      appliedPoints = Math.min(requestedPoints, availablePoints, maxSPAllowedPoints);
    } else {
      // Non-subscribers or no balance: ignore requested SP (clamp to 0)
      appliedPoints = 0;
    }

    // V2: 1 SP = $1 discount for simplicity (100 cents)
    const spToCashRate = 1; 
    const discountCentsFromSp = appliedPoints * spToCashRate * 100;

    const discountedSubtotalCents = Math.max(itemPriceCents - discountCentsFromSp, 0);

    // 6. Compute transaction fee based on subscription status
    // Subscriber: $0.99, Non-subscriber: $2.99
    const isSubscriber = subscriptionSummary.is_subscriber;
    const transactionFeeCents = isSubscriber ? 99 : 299;

    const cashAmountCents = discountedSubtotalCents + transactionFeeCents;

    // 7. Create trade row
    const { data: trade, error: tradeError } = await (supabase
      .from('trades')
      .insert({
        listing_id: item_id,
        buyer_id: buyerId,
        seller_id: itemData.seller_id,
        status: 'pending' as TradeStatus,
        sp_amount: appliedPoints,
        cash_amount_cents: cashAmountCents,
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
      return { success: false, error: error.message };
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
 * for the seller via the complete_trade_v2 RPC.
 * 
 * @param tradeId - ID of the in_progress trade
 * @returns Success status
 */
export async function completeTradeV2(
  tradeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase.rpc('complete_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id
    } as any);

    if (error) {
      console.error('[trade-service] completeTradeV2 RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as any;
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[trade-service] completeTradeV2 failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TASK TRADE-V2-005: Cancellation & SP Refund
 * 
 * Cancels a trade, marking it as 'cancelled' and refunding SP to the buyer
 * via the cancel_trade_v2 RPC.
 * 
 * @param tradeId - ID of the trade to cancel
 * @param reason - Optional reason for cancellation
 * @returns Success status
 */
export async function cancelTradeV2(
  tradeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase.rpc('cancel_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_reason: reason
    } as any);

    if (error) {
      console.error('[trade-service] cancelTradeV2 RPC error:', error);
      return { success: false, error: error.message };
    }

    const result = data as any;
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[trade-service] cancelTradeV2 failed:', error);
    return { success: false, error: error.message };
  }
}
