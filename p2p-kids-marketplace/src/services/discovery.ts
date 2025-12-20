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

    return (data as SearchResult[]) || [];
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

    return (data as CategoryResult[]) || [];
  } catch (err) {
    console.error('[searchListingsByCategory] Error:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to browse category'
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

    // TODO(DISCOVERY-V2-002): Implement RPC function get_recommendations
    // This requires MODULE-09 (SP Wallet) and MODULE-11 (Subscriptions)
    // For now, return empty to unblock Module 05 search functionality
    console.warn('[getRecommendations] Not yet implemented - requires Module 09 + 11');

    return [];
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

  if (__DEV__) {
    console.log(`[searchListings] Query: "${query}" | Time: ${timingMs.toFixed(2)}ms | Results: ${results.length}`);
  }

  return { results, timingMs };
}
