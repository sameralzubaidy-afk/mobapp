// File: src/services/oauthService.ts
// OAuth Service for Social Login (Google, Facebook, Apple)
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN
// Source: TASK AUTH-V3-003 (OAuthService)

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase/client';
import {
  OAuthProvider,
  ProviderProfile,
  OAuthSession,
  AuthResult,
} from '@/types/auth-v3';
import {
  OAuthStateMismatchError,
  ProviderUnavailableError,
} from '@/types/auth-v3-errors';
import {
  OAUTH_SCOPES,
  getRedirectUri,
  OAUTH_STATE_KEY_PREFIX,
  OAUTH_STATE_EXPIRY_MS,
  PROVIDER_TIMEOUT_SECONDS,
} from './oauthProviderConfig';

/**
 * Generate a cryptographically secure random state token (32 bytes, base64)
 * Used for CSRF protection during OAuth flow
 */
async function generateStateToken(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  // Convert to base64 string for use in URL params
  return Buffer.from(randomBytes).toString('base64');
}

/**
 * Store OAuth state securely for later verification
 */
async function storeOAuthState(
  provider: OAuthProvider,
  state: string
): Promise<void> {
  const key = `${OAUTH_STATE_KEY_PREFIX}${provider}`;
  const session: OAuthSession = {
    state,
    provider,
    createdAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(key, JSON.stringify(session));
}

/**
 * Retrieve and validate stored OAuth state
 * Throws OAuthStateMismatchError if state doesn't match or is expired
 */
async function validateOAuthState(
  provider: OAuthProvider,
  receivedState: string
): Promise<OAuthSession> {
  const key = `${OAUTH_STATE_KEY_PREFIX}${provider}`;
  const storedSessionJson = await SecureStore.getItemAsync(key);

  if (!storedSessionJson) {
    throw new OAuthStateMismatchError('No stored state found for this provider');
  }

  const storedSession: OAuthSession = JSON.parse(storedSessionJson);

  // Verify state matches
  if (storedSession.state !== receivedState) {
    throw new OAuthStateMismatchError(
      `State mismatch: expected ${storedSession.state}, got ${receivedState}`
    );
  }

  // Check expiry (30 minutes)
  const createdAt = new Date(storedSession.createdAt).getTime();
  const now = Date.now();
  if (now - createdAt > OAUTH_STATE_EXPIRY_MS) {
    throw new OAuthStateMismatchError('OAuth state expired - flow took too long');
  }

  // Clean up stored state after successful validation
  await SecureStore.deleteItemAsync(key);

  return storedSession;
}

/**
 * Initiate OAuth social login flow
 * 
 * @param provider - OAuth provider (google, facebook, apple)
 * @returns OAuth URL to open + state token for verification
 * @throws ProviderUnavailableError if provider times out or returns 5xx
 * 
 * SECURITY: Generates CSRF state token and stores it securely
 * USER CANCEL: Provider may return 'access_denied' - caller should handle gracefully
 */
export async function initiateSocialLogin(
  provider: OAuthProvider
): Promise<{ url: string; state: string }> {
  try {
    // Generate CSRF state token
    const state = await generateStateToken();

    // Store state for callback verification
    await storeOAuthState(provider, state);

    // Get provider-specific scopes
    const scopes = OAUTH_SCOPES[provider];
    const redirectTo = getRedirectUri();

    // Start OAuth flow with Supabase Auth
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ProviderUnavailableError(provider, 'OAuth initiation timeout'));
      }, PROVIDER_TIMEOUT_SECONDS * 1000);
    });

    const { data, error } = await Promise.race([
      supabase.auth.signInWithOAuth({
        provider: provider as any, // Supabase types use string literals
        options: {
          redirectTo,
          scopes,
          queryParams: { state },
        },
      }),
      timeoutPromise,
    ]);

    if (error) {
      // Check if it's a 5xx error (provider outage)
      if (error.message.includes('503') || error.message.includes('500')) {
        throw new ProviderUnavailableError(
          provider,
          `Provider returned error: ${error.message}`
        );
      }
      throw new Error(`OAuth initiation failed: ${error.message}`);
    }

    if (!data?.url) {
      throw new Error('OAuth URL not returned by Supabase');
    }

    return { url: data.url, state };
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof ProviderUnavailableError ||
      error instanceof OAuthStateMismatchError
    ) {
      throw error;
    }

    // Wrap unexpected errors
    throw new Error(
      `Failed to initiate ${provider} login: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Handle OAuth callback after provider redirects back
 * 
 * @param code - Authorization code from provider (if using code exchange)
 * @param state - State token from URL params
 * @param provider - Which provider is calling back
 * @returns null if user cancelled, AuthResult on success
 * @throws OAuthStateMismatchError if state doesn't match
 * 
 * SECURITY: Validates CSRF state before accepting session
 * USER CANCEL: Returns null (no error thrown)
 */
export async function handleOAuthCallback(
  code: string | null,
  state: string | null,
  provider: OAuthProvider,
  error?: string
): Promise<AuthResult | null> {
  try {
    // User cancelled (provider returned access_denied)
    if (error === 'access_denied') {
      return null; // Graceful - no error thrown
    }

    // Validate CSRF state
    if (!state) {
      throw new OAuthStateMismatchError('No state token in callback');
    }

    await validateOAuthState(provider, state);

    // Supabase Auth handles token exchange automatically via the callback URL
    // We just need to wait for the session to be established
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(
        `Failed to get session after OAuth: ${sessionError?.message || 'No session'}`
      );
    }

    const { session } = sessionData;
    const user = session.user;

    // Extract profile from provider data
    const profile = extractProviderProfile(
      provider,
      user.user_metadata || {},
      user.identities?.[0]?.identity_data || {}
    );

    return {
      success: true,
      userId: user.id,
      sessionToken: session.access_token,
      metadata: {
        provider,
        profile,
        isNewUser: user.created_at === user.last_sign_in_at,
      },
    };
  } catch (error) {
    if (error instanceof OAuthStateMismatchError) {
      throw error;
    }

    return {
      success: false,
      errorCode: 'OAUTH_CALLBACK_FAILED',
      errorMessage:
        error instanceof Error ? error.message : 'OAuth callback failed',
    };
  }
}

/**
 * Extract provider profile data into standardized format
 * 
 * Provider-specific extraction rules:
 * - Google: given_name + family_name → name, picture → avatar
 * - Facebook: name → name, picture.data.url → avatar
 * - Apple: firstName + lastName → name (FIRST SIGN-IN ONLY), no avatar
 * 
 * @param provider - OAuth provider
 * @param userData - User metadata from Supabase
 * @param identityData - Identity data from Supabase
 * @returns Standardized profile data
 */
export function extractProviderProfile(
  provider: OAuthProvider,
  userData: Record<string, any>,
  identityData: Record<string, any>
): ProviderProfile {
  const data = { ...userData, ...identityData };

  switch (provider) {
    case 'google': {
      const givenName = data.given_name || '';
      const familyName = data.family_name || '';
      const name = `${givenName} ${familyName}`.trim() || data.name || '';

      return {
        name,
        email: data.email || '',
        avatar: data.picture || undefined,
        provider: 'google',
        providerUserId: data.sub || data.id || '',
      };
    }

    case 'facebook': {
      const name = data.name || '';
      const avatar = data.picture?.data?.url || data.picture || undefined;

      return {
        name,
        email: data.email || '',
        avatar,
        provider: 'facebook',
        providerUserId: data.id || '',
      };
    }

    case 'apple': {
      // Apple only sends firstName/lastName on FIRST authorization
      // After that, these fields are null and we must use cached data
      let name = '';

      if (data.firstName || data.lastName) {
        name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
      } else {
        // Fall back to full_name if available (some Apple responses)
        name = data.full_name || data.name || '';
      }

      return {
        name,
        email: data.email || '',
        avatar: undefined, // Apple does not provide avatar
        provider: 'apple',
        providerUserId: data.sub || data.id || '',
      };
    }

    default: {
      // Should never reach here due to TypeScript union, but handle gracefully
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * Check if user has linked a specific provider
 * 
 * @param userId - User ID to check
 * @param provider - Provider to check for
 * @returns true if provider is linked
 */
export async function isProviderLinked(
  userId: string,
  provider: OAuthProvider
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_linked_providers')
    .select('provider')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    console.error(`[oauthService] Error checking linked provider:`, error);
    return false;
  }

  return !!data;
}
