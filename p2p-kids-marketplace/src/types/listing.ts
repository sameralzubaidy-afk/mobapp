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
 * MODULE-13 SAFETY-P003: Added 'flagged', 'rejected', 'needs_edits' statuses
 */
export type ListingStatus =
  | 'draft'
  | 'available'
  | 'pending'
  | 'sold'
  | 'deleted'
  | 'paused'
  | 'flagged'
  | 'rejected'
  | 'needs_edits';

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

  // MODULE-13 SAFETY-P003: Safety/moderation fields
  flagged_at: string | null;
  flagged_reason: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  moderation_note: string | null; // Admin's comment for needs_edits or rejection context
  appeal_count: number;
  appeal_reason?: string | null;
  appealed_at?: string | null;
  edited_since_rejection?: boolean;
  edited_since_rejection_at?: string | null;

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

// =====================================================
// MODULE-04-ITEM-LISTING-V3: AI Auto-Fill Types
// TASK: LISTING-V3-002
// Must match supabase/functions/_shared/aiTypes.ts
// =====================================================

/**
 * Generic AI field result with value and confidence score
 * MODULE-04 V3: Used for AI auto-fill suggestions
 */
export interface AIFieldResult<T> {
  value: T;
  confidence: number;
}

/**
 * Complete AI analysis result for an item photo
 * All fields are optional - only fields with confidence >= 0.40 are included
 * MODULE-04 V3: Returned by analyze-item-image and batch-analyze-items edge functions
 */
export interface AIAnalysisResult {
  /** Item title extracted from labels/OCR */
  title?: AIFieldResult<string>;
  
  /** Matched category with fuzzy matching */
  category?: AIFieldResult<{ 
    label: string; 
    categoryId: string | null; 
  }>;
  
  /** Item condition inferred from labels */
  condition?: AIFieldResult<'new' | 'like_new' | 'good' | 'fair' | 'worn'>;
  
  /** Brand name (matched against PREDEFINED_BRANDS or from labels) */
  brand?: AIFieldResult<string>;
  
  /** Dominant colors from image */
  color?: AIFieldResult<string[]>;
  
  /** Age group inferred from labels */
  age_group?: AIFieldResult<'0-2' | '3-5' | '6-8' | '9-12' | '13+'>;
  
  /** Gender inferred from labels */
  gender?: AIFieldResult<'boy' | 'girl' | 'unisex'>;
  
  /** Raw Google Vision labels for debugging */
  rawLabels?: string[];
  
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Photo asset from image picker
 * MODULE-04 V3: Used in photo-first listing flow
 */
export interface PhotoAsset {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Photo group for bulk listing
 * MODULE-04 V3: Groups photos into individual items
 */
export interface PhotoGroup {
  groupId: string;
  photos: PhotoAsset[];
  primaryPhotoIndex: number; // Index in photos array
  analysis?: AIAnalysisResult;
}

/**
 * Item draft data (JSONB structure in item_drafts table)
 * MODULE-04 V3: Auto-saved draft state
 */
export interface DraftData {
  title?: string;
  description?: string;
  price?: number;
  category_id?: string;
  requested_category_name?: string; // For "Other" category
  condition?: ListingCondition;
  brand?: string;
  color?: string[];
  age_group?: '0-2' | '3-5' | '6-8' | '9-12' | '13+';
  gender?: 'boy' | 'girl' | 'unisex';
  accepts_swap_points?: boolean;
  photo_urls?: string[];
  ai_suggestions?: AIAnalysisResult;
  step?: 'photo' | 'details' | 'pricing' | 'review';
}

/**
 * Item draft from database
 * MODULE-04 V3: Persisted draft with TTL
 */
export interface ItemDraft {
  id: string;
  seller_id: string;
  draft_data: DraftData;
  photo_urls: string[];
  ai_suggestions: AIAnalysisResult | null;
  step: 'photo' | 'details' | 'pricing' | 'review';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Bulk publish result
 * MODULE-04 V3: Result of publishing multiple items at once
 */
export interface BulkPublishResult {
  published: Array<{
    groupId: string;
    itemId: string;
  }>;
  failed: Array<{
    groupId: string;
    error: string;
  }>;
  totalPublished: number;
  totalFailed: number;
}

/**
 * Price tier for suggested pricing
 * MODULE-04 V3: Four-tier price suggestions
 */
export type PriceTier = 'great_deal' | 'fair_price' | 'asking_price' | 'almost_new';

/**
 * Price suggestion
 * MODULE-04 V3: AI-powered price guidance
 */
export interface PriceSuggestion {
  tier: PriceTier;
  price: number;
  label: string; // "Great Deal", "Fair Price", etc.
  description: string; // "Priced to sell fast"
}

/**
 * Condition guide entry
 * MODULE-04 V3: Visual guide for condition selection
 */
export interface ConditionGuide {
  condition: ListingCondition;
  title: string;
  description: string;
  examplePhotoUrl: string;
  tips: string[];
}
