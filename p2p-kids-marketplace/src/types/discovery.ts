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
