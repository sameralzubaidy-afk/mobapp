/**
 * File: p2p-kids-marketplace/src/utils/spCalculations.ts
 * MODULE-04 LISTING-V3-011: SP Calculation Utilities
 * Task: LISTING-V3-011 - SP earnings preview for single & bulk listing
 * 
 * Pure functions for client-side SP calculations.
 * Follows MODULE-12 V3 rounding rules:
 * - earn_sp: Math.round (nearest integer)
 * - max_spend_sp: Math.floor (never exceed cap)
 * 
 * @see BRD US-SUB-002: SP earnings preview requirement
 */

/**
 * Calculate SP earnings for a single item (seller perspective)
 * @param price Item price in dollars
 * @param multiplier Category SP multiplier (1.05 - 1.40)
 * @returns Rounded SP amount (Math.round)
 */
export function calculateEarnedSP(price: number, multiplier: number): number {
  // Validation: price must be positive, multiplier in valid range
  if (price <= 0 || !Number.isFinite(price)) return 0;
  if (multiplier < 1.05 || multiplier > 1.40 || !Number.isFinite(multiplier)) {
    // Fallback to default 1.10x if invalid
    multiplier = 1.10;
  }
  
  // MODULE-12 V3 rule: Math.round for earning SP
  return Math.round(price * multiplier);
}

/**
 * Calculate max SP buyer can spend (not used for seller preview, included for completeness)
 * @param price Item price in dollars
 * @param spendingCapPercent Category spending cap (50-80%)
 * @returns Floored SP amount (Math.floor)
 */
export function calculateMaxSpendSP(price: number, spendingCapPercent: number): number {
  if (price <= 0 || !Number.isFinite(price)) return 0;
  if (spendingCapPercent < 50 || spendingCapPercent > 80 || !Number.isFinite(spendingCapPercent)) {
    // Fallback to default 70% if invalid
    spendingCapPercent = 70;
  }
  
  // MODULE-12 V3 rule: Math.floor for spending cap
  return Math.floor((price * spendingCapPercent) / 100);
}

/**
 * Aggregate SP for bulk listing
 * @param items Array of items with category_id and price
 * @param getMultiplier Function to retrieve multiplier for a category ID
 * @returns { totalSP, breakdown: { categoryId, categoryName, count, sp }[] }
 */
export function calculateBulkTotalSP(
  items: Array<{
    category_id: string | null;
    price: number;
    includeInPublish?: boolean;
  }>,
  getMultiplier: (categoryId: string | null) => number,
  categoryNames?: Map<string, string>
): {
  totalSP: number;
  breakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    sp: number;
    multiplier: number;
  }>;
} {
  // Filter to items that will be published and have valid data
  const validItems = items.filter(
    (item) =>
      (item.includeInPublish === undefined || item.includeInPublish) &&
      item.category_id &&
      item.price > 0
  );

  // Group by category
  const categoryMap = new Map<
    string,
    { count: number; totalPrice: number; multiplier: number; name: string }
  >();

  validItems.forEach((item) => {
    const categoryId = item.category_id!;
    const multiplier = getMultiplier(categoryId);
    const existing = categoryMap.get(categoryId);

    if (existing) {
      existing.count += 1;
      existing.totalPrice += item.price;
    } else {
      categoryMap.set(categoryId, {
        count: 1,
        totalPrice: item.price,
        multiplier,
        name: categoryNames?.get(categoryId) || categoryId,
      });
    }
  });

  // Calculate SP per category
  const breakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: data.name,
    count: data.count,
    sp: calculateEarnedSP(data.totalPrice, data.multiplier),
    multiplier: data.multiplier,
  }));

  // Total SP
  const totalSP = breakdown.reduce((sum, cat) => sum + cat.sp, 0);

  return { totalSP, breakdown };
}

/**
 * Format SP value for display
 * @param sp SP amount
 * @returns Formatted string (e.g., "~35 SP")
 */
export function formatSP(sp: number): string {
  if (!Number.isFinite(sp) || sp < 0) return '0 SP';
  const rounded = Math.round(sp);
  if (rounded === 0) return '0 SP';
  return `~${rounded} SP`;
}

/**
 * Format multiplier for display
 * @param multiplier Multiplier value
 * @returns Formatted string (e.g., "1.20x")
 */
export function formatMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier) || multiplier < 1) return '1.00x';
  return `${multiplier.toFixed(2)}x`;
}
