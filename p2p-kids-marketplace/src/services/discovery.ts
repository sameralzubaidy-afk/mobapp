/**
 * File: p2p-kids-marketplace/src/services/discovery.ts
 * MODULE-05-DISCOVERY-V2: Discovery Service
 * Task: DISCOVERY-V2-001 - Full-Text Search
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
 * Search listings by full-text query
 * Returns results ranked by relevance (highest first)
 *
 * @param query - Search query string
 * @param filters - Optional discovery filters
 * @returns Array of search results ranked by relevance
 * @throws Error if search fails
 */
export async function searchListings(
  query: string,
  filters?: DiscoveryFilters
): Promise<SearchResult[]> {
  try {
    // Validate input
    if (!query || query.trim().length === 0) {
      return [];
    }

    const spEligibleOnly = filters?.spEligibleOnly ?? false;
    const limit = filters?.limit ?? 20;

    // Call RPC function for full-text search
    const { data, error } = await supabase.rpc('search_listings', {
      p_query: query.trim(),
      p_sp_eligible_only: spEligibleOnly,
      p_limit: limit,
    });

    if (error) {
      console.error('[searchListings] RPC error:', error);
      throw error;
    }

    // Track search event for analytics
    trackEvent('search_listings', {
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
