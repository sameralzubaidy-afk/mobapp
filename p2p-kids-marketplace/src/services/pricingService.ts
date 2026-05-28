/**
 * File: p2p-kids-marketplace/src/services/pricingService.ts
 * MODULE-04 LISTING-V3: Pricing Service Layer
 * Task: LISTING-V3-003 - Price suggestion tiers
 *
 * Handles:
 * - Price suggestions based on historical sold prices
 * - 4-tier pricing (Great Deal / Fair / Asking / Almost New)
 * - Price tier labels
 */

import { supabase } from '../config/supabase';
import { PriceSuggestion } from '../types/listing';

// Tier multipliers (midpoints from spec)
// great_deal: 0.40-0.50 range, midpoint 0.45
// fair_price: 0.55-0.65 range, midpoint 0.60
// asking_price: 0.70-0.80 range, midpoint 0.75
// almost_new: 0.85-0.95 range, midpoint 0.90
const TIER_MULTIPLIERS = {
  great_deal: 0.45,
  fair_price: 0.6,
  asking_price: 0.75,
  almost_new: 0.9,
};

// Minimum number of comparable sales required
const MIN_COMPARABLE_SALES = 5;

// Lookback window in days
const LOOKBACK_DAYS = 90;

/**
 * Get suggested prices for an item
 * Queries avg sold price over last 90 days
 * Returns [] if fewer than 5 comparable rows
 * Otherwise returns 4-tier array using multipliers
 *
 * @param categoryId - Category ID
 * @param condition - Item condition
 * @returns Array of price suggestions (empty if insufficient data)
 */
export async function getSuggestedPrice(
  categoryId?: string,
  condition?: string
): Promise<PriceSuggestion[]> {
  try {
    // If no category, cannot provide suggestions
    if (!categoryId) {
      return [];
    }

    // Calculate lookback date
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    // Query sold items in same category
    let query = supabase
      .from('items')
      .select('price')
      .eq('category_id', categoryId)
      .eq('status', 'sold')
      .gte('sold_at', lookbackDate.toISOString());

    // Optionally filter by condition for more accurate suggestions
    if (condition) {
      query = query.eq('condition', condition);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Check if we have enough data
    if (!data || data.length < MIN_COMPARABLE_SALES) {
      return [];
    }

    // Calculate average price
    const total = data.reduce((sum: number, item: { price: number | null }) => sum + (item.price || 0), 0);
    const avgPrice = total / data.length;

    // Generate 4 tiers
    const tiers: PriceSuggestion[] = [
      {
        tier: 'great_deal',
        label: 'Great Deal',
        price: Math.round(avgPrice * TIER_MULTIPLIERS.great_deal * 100) / 100,
        description: 'Quick sale, excellent value',
      },
      {
        tier: 'fair_price',
        label: 'Fair Price',
        price: Math.round(avgPrice * TIER_MULTIPLIERS.fair_price * 100) / 100,
        description: 'Competitive pricing',
      },
      {
        tier: 'asking_price',
        label: 'Asking Price',
        price: Math.round(avgPrice * TIER_MULTIPLIERS.asking_price * 100) / 100,
        description: 'Market average',
      },
      {
        tier: 'almost_new',
        label: 'Almost New',
        price: Math.round(avgPrice * TIER_MULTIPLIERS.almost_new * 100) / 100,
        description: 'Premium pricing',
      },
    ];

    return tiers;
  } catch (error: any) {
    console.error('[pricingService] Get suggested price error:', error);
    return [];
  }
}

/**
 * Get price tier label by ID
 *
 * @param tierId - Tier ID
 * @returns Tier label
 */
export function getPriceTierLabel(tierId: string): string {
  const labels: Record<string, string> = {
    great_deal: 'Great Deal',
    fair_price: 'Fair Price',
    asking_price: 'Asking Price',
    almost_new: 'Almost New',
  };

  return labels[tierId] || 'Custom Price';
}

/**
 * Format price for display
 *
 * @param price - Price in dollars
 * @returns Formatted price string (e.g., "$12.99")
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Validate price
 *
 * @param price - Price to validate
 * @returns Validation result
 */
export function validatePrice(price: number): { valid: boolean; error?: string } {
  if (price <= 0) {
    return { valid: false, error: 'Price must be greater than $0' };
  }

  if (price > 10000) {
    return { valid: false, error: 'Price cannot exceed $10,000' };
  }

  // Check for reasonable decimal places (max 2)
  const decimalPlaces = (price.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Price cannot have more than 2 decimal places' };
  }

  return { valid: true };
}
