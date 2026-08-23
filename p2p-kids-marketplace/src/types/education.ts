// FILE: p2p-kids-marketplace/src/types/education.ts
// MODULE-18 V1 EDU-002: Trading Education types (mobile-facing)
// NOTE: This file does NOT import from admin-portal (independent packages)

import { BonusCategory } from './category';

/**
 * Section type enum — matches DB CHECK constraint exactly
 */
export type SectionType =
  | 'general'
  | 'sp_definition'
  | 'sp_earning'
  | 'sp_spending'
  | 'safety'
  | 'example';

/**
 * Education content section (published content only)
 * Omitted fields (admin-only): published_by, updated_at
 */
export interface EducationSection {
  id: string;
  title: string; // 3-100 chars
  body: string; // 10-2000 chars, plain text with newline preservation
  image_url: string | null; // Supabase Storage public URL or null
  display_order: number;
  section_type: SectionType;
  is_published: boolean; // Mobile always filters to true
  published_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
}

/**
 * Example scenario for SP calculator demos
 * Omitted fields (admin-only): updated_at
 * SP values are COMPUTED on read — never stored
 */
export interface EducationExample {
  id: string;
  item_name: string;
  item_price: number; // Dollars (e.g., 25.99)
  category_id: string | null; // FK to categories; null = "Other"
  display_order: number;
  is_published: boolean;
  created_at: string; // ISO timestamp
}

/**
 * SP calculation result — discriminated union by mode
 */
export type SPCalculation = SellSPCalculation | BuySPCalculation;

/**
 * Sell mode: shows how much SP a seller earns
 */
export interface SellSPCalculation {
  mode: 'sell';
  price: number;
  category_id: string;
  category_name: string;
  earn_sp: number; // Math.round(price × multiplier)
  multiplier: number; // e.g., 1.30
  is_bonus: boolean; // true iff multiplier > 1.10
}

/**
 * Buy mode: shows max SP usable + cash breakdown
 */
export interface BuySPCalculation {
  mode: 'buy';
  price: number;
  category_id: string;
  category_name: string;
  max_sp_usable: number; // Math.floor(price × cap / 100)
  sp_spending_cap_percent: number; // e.g., 70
  sp_to_use: number; // User's selected SP amount
  cash_paid: number; // price - sp_to_use
  fee: number; // 10% of price (constant for MVP)
  total_cost: number; // cash_paid + fee
  is_bonus: boolean; // true iff multiplier > 1.10 (for badge display)
}

/**
 * Analytics event type enum — the event types the app can emit. The DB CHECK
 * constraint `chk_education_analytics_event_type` is a SUPERSET (it also accepts
 * legacy section_collapse / prompt_* values) so every value here persists.
 */
export type EducationAnalyticsEventType =
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'onboarding_skip'
  | 'help_view'
  | 'section_expand'
  | 'calculator_use'
  | 'seller_prompt_view'
  | 'buyer_prompt_view';

/**
 * Education analytics event (append-only)
 */
export interface EducationAnalyticsEvent {
  id: string;
  user_id: string | null; // Nullable for anonymous onboarding-start events
  event_type: EducationAnalyticsEventType;
  event_data: Record<string, unknown> | null; // JSONB payload (no PII)
  created_at: string; // ISO timestamp
}

/**
 * Re-export BonusCategory from category.ts for convenience
 * (Avoids mobile imports needing two paths)
 */
export type { BonusCategory };
