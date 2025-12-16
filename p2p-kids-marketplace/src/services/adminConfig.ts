// File: p2p-kids-marketplace/src/services/adminConfig.ts
// Dynamic config service - fetches all admin_config values from Supabase

import { supabase } from '../config/supabase';

export interface AdminConfig {
  // Subscription
  subscription_price_monthly: number;
  subscription_price_yearly: number;
  trial_period_days: number;
  trial_enabled: boolean;
  grace_period_days: number;

  // Swap Points
  sp_earn_multiplier: number;
  sp_max_percentage_per_purchase: number;
  sp_pending_days: number;
  sp_expiration_days: number;
  sp_min_balance_for_redemption: number;
  sp_redemption_multiplier: number;
  sp_subscriber_only: boolean;

  // Fees
  platform_fee_buyer_fixed_cents: number;
  platform_fee_buyer_percentage: number;
  platform_fee_seller_percentage: number;
  platform_fee_seller_discount_percentage_freemium: number;
  platform_fee_seller_discount_percentage_kids_club_plus: number;
  stripe_transaction_fee_percentage: number;
  stripe_transaction_fee_fixed_cents: number;
  min_transaction_amount_cents: number;

  // SMS
  twilio_enabled: boolean;
  sms_verification_timeout_minutes: number;
  sms_daily_limit_per_user: number;

  // Email
  sendgrid_enabled: boolean;
  email_from_address: string;

  // Moderation
  moderation_ai_enabled: boolean;
  moderation_human_review_threshold: string; // low/medium/high
  moderation_auto_reject_high_risk: boolean;

  // Safety
  cpsc_recall_check_enabled: boolean;
  prohibited_items_check_enabled: boolean;

  // Analytics
  firebase_analytics_enabled: boolean;
  analytics_user_session_tracking: boolean;

  // Feature Flags
  feature_flag_sp_redemption_enabled: boolean;
  feature_flag_referral_program_enabled: boolean;
  feature_flag_bundle_purchases_enabled: boolean;
}

// In-memory cache with TTL
let configCache: AdminConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all admin config values from Supabase
 * Uses in-memory cache with 5-minute TTL
 */
export async function getAdminConfig(forceRefresh = false): Promise<AdminConfig> {
  // Return cached config if available and not expired
  if (!forceRefresh && configCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return configCache;
  }

  try {
    const { data: configRows, error } = await supabase
      .from('admin_config')
      .select('key, value, data_type')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch admin config:', error);
      // Return defaults if fetch fails
      return getDefaultConfig();
    }

    const config = getDefaultConfig();

    // Parse config values based on data_type
    if (configRows) {
      for (const row of configRows) {
        const key = row.key as keyof AdminConfig;
        const value = row.value;
        const dataType = row.data_type;

        // Type conversion based on data_type
        if (dataType === 'number') {
          config[key] = parseFloat(value as string) as never;
        } else if (dataType === 'boolean') {
          config[key] = (value === 'true' || value === true) as never;
        } else {
          config[key] = value as never;
        }
      }
    }

    // Update cache
    configCache = config;
    cacheTimestamp = Date.now();

    return config;
  } catch (err) {
    console.error('Error fetching admin config:', err);
    return getDefaultConfig();
  }
}

/**
 * Get a single config value by key
 */
export async function getConfigValue<K extends keyof AdminConfig>(
  key: K,
  forceRefresh = false
): Promise<AdminConfig[K]> {
  const config = await getAdminConfig(forceRefresh);
  return config[key];
}

/**
 * Default config values (fallback if fetch fails or cache is cold)
 */
function getDefaultConfig(): AdminConfig {
  return {
    // Subscription
    subscription_price_monthly: 7.99,
    subscription_price_yearly: 79.99,
    trial_period_days: 30,
    trial_enabled: true,
    grace_period_days: 90,

    // Swap Points
    sp_earn_multiplier: 1.0,
    sp_max_percentage_per_purchase: 50,
    sp_pending_days: 3,
    sp_expiration_days: 90,
    sp_min_balance_for_redemption: 100,
    sp_redemption_multiplier: 1.0,
    sp_subscriber_only: true,

    // Fees
    platform_fee_buyer_fixed_cents: 25,
    platform_fee_buyer_percentage: 2.5,
    platform_fee_seller_percentage: 5.0,
    platform_fee_seller_discount_percentage_freemium: 0,
    platform_fee_seller_discount_percentage_kids_club_plus: 0,
    stripe_transaction_fee_percentage: 2.9,
    stripe_transaction_fee_fixed_cents: 30,
    min_transaction_amount_cents: 100,

    // SMS
    twilio_enabled: true,
    sms_verification_timeout_minutes: 10,
    sms_daily_limit_per_user: 5,

    // Email
    sendgrid_enabled: true,
    email_from_address: 'noreply@kidsp2p.com',

    // Moderation
    moderation_ai_enabled: true,
    moderation_human_review_threshold: 'medium',
    moderation_auto_reject_high_risk: false,

    // Safety
    cpsc_recall_check_enabled: true,
    prohibited_items_check_enabled: true,

    // Analytics
    firebase_analytics_enabled: true,
    analytics_user_session_tracking: true,

    // Feature Flags
    feature_flag_sp_redemption_enabled: true,
    feature_flag_referral_program_enabled: false,
    feature_flag_bundle_purchases_enabled: false,
  };
}

/**
 * Invalidate cache to force refresh on next call
 */
export function invalidateConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Convenience functions for common config values
 */
export async function getSubscriptionPrice(): Promise<number> {
  return getConfigValue('subscription_price_monthly');
}

export async function getTrialDays(): Promise<number> {
  return getConfigValue('trial_period_days');
}

export async function isTrialEnabled(): Promise<boolean> {
  return getConfigValue('trial_enabled');
}

export async function getSPMaxPercentage(): Promise<number> {
  return getConfigValue('sp_max_percentage_per_purchase');
}

export async function getPlatformFeePercentage(): Promise<number> {
  return getConfigValue('platform_fee_buyer_percentage');
}

export async function getGracePeriodDays(): Promise<number> {
  return getConfigValue('grace_period_days');
}
