// FILE: p2p-kids-marketplace/src/services/spCalculatorService.ts
// MODULE-18 V1 EDU-003: SP Calculator service (delegates to MODULE-12 V3)

import type { SPCalculation, BonusCategory } from '../types/education';
import { calculateCategorySP, getCategoryById, getBonusCategories as getV3BonusCategories } from './categoryService';
import { getAdminConfig } from './adminConfig';
import { getSubscriptionSummary } from './subscription';
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
      
      // R1 — Tiered Buyer-Fee Engine: educational preview shows a representative
      // flat fee. The ACTUAL fee is resolved server-side at checkout via
      // fn_get_buyer_fee_for_checkout (flat for active members / first-trade users,
      // or % + fixed for free users with 1+ completed trades). This preview is
      // illustrative only — it is never the charge.
      //
      // The preview is now subscriber-aware: Kids Club+ members see the subscriber
      // flat fee (staging $1.00), free users the non-subscriber fee (staging $20.00).
      // QA: Group Q+S 2026-08-23 — a subscriber previously saw the $20.00 figure.
      let feeInCents: number;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let isSubscriber = false;
        if (user?.id) {
          const summary = await getSubscriptionSummary(user.id);
          isSubscriber = summary.is_subscriber;
        }

        feeInCents = Number(
          isSubscriber
            ? adminConfig.transaction_fee_subscriber_cents ?? 99
            : adminConfig.transaction_fee_non_subscriber_cents ?? 299
        );
      } catch (error: any) {
        // Never fail the whole preview on a tier-lookup error — fall back to the
        // non-subscriber figure so the calculator still renders.
        console.warn(
          '[spCalculatorService] Failed to resolve tier for fee preview, using non-subscriber fee:',
          error
        );
        feeInCents = Number(adminConfig.transaction_fee_non_subscriber_cents ?? 299);
      }
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

    // ⭐ CORRECTED (2026-08-28, C05): the live credit path
    // (fn_release_all_sp_on_complete, DT-17/DT-19) credits the seller a platform
    // bonus of FLOOR(price × 0.25 × multiplier) — NOT price × multiplier — and
    // only when the seller has an active/trial subscription. This mirrors the
    // actual credited figure (e.g. a $40 item at 1.3x → 13 SP platform bonus).
    const itemPrice = Number(listing.price) || 0;
    if (itemPrice <= 0) return 0;
    if (!(await currentUserIsSubscriber())) return 0;
    return Math.floor(itemPrice * 0.25 * categoryMultiplier);
  } catch (err: any) {
    console.error('[spCalculatorService] calculatePlatformSP error:', err);
    return 0;
  }
}

/**
 * Resolve whether the current user holds an active/trial Kids Club+ subscription.
 * Used to gate the seller-side platform SP bonus preview, mirroring the server
 * check (v_seller_is_subscriber in fn_release_all_sp_on_complete).
 */
async function currentUserIsSubscriber(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;
    const summary = await getSubscriptionSummary(user.id);
    return summary.is_subscriber;
  } catch (err: any) {
    console.warn('[spCalculatorService] Failed to resolve subscriber status:', err);
    return false;
  }
}

/**
 * ⭐ CORRECTED FORMULA (2026-08-28, C05 fix): Preview total SP seller will receive.
 *
 * Mirrors the LIVE credit path (fn_release_all_sp_on_complete, DT-17/DT-19):
 *   - Seller platform bonus = FLOOR(price × 0.25 × category_multiplier),
 *     credited ONLY when the seller has an active/trial subscription.
 *     The buyer's SP amount does NOT scale the bonus — it is always 25% of the
 *     item price × multiplier. (Previous formula FLOOR(buyerSp × multiplier)
 *     showed e.g. +10 SP when the real credit was +21 = 8 buyer + 13 platform.)
 *   - Total = buyerSp + platformSp.
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

    const itemPrice = Number(listing.price) || 0;

    let platformSp = 0;
    if (itemPrice > 0 && (await currentUserIsSubscriber())) {
      platformSp = Math.floor(itemPrice * 0.25 * categoryMultiplier);
    }

    const buyerSp = Math.max(0, Math.floor(buyerSpAmount || 0));

    return {
      buyerSp,
      platformSp,
      totalSp: buyerSp + platformSp,
    };
  } catch (err: any) {
    console.error('[spCalculatorService] previewTotalSPToSeller error:', err);
    return { buyerSp: 0, platformSp: 0, totalSp: 0 };
  }
}
