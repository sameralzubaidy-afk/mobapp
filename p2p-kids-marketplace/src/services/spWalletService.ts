/**
 * File: p2p-kids-marketplace/src/services/spWalletService.ts
 *
 * Live SP wallet balance check for points-redemption feature.
 * Provides real-time wallet balance (bypassing client-side caches)
 * and category SP redemption cap for per-item validation.
 */

import { supabase } from '@/config/supabase';

export interface SpBalanceResult {
  availableBalance: number;
  reservedSp: number;
  state: string; // 'active' | 'frozen' | 'no_wallet'
}

export interface SpCategoryCapResult {
  listingId: string;
  spRedemptionCap: number;
}

/**
 * Fetch buyer's current available SP balance (force-refresh, no cache).
 */
export async function getBuyerSpBalance(): Promise<SpBalanceResult> {
  const { data, error } = await supabase.rpc('rpc_get_buyer_sp_balance');

  if (error) {
    console.error('[spWalletService] getBuyerSpBalance RPC error:', error);
    return { availableBalance: 0, reservedSp: 0, state: 'no_wallet' };
  }

  // RPC returns snake_case keys; extract them safely
  const raw = data as Record<string, unknown>;
  const rawData = (raw?.data ?? {}) as Record<string, unknown>;
  return {
    availableBalance: typeof rawData.available_balance === 'number' ? rawData.available_balance : 0,
    reservedSp: typeof rawData.reserved_sp === 'number' ? rawData.reserved_sp : 0,
    state: typeof rawData.state === 'string' ? rawData.state : 'no_wallet',
  };
}

/**
 * Fetch the SP redemption cap for a specific listing's category.
 * Falls back to global cap if category has no specific cap.
 */
export async function getCategorySpCap(listingId: string): Promise<number> {
  const { data, error } = await supabase.rpc('rpc_get_category_sp_cap', {
    p_listing_id: listingId,
  });

  if (error) {
    console.error('[spWalletService] getCategorySpCap RPC error:', error);
    return 100;
  }

  // RPC returns snake_case keys; extract safely
  const raw = data as Record<string, unknown>;
  const rawData = (raw?.data ?? {}) as Record<string, unknown>;
  const cap = rawData.sp_redemption_cap;
  return typeof cap === 'number' ? cap : 100;
}

/**
 * Calculate the effective SP amount for an item given:
 * - item price (dollars)
 * - remaining wallet balance
 * - category redemption cap
 * - 50% global SP cap
 *
 * Returns the lesser of all applicable caps.
 */
export function calcEffectiveSpForItem(
  itemPriceDollars: number,
  remainingBalance: number,
  categoryCap: number
): { spApplied: number; cappedBy: 'wallet' | 'category' | 'global' | 'full' } {
  // Guard against NaN / undefined inputs
  const safePrice = Number.isFinite(itemPriceDollars) ? itemPriceDollars : 0;
  const safeBalance = Number.isFinite(remainingBalance) ? remainingBalance : 0;
  const safeCap = Number.isFinite(categoryCap) ? categoryCap : 100;

  if (safePrice <= 0 || safeBalance <= 0) {
    return { spApplied: 0, cappedBy: 'wallet' };
  }

  // 50% global cap (SP_CAP_PERCENT from constants)
  const globalCap = Math.floor(safePrice * 0.5);

  // Effective cap = min(global cap, category cap, remaining balance)
  const effective = Math.min(globalCap, safeCap, safeBalance);

  if (effective <= 0) {
    return { spApplied: 0, cappedBy: 'wallet' };
  }

  // Determine which cap limited the amount
  let cappedBy: 'wallet' | 'category' | 'global' | 'full' = 'full';
  if (effective === safeBalance && safeBalance < globalCap && safeBalance < safeCap) {
    cappedBy = 'wallet';
  } else if (effective === safeCap && safeCap < globalCap) {
    cappedBy = 'category';
  } else if (effective === globalCap) {
    cappedBy = 'global';
  }

  return { spApplied: effective, cappedBy };
}
