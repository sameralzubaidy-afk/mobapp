/**
 * File: p2p-kids-marketplace/src/services/brandAutocomplete.ts
 * MODULE-05-DISCOVERY-V3: Brand Autocomplete Service
 * Task: DISCOVERY-V3-003 - Brand Autocomplete
 * 
 * Hybrid brand suggestions: 50 predefined popular brands + database brands
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

// Storage key for brand cache
const BRAND_CACHE_KEY = '@kids_marketplace:brand_cache';

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Predefined popular kids brands (50 brands)
 * Exact casing from SEARCH-FILTER-REQUIREMENTS.md § Section 11
 */
export const PREDEFINED_BRANDS = [
  'LEGO',
  'Nike',
  "Carter's",
  "OshKosh B'Gosh",
  'Melissa & Doug',
  'Fisher-Price',
  'Little Tikes',
  'Barbie',
  'Hot Wheels',
  'Disney',
  'Marvel',
  'Star Wars',
  'Pokemon',
  'Gap Kids',
  'Old Navy',
  'Target',
  'Cat & Jack',
  'H&M',
  'Zara Kids',
  'Gymboree',
  'Graco',
  'Chicco',
  'BabyBjörn',
  'Ergobaby',
  'Skip Hop',
  'Vans',
  'Converse',
  'Adidas',
  'Crayola',
  'Play-Doh',
  'Nerf',
  'American Girl',
  'Baby Einstein',
  'VTech',
  'LeapFrog',
  'Paw Patrol',
  'Frozen',
  'Minnie Mouse',
  'Thomas & Friends',
  'Sesame Street',
  'The North Face',
  'Columbia',
  'Patagonia',
  'Ralph Lauren',
  'Tommy Hilfiger',
  'Hanna Andersson',
  'Mini Boden',
  'Tea Collection',
  'Primary',
  "Lands' End",
];

interface BrandCache {
  timestamp: number;
  brands: string[];
}

/**
 * Fetch brands from database with 5-minute cache
 * Cached in AsyncStorage to reduce DB queries
 * 
 * @returns Promise<string[]> - List of brand names from database
 */
export async function fetchDatabaseBrands(): Promise<string[]> {
  try {
    // Check cache first
    try {
      const cached = await AsyncStorage.getItem(BRAND_CACHE_KEY);
      if (cached) {
        const cache: BrandCache = JSON.parse(cached);
        const age = Date.now() - cache.timestamp;

        // Return cached if within TTL
        if (age < CACHE_TTL_MS) {
          return cache.brands;
        }
      }
    } catch (cacheError) {
      console.warn('[brandAutocomplete] Cache read failed, falling back to DB fetch:', cacheError);
    }

    // Fetch from database using get_popular_brands RPC
    const { data, error } = await supabase.rpc('get_popular_brands', {
      p_limit: 50,
    });

    if (error) {
      console.error('[brandAutocomplete] Failed to fetch DB brands:', error);
      return [];
    }

    // Extract brand names from result (RPC returns {brand, item_count})
    const brands: string[] = (data || [])
      .map((row: { brand: string; item_count: number }) => row.brand)
      .filter((brand: string | null) => brand && brand.trim().length > 0);

    // Update cache
    const newCache: BrandCache = {
      timestamp: Date.now(),
      brands,
    };
    try {
      await AsyncStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(newCache));
    } catch (cacheError) {
      console.warn('[brandAutocomplete] Cache write failed, continuing with fresh data:', cacheError);
    }

    return brands;
  } catch (error) {
    console.error('[brandAutocomplete] Error fetching database brands:', error);
    return [];
  }
}

/**
 * Get brand suggestions for autocomplete
 * Merges predefined brands + DB brands, dedupes, filters by query, sorts alphabetically
 * 
 * @param query - Brand search query (min 2 characters)
 * @returns Promise<string[]> - Up to 8 matching brand suggestions
 */
export async function getBrandSuggestions(query: string): Promise<string[]> {
  try {
    const trimmed = query.trim();

    // Return empty if query too short
    if (trimmed.length < 2) {
      return [];
    }

    const normalizedQuery = trimmed.toLowerCase();

    // Fetch DB brands (cached)
    const dbBrands = await fetchDatabaseBrands();

    // Merge predefined + DB brands
    const allBrands = [...PREDEFINED_BRANDS, ...dbBrands];

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const brand of allBrands) {
      const normalized = brand.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(brand);
      }
    }

    // Filter by query (case-insensitive contains)
    const matches = unique.filter((brand) =>
      brand.toLowerCase().includes(normalizedQuery)
    );

    // Sort alphabetically (case-insensitive)
    const sorted = matches.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    // Cap at 8 suggestions
    return sorted.slice(0, 8);
  } catch (error) {
    console.error('[brandAutocomplete] Error getting brand suggestions:', error);
    return [];
  }
}
