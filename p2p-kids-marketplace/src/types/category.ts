// FILE: p2p-kids-marketplace/src/types/category.ts
// ADMIN-V3-002: Mobile mirror of category types (subset — no admin fields)
// Module: MODULE-12-ADMIN-V3-CATEGORIES
// NOTE: This file does NOT import from admin-portal (independent packages)

/**
 * Category entity (mobile-facing subset)
 * 
 * Omitted fields (admin-only):
 * - description
 * - sp_config_notes
 * - sp_rate_change_notify
 * - updated_at
 */
export interface Category {
  id: string;
  name: string;
  icon: string | null; // Emoji or icon library name
  icon_url: string | null; // Custom uploaded icon URL
  bonus_badge_icon_url: string | null; // Custom bonus badge URL
  is_active: boolean;
  item_count: number; // Computed by trigger — READ-ONLY
  display_order: number;
  sp_earning_multiplier: number; // 1.05–1.40
  sp_spending_cap_percent: number; // 50–80
  created_at: string; // ISO timestamp
}

/**
 * Category with bonus earning multiplier (filtered view)
 * Used for displaying "bonus" badges on category chips
 */
export interface BonusCategory {
  id: string;
  name: string;
  icon: string | null;
  icon_url: string | null;
  bonus_badge_icon_url: string | null;
  sp_earning_multiplier: number; // > 1.10
  sp_spending_cap_percent: number;
  item_count: number;
}

/**
 * Preview calculation result for SP rates
 * Used in checkout/listing flows to show SP preview
 */
export interface CategorySPPreview {
  price: number; // Input price
  earn_sp: number; // Math.round(price * multiplier)
  max_spend_sp: number; // Math.floor(price * cap_percent / 100)
  spend_percent: number; // cap_percent value
}

/**
 * Input for creating a category suggestion from "Other" category flow
 * (MODULE-04 V3 integration)
 */
export interface CreateCategorySuggestionInput {
  item_id: string;
  suggested_name: string; // Seller's suggested category name
}

/**
 * Category suggestion entity (mobile view — minimal fields)
 * Used for displaying seller's own suggestion status
 */
export interface CategorySuggestion {
  id: string;
  suggested_name: string;
  item_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null; // Why rejected/merged
  merged_to_category?: {
    id: string;
    name: string;
  };
}

/**
 * Options for getCategoriesWithCounts
 */
export interface GetCategoriesOptions {
  includeInactive?: boolean; // Default false (filter out inactive + zero-count)
}
