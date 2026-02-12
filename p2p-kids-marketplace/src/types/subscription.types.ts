// File: p2p-kids-marketplace/src/types/subscription.types.ts
// MODULE-11 SUB-001: TypeScript types for subscription tiers and features

/**
 * Subscription tier database record
 * Maps to public.subscription_tiers table
 */
export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  trial_days: number;
  grace_period_days: number;
  stripe_price_id: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Subscription feature database record
 * Maps to public.subscription_features table
 */
export interface SubscriptionFeature {
  id: string;
  tier_id: string;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Subscription tier with associated features (for display)
 */
export interface SubscriptionTierWithFeatures extends SubscriptionTier {
  features: SubscriptionFeature[];
}

/**
 * Known feature keys for Kids Club+
 * Used for programmatic feature checks
 */
export enum SubscriptionFeatureKey {
  CAN_EARN_SP = 'can_earn_sp',
  CAN_SPEND_SP = 'can_spend_sp',
  CAN_DONATE = 'can_donate',
  REDUCED_FEE = 'reduced_fee',
  PRIORITY_MATCHING = 'priority_matching',
  EARLY_ACCESS = 'early_access',
  PRIORITY_SUPPORT = 'priority_support',
}

/**
 * Subscription tier names (internal identifiers)
 */
export enum SubscriptionTierName {
  KIDS_CLUB_PLUS = 'kids_club_plus',
}

/**
 * Display-friendly tier information for UI
 */
export interface TierDisplayInfo {
  name: string;
  displayName: string;
  description: string;
  priceFormatted: string;
  trialDays: number;
  features: {
    key: string;
    name: string;
    description: string;
  }[];
}

/**
 * Tier comparison data (for future multi-tier support)
 */
export interface TierComparison {
  free: {
    name: string;
    price: string;
    features: string[];
  };
  kidsClubPlus: {
    name: string;
    price: string;
    trialDays: number;
    features: string[];
  };
}

/**
 * Helper type for feature check results
 */
export interface FeatureCheckResult {
  hasFeature: boolean;
  tierName: string;
  featureName: string;
}
