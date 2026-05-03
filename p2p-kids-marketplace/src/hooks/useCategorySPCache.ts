/**
 * File: p2p-kids-marketplace/src/hooks/useCategorySPCache.ts
 * MODULE-04 LISTING-V3-011: Category SP Multiplier Cache Hook
 * Task: LISTING-V3-011 - SP earnings preview for single & bulk listing
 *
 * Purpose: Fetch category SP multipliers once, cache in AsyncStorage for 24h
 * Performance: Client-side optimistic calculation (no API calls per listing)
 *
 * @see BRD US-SUB-002: SP earnings preview requirement
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategoriesWithCounts } from '../services/categoryService';

const STORAGE_KEY = '@kids_marketplace:category_sp_multipliers';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MULTIPLIER = 1.1;

export interface CategorySPMultiplier {
  category_id: string;
  category_name: string;
  sp_earning_multiplier: number;
  last_updated: string; // ISO timestamp
}

interface CachedData {
  data: CategorySPMultiplier[];
  cachedAt: string; // ISO timestamp
}

export interface UseCategorySPCacheReturn {
  /** Map of category_id -> sp_earning_multiplier */
  multipliers: Map<string, number>;
  /** Map of category_id -> category_name */
  categoryNames: Map<string, string>;
  /** Loading state */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Get multiplier for a category ID (returns default 1.10 if not found) */
  getMultiplier: (categoryId: string | null) => number;
  /** Get category name by ID */
  getCategoryName: (categoryId: string | null) => string;
  /** Force refresh from API */
  refresh: () => Promise<void>;
}

/**
 * Hook to cache and retrieve category SP multipliers
 *
 * Caching strategy (Decision 7 - Option C):
 * - Fetch on app start
 * - Cache in AsyncStorage with 24h TTL
 * - Refresh on mount if stale
 * - Network failure → use stale cache if available
 * - No cache + network fail → default all to 1.10x
 */
export function useCategorySPCache(): UseCategorySPCacheReturn {
  const [multipliers, setMultipliers] = useState<Map<string, number>>(new Map());
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get multiplier for a category ID
   * Returns default 1.10 if not found
   */
  const getMultiplier = useCallback(
    (categoryId: string | null): number => {
      if (!categoryId) return DEFAULT_MULTIPLIER;
      return multipliers.get(categoryId) || DEFAULT_MULTIPLIER;
    },
    [multipliers]
  );

  /**
   * Get category name by ID
   */
  const getCategoryName = useCallback(
    (categoryId: string | null): string => {
      if (!categoryId) return 'Unknown';
      return categoryNames.get(categoryId) || categoryId;
    },
    [categoryNames]
  );

  /**
   * Apply multiplier payload to local state maps
   */
  const applyCategoryData = useCallback((data: CategorySPMultiplier[]) => {
    const newMultipliers = new Map<string, number>();
    const newNames = new Map<string, string>();

    data.forEach((cat) => {
      newMultipliers.set(cat.category_id, cat.sp_earning_multiplier);
      newNames.set(cat.category_id, cat.category_name);
    });

    setMultipliers(newMultipliers);
    setCategoryNames(newNames);
  }, []);

  /**
   * Load cache from AsyncStorage
   */
  const loadCache = useCallback(async (): Promise<CachedData | null> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed: CachedData = JSON.parse(stored);

      // Validate structure
      if (!parsed.data || !Array.isArray(parsed.data) || !parsed.cachedAt) {
        console.warn('[useCategorySPCache] Invalid cache structure, ignoring');
        return null;
      }

      return parsed;
    } catch (err: any) {
      console.error('[useCategorySPCache] Load cache error:', err);
      return null;
    }
  }, []);

  /**
   * Save cache to AsyncStorage
   */
  const saveCache = useCallback(async (data: CategorySPMultiplier[]): Promise<void> => {
    try {
      const cacheData: CachedData = {
        data,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (err: any) {
      console.error('[useCategorySPCache] Save cache error:', err);
    }
  }, []);

  /**
   * Check if cache is stale (> 24h old)
   */
  const isCacheStale = useCallback((cachedAt: string): boolean => {
    const cached = new Date(cachedAt);
    const now = new Date();
    const ageMs = now.getTime() - cached.getTime();
    return ageMs > CACHE_TTL_MS;
  }, []);

  /**
   * Fetch category multipliers from API
   */
  const fetchFromAPI = useCallback(async (): Promise<CategorySPMultiplier[]> => {
    const result = await getCategoriesWithCounts();
    const categories = Array.isArray(result) ? result : (result as any)?.categories;

    if (!Array.isArray(categories)) {
      throw new Error('Failed to fetch categories');
    }

    // Map to CategorySPMultiplier format
    return categories.map((cat) => ({
      category_id: cat.id,
      category_name: cat.name,
      sp_earning_multiplier: cat.sp_earning_multiplier || DEFAULT_MULTIPLIER,
      last_updated: new Date().toISOString(),
    }));
  }, []);

  /**
   * Refresh cache from API
   */
  const refreshInternal = useCallback(
    async (silent: boolean = false): Promise<void> => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchFromAPI();

        applyCategoryData(data);

        // Save to cache
        await saveCache(data);
      } catch (err: any) {
        console.error('[useCategorySPCache] Refresh error:', err);

        // Try to use stale cache if available
        const cached = await loadCache();
        if (cached) {
          console.warn('[useCategorySPCache] Using stale cache due to network error');

          if (!silent) {
            applyCategoryData(cached.data);
            setError('Using cached data (network unavailable)');
          }
        } else {
          // No cache available - default to empty (getMultiplier will return 1.10)
          if (!silent) {
            setError(err.message || 'Failed to load SP multipliers');
          }
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [fetchFromAPI, saveCache, loadCache, applyCategoryData]
  );

  const refresh = useCallback(async (): Promise<void> => {
    await refreshInternal(false);
  }, [refreshInternal]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // Try to load from cache first
      const cached = await loadCache();

      if (cached && !isCacheStale(cached.cachedAt)) {
        // Cache is fresh - use it
        if (isMounted) {
          applyCategoryData(cached.data);
          setLoading(false);

          // Keep cache UX fast, but silently re-sync with server so admin changes
          // (e.g., multiplier updates) appear without waiting 24h TTL expiry.
          void refreshInternal(true);
        }
      } else {
        // Cache is stale or missing - fetch from API
        if (isMounted) {
          await refreshInternal(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [refreshInternal, loadCache, isCacheStale, applyCategoryData]);

  return {
    multipliers,
    categoryNames,
    loading,
    error,
    getMultiplier,
    getCategoryName,
    refresh,
  };
}
