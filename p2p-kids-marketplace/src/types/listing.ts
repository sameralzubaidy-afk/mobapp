/**
 * File: p2p-kids-marketplace/src/types/listing.ts
 * MODULE-04 LISTING-V2-001: TypeScript types for item listings
 * 
 * V2 Enhancements:
 * - accepts_swap_points: SP payment preference
 * - seller_subscription_status_at_creation: Audit trail
 * - last_edited_at (maps to updated_at in DB)
 */

/**
 * Listing status enum
 * Matches items.status column in database
 */
export type ListingStatus = 'draft' | 'available' | 'pending' | 'sold' | 'deleted';

/**
 * Item condition enum
 * Matches items.condition column in database
 */
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

/**
 * Complete listing object from database
 * Maps to items table + related data
 */
export interface Listing {
  id: string;
  seller_id: string;
  title: string; // item_name in spec, but DB uses 'title'
  description: string | null; // item_description in spec, but DB uses 'description'
  price: number; // price in dollars (DB stores as DECIMAL, not cents)
  category_id: string | null;
  condition: ListingCondition | null;
  status: ListingStatus;
  
  // V2 fields:
  accepts_swap_points: boolean; // Whether seller accepts SP payment
  seller_subscription_status_at_creation: string | null; // Audit: seller sub status when created
  
  // Timestamps:
  created_at: string;
  updated_at: string; // Maps to 'last_edited_at' concept in spec
  sold_at: string | null;
  
  // Related data (optional, from joins):
  seller?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
  };
  images?: {
    id: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }[];
}

/**
 * Input for creating a new listing
 * Used by createListing service function
 */
export interface CreateListingInput {
  seller_id: string;
  title: string;
  description: string;
  price: number; // Dollars (will be validated > 0)
  category_id?: string;
  condition: ListingCondition;
  image_urls?: string[]; // To be uploaded/stored separately
  accepts_swap_points: boolean; // V2: SP payment preference
}

/**
 * Input for updating an existing listing
 * Used by updateListing service function
 * All fields except listing_id and user_id are optional
 */
export interface UpdateListingInput {
  listing_id: string;
  user_id: string; // For ownership verification
  title?: string;
  description?: string;
  price?: number; // Dollars
  category_id?: string;
  condition?: ListingCondition;
  accepts_swap_points?: boolean; // V2: Can toggle SP acceptance
}

/**
 * Filters for browsing/searching listings
 * Used by fetchListings service function
 */
export interface ListingFilters {
  category_id?: string;
  min_price?: number; // Dollars
  max_price?: number; // Dollars
  condition?: ListingCondition;
  sp_eligible_only?: boolean; // V2: Filter for accepts_swap_points = true
  node_id?: string; // Filter by seller's node (for local browsing)
  search_query?: string; // Text search in title/description
}

/**
 * Summary of seller's listings (for "My Listings" screen)
 */
export interface ListingSummary {
  total_active: number;
  total_sold: number;
  total_earnings_dollars: number; // Sum of sold item prices
}
