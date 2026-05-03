// FILE: p2p-kids-marketplace/src/services/educationExampleService.ts
// MODULE-18 V1 EDU-003: Education example service (mobile read-only)

import { supabase } from '../config/supabase';
import type { EducationExample } from '../types/education';
import { calculateCategorySP, getCategoryById } from './categoryService';

/**
 * Calculated SP values for an example
 * Shaped for UI display
 */
export interface ExampleSPResult {
  earn_sp: number;
  max_use_sp: number;
  cash_paid: number; // price - max_use_sp
  fee: number; // 10% of price
  is_bonus: boolean; // true if category sp_earning_multiplier > 1.10
  category_name: string;
}

/**
 * Get all published examples
 * Ordered by display_order
 *
 * @returns Array of published examples
 */
export async function getPublishedExamples(): Promise<EducationExample[]> {
  try {
    const { data, error } = await supabase
      .from('education_examples')
      .select(
        `
        id,
        item_name,
        item_price,
        category_id,
        display_order,
        is_published,
        created_at
      `
      )
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return (data || []) as EducationExample[];
  } catch (error: any) {
    console.error('[educationExampleService] Get published examples error:', error);
    return [];
  }
}

/**
 * Calculate SP values for an example
 * Delegates to MODULE-12 V3 calculateCategorySP
 * Returns null if category is missing/inactive
 *
 * @param price - Item price in dollars
 * @param categoryId - Category ID (can be null)
 * @returns Calculated SP result or null
 */
export async function calculateExampleSP(
  price: number,
  categoryId: string | null
): Promise<ExampleSPResult | null> {
  try {
    // If no category, return null
    if (!categoryId) {
      return null;
    }

    // Get category details for name
    const category = await getCategoryById(categoryId);
    if (!category || !category.is_active) {
      return null;
    }

    // Delegate SP calculation to MODULE-12 V3
    const spResult = await calculateCategorySP(categoryId, price);
    if (!spResult) {
      return null;
    }

    // Calculate fee (10% of price — MVP constant)
    const fee = Math.round(price * 0.1 * 100) / 100;

    // Calculate cash paid (price minus max SP usable)
    const cashPaid = price - spResult.max_spend_sp;

    // Check if bonus (multiplier > 1.10)
    const multiplier = category.sp_earning_multiplier || 1.1;
    const isBonus = multiplier > 1.1;

    return {
      earn_sp: spResult.earn_sp,
      max_use_sp: spResult.max_spend_sp,
      cash_paid: Math.max(0, cashPaid),
      fee,
      is_bonus: isBonus,
      category_name: category.name,
    };
  } catch (error: any) {
    console.error('[educationExampleService] Calculate example SP error:', error);
    return null;
  }
}
