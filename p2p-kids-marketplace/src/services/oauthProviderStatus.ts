// File: src/services/oauthProviderStatus.ts
// FIX-Task-3 (QA Task 43d Item 1) — client-side pre-validation of OAuth providers
// against the LIVE GoTrue auth configuration, BEFORE supabase.auth.signInWithOAuth().
//
// Why: with `skipBrowserRedirect: true`, supabase-js returns the /auth/v1/authorize
// URL WITHOUT erroring for a provider that is disabled in Supabase Auth config —
// the `400 validation_failed "provider is not enabled"` only renders once the
// browser sheet / custom tab actually opens that URL (QA Task 43d Item 4 FAIL both
// platforms). Pre-validating against the PUBLIC GoTrue `GET /auth/v1/settings`
// endpoint (which mirrors the auth config's enabled external providers) lets the
// app fail fast with the friendly ProviderDisabledError banner and never open the
// raw-JSON sheet.
//
// The /settings endpoint is public (no session/admin credentials) — see
// supabase/auth internal/api/settings.go + README "GET /settings":
//   { "external": { "apple": bool, "google": bool, "facebook": bool, ... }, ... }
//
// Fail-open contract: this module NEVER throws to its caller. A probe failure
// (network, 5xx, missing env) returns `null` so the real OAuth initiation always
// runs; the existing 400-classification in oauthService stays as a backstop.

import { OAuthProvider } from '@/types/auth-v3';

/** How long a successful /settings probe is cached (BP-15-style TTL cache). */
const AUTH_SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

/** Providers this app offers social login for (== OAUTH_SCOPES keys in oauthProviderConfig). */
const APP_OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'facebook', 'apple'];

let cachedProviders: OAuthProvider[] | null = null;
let cacheExpiresAt = 0;

export interface GoTrueSettingsResponse {
  /** Enabled external providers map, e.g. { apple: false, google: true, facebook: true }. */
  external?: Partial<Record<string, boolean>>;
}

async function fetchEnabledProvidersFromGoTrue(): Promise<OAuthProvider[] | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl) {
    console.warn(
      '[oauthProviderStatus] EXPO_PUBLIC_SUPABASE_URL not set — skipping provider pre-check'
    );
    return null;
  }

  try {
    // Mirror the established raw REST header pattern used across the app
    // (trade.ts / subscription.ts): apikey + Bearer anon key.
    const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: {
        apikey: anonKey,
        ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
      },
    });

    if (!res.ok) {
      console.warn(`[oauthProviderStatus] GET /auth/v1/settings failed: HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as GoTrueSettingsResponse;
    const external = body?.external ?? {};
    return APP_OAUTH_PROVIDERS.filter((provider) => external[provider] === true);
  } catch (err) {
    // Fail open — a probe failure must never block the real OAuth initiation.
    console.warn(
      '[oauthProviderStatus] Provider probe failed — continuing without pre-check:',
      err
    );
    return null;
  }
}

/**
 * The OAuth providers (subset of google/facebook/apple) enabled per the LIVE GoTrue
 * auth config. TTL-cached; pass `forceRefresh = true` to bypass the cache.
 *
 * Returns:
 *  - `OAuthProvider[]` — probe succeeded (may be empty if every provider is disabled)
 *  - `null` — probe could not run / failed (caller MUST fail open and proceed)
 *
 * Never throws.
 */
export async function getEnabledOAuthProviders(
  forceRefresh = false
): Promise<OAuthProvider[] | null> {
  const now = Date.now();
  if (!forceRefresh && cachedProviders !== null && now < cacheExpiresAt) {
    return cachedProviders;
  }

  const providers = await fetchEnabledProvidersFromGoTrue();
  if (providers !== null) {
    cachedProviders = providers;
    cacheExpiresAt = now + AUTH_SETTINGS_CACHE_TTL_MS;
  }
  return providers;
}
