// FILE: p2p-kids-marketplace/src/services/spCalculatorService.ts
// MODULE-18 V1 EDU-003: SP Calculator service (delegates to MODULE-12 V3)

import type { SPCalculation, BonusCategory } from '../types/education';
import { calculateCategorySP, getCategoryById, getBonusCategories as getV3BonusCategories } from './categoryService';
import { getAdminConfig } from './adminConfig';
import { supabase } from '../config/supabase';

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ❌ DEPRECATED: Percentage-based fee removed per BACKEND-AUDIT-REPORT Part 1
// BRD requires flat fees only: $2.99 for free users, $0.99 for subscribers

/**
 * Calculate SP for an item (sell or buy mode)
 * Delegates 100% of math to MODULE-12 V3 calculateCategorySP
 * Returns discriminated union based on mode
 *
 * @param itemPrice - Item price in dollars
 * @param categoryId - Category ID
 * @param mode - 'sell' or 'buy'
 * @param spToUse - SP amount user wants to use (buy mode only)
 * @returns SP calculation result or null
 */
export async function calculateSP(
  itemPrice: number,
  categoryId: string,
  mode: 'sell' | 'buy',
  spToUse?: number
): Promise<SPCalculation | null> {
  try {
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      return null;
    }

    // Get category details
    const category = await getCategoryById(categoryId);
    if (!category || !category.is_active) {
      return null;
    }

    // Delegate to MODULE-12 V3
    const spResult = await calculateCategorySP(categoryId, itemPrice);
    if (!spResult) {
      return null;
    }

    const multiplier = category.sp_earning_multiplier || 1.1;
    const capPercent = category.sp_spending_cap_percent || 70;
    const isBonus = multiplier > 1.1;

    if (mode === 'sell') {
      return {
        mode: 'sell',
        price: itemPrice,
        category_id: categoryId,
        category_name: category.name,
        earn_sp: spResult.earn_sp,
        multiplier,
        is_bonus: isBonus,
      };
    } else {
      // Buy mode
      const adminConfig = await getAdminConfig();
      
      // ✅ FIX: Use flat fee from admin config (educational preview shows non-subscriber fee)
      // Per SYSTEM_REQUIREMENTS_V2.md Section 8.1.1: Free users = $2.99, Subscribers = $0.99
      const feeInCents = Number(adminConfig.transaction_fee_non_subscriber_cents ?? 299);
      const fee = roundToCents(feeInCents / 100);

      // For educational preview, default to max usable SP when caller does not provide a value.
      const requestedSp = spToUse ?? spResult.max_spend_sp;
      const clampedSp = Math.max(0, Math.min(requestedSp, spResult.max_spend_sp));

      const cashPaid = roundToCents(Math.max(0, itemPrice - clampedSp));
      const totalCost = roundToCents(cashPaid + fee);

      return {
        mode: 'buy',
        price: itemPrice,
        category_id: categoryId,
        category_name: category.name,
        max_sp_usable: spResult.max_spend_sp,
        sp_spending_cap_percent: capPercent,
        sp_to_use: clampedSp,
        cash_paid: cashPaid,
        fee,
        total_cost: totalCost,
        is_bonus: isBonus,
      };
    }
  } catch (error: any) {
    console.error('[spCalculatorService] Calculate SP error:', error);
    return null;
  }
}

/**
 * Get bonus categories (sp_earning_multiplier > 1.10)
 * Delegates to MODULE-12 V3 getBonusCategories
 * Does NOT re-query — direct passthrough
 *
 * @returns Array of bonus categories
 */
export async function getBonusCategories(): Promise<BonusCategory[]> {
  try {
    const categories = await getV3BonusCategories();
    
    // Map to BonusCategory type - add item_count field which is required by BonusCategory
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      icon_url: cat.icon_url || null,
      bonus_badge_icon_url: cat.bonus_badge_icon_url || null,
      sp_earning_multiplier: cat.sp_earning_multiplier || 1.1,
      sp_spending_cap_percent: cat.sp_spending_cap_percent || 70,
      item_count: cat.item_count || 0, // CategoryWithCount already provides this
    }));
  } catch (error: any) {
    console.error('[spCalculatorService] Get bonus categories error:', error);
    return [];
  }
}

/**
 * ⭐ CORRECTED FORMULA (2026-06-07): Calculate total SP seller receives.
 * Formula depends on buyer's payment method:
 *   - If buyer uses SP: seller_sp = FLOOR(buyer_sp × category_multiplier)
 *   - If buyer pays all cash: seller_sp = FLOOR(price × category_multiplier)
 * 
 * Examples:
 *   - $50 item, 1.10× multiplier, buyer offers 30 SP → seller gets 33 SP
 *   - $50 item, 1.10× multiplier, buyer pays all cash → seller gets 55 SP
 * 
 * Used to show total SP to seller (no source breakdown shown per D-11).
 */
export async function calculatePlatformSP(listingId: string): Promise<number> {
  try {
    const { data: listing, error } = await supabase
      .from('items')
      .select('price, category_id, accepts_swap_points')
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      console.error('[spCalculatorService] calculatePlatformSP — listing not found:', error?.message);
      return 0;
    }

    // SP is only awarded for Accept SP listings (Cash Only = no SP)
    if (!listing.accepts_swap_points) {
      return 0;
    }

    // Get category multiplier
    let categoryMultiplier = 1.0;
    const category = await getCategoryById(listing.category_id ?? '');
    if (category?.sp_earning_multiplier) {
      categoryMultiplier = category.sp_earning_multiplier;
    }

    // ⭐ CORRECTED: If buyer pays all cash, seller gets price × multiplier
    // This is used for preview when buyer hasn't decided yet, so assume all cash case
    return Math.floor(listing.price * categoryMultiplier);
  } catch (err: any) {
    console.error('[spCalculatorService] calculatePlatformSP error:', err);
    return 0;
  }
}

/**
 * ⭐ CORRECTED FORMULA (2026-06-07): Preview total SP seller will receive.
 * 
 * Formula:
 *   - If buyer uses SP: total = FLOOR(buyer_sp × category_multiplier)
 *   - If buyer pays all cash (buyerSpAmount = 0): total = FLOOR(price × category_multiplier)
 * 
 * D-11 rule: seller sees ONLY the combined total, never a breakdown.
 */
export async function previewTotalSPToSeller(
  listingId: string,
  buyerSpAmount: number
): Promise<{ buyerSp: number; platformSp: number; totalSp: number }> {
  try {
    const { data: listing, error } = await supabase
      .from('items')
      .select('price, category_id, accepts_swap_points')
      .eq('id', listingId)
      .single();

    if (error || !listing || !listing.accepts_swap_points) {
      // Cash only or error → no SP
      return { buyerSp: 0, platformSp: 0, totalSp: 0 };
    }

    // Get category multiplier
    let categoryMultiplier = 1.0;
    const category = await getCategoryById(listing.category_id ?? '');
    if (category?.sp_earning_multiplier) {
      categoryMultiplier = category.sp_earning_multiplier;
    }

    // ⭐ CORRECTED FORMULA
    let totalSp = 0;
    if (buyerSpAmount > 0) {
      // Buyer used SP: multiply buyer's amount by category multiplier
      totalSp = Math.floor(buyerSpAmount * categoryMultiplier);
    } else {
      // Buyer paid all cash: multiply price by category multiplier
      totalSp = Math.floor(listing.price * categoryMultiplier);
    }

    return {
      buyerSp: buyerSpAmount,
      platformSp: totalSp - buyerSpAmount, // For backward compatibility
      totalSp,
    };
  } catch (err: any) {
    console.error('[spCalculatorService] previewTotalSPToSeller error:', err);
    return { buyerSp: 0, platformSp: 0, totalSp: 0 };
  }
}
