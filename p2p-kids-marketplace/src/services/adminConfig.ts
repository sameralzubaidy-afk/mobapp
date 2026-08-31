// File: p2p-kids-marketplace/src/services/adminConfig.ts
// Dynamic config service - fetches all admin_config values from Supabase

import { supabase } from '../config/supabase';
import { getSimulatedConfigFetchFailure } from './devTestingService';
import { AppState } from 'react-native';

export interface AdminConfig {
  // Subscription
  subscription_price_monthly: number;
  subscription_price_yearly: number;
  trial_period_days: number;
  trial_enabled: boolean;
  max_trial_uses: number;
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
  transaction_fee_subscriber_cents: number;
  transaction_fee_non_subscriber_cents: number;
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
  moderation_appeal_max_attempts: number;
  moderation_appeal_window_days: number;

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

  // Offer Limits (admin-configurable, no hardcoded fallback in enforcement)
  max_pending_offers_per_seller: number;

  // Listing Price Floor
  min_listing_price: number;

  // Bundle Fee Behavior
  charge_one_fee_per_bundle: boolean;

  // Tiered Buyer-Fee Engine (R1) — flat/percentage buyer fee params.
  // Read via fn_get_buyer_fee_for_checkout (authoritative); these mirrors exist
  // so the config cache can expose them if needed.
  buyer_fee_active_member_cents: number;
  buyer_fee_first_trade_cents: number;
  buyer_fee_subsequent_percentage: number;
  buyer_fee_subsequent_fixed_cents: number;
  buyer_fee_subsequent_max_cents: number;
  buyer_fee_label: string;
}

// In-memory cache with TTL
let configCache: AdminConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeSubscriptionPriceMonthly(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  // Some environments have this value stored as cents (e.g. 1500 for $15.00).
  if (rawValue >= 100) {
    return rawValue / 100;
  }

  return rawValue;
}

/**
 * Fetch all admin config values from Supabase
 * Uses in-memory cache with 5-minute TTL
 */
export async function getAdminConfig(forceRefresh = false): Promise<AdminConfig> {
  // Return cached config if available and not expired
  if (!forceRefresh && configCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return configCache;
  }

  // QA TRD-TC-B05i (dev-only, session-local): simulate the admin_config fetch
  // failing — exercises the fail-soft path (getDefaultConfig) on demand WITHOUT
  // touching shared-staging admin_config. Fail-closed outside dev/test.
  if ((await getSimulatedConfigFetchFailure()) === 'fetch_failure') {
    // eslint-disable-next-line no-console
    console.warn(
      '⚠️ [QA] Simulated admin config fetch failure (qa_local_config_fetch_failure) — returning defaults'
    );
    return getDefaultConfig();
  }

  try {
    let configRows: {
      key: string;
      value: string | boolean | number;
      data_type: string;
    }[] | null = null;

    const { data: keyValueRows, error: keyValueError } = await supabase
      .from('admin_config')
      .select('key, value, data_type')
      .eq('is_active', true);

    if (!keyValueError && keyValueRows) {
      configRows = keyValueRows as {
        key: string;
        value: string | boolean | number;
        data_type: string;
      }[];
    } else {
      console.warn('⚠️ Failed to fetch admin config:', keyValueError?.message);
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
    const error = err as Error;
    console.warn('⚠️ Error fetching admin config:', error.message);
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
    subscription_price_monthly: 0,
    subscription_price_yearly: 0,
    trial_period_days: 30,
    trial_enabled: true,
    max_trial_uses: 1,
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
    transaction_fee_subscriber_cents: 99,
    transaction_fee_non_subscriber_cents: 299,
    // ❌ DEPRECATED: Percentage-based buyer fees not used per BRD Section 8.1.1
    // BRD requires flat fees only (set to 0 to mark as deprecated)
    platform_fee_buyer_fixed_cents: 0,
    platform_fee_buyer_percentage: 0.00,
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
    moderation_appeal_max_attempts: 3,
    moderation_appeal_window_days: 14,

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

    // Offer Limits
    max_pending_offers_per_seller: 3,

    // Listing Price Floor (0 = disabled / no floor)
    min_listing_price: 0,

    // Bundle Fee Behavior — default: charge per item (current behavior)
    charge_one_fee_per_bundle: false,

    // Tiered Buyer-Fee Engine (R1) — seed defaults; admin_config is authoritative.
    buyer_fee_active_member_cents: 149,
    buyer_fee_first_trade_cents: 149,
    buyer_fee_subsequent_percentage: 5.0,
    buyer_fee_subsequent_fixed_cents: 199,
    buyer_fee_subsequent_max_cents: 499,
    buyer_fee_label: 'Safety & Platform Fee',
  };
}

/**
 * Invalidate cache to force refresh on next call
 */
export function invalidateConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

// DT71 (2026-08-31): invalidate the in-memory config cache whenever the app
// returns to the foreground, so admin-driven config changes (e.g. toggling
// sales_tax_enabled / min_listing_price / SP caps in the admin portal) apply on
// the next getAdminConfig() read WITHOUT requiring an app relaunch. Mirrors the
// CartContext foreground-refresh pattern. Self-registered once on import.
let foregroundRefreshRegistered = false;
function registerForegroundRefresh(): void {
  if (foregroundRefreshRegistered) return;
  foregroundRefreshRegistered = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      invalidateConfigCache();
    }
  });
}
registerForegroundRefresh();

/**
 * Convenience functions for common config values
 */
export async function getSubscriptionPrice(forceRefresh = false): Promise<number> {
  const rawValue = await getConfigValue('subscription_price_monthly', forceRefresh);
  return normalizeSubscriptionPriceMonthly(rawValue);
}

export async function getTrialDays(forceRefresh = false): Promise<number> {
  return getConfigValue('trial_period_days', forceRefresh);
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

/**
 * Extract a single result from a TABLE-returning RPC.
 * Supabase JS returns TABLE results as an array of row objects.
 */
function extractRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data) && data.length > 0) {
    return data[0] as T;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as T;
  }
  return null;
}

export async function getTransactionFeeSubscriberCents(forceRefresh = false): Promise<number> {
  // Uses SECURITY DEFINER RPC to bypass RLS on admin_config
  // Falls back to getConfigValue as secondary fallback
  try {
    const { data, error } = await supabase.rpc('fn_get_fee_config');
    const row = extractRpcRow<{ subscriber_cents: number }>(data);
    if (!error && row?.subscriber_cents != null && Number.isFinite(row.subscriber_cents)) {
      return row.subscriber_cents;
    }
    if (error) {
      console.warn('[adminConfig] RPC fn_get_fee_config failed:', error.message);
    }
  } catch (err) {
    console.warn('[adminConfig] RPC fn_get_fee_config error:', (err as Error).message);
  }
  // Fallback to cached adminConfig
  return getConfigValue('transaction_fee_subscriber_cents', forceRefresh);
}

export async function getTransactionFeeNonSubscriberCents(forceRefresh = false): Promise<number> {
  // Uses SECURITY DEFINER RPC to bypass RLS on admin_config
  // Falls back to getConfigValue as secondary fallback
  try {
    const { data, error } = await supabase.rpc('fn_get_fee_config');
    const row = extractRpcRow<{ non_subscriber_cents: number }>(data);
    if (!error && row?.non_subscriber_cents != null && Number.isFinite(row.non_subscriber_cents)) {
      return row.non_subscriber_cents;
    }
    if (error) {
      console.warn('[adminConfig] RPC fn_get_fee_config failed:', error.message);
    }
  } catch (err) {
    console.warn('[adminConfig] RPC fn_get_fee_config error:', (err as Error).message);
  }
  // Fallback to cached adminConfig
  return getConfigValue('transaction_fee_non_subscriber_cents', forceRefresh);
}

/**
 * Returns the platform fee in cents for the given user tier.
 * Source of truth: admin_config rows
 *   key=transaction_fee_subscriber_cents     (default: 99  = $0.99)
 *   key=transaction_fee_non_subscriber_cents (default: 299 = $2.99)
 * Falls back to the defaults above if Supabase is unreachable.
 */
export async function getPlatformFeeCents(isSubscriber: boolean): Promise<number> {
  return isSubscriber
    ? getTransactionFeeSubscriberCents()
    : getTransactionFeeNonSubscriberCents();
}

/**
 * Returns whether the bundle checkout should charge the platform fee
 * once (per bundle) instead of per item.
 * Source of truth: admin_config key=charge_one_fee_per_bundle (boolean, default: false)
 */
export async function getChargeOneFeePerBundle(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'charge_one_fee_per_bundle')
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data?.value != null) {
      return data.value === 'true';
    }
  } catch (err) {
    console.warn('⚠️ getChargeOneFeePerBundle failed:', (err as Error).message);
  }
  return false; // default: per-item charging (current behavior)
}

export interface BuyerFeeInfo {
  feeCents: number;
  feeState: string;
  label: string;
}

/**
 * R1 — Tiered Buyer-Fee Engine: resolves the authoritative buyer fee for a
 * checkout via fn_get_buyer_fee_for_checkout (SECURITY DEFINER). This is the
 * SAME function the create-trade-offer Edge Function calls, so the preview and
 * the actual charge always agree.
 *
 * Fee tiers (all amounts dynamic from admin_config 'fees' category):
 *   - active_member / no_completed_trade / first_trade_in_progress -> flat fee
 *   - first_trade_completed / subsequent_free -> %% of cash portion + fixed, capped
 *
 * @param cashPortionCents cash portion of the order (order total minus Swap
 *   Points) BEFORE the fee — the percentage tier applies only to this amount.
 * @returns fee info, or null when the RPC is unavailable (display-only fallback;
 *   the server remains authoritative for the actual charge).
 */
export async function getBuyerFeeForCheckout(
  cashPortionCents: number
): Promise<BuyerFeeInfo | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('fn_get_buyer_fee_for_checkout', {
      p_user_id: user.id,
      p_cash_portion_cents: Math.max(0, Math.round(cashPortionCents)),
    });

    if (error) {
      console.warn('[adminConfig] fn_get_buyer_fee_for_checkout failed:', error.message);
      return null;
    }
    const row = extractRpcRow<{ fee_state: string; fee_cents: number | null; label: string }>(data);
    if (!row || !Number.isFinite(Number(row.fee_cents))) {
      console.warn('[adminConfig] fn_get_buyer_fee_for_checkout returned no fee:', row);
      return null;
    }
    return {
      feeCents: Number(row.fee_cents),
      feeState: row.fee_state,
      label: row.label ?? 'Safety & Platform Fee',
    };
  } catch (err) {
    console.warn('[adminConfig] fn_get_buyer_fee_for_checkout error:', (err as Error).message);
    return null;
  }
}

/**
 * R1 — Tiered Buyer-Fee Engine: the flat Safety & Platform Fee charged to active
 * members (subscription trial|active), dynamic from admin_config
 * (buyer_fee_active_member_cents). Used by the subscription marketing/plan screens.
 * Fallback 149 matches the seed default in 20260810000009_tiered_buyer_fee_engine.sql
 * (BP-13 — the canonical source is admin_config).
 */
export async function getActiveMemberFeeCents(forceRefresh = false): Promise<number> {
  try {
    const config = await getAdminConfig(forceRefresh);
    const raw = Number(config.buyer_fee_active_member_cents);
    if (Number.isFinite(raw) && raw >= 0) {
      return Math.round(raw);
    }
  } catch (err) {
    console.warn('[adminConfig] getActiveMemberFeeCents error:', (err as Error).message);
  }
  return 149;
}

export async function getSPExpirationDays(forceRefresh = false): Promise<number> {
  // Primary source: admin_config table as written by Admin UI.
  // Canonical schema uses key/value columns.
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'sp_expiration_days')
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data?.value != null) {
      const parsed = Number(data.value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPExpirationDays table read (key/value) failed, trying legacy schema:',
      (err as Error).message
    );
  }

  // Keep RPC path as compatibility fallback.
  try {
    const { data, error } = await supabase.rpc('get_config_value', {
      p_key: 'sp_expiration_days',
    });

    if (!error && data != null) {
      const parsed = Number(data);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPExpirationDays RPC(get_config_value) failed, trying legacy sp_config key:',
      (err as Error).message
    );
  }

  // Legacy fallback for environments still storing this in sp_config.
  try {
    const { data, error } = await supabase.rpc('get_sp_config', {
      p_key: 'expiration_period_days',
    });

    if (!error && data != null) {
      const parsed = Number(data);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPExpirationDays legacy RPC(get_sp_config) failed, falling back to table config fetch:',
      (err as Error).message
    );
  }

  return getConfigValue('sp_expiration_days', forceRefresh);
}

export async function getGracePeriodDays(forceRefresh = false): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_config_value', {
      p_key: 'grace_period_days',
    });

    if (!error && data != null) {
      const parsed = Number(data);
      if (Number.isFinite(parsed)) {
        return Math.max(parsed, 0);
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getGracePeriodDays RPC failed, falling back to table config fetch:',
      (err as Error).message
    );
  }

  return getConfigValue('grace_period_days', forceRefresh);
}

/**
 * Get the number of days SP remains pending after trade completion
 * before being released to the seller's available balance.
 * Default: 3 days.
 */
export async function getSPReleaseDays(_forceRefresh = false): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_config_value', {
      p_key: 'sp_pending_days',
    });

    if (!error && data != null) {
      const parsed = Number(data);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPReleaseDays RPC failed, trying admin_config key sp_pending_days:',
      (err as Error).message
    );
  }

  // Fallback: check admin_config directly for 'sp_pending_days' (Config page Swap Points tab saves here)
  // Uses direct query instead of getConfigValue to bypass the is_active=true filter,
  // because secure_upsert_admin_config RPC does NOT set is_active=true.
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value, data_type')
      .eq('key', 'sp_pending_days')
      .maybeSingle();

    if (!error && data?.value != null) {
      if (data.data_type === 'number') {
        const parsed = parseFloat(String(data.value));
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
      // If data_type is missing (RPC doesn't set it), try parsing as number anyway
      const parsed = Number(data.value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPReleaseDays admin_config direct query failed:',
      (err as Error).message
    );
  }

  // Last resort: check sp_config table (may be stale if sync trigger is missing)
  try {
    const { data, error } = await supabase
      .from('sp_config')
      .select('config_value')
      .eq('config_key', 'sp_pending_days')
      .maybeSingle();

    if (!error && data?.config_value != null) {
      const parsed = Number(data.config_value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(
      '⚠️ getSPReleaseDays sp_config table failed:',
      (err as Error).message
    );
  }

  return 3;
}
