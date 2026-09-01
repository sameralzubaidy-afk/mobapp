// FILE: p2p-kids-marketplace/src/services/tradeServiceV2.ts
// TFV2-013: Trade service V2 — wraps create-trade-offer Edge Function

import { supabase } from '../config/supabase';

export interface SubmitOfferInput {
  listingId: string;
  buyerId: string;
  sellerId: string;
  cashAmountCents: number;
  spAmount: number;
  bundleId?: string;
}

export interface SubmitOfferResult {
  trade: any;
  spReserved: number;
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
      listing_id: params.listingId,
      buyer_id: params.buyerId,
      seller_id: params.sellerId,
      cash_amount_cents: params.cashAmountCents,
      sp_amount: params.spAmount,
      bundle_id: params.bundleId,
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
  reason: string,
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

/**
 * Accept a bundle of offers (seller only) in a single EF call.
 * Calls `transactions-accept-bundle` Edge Function which processes
 * all trades in parallel internally, avoiding N cold starts.
 */
export async function acceptBundleOffers(tradeIds: string[]): Promise<{
  trades: Array<{ trade_id: string; status: string }>;
  errors?: Array<{ trade_id: string; error: string }>;
}> {
  const { data, error } = await supabase.functions.invoke('transactions-accept-bundle', {
    body: { trade_ids: tradeIds },
  });

  if (error) {
    const context = (error as any)?.context || {};
    const efError = (data as any)?.error || {};
    console.error('[tradeServiceV2] acceptBundleOffers error:', {
      count: tradeIds.length,
      errorCode: efError.code || context.code,
      errorMessage: efError.message || context.message,
    });
    throw new Error(efError.message ?? 'Failed to accept offers.');
  }

  return data;
}

/**
 * Decline a bundle of offers (seller only) in a single EF call.
 * Calls `transactions-decline-bundle` Edge Function which processes
 * all trades in parallel internally, avoiding N cold starts.
 */
export async function declineBundleOffers(tradeIds: string[]): Promise<{
  trades: Array<{ trade_id: string; status: string }>;
  errors?: Array<{ trade_id: string; error: string }>;
}> {
  const { data, error } = await supabase.functions.invoke('transactions-decline-bundle', {
    body: { trade_ids: tradeIds },
  });

  if (error) {
    const context = (error as any)?.context || {};
    const efError = (data as any)?.error || {};
    console.error('[tradeServiceV2] declineBundleOffers error:', {
      count: tradeIds.length,
      errorCode: efError.code || context.code,
      errorMessage: efError.message || context.message,
    });
    throw new Error(efError.message ?? 'Failed to decline offers.');
  }

  return data;
}

/**
 * R15 (2026-08-10): Request ONE extension during the pickup window (buyer or seller).
 * Calls the `trade-extension` Edge Function (action='request'). The counterparty
 * has `extension_response_window_hours` (default 4h) to accept/decline; no response
 * auto-denies + auto-cancels. Any second request on the same trade is rejected.
 */
export async function requestTradeExtension(
  tradeId: string
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke('trade-extension', {
    body: { action: 'request', trade_id: tradeId },
  });

  if (error) {
    const context = (error as any)?.context || {};
    const efError = (data as any)?.error || {};
    console.error('[tradeServiceV2] requestTradeExtension error:', {
      tradeId,
      errorCode: efError.code || context.code,
      errorMessage: efError.message || context.message,
      statusCode: context.status,
    });
    const detail = efError.message ? ` (${efError.code}: ${efError.message})` : '';
    throw new Error(`Could not request an extension.${detail}`);
  }

  if (!data || data.success !== true) {
    throw new Error('Could not request an extension.');
  }

  return data;
}

/**
 * R15 (2026-08-10): Accept or decline a pending extension request (counterparty only).
 * Calls the `trade-extension` Edge Function.
 *  - accept: voids the existing hold + places a FRESH authorization. `paymentMethodId`
 *    is the buyer's saved card (pm_...) and is REQUIRED when the trade has a cash hold.
 *  - decline: releases the hold and auto-cancels the trade via the shared R2 path.
 */
export async function respondToExtension(
  tradeId: string,
  action: 'accept' | 'decline',
  paymentMethodId?: string
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke('trade-extension', {
    body: {
      action,
      trade_id: tradeId,
      ...(action === 'accept' && paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  });

  if (error) {
    const context = (error as any)?.context || {};
    const efError = (data as any)?.error || {};
    console.error('[tradeServiceV2] respondToExtension error:', {
      action,
      tradeId,
      errorCode: efError.code || context.code,
      errorMessage: efError.message || context.message,
      statusCode: context.status,
    });
    const detail = efError.message ? ` (${efError.code}: ${efError.message})` : '';
    throw new Error(
      action === 'accept'
        ? `Could not accept the extension request.${detail}`
        : `Could not decline the extension request.${detail}`
    );
  }

  if (!data || data.success !== true) {
    throw new Error(
      action === 'accept'
        ? 'Could not accept the extension request.'
        : 'Could not decline the extension request.'
    );
  }

  return data;
}

// ─── FIX-CANCEL (2026-09-01): Buyer "Request to Cancel" + admin escalation ───

/**
 * FIX-CANCEL: Buyer requests a cancellation on an in-progress trade (single or
 * whole bundle). The seller approves (→ cancel-trade EF) or declines (→ escalate
 * to admin). State + notifications are handled server-side by
 * `fn_request_cancel_trade` (incl. config-driven response timeout).
 *
 * @throws Error with structured message on failure
 */
export async function requestCancelTrade(
  tradeId: string,
  userId: string,
  reason?: string,
  scope: 'all' | 'single' = 'all'
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc('fn_request_cancel_trade', {
    p_trade_id: tradeId,
    p_user_id: userId,
    p_reason: reason ?? null,
    p_scope: scope,
  });

  if (error) {
    console.error('[tradeServiceV2] requestCancelTrade error:', {
      tradeId,
      errorCode: error.code,
      errorMessage: error.message,
    });
    throw new Error('Could not request a cancellation. Please try again.');
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.success !== true) {
    throw new Error((result.error as string) || 'Could not request a cancellation.');
  }

  return { success: true, data: result };
}

/**
 * FIX-CANCEL: Seller responds to a buyer's cancellation request.
 *  - approve: marks the request approved AND cancels the trade + refund via the
 *    existing `cancel-trade` Edge Function (SP release, Stripe refund, tax void).
 *    The EF skips the seller-cancellation consequence for request approvals.
 *  - decline: marks the request escalated (config-driven) — admin reviews.
 */
export async function respondToCancelRequest(
  tradeId: string,
  userId: string,
  action: 'approve' | 'decline'
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  if (action === 'approve') {
    // Approve + cancel atomically via the existing cancel-trade EF.
    const { data, error } = await supabase.functions.invoke('cancel-trade', {
      body: {
        tradeId,
        reason: 'Buyer requested cancellation — approved by seller',
        cancel_request_id: tradeId,
      },
    });

    if (error) {
      const ctx = (error as any)?.context || {};
      const efError = (data as any)?.error || {};
      console.error('[tradeServiceV2] respondToCancelRequest(approve) error:', {
        tradeId,
        errorCode: efError.code || ctx.code,
        errorMessage: efError.message || ctx.message,
        statusCode: ctx.status,
      });
      throw new Error(efError.message ?? 'Could not approve the cancellation.');
    }

    if (!data || data.success !== true) {
      throw new Error((data as any)?.error || 'Could not approve the cancellation.');
    }

    return { success: true, data };
  }

  // decline → RPC (state only; server escalates per config).
  const { data, error } = await supabase.rpc('fn_respond_cancel_request', {
    p_trade_id: tradeId,
    p_user_id: userId,
    p_action: 'decline',
  });

  if (error) {
    console.error('[tradeServiceV2] respondToCancelRequest(decline) error:', {
      tradeId,
      errorMessage: error.message,
    });
    throw new Error('Could not decline the cancellation. Please try again.');
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.success !== true) {
    throw new Error((result.error as string) || 'Could not decline the cancellation.');
  }

  return { success: true, data: result };
}

/**
 * FIX-CANCEL: Buyer withdraws a pending cancellation request.
 */
export async function withdrawCancelRequest(
  tradeId: string,
  userId: string
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc('fn_withdraw_cancel_request', {
    p_trade_id: tradeId,
    p_user_id: userId,
  });

  if (error) {
    console.error('[tradeServiceV2] withdrawCancelRequest error:', {
      tradeId,
      errorMessage: error.message,
    });
    throw new Error('Could not withdraw the cancellation request. Please try again.');
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.success !== true) {
    throw new Error((result.error as string) || 'Could not withdraw the cancellation request.');
  }

  return { success: true, data: result };
}
