/**
 * File: p2p-kids-marketplace/src/services/categoryService.ts
 * MODULE-04 LISTING-V3: Category Service Layer
 * Task: LISTING-V3-003 - Category operations with V3 enhancements
 * 
 * Handles:
 * - Category fetching (reuses existing from items.ts)
 * - Category counts
 * - Flag for category review (Other category flow)
 * - Recent categories (AsyncStorage LRU)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { getCategories as getV2Categories } from './items';

/**
 * Category with item count
 */
export interface CategoryWithCount {
  id: string;
  name: string;
  icon: string | null;
  icon_url?: string | null;
  bonus_badge_icon_url?: string | null;
  is_active: boolean;
  display_order: number;
  item_count?: number;
  sp_earning_multiplier?: number;
  sp_spending_cap_percent?: number;
}

// AsyncStorage key for recent categories
const RECENT_CATEGORIES_KEY_PREFIX = '@kids_marketplace:recent_categories_';

// Max recent categories to store
const MAX_RECENT_CATEGORIES = 3;

/**
 * Get categories (V2 compatibility)
 * Re-exports from items.ts for backward compatibility
 */
export const getCategories = getV2Categories;

/**
 * Get categories with optional inactive inclusion
 * Item counts are still fetched for analytics/UI consumers, but not used to hide categories.
 * 
 * @param includeInactive - Whether to include inactive categories (default: false)
 * @returns Array of categories with counts
 */
export async function getCategoriesWithCounts(
  includeInactive: boolean = false
): Promise<CategoryWithCount[]> {
  try {
    // Build query - fetch item_count from the column (maintained by trigger)
    let query = supabase
      .from('categories')
      .select(`
        id,
        name,
        icon,
        icon_url,
        bonus_badge_icon_url,
        is_active,
        item_count,
        display_order,
        sp_earning_multiplier,
        sp_spending_cap_percent
      `)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    // Filter by active status when requested.
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) throw error;

    if (!categories) {
      return [];
    }

    return categories as CategoryWithCount[];
  } catch (error: any) {
    console.error('[categoryService] Get categories with counts error:', error);
    return [];
  }
}

/**
 * Flag item for category review
 * Idempotent operation (upsert review_flag)
 * Called when user selects "Other" and enters custom category name
 * 
 * @param itemId - Item ID
 * @param requestedCategoryName - User-entered category name
 * @returns Success status
 */
export async function flagForCategoryReview(
  itemId: string,
  requestedCategoryName: string
): Promise<boolean> {
  try {
    // Update item with requested category name
    const { error: updateError } = await supabase
      .from('items')
      .update({ requested_category_name: requestedCategoryName })
      .eq('id', itemId);

    if (updateError) throw updateError;

    // Insert or update review flag
    // Using upsert for idempotency
    const { error: flagError } = await supabase
      .from('review_flags')
      .upsert(
        {
          item_id: itemId,
          type: 'category_suggestion',
          details: {
            requested_name: requestedCategoryName,
            flagged_at: new Date().toISOString(),
          },
        },
        {
          onConflict: 'item_id,type',
        }
      );

    if (flagError) {
      // If review_flags table doesn't exist yet, log but don't fail
      console.warn('[categoryService] Review flag insert failed (table may not exist yet):', flagError);
    }

    return true;
  } catch (error: any) {
    console.error('[categoryService] Flag for category review error:', error);
    return false;
  }
}

/**
 * Create or update a category suggestion entry for admin review queue.
 * Uses upsert on item_id so repeated publishes/edits stay idempotent.
 *
 * @param itemId - Item ID
 * @param suggestedName - Seller-entered category name
 * @param sellerId - Seller user ID (auth.users.id)
 * @returns Success status
 */
export async function createCategorySuggestionFromItem(
  itemId: string,
  suggestedName: string,
  sellerId: string
): Promise<boolean> {
  try {
    const trimmedName = suggestedName.trim();
    if (!itemId || !trimmedName || !sellerId) {
      throw new Error('itemId, suggestedName, and sellerId are required');
    }

    const { error } = await supabase
      .from('category_suggestions')
      .upsert(
        {
          item_id: itemId,
          seller_id: sellerId,
          suggested_name: trimmedName,
          status: 'pending',
          approved_by: null,
          merged_to_category_id: null,
          admin_note: null,
          reviewed_at: null,
        },
        {
          onConflict: 'item_id',
        }
      );

    if (error) {
      throw error;
    }

    return true;
  } catch (error: any) {
    console.error('[categoryService] Create category suggestion error:', error);
    return false;
  }
}

/**
 * Get recent categories for seller
 * LRU cache in AsyncStorage
 * Max 3 entries
 * 
 * @param sellerId - Seller ID
 * @returns Array of recent category IDs
 */
export async function getRecentCategories(sellerId: string): Promise<string[]> {
  try {
    const key = `${RECENT_CATEGORIES_KEY_PREFIX}${sellerId}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) {
      return [];
    }

    const recent: string[] = JSON.parse(cached);
    return recent.slice(0, MAX_RECENT_CATEGORIES);
  } catch (error: any) {
    console.error('[categoryService] Get recent categories error:', error);
    return [];
  }
}

/**
 * Save recent category for seller
 * Updates LRU cache in AsyncStorage
 * Max 3 entries, most recent first
 * 
 * @param sellerId - Seller ID
 * @param categoryId - Category ID to add
 * @returns Success status
 */
export async function saveRecentCategory(
  sellerId: string,
  categoryId: string
): Promise<boolean> {
  try {
    const key = `${RECENT_CATEGORIES_KEY_PREFIX}${sellerId}`;
    
    // Get existing recent categories
    const existing = await getRecentCategories(sellerId);

    // Remove categoryId if already in list
    const filtered = existing.filter(id => id !== categoryId);

    // Add to front
    const updated = [categoryId, ...filtered].slice(0, MAX_RECENT_CATEGORIES);

    // Save back to AsyncStorage
    await AsyncStorage.setItem(key, JSON.stringify(updated));

    return true;
  } catch (error: any) {
    console.error('[categoryService] Save recent category error:', error);
    return false;
  }
}
/**
 * Get bonus categories (sp_earning_multiplier > 1.10)
 * Returns categories with bonus earning rates, ordered by multiplier descending
 * 
 * @returns Array of bonus categories
 */
export async function getBonusCategories(): Promise<CategoryWithCount[]> {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        icon,
        icon_url,
        bonus_badge_icon_url,
        is_active,
        item_count,
        display_order,
        sp_earning_multiplier,
        sp_spending_cap_percent
      `)
      .eq('is_active', true)
      .gt('sp_earning_multiplier', 1.10)
      .order('sp_earning_multiplier', { ascending: false });

    if (error) throw error;

    return (categories || []) as CategoryWithCount[];
  } catch (error: any) {
    console.error('[categoryService] Get bonus categories error:', error);
    return [];
  }
}

/**
 * Calculate category-specific SP earning and spending rates
 * Used in checkout and listing flows to show SP preview
 * 
 * @param categoryId - Category ID
 * @param price - Item price in dollars
 * @returns SP calculation result
 */
export async function calculateCategorySP(
  categoryId: string,
  price: number
): Promise<{
  earn_sp: number;
  max_spend_sp: number;
  spend_percent: number;
} | null> {
  try {
    const { data: category, error } = await supabase
      .from('categories')
      .select('sp_earning_multiplier, sp_spending_cap_percent')
      .eq('id', categoryId)
      .single();

    if (error) throw error;

    if (!category) {
      return null;
    }

    // Rounding rules from MODULE-12 V3:
    // - earn_sp: Math.round (nearest integer)
    // - max_spend_sp: Math.floor (never exceed cap)
    const multiplier = category.sp_earning_multiplier || 1.10;
    const capPercent = category.sp_spending_cap_percent || 70;

    return {
      earn_sp: Math.round(price * multiplier),
      max_spend_sp: Math.floor((price * capPercent) / 100),
      spend_percent: capPercent,
    };
  } catch (error: any) {
    console.error('[categoryService] Calculate category SP error:', error);
    return null;
  }
}
/**
 * Get category by ID
 * 
 * @param categoryId - Category ID
 * @returns Category or null
 */
export async function getCategoryById(categoryId: string): Promise<CategoryWithCount | null> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error) throw error;

    return data as CategoryWithCount;
  } catch (error: any) {
    console.error('[categoryService] Get category by ID error:', error);
    return null;
  }
}

/**
 * Search categories by name
 * Case-insensitive search
 * 
 * @param query - Search query
 * @returns Matching categories
 */
export async function searchCategories(query: string): Promise<CategoryWithCount[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .ilike('name', `%${query}%`)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(10);

    if (error) throw error;

    return (data as CategoryWithCount[]) || [];
  } catch (error: any) {
    console.error('[categoryService] Search categories error:', error);
    return [];
  }
}
