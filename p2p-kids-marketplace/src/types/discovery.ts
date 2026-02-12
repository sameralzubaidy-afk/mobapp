/**
 * File: p2p-kids-marketplace/src/types/discovery.ts
 * MODULE-05-DISCOVERY-V2: Discovery Types
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * 
 * Defines types for search and discovery features
 */

/**
 * Search result from full-text search
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
}

/**
 * Search filters for discovering listings
 */
export interface DiscoveryFilters {
  /** Full-text search query */
  query?: string;
  /** Only return SP-eligible items */
  spEligibleOnly?: boolean;
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
}
