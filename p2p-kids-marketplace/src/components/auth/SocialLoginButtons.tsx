// File: p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx
// Social login buttons container (Google + Facebook + Apple)
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { OAuthProvider, ProviderProfile } from '@/types/auth-v3';
import { initiateSocialLogin, handleOAuthCallback } from '@/services/oauthService';
import { checkAccountExists } from '@/services/accountService';
import { autoFillProfile } from '@/services/profileService';
import { ProviderUnavailableError } from '@/types/auth-v3-errors';
import { useAuth } from '@/hooks/useAuth';
import { getRedirectUri } from '@/services/oauthProviderConfig';
import { supabase } from '@/services/supabase/client';

// Warm up the browser for faster OAuth flows
WebBrowser.maybeCompleteAuthSession();

export interface SocialLoginButtonsProps {
  /** Display mode: 'login' shows "Sign in with", 'signup' shows "Continue with" */
  mode: 'login' | 'signup';

  /** Callback when OAuth succeeds AND account exists (navigate to AccountLinkingPrompt) */
  onAccountExists?: (email: string, provider: OAuthProvider) => void;

  /** Callback when OAuth succeeds AND it's a new signup (navigate to home) */
  onSignupSuccess?: () => void;

  /** Callback when OAuth succeeds for existing user login (navigate to home) */
  onLoginSuccess?: () => void;

  /** Ref to email input for scroll-to-focus on provider outage */
  emailInputRef?: React.RefObject<any>;

  /** Test ID for automation */
  testID?: string;
}

/**
 * SOCIAL LOGIN BUTTONS COMPONENT
 *
 * Renders Google + Facebook + Apple OAuth buttons.
 * Handles full flow: initiate → callback → check account → auto-fill profile → navigate.
 *
 * OS-Conditional Rendering:
 * - Apple button rendered on BOTH iOS and Android per App Store compliance
 *   (required when other third-party sign-ins are offered)
 *
 * Error Handling:
 * - Provider outage (ProviderUnavailableError): shows inline banner + email fallback CTA
 * - User cancel (access_denied): silent — button returns to idle
 *
 * CSRF Protection:
 * - OAuth state token generated and validated via oauthService
 *
 * Navigation Logic:
 * - Signup mode + new user → auto-fill profile → onSignupSuccess → navigate to home
 * - Login mode + existing user → onLoginSuccess → navigate to home
 * - Existing account detected → onAccountExists → show AccountLinkingPrompt modal
 *
 * @example
 * ```tsx
 * <SocialLoginButtons
 *   mode="signup"
 *   onSignupSuccess={() => navigation.navigate('Home')}
 *   onAccountExists={(email, provider) => setLinkPrompt({ email, provider })}
 *   emailInputRef={emailInputRef}
 * />
 * ```
 */
export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  mode,
  onAccountExists,
  onSignupSuccess,
  onLoginSuccess,
  emailInputRef,
  testID,
}) => {
  const { refreshSession } = useAuth();

  // Loading state per provider
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  // Provider unavailable error state
  const [unavailableProvider, setUnavailableProvider] = useState<OAuthProvider | null>(null);

  /**
   * Parse OAuth callback params from URL
   * Handles both query params (?code=...) and fragment params (#access_token=...)
   */
  const parseOAuthCallbackUrl = (
    url: string
  ): {
    code: string | null;
    state: string | null;
    error?: string;
    access_token?: string;
    refresh_token?: string;
  } => {
    const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const fragmentPart = url.includes('#') ? url.split('#')[1] : '';

    const queryParams = new URLSearchParams(queryPart);
    const fragmentParams = new URLSearchParams(fragmentPart);

    const getParam = (key: string): string | null => {
      return queryParams.get(key) || fragmentParams.get(key) || null;
    };

    return {
      code: getParam('code'),
      state: getParam('state'),
      error: getParam('error') || undefined,
      access_token: getParam('access_token') || undefined,
      refresh_token: getParam('refresh_token') || undefined,
    };
  };

  /**
   * Handle social login for a provider
   * Full flow: initiate → callback → check account → auto-fill → navigate
   */
  const handleSocialLogin = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    setUnavailableProvider(null);

    try {
      const { data: preAuthSessionData } = await supabase.auth.getSession();
      const preAuthUserId = preAuthSessionData?.session?.user?.id || null;

      const runOAuthAttempt = async (
        redirectUri: string
      ): Promise<{ callbackUrl: string | null; state: string }> => {
        // Step 1: Initiate OAuth flow (get provider URL + CSRF state)
        const { state, url } = await initiateSocialLogin(provider, redirectUri);

        // Step 2: Open auth session and capture callback URL directly.
        // This works for both custom scheme callbacks and localhost callbacks.
        console.log('');
        console.log('🌐 ========== OPENING AUTH SESSION ==========');
        console.log('🔗 OAuth URL:', url.substring(0, 120) + '...');
        console.log('🔙 Return URL:', redirectUri);
        console.log('===========================================');
        console.log('');

        const appReturnUrl = redirectUri;
        const authSessionUrl = url;

        let callbackUrl: string | null = null;

        if (process.env.NODE_ENV !== 'test') {
          // Set up deep link listener as fallback if WebBrowser hangs
          let linkingCallbackUrl: string | null = null;
          const linkingSubscription = Linking.addEventListener('url', ({ url: incomingUrl }) => {
            console.log('📲 Deep link received during OAuth:', incomingUrl);
            if (incomingUrl.includes('oauth-callback') || incomingUrl.includes('state=')) {
              linkingCallbackUrl = incomingUrl;
            }
          });

          try {
            // Open OAuth session in browser
            const authResult = await Promise.race([
              WebBrowser.openAuthSessionAsync(authSessionUrl, appReturnUrl, {
                // Helps ensure OAuth account selection is shown instead of silently reusing cookies.
                preferEphemeralSession: true,
              }),
              new Promise<{ type: 'timeout' }>((resolve) => {
                setTimeout(() => resolve({ type: 'timeout' }), 45000);
              }),
            ]);

            console.log('🔔 Auth session result:', authResult.type);

            if (authResult.type === 'success' && 'url' in authResult && authResult.url) {
              callbackUrl = authResult.url;
            } else {
              if (authResult.type === 'timeout') {
                console.log(
                  '[SocialLoginButtons] OAuth session timed out - checking deep link/session recovery'
                );
              }

              if (linkingCallbackUrl) {
                callbackUrl = linkingCallbackUrl;
                console.log('[SocialLoginButtons] Using deep-link callback captured during dismiss');
                return { callbackUrl, state };
              }

              console.log(
                '[SocialLoginButtons] OAuth flow cancelled or dismissed - checking session...'
              );

              // Some providers/proxy flows return `cancel` after auth completes.
              // Recover by polling for a newly established session.
              for (let attempt = 0; attempt < 60; attempt += 1) {
                const { data: recoveredSessionData } = await supabase.auth.getSession();
                const recoveredUserId = recoveredSessionData?.session?.user?.id || null;
                const hasRecoveredSession =
                  !!recoveredUserId && (!preAuthUserId || recoveredUserId !== preAuthUserId);

                if (hasRecoveredSession) {
                  callbackUrl = state ? `${redirectUri}?state=${encodeURIComponent(state)}` : redirectUri;
                  console.log('[SocialLoginButtons] Recovered OAuth session after dismiss');
                  break;
                }

                if (attempt > 0 && attempt % 10 === 0) {
                  console.log('[SocialLoginButtons] Waiting for recovered session...', {
                    attempt,
                    redirectUri,
                  });
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }
          } finally {
            linkingSubscription.remove();
          }
        }

        return { callbackUrl, state };
      };

      // Single attempt with the redirect URI from config (now uses auth.expo.io for Expo Go)
      const { callbackUrl, state } = await runOAuthAttempt(getRedirectUri());

      if (!callbackUrl) {
        // No callback and no recovered session.
        return;
      }

      const callback = parseOAuthCallbackUrl(callbackUrl);
      console.log('🔗 OAuth callback URL:', callbackUrl);
      console.log('🔍 Parsed OAuth callback:', {
        hasCode: !!callback.code,
        hasAccessToken: !!callback.access_token,
        hasState: !!callback.state,
        hasError: !!callback.error,
        error: callback.error || 'none',
        code: callback.code || null,
        state: callback.state || null,
      });

      const result = await handleOAuthCallback(
        callback.code,
        callback.state || state || null,
        provider,
        callback.error,
        callback.access_token,
        callback.refresh_token
      );

      if (!result) {
        console.log('[SocialLoginButtons] OAuth flow cancelled by user');
        return;
      }

      if (!result.success) {
        console.log('[SocialLoginButtons] OAuth flow failed:', result.errorCode);
        return;
      }

      const userId = result.userId;
      const profile =
        (result.metadata?.profile as ProviderProfile | undefined) ||
        ((result as any).profile as ProviderProfile | undefined);

      // Step 4: Check if account already exists with this email
      if (profile?.email && userId) {
        const accountCheck = await checkAccountExists(profile.email);

        if (accountCheck.exists && accountCheck.userId !== userId) {
          if (onAccountExists) {
            onAccountExists(profile.email, provider);
          }
          return;
        }
      }

      // Step 5: Auto-fill profile on first signup
      if (mode === 'signup' && profile) {
        await autoFillProfile(profile);
      }

      // Step 6: Refresh auth context
      await refreshSession(true);

      // Step 7: Navigate based on mode
      if (mode === 'signup' && onSignupSuccess) {
        onSignupSuccess();
      } else if (mode === 'login' && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'OAUTH_REDIRECT_TIMEOUT') {
        // User closed provider page without completing auth. Treat as silent cancel.
        console.log('[SocialLoginButtons] OAuth flow cancelled by user (redirect timeout)');
        return;
      }

      console.error(`[SocialLoginButtons] ${provider} OAuth error:`, error);

      // Handle provider unavailable error
      if (error instanceof ProviderUnavailableError) {
        setUnavailableProvider(provider);
      } else {
        // Other errors: log but don't block — user can try email signup
        console.error(`[SocialLoginButtons] Unexpected error:`, error);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  /**
   * Focus email input (for provider unavailable fallback CTA)
   */
  const handleFocusEmailInput = () => {
    if (emailInputRef?.current) {
      emailInputRef.current.focus();
      // Scroll to email input if in ScrollView
      if (emailInputRef.current.measure) {
        emailInputRef.current.measure(
          (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
            // Scroll logic would go here if parent is a ScrollView
            console.log('[SocialLoginButtons] Email input focused at:', { pageX, pageY });
          }
        );
      }
    }
    setUnavailableProvider(null);
  };

  /**
   * Get capitalized provider name for display
   */
  const getProviderDisplayName = (provider: OAuthProvider): string => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  return (
    <View style={styles.container} testID={testID || 'social-login-buttons'}>
      {/* Divider with text - Whisk style */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Provider unavailable banner */}
      {unavailableProvider && (
        <View style={styles.errorBanner} testID="provider-unavailable-banner">
          <Text style={styles.errorText}>
            {getProviderDisplayName(unavailableProvider)} is temporarily unavailable.{' '}
            {mode === 'signup' ? 'Sign up' : 'Sign in'} with email instead?
          </Text>
          <TouchableOpacity
            onPress={handleFocusEmailInput}
            style={styles.errorCta}
            accessible={true}
            accessibilityLabel="Use email signup instead"
            accessibilityRole="button"
            testID="provider-error-cta"
          >
            <Text style={styles.errorCtaText}>Use Email</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Circular icon buttons - Whisk style */}
      <View style={styles.buttonsContainer}>
        {/* Google */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleSocialLogin('google')}
          disabled={loadingProvider !== null}
          testID="google-login-button"
        >
          <Text style={styles.iconText}>G</Text>
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleSocialLogin('apple')}
          disabled={loadingProvider !== null}
          testID="apple-login-button"
        >
          <Text style={styles.iconText}></Text>
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleSocialLogin('facebook')}
          disabled={loadingProvider !== null}
          testID="facebook-login-button"
        >
          <Text style={styles.iconText}>f</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#6B6B6B',
    textTransform: 'lowercase',
  },
  buttonsContainer: {
    flexDirection: 'row', // Horizontal row
    gap: 16,
    justifyContent: 'center',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25, // Circular
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  errorBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 8,
    lineHeight: 20,
  },
  errorCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  errorCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
