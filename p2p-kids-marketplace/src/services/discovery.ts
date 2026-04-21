/**
 * File: p2p-kids-marketplace/src/services/discovery.ts
 * MODULE-05-DISCOVERY-V2: Discovery Service
 * MODULE-05-DISCOVERY-V3: Enhanced with 13-param search + filters
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * Task: DISCOVERY-V3-003 - Services Layer
 * 
 * Handles search, browsing, and recommendation queries
 */

import { supabase } from '../config/supabase';
import {
  SearchResult,
  CategoryResult,
  DiscoveryFilters,
  CategoryFilters,
  Recommendation,
} from '../types/discovery';
import { trackEvent } from './analytics';
import { findClosestMatch } from '../utils/fuzzyMatch';

interface DiscoveryListingImage {
  id: string;
  item_id: string;
  url: string;
  thumbnail_url: string | null;
  display_order: number;
}

type DiscoveryListingImageView = Omit<DiscoveryListingImage, 'item_id'>;

const attachListingImages = async <T extends { id: string }>(
  rows: T[]
): Promise<(T & { images: DiscoveryListingImageView[] })[]> => {
  if (!rows.length) {
    return [];
  }

  const fromResult = (supabase as unknown as { from?: (table: string) => any }).from?.('item_images');
  if (!fromResult || typeof fromResult.select !== 'function') {
    return rows as (T & { images: DiscoveryListingImageView[] })[];
  }

  const listingIds = rows.map((row) => row.id);
  const selected = fromResult.select('id, item_id, url, thumbnail_url, display_order');
  if (!selected || typeof selected.in !== 'function') {
    return rows as (T & { images: DiscoveryListingImageView[] })[];
  }

  const { data: images, error } = await selected.in('item_id', listingIds);

  if (error) {
    console.warn('[discovery] Failed to attach listing images:', error.message);
    return rows as (T & { images: DiscoveryListingImageView[] })[];
  }

  const imageMap = new Map<string, DiscoveryListingImageView[]>();
  (images || []).forEach((image: DiscoveryListingImage) => {
    const imageView: DiscoveryListingImageView = {
      id: image.id,
      url: image.url,
      thumbnail_url: image.thumbnail_url,
      display_order: image.display_order,
    };

    if (!imageMap.has(image.item_id)) {
      imageMap.set(image.item_id, [imageView]);
      return;
    }

    imageMap.get(image.item_id)?.push(imageView);
  });

  return rows.map((row) => {
    const sortedImages = [...(imageMap.get(row.id) || [])].sort(
      (a, b) => a.display_order - b.display_order
    );

    return {
      ...row,
      images: sortedImages,
    };
  });
};

/**
 * Search listings with full-text search and optional V3 filters.
 * Returns results ranked by relevance (highest first)
 *
 * @param query - Search query string
 * @param filters - Optional discovery filters (V3 enhanced)
 * @returns Array of search results ranked by relevance
 * @throws Error if search fails
 */
export async function searchListings(
  query: string,
  filters?: DiscoveryFilters
): Promise<SearchResult[]> {
  try {
    // Normalize query
    const trimmedQuery = query?.trim() || '';

    // Extract and normalize filters (convert undefined to null for RPC)
    const spEligibleOnly = filters?.spEligibleOnly ?? false;
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    const categoryIds = filters?.categoryIds && filters.categoryIds.length > 0
      ? filters.categoryIds
      : null;
    const condition = filters?.condition ?? null;
    const minPrice = filters?.minPrice ?? null;
    const maxPrice = filters?.maxPrice ?? null;
    const ageGroup = filters?.ageGroup ?? null;
    const gender = filters?.gender ?? null;
    const brand = filters?.brand ?? null;
    const colors = filters?.colors && filters.colors.length > 0
      ? filters.colors
      : null;
    const sortBy = filters?.sortBy ?? 'relevance';

    // Call RPC function for full-text search with all 13 params
    const { data, error } = await supabase.rpc('search_listings', {
      p_query: trimmedQuery,
      p_sp_eligible_only: spEligibleOnly,
      p_limit: limit,
      p_offset: offset,
      p_category_ids: categoryIds,
      p_condition: condition,
      p_min_price: minPrice,
      p_max_price: maxPrice,
      p_age_group: ageGroup,
      p_gender: gender,
      p_brand: brand,
      p_colors: colors,
      p_sort_by: sortBy,
    });

    if (error) {
      console.error('[searchListings] RPC error:', error);
      throw error;
    }

    // Track search event for analytics
    trackEvent('search_listings', {
      query: trimmedQuery.substring(0, 100), // Limit PII length
      result_count: data?.length ?? 0,
      sp_eligible_only: spEligibleOnly,
      has_filters: !!(categoryIds || condition || minPrice || maxPrice || ageGroup || gender || brand || colors),
      sort_by: sortBy,
    });

    const normalizedResults: SearchResult[] = (data || []).map((item: any) => ({
      ...item,
      seller: item.seller_name ? {
        name: item.seller_name,
        avatar_url: item.seller_avatar_url,
        verification_status: item.seller_verification_status
      } : undefined
    }));

    return attachListingImages(normalizedResults);
  } catch (err) {
    console.error('[searchListings] Error:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to search listings'
    );
  }
}

/**
 * Browse listings by category
 * Returns paginated results ordered by newest first
 *
 * @param categoryId - Category UUID to browse
 * @param filters - Optional category filters
 * @returns Array of category results
 * @throws Error if fetch fails
 */
export async function searchListingsByCategory(
  categoryId: string,
  filters?: CategoryFilters
): Promise<CategoryResult[]> {
  try {
    // Validate category ID
    if (!categoryId || categoryId.trim().length === 0) {
      throw new Error('Category ID is required');
    }

    const spEligibleOnly = filters?.spEligibleOnly ?? false;
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    // Call RPC function for category browsing
    const { data, error } = await supabase.rpc('search_listings_by_category', {
      p_category_id: categoryId,
      p_sp_eligible_only: spEligibleOnly,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('[searchListingsByCategory] RPC error:', error);
      throw error;
    }

    // Track category browse event
    trackEvent('browse_category', {
      category_id: categoryId,
      result_count: data?.length ?? 0,
      sp_eligible_only: spEligibleOnly,
      offset,
    });

    const normalizedResults: CategoryResult[] = (data || []).map((item: any) => ({
      ...item,
      seller: item.seller_name ? {
        name: item.seller_name,
        avatar_url: item.seller_avatar_url,
        verification_status: item.seller_verification_status
      } : undefined
    }));

    return attachListingImages(normalizedResults);
  } catch (err) {
    console.error('[searchListingsByCategory] Error:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to browse category'
    );
  }
}

/**
 * Fetch listings by category name with optional SP filter
 * Resolves category name to ID and calls searchListingsByCategory
 * 
 * @param categoryName - Name of the category (e.g., 'Toys', 'Books')
 * @param spEligibleOnly - Filter for SP-eligible items
 * @returns Array of category results
 */
export async function fetchListingsByCategory(
  categoryName: string,
  spEligibleOnly: boolean = false
): Promise<CategoryResult[]> {
  try {
    // 1. Get category ID from name
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', categoryName)
      .eq('is_active', true)
      .maybeSingle();

    if (categoryError) throw categoryError;
    if (!categoryData) {
      console.warn(`[fetchListingsByCategory] Category not found: ${categoryName}`);
      return [];
    }

    // 2. Fetch listings using the ID
    return await searchListingsByCategory(categoryData.id, {
      spEligibleOnly,
      limit: 50,
    });
  } catch (err) {
    console.error('[fetchListingsByCategory] Error:', err);
    return [];
  }
}

/**
 * Search listings within a specific category with optional text query
 * Combines category filtering with full-text search for refined results
 *
 * @param categoryId - Category UUID to search within
 * @param query - Optional search query (empty string returns all category items)
 * @param filters - Optional category filters
 * @returns Array of search results
 * @throws Error if search fails
 */
export async function searchListingsByCategoryAndQuery(
  categoryId: string,
  query: string = '',
  filters?: CategoryFilters
): Promise<SearchResult[]> {
  try {
    // Validate category ID
    if (!categoryId || categoryId.trim().length === 0) {
      throw new Error('Category ID is required');
    }

    const spEligibleOnly = filters?.spEligibleOnly ?? false;
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    // Call RPC function for combined category + text search
    const { data, error } = await supabase.rpc('search_listings_by_category_and_query', {
      p_category_id: categoryId,
      p_query: query.trim(),
      p_sp_eligible_only: spEligibleOnly,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('[searchListingsByCategoryAndQuery] RPC error:', error);
      throw error;
    }

    // Track search event for analytics
    trackEvent('search_listings_by_category', {
      category_id: categoryId,
      query: query.substring(0, 100), // Limit PII length
      result_count: data?.length ?? 0,
      sp_eligible_only: spEligibleOnly,
    });

    const normalizedResults: SearchResult[] = (data || []).map((item: any) => ({
      ...item,
      seller: item.seller_name ? {
        name: item.seller_name,
        avatar_url: item.seller_avatar_url,
        verification_status: item.seller_verification_status
      } : undefined
    }));

    return attachListingImages(normalizedResults);
  } catch (err) {
    console.error('[searchListingsByCategoryAndQuery] Error:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to search category listings'
    );
  }
}

/**
 * Get personalized recommendations for user
 * SP-eligible items ranked higher for subscribers
 * Respects user's SP balance and subscription status
 *
 * @param userId - User UUID
 * @param limit - Maximum recommendations to return
 * @returns Array of recommendations sorted by score
 * @throws Error if fetch fails
 *
 * @note This function requires Module 09 (SP Wallet) and Module 11 (Subscriptions)
 *       to be implemented first for full functionality
 */
export async function getRecommendations(
  userId: string,
  limit: number = 10
): Promise<Recommendation[]> {
  try {
    // Validate user ID
    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID is required');
    }

    // Call RPC function for personalized recommendations
    const { data, error } = await supabase.rpc('get_recommendations', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      console.error('[getRecommendations] RPC error:', error);
      // Return empty array on error instead of throwing
      // so that home screen doesn't break if recommendations fail
      return [];
    }

    // Track recommendations event for analytics
    trackEvent('view_recommendations', {
      user_id: userId,
      result_count: data?.length ?? 0,
      limit,
    });

    const normalizedResults: Recommendation[] = (data || []).map((item: any) => ({
      ...item,
      seller: item.seller_name ? {
        name: item.seller_name,
        avatar_url: item.seller_avatar_url,
        verification_status: item.seller_verification_status
      } : undefined
    }));

    return attachListingImages(normalizedResults);
  } catch (err) {
    console.error('[getRecommendations] Error:', err);
    // Return empty array on error instead of throwing
    // so that search UI doesn't break if recommendations fail
    return [];
  }
}

/**
 * Suggest spelling correction for search query
 * V3: Client-side typo correction using Levenshtein distance
 * 
 * @param query - The potentially misspelled search query
 * @param recentSearches - Array of recent valid searches to match against
 * @returns Suggested correction or null if no close match found
 * 
 * @example
 * suggestSpellingCorrection('bycicle', ['bicycle', 'tricycle', 'scooter'])
 * // Returns: 'bicycle'
 */
export function suggestSpellingCorrection(
  query: string,
  recentSearches: string[]
): string | null {
  if (!query || query.trim().length === 0) {
    return null;
  }

  if (!recentSearches || recentSearches.length === 0) {
    return null;
  }

  // Use Levenshtein distance with threshold 3
  return findClosestMatch(query.trim(), recentSearches, 3);
}

/**
 * Search with performance timing (dev mode)
 * Useful for monitoring search performance in development
 *
 * @internal Use only in development mode
 */
export async function searchListingsWithTiming(
  query: string,
  filters?: DiscoveryFilters
): Promise<{ results: SearchResult[]; timingMs: number }> {
  const startTime = performance.now();
  const results = await searchListings(query, filters);
  const timingMs = performance.now() - startTime;

  return { results, timingMs };
}
