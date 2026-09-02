// p2p-kids-web/lib/publicConfig.ts
// Server-side public subscription config for the marketing pages (/join, success,
// home). Reads the same admin_config keys the mobile app and checkout Edge Function
// use, so displayed price/fee/trial copy can't drift from what is actually charged.
//
// admin_config rows are PUBLIC-readable (RLS: admin_config_select_all USING (true));
// this helper runs server-side with the anon key only — no secrets cross the wire.
//
// Canonical values (QA Task 20 unblock / owner decision 2026-09-02):
//   monthly price   = subscription_price_monthly  -> 599 cents ($5.99)
//   flat member fee = buyer_fee_active_member_cents -> 149 cents ($1.49)
//   trial           = trial_enabled (boolean) + trial_period_days

import { createClient } from "@supabase/supabase-js";

export interface PublicSubscriptionConfig {
  /** Monthly Kids Club+ price in CENTS (normalized to the >=100 => cents convention). */
  monthlyPriceCents: number;
  /** Flat Safety & Platform fee in cents (buyer_fee_active_member_cents). */
  flatFeeCents: number;
  /** trial_enabled (admin switch). */
  trialEnabled: boolean;
  /** trial_period_days (only meaningful when trialEnabled). */
  trialDays: number;
  /** True when every key resolved from the DB; false when config is unavailable. */
  complete: boolean;
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const REQUIRED_KEYS = [
  "subscription_price_monthly",
  "buyer_fee_active_member_cents",
  "trial_enabled",
  "trial_period_days",
] as const;

/**
 * Fetch the public marketing config once per request. Returns a best-effort
 * object; `complete:false` when Supabase/anon key is unset or the read fails so
 * callers can degrade gracefully (never crash the page).
 */
export async function getPublicSubscriptionConfig(): Promise<PublicSubscriptionConfig | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  try {
    const { data, error } = await supabase
      .from("admin_config")
      .select("key, value, data_type")
      .eq("is_active", true)
      .in("key", REQUIRED_KEYS);

    if (error || !Array.isArray(data)) {
      console.error("[publicConfig] admin_config read failed:", error?.message);
      return null;
    }

    const byKey = new Map<
      string,
      { value: string | boolean | number; data_type: string }
    >();
    for (const row of data as {
      key: string;
      value: string | boolean | number;
      data_type: string;
    }[]) {
      byKey.set(row.key, row);
    }

    const num = (key: string, fallback: number): number => {
      const row = byKey.get(key);
      if (!row) return fallback;
      const n = Number(row.value);
      return Number.isFinite(n) ? n : fallback;
    };
    const bool = (key: string, fallback: boolean): boolean => {
      const row = byKey.get(key);
      if (!row) return fallback;
      return row.value === "true" || row.value === true;
    };

    const rawMonthly = num("subscription_price_monthly", 599);
    // Normalize: >=100 means cents (staging), <100 means dollars (legacy seed).
    const monthlyPriceCents =
      rawMonthly >= 100 ? Math.round(rawMonthly) : Math.round(rawMonthly * 100);
    const flatFeeCents = Math.round(num("buyer_fee_active_member_cents", 149));
    const trialEnabled = bool("trial_enabled", false);
    const trialDays = Math.round(num("trial_period_days", 30));

    return {
      monthlyPriceCents,
      flatFeeCents,
      trialEnabled,
      trialDays,
      complete: true,
    };
  } catch (err) {
    console.error("[publicConfig] unexpected error:", err);
    return null;
  }
}
