// Canonical tier definitions for the current MVP subscription model.
// Source of truth: supabase/migrations/20260212000000_subscription_tiers.sql

export const TIER_ID_FREE = 'free';
export const TIER_ID_KIDS_CLUB_PLUS = 'kids_club_plus';

export interface TierFeatureComparisonRow {
  key: string;
  name: string;
  free: boolean | string;
  kidsClubPlus: boolean | string;
}

// Note: Prices and fees are fetched dynamically from admin config.
// These rows define the feature comparison structure only.
export const TIER_COMPARISON_ROWS: TierFeatureComparisonRow[] = [
  {
    key: 'monthly_subscription',
    name: 'Monthly subscription',
    free: '$0',
    kidsClubPlus: 'DYNAMIC', // Fetched from admin config
  },
  {
    key: 'trial_period',
    name: 'Free trial',
    free: 'No',
    kidsClubPlus: 'DYNAMIC', // Fetched from admin config (trial_period_days)
  },
  {
    key: 'transaction_fee',
    name: 'Transaction fee',
    free: 'DYNAMIC', // Fetched from admin config
    kidsClubPlus: 'DYNAMIC', // Fetched from admin config
  },
  {
    key: 'trade_with_pips',
    name: 'Trade with PIPs',
    free: false,
    kidsClubPlus: true,
  },
  {
    key: 'reduced_fee',
    name: 'Reduced transaction fee',
    free: false,
    kidsClubPlus: true,
  },
];

export const MY_SUBSCRIPTION_BENEFITS: string[] = [
  'Trade with PIPs — help buyers save and sellers move inventory faster',
  'Reduced transaction fees — save on every purchase',
];

// Free-trial marketing line. NOT included in MY_SUBSCRIPTION_BENEFITS above:
// trials are admin-config-gated (admin_config.trial_enabled). Consumers append
// this line only when useTrialEligibility().trialEnabled is true, so a disabled
// trial never shows a "free trial" benefit claim (QA Task 20 F-3).
export const TRIAL_MARKETING_BENEFIT = '30-day free trial to explore all benefits';
