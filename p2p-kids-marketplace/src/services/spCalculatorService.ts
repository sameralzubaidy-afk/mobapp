// FILE: p2p-kids-marketplace/src/services/spCalculatorService.ts
// MODULE-18 V1 EDU-003: SP Calculator service (delegates to MODULE-12 V3)

import type { SPCalculation, BonusCategory } from '../types/education';
import { calculateCategorySP, getCategoryById, getBonusCategories as getV3BonusCategories } from './categoryService';
import { getAdminConfig } from './adminConfig';

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function calculateBuyerPlatformFee(itemPrice: number, feePercentage: number, fixedCents: number): number {
  const percentComponent = itemPrice * (feePercentage / 100);
  const fixedComponent = fixedCents / 100;
  return roundToCents(percentComponent + fixedComponent);
}

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
      const feePercentage = Number(adminConfig.platform_fee_buyer_percentage ?? 0);
      const feeFixedCents = Number(adminConfig.platform_fee_buyer_fixed_cents ?? 0);

      // For educational preview, default to max usable SP when caller does not provide a value.
      const requestedSp = spToUse ?? spResult.max_spend_sp;
      const clampedSp = Math.max(0, Math.min(requestedSp, spResult.max_spend_sp));

      const cashPaid = roundToCents(Math.max(0, itemPrice - clampedSp));
      const fee = calculateBuyerPlatformFee(itemPrice, feePercentage, feeFixedCents);
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
