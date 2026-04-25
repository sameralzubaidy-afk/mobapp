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
  is_active: boolean;
  display_order: number;
  item_count?: number;
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
 * Get categories with item counts
 * Optionally includes inactive categories
 * 
 * @param includeInactive - Whether to include inactive categories
 * @returns Array of categories with counts
 */
export async function getCategoriesWithCounts(
  includeInactive: boolean = false
): Promise<CategoryWithCount[]> {
  try {
    // Build query
    let query = supabase
      .from('categories')
      .select(`
        id,
        name,
        icon,
        is_active,
        display_order
      `)
      .order('display_order', { ascending: true });

    // Filter by active status if needed
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) throw error;

    if (!categories) {
      return [];
    }

    // Get item counts for each category
    const categoriesWithCounts: CategoryWithCount[] = await Promise.all(
      categories.map(async (category) => {
        const { count, error: countError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('status', 'available');

        return {
          ...category,
          item_count: countError ? 0 : (count || 0),
        };
      })
    );

    return categoriesWithCounts;
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
