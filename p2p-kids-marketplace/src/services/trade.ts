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

export interface InitiateTradeParams {
  listingId: string;
  spAmount?: number; // Amount of Swap Points the buyer wants to use
}

/**
 * TASK TRADE-V2-002: Initiate Trade with Subscription & SP Context
 * 
 * V2 Rules:
 * 1. Validates buyer and seller are in the same node (or allowed cross-node).
 * 2. Integrates MODULE-11 subscription summary to determine fee ($0.99 vs $2.99).
 * 3. Integrates MODULE-09 SP wallet summary to validate SP balance if SP is used.
 * 4. Enforces the 50% SP cap (SP cannot exceed 50% of item price).
 * 5. Creates the trade record in 'pending' status.
 * 
 * @param params - Trade initiation parameters
 * @returns Created trade object
 * @throws Error if validation fails
 */
export async function initiateTradeV2(params: InitiateTradeParams): Promise<Trade> {
  const { listingId, spAmount = 0 } = params;

  // 1. Get current user (buyer)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('You must be logged in to initiate a trade');
  }
  const buyerId = user.id;

  // 2. Get listing details
  const listing = await getListingById(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }

  if (listing.seller_id === buyerId) {
    throw new Error('You cannot buy your own item');
  }

  if (listing.status !== 'available') {
    throw new Error('This item is no longer available');
  }

  // 3. Get buyer and seller profiles to check nodes
  const { data: profiles, error: profilesError } = await (supabase
    .from('profiles')
    .select('user_id, node_id')
    .in('user_id', [buyerId, listing.seller_id]) as any);

  if (profilesError || !profiles || profiles.length < 2) {
    // If seller profile is missing, we can't proceed. 
    // If buyer profile is missing, it's a critical error.
    throw new Error('Failed to verify user profiles and node locations');
  }

  const buyerProfile = (profiles as any[]).find(p => p.user_id === buyerId);
  const sellerProfile = (profiles as any[]).find(p => p.user_id === listing.seller_id);

  if (!buyerProfile?.node_id || !sellerProfile?.node_id) {
    throw new Error('Both buyer and seller must be assigned to a node to trade');
  }

  // V2 Rule: Same node validation (can be expanded for cross-node later)
  if (buyerProfile.node_id !== sellerProfile.node_id) {
    // TODO(NODE-007): Support cross-node trades if allowed by admin config
    throw new Error('You can only trade with users in your same node');
  }

  // 4. Get buyer subscription summary (MODULE-11)
  const buyerSub = await getSubscriptionSummary(buyerId);

  // 5. Get buyer SP wallet summary (MODULE-09)
  let buyerAvailableSP = 0;
  if (spAmount > 0) {
    const { data: walletData, error: walletError } = await (supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: buyerId
    } as any) as any);
    
    if (walletError) {
      console.error('[trade] Error fetching SP wallet:', walletError);
      throw new Error('Failed to verify Swap Points balance');
    }
    
    // RPC returns an array or single object depending on implementation
    const wallet = Array.isArray(walletData) ? walletData[0] : walletData;
    buyerAvailableSP = wallet?.available_points || 0;
  }

  // 6. Validation Logic
  
  // Rule: Only subscribers can use SP
  if (spAmount > 0 && !buyerSub.can_spend_sp) {
    throw new Error('Only Kids Club+ subscribers can use Swap Points');
  }

  // Rule: Seller must accept SP
  if (spAmount > 0 && !listing.accepts_swap_points) {
    throw new Error('This seller does not accept Swap Points for this item');
  }

  // Rule: SP cannot exceed 50% of item price
  // Price is in dollars (e.g. 10.00), convert to cents for comparison
  const priceInCents = Math.round(listing.price * 100);
  const maxSPAllowed = Math.floor(priceInCents * 0.5);
  
  if (spAmount > maxSPAllowed) {
    throw new Error(`Swap Points cannot exceed 50% of the item price (Max: ${maxSPAllowed} SP)`);
  }

  // Rule: Buyer must have enough SP
  if (spAmount > buyerAvailableSP) {
    throw new Error(`Insufficient Swap Points balance (Available: ${buyerAvailableSP} SP)`);
  }

  // 7. Calculate Fees
  // Subscriber: $0.99, Non-subscriber: $2.99
  const feeCents = buyerSub.is_subscriber ? 99 : 299;

  // 8. Create Trade Record
  const { data: trade, error: tradeError } = await (supabase
    .from('trades')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      status: 'pending' as TradeStatus,
      price_cents: priceInCents,
      sp_amount: spAmount,
      cash_amount_cents: priceInCents - spAmount,
      buyer_transaction_fee_cents: feeCents,
      buyer_subscription_status: buyerSub.status,
      node_id: sellerProfile.node_id,
      last_status_change_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single() as any);

  if (tradeError) {
    console.error('[trade] Error creating trade:', tradeError);
    throw new Error(`Failed to initiate trade: ${tradeError.message}`);
  }

  return trade as Trade;
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
