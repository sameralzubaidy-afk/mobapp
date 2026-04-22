/**
 * File: p2p-kids-marketplace/src/types/discovery.ts
 * MODULE-05-DISCOVERY-V2: Discovery Types
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * 
 * Defines types for search and discovery features
 */

/**
 * Search result from full-text search (V3 - Enhanced with filter columns)
 * MODULE-05-DISCOVERY-V3: Added age_group, gender, brand, color
 */
export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  price: number;
  accepts_swap_points: boolean;
  status: string;
  seller_id: string;
  category_id: string | null;
  condition: string | null;
  /** V3: Age group filter */
  age_group: string | null;
  /** V3: Gender filter */
  gender: string | null;
  /** V3: Brand name */
  brand: string | null;
  /** V3: Colors (array) */
  color: string[] | null;
  created_at: string;
  updated_at: string;
  /** Relevance score from full-text search (0-1) */
  relevance: number;
  /** Seller information for trust signals */
  seller?: {
    name: string;
    avatar_url: string | null;
    verification_status: 'none' | 'pending' | 'approved';
  };
  images?: {
    id: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }[];
}

/**
 * Category browsing result
 */
export interface CategoryResult {
  id: string;
  title: string;
  description: string | null;
  price: number;
  accepts_swap_points: boolean;
  status: string;
  seller_id: string;
  category_id: string | null;
  condition: string | null;
  created_at: string;
  updated_at: string;
  /** Seller information for trust signals */
  seller?: {
    name: string;
    avatar_url: string | null;
    verification_status: 'none' | 'pending' | 'approved';
  };
  images?: {
    id: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }[];
}

/**
 * Sort options for search results
 * MODULE-05-DISCOVERY-V3: Added for filter/sort functionality
 */
export type SortOption = 'relevance' | 'newest' | 'price_asc' | 'price_desc';

/**
 * Search filters for discovering listings (V3 - Enhanced)
 * MODULE-05-DISCOVERY-V3: Expanded from V2 with 9 filter dimensions
 */
export interface DiscoveryFilters {
  /** Full-text search query */
  query?: string;
  /** Category IDs (multi-select) */
  categoryIds?: string[];
  /** Item condition */
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'worn';
  /** Minimum price */
  minPrice?: number;
  /** Maximum price */
  maxPrice?: number;
  /** Age group */
  ageGroup?: '0-2' | '3-5' | '6-8' | '9-12' | '13+';
  /** Gender */
  gender?: 'boy' | 'girl' | 'unisex';
  /** Brand name */
  brand?: string;
  /** Colors (multi-select from 12-color palette) */
  colors?: string[];
  /** Only return SP-eligible items */
  spEligibleOnly?: boolean;
  /** Sort option */
  sortBy?: SortOption;
  /** Maximum results to return */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Category filter options
 */
export interface CategoryFilters {
  /** Category ID to browse (optional if passed separately) */
  categoryId?: string;
  /** Only return SP-eligible items */
  spEligibleOnly?: boolean;
  /** Maximum results to return */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Recommendation result from personalized engine
 */
export interface Recommendation {
  id: string;
  title: string;
  price: number;
  accepts_swap_points: boolean;
  status: string;
  seller_id: string;
  category_id: string | null;
  condition: string | null;
  created_at: string;
  updated_at: string;
  /** Score for recommendation (higher = better for user) */
  score: number;
  /** Seller information for trust signals */
  seller?: {
    name: string;
    avatar_url: string | null;
    verification_status: 'none' | 'pending' | 'approved';
  };
  images?: {
    id: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }[];
}

/**
 * Brand suggestion for autocomplete
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 */
export interface BrandSuggestion {
  name: string;
  source: 'predefined' | 'database';
}

/**
 * Price range preset for quick filtering
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 */
export interface PricePreset {
  id: string;
  label: string;
  min: number;
  max: number;
}

/**
 * 12-color palette for item filtering
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 * Source: SEARCH-FILTER-REQUIREMENTS.md § Appendix
 */
export const COLOR_PALETTE = [
  { id: 'red', label: 'Red', hex: '#EF4444' },
  { id: 'blue', label: 'Blue', hex: '#3B82F6' },
  { id: 'green', label: 'Green', hex: '#10B981' },
  { id: 'yellow', label: 'Yellow', hex: '#FBBF24' },
  { id: 'pink', label: 'Pink', hex: '#EC4899' },
  { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
  { id: 'black', label: 'Black', hex: '#1F2937' },
  { id: 'white', label: 'White', hex: '#F9FAFB' },
  { id: 'gray', label: 'Gray', hex: '#6B7280' },
  { id: 'brown', label: 'Brown', hex: '#92400E' },
  { id: 'orange', label: 'Orange', hex: '#F97316' },
  { id: 'multicolor', label: 'Multicolor', hex: '#FFFFFF' }, // Placeholder for gradient
] as const;

/**
 * 5 price range presets for quick filtering
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 * Source: SEARCH-FILTER-REQUIREMENTS.md § Appendix
 */
export const PRICE_PRESETS: PricePreset[] = [
  { id: 'under-10', label: 'Under $10', min: 0, max: 10 },
  { id: '10-25', label: '$10-$25', min: 10, max: 25 },
  { id: '25-50', label: '$25-$50', min: 25, max: 50 },
  { id: '50-100', label: '$50-$100', min: 50, max: 100 },
  { id: 'over-100', label: 'Over $100', min: 100, max: 10000 },
];

/**
 * AsyncStorage keys for discovery features
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 * Source: SEARCH-FILTER-REQUIREMENTS.md § Appendix
 */
export const STORAGE_KEYS = {
  RECENT_SEARCHES: '@kids_marketplace:recent_searches',
  ACTIVE_FILTERS: '@kids_marketplace:active_filters', // session only
  BRAND_CACHE: '@kids_marketplace:brand_cache', // 5min TTL
} as const;
