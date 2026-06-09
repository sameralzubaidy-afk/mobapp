// FILE: p2p-kids-marketplace/src/services/tradeServiceV2.ts
// TFV2-013: Trade service V2 — wraps create-trade-offer Edge Function

import { supabase } from '../config/supabase';

export interface SubmitOfferInput {
  listingId:        string;
  buyerId:          string;
  sellerId:         string;
  cashAmountCents:  number;
  spAmount:         number;
  bundleId?:        string;
}

export interface SubmitOfferResult {
  trade:                  any;
  spReserved:             number;
  authorizationExpiresAt: string;
}

/**
 * Submit a buyer offer for a listing.
 * Calls the `create-trade-offer` Edge Function which handles:
 *  - D-30: Stripe pre-auth + SP hold (atomic)
 *  - SP cap enforcement (50%)
 *  - Subscription gating
 *
 * @throws Error with structured `{ code, message }` on failure
 */
export async function submitOfferV2(params: SubmitOfferInput): Promise<SubmitOfferResult> {
  const { data, error } = await (supabase.functions.invoke as any)('create-trade-offer', {
    body: {
      listing_id:        params.listingId,
      buyer_id:          params.buyerId,
      seller_id:         params.sellerId,
      cash_amount_cents: params.cashAmountCents,
      sp_amount:         params.spAmount,
      bundle_id:         params.bundleId,
    },
  });

  if (error) {
    console.error('[tradeServiceV2] submitOfferV2 error:', error);
    throw new Error(error.message ?? 'Failed to submit offer. Please try again.');
  }

  if (!data) {
    throw new Error('No data returned from create-trade-offer.');
  }

  return data;
}

/**
 * Accept or decline a pending offer (seller only).
 * Calls `transactions-update` Edge Function.
 */
export async function respondToOffer(
  tradeId: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean; status: string; auto_complete_at?: string }> {
  const { data, error } = await supabase.functions.invoke('transactions-update', {
    body: { trade_id: tradeId, action },
  });

  if (error) {
    // FunctionsHttpError contains the EF response body in context
    const context = (error as any)?.context || {};
    const efError = (data as any)?.error || {};
    console.error('[tradeServiceV2] respondToOffer error:', {
      action,
      tradeId,
      errorCode: efError.code || context.code,
      errorMessage: efError.message || context.message,
      statusCode: context.status,
    });
    const detail = efError.message ? ` (${efError.code}: ${efError.message})` : '';
    throw new Error(`Failed to ${action} offer.${detail}`);
  }

  return data;
}

/**
 * Buyer marks trade as complete ("I Got It").
 * Triggers SP release (3-day pending starts).
 * Calls `complete-trade` Edge Function.
 */
export async function completeTrade(tradeId: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('complete-trade', {
    body: { trade_id: tradeId },
  });

  if (error) {
    console.error('[tradeServiceV2] completeTrade error:', error);
    throw new Error(error.message ?? 'Failed to mark trade as complete.');
  }

  return data;
}

/**
 * Buyer reports a dispute on an in-progress trade.
 * Calls `open-dispute` Edge Function.
 */
export async function openDispute(
  tradeId: string,
  reason:  string,
  description: string
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('open-dispute', {
    body: { trade_id: tradeId, reason, description },
  });

  if (error) {
    console.error('[tradeServiceV2] openDispute error:', error);
    throw new Error(error.message ?? 'Failed to report dispute.');
  }

  return data;
}
