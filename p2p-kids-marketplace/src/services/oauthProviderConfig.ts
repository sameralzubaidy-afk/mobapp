// File: src/services/oauthProviderConfig.ts
// OAuth provider configuration for AUTH-V3-003
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN
// Source: TASK AUTH-V3-003 (Provider Config)

import { OAuthProvider } from '@/types/auth-v3';
import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * OAuth scopes required for each provider
 * Documented in MODULE-03-AUTH-V3-SOCIAL-LOGIN.md
 */
export const OAUTH_SCOPES: Record<OAuthProvider, string> = {
  google: 'openid email profile',
  // Email is required by Supabase Facebook provider to complete user identity mapping.
  facebook: 'public_profile,email',
  apple: 'name email',
};

/**
 * Deep-link redirect URI for OAuth callbacks
 * Strategy for Expo Go (iOS Simulator):
 * - PRIMARY: Use auth.expo.io proxy (deep links unreliable on simulator)
 * - FALLBACK: Direct exp:// callback if proxy unavailable
 * For dev builds/standalone, use native app scheme.
 */
export const getRedirectUri = (): string => {
  // Detect Expo Go via the modern, reliable executionEnvironment API (NOT the
  // deprecated appOwnership, which is ambiguous on development builds). On a
  // dev build / standalone the value is `standalone`, so we correctly take the
  // native-scheme path below.
  const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (isExpoGo) {
    // Expo Go: prefer auth.expo.io proxy for iOS Simulator reliability.
    // Use AuthSession helper so runtime project identity is respected.
    try {
      const proxyUrl = AuthSession.getRedirectUrl();
      console.log('[oauthProviderConfig] Using auth.expo.io proxy (primary):', proxyUrl);
      return proxyUrl;
    } catch {
      const scopeKey =
        Constants?.expoConfig?.extra?.scopeKey ||
        (Constants as any)?.manifest?.extra?.scopeKey ||
        (Constants as any)?.manifest2?.extra?.scopeKey ||
        (Constants as any)?.manifest2?.extra?.expoClient?.extra?.scopeKey;
      if (typeof scopeKey === 'string' && scopeKey.startsWith('@')) {
        const scopeKeyPath = scopeKey.split('?')[0].replace(/^\/+/, '');
        const proxyUrl = `https://auth.expo.io/${scopeKeyPath}`;
        console.log('[oauthProviderConfig] Using auth.expo.io scopeKey fallback:', proxyUrl);
        return proxyUrl;
      }

      const owner = Constants?.expoConfig?.owner;
      const slug = Constants?.expoConfig?.slug;

      if (owner && slug) {
        const proxyUrl = `https://auth.expo.io/@${owner}/${slug}`;
        console.log('[oauthProviderConfig] Using auth.expo.io owner/slug fallback:', proxyUrl);
        return proxyUrl;
      }
    }

    // Fallback: direct exp:// callback if owner/slug unavailable
    try {
      const directCallback = AuthSession.makeRedirectUri({
        path: 'oauth-callback',
        preferLocalhost: false,
      });
      console.log('[oauthProviderConfig] Using direct exp:// callback (fallback):', directCallback);
      return directCallback;
    } catch {
      return 'exp://localhost:8081/--/oauth-callback';
    }
  }

  // Dev builds / standalone: return the deterministic native-scheme callback URL.
  // Do NOT use AuthSession.makeRedirectUri() here — on a dev build it embeds the
  // Metro dev host (`p2pkidsmarketplace:///127.0.0.1:8081/oauth-callback`), a
  // triple-slash + host URL that breaks ASWebAuthenticationSession's custom-scheme
  // callback capture (session invalidated with `Code=4 "Invalidation requested"`,
  // callback never delivered → app returns to Login with no session) and never
  // matches the registered redirect. The `p2pkidsmarketplace` scheme IS registered
  // in Info.plist (CFBundleURLTypes), so the clean form is sufficient and stable
  // across dev/prod.
  return 'p2pkidsmarketplace://oauth-callback';
};

/**
 * Provider display names for UI
 */
export const PROVIDER_DISPLAY_NAMES: Record<OAuthProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
};

/**
 * OAuth state token storage key prefix
 * Actual key is `oauth_state_{provider}`
 */
export const OAUTH_STATE_KEY_PREFIX = 'oauth_state_';

/**
 * OAuth state expiry (30 minutes)
 * After this, stored state is considered stale
 */
export const OAUTH_STATE_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Provider-specific quirks and known issues
 */
export const PROVIDER_NOTES: Record<OAuthProvider, string> = {
  google: 'Returns given_name + family_name + picture on every sign-in',
  facebook: 'Avatar nested at picture.data.url',
  apple: 'firstName/lastName only on first authorization - cache immediately',
};

/**
 * Provider outage timeout (seconds)
 * If OAuth initiation takes longer than this, assume provider is down
 */
export const PROVIDER_TIMEOUT_SECONDS = 10;
