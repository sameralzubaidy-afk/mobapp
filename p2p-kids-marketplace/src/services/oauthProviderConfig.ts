// File: src/services/oauthProviderConfig.ts
// OAuth provider configuration for AUTH-V3-003
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN
// Source: TASK AUTH-V3-003 (Provider Config)

import { OAuthProvider } from '@/types/auth-v3';

/**
 * OAuth scopes required for each provider
 * Documented in MODULE-03-AUTH-V3-SOCIAL-LOGIN.md
 */
export const OAUTH_SCOPES: Record<OAuthProvider, string> = {
  google: 'openid email profile',
  facebook: 'email,public_profile',
  apple: 'name email',
};

/**
 * Deep-link redirect URI for OAuth callbacks
 * Must match scheme in app.json
 */
export const getRedirectUri = (): string => {
  const scheme = 'p2pkidsmarketplace'; // Must match app.json expo.scheme
  return `${scheme}://oauth-callback`;
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
