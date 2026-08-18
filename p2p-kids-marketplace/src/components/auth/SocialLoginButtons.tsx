// File: p2p-kids-marketplace/src/components/auth/SocialLoginButtons.tsx
// Social login buttons container (Google + Facebook + Apple)
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { AppleLogo } from 'phosphor-react-native';
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

// One-time inline hint under the social row — shown once per device, then remembered.
const SOCIAL_HINT_SEEN_KEY = '@kids_marketplace:social_login_hint_seen_v1';
const SOCIAL_HINT_COPY = 'Prefer to sign in with Google, Apple, or Facebook?';

export interface SocialLoginButtonsProps {
  /** Display mode: 'login' shows "Sign in with", 'signup' shows "Continue with" */
  mode: 'login' | 'signup';

  /** Callback when OAuth succeeds AND the provider email matches an existing account.
   *  Receives the email, provider, extracted provider profile, and whether the existing
   *  account has a password (drives AccountLinkingPrompt's re-auth mode). */
  onAccountExists?: (
    email: string,
    provider: OAuthProvider,
    profile: ProviderProfile,
    hasPassword: boolean
  ) => void;

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
 *   onAccountExists={(email, provider, profile, hasPassword) =>
 *     setLinkPrompt({ email, provider, profile, hasPassword })
 *   }
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

  // OAuth failure banner state — covers provider outages (ProviderUnavailableError) AND
  // initiation failures (e.g. OAUTH_INIT_FAILED) so a dead tap is never silent to the user.
  const [errorInfo, setErrorInfo] = useState<{ provider: OAuthProvider; message: string } | null>(
    null
  );

  // One-time social-login hint (once per device, ever). Non-dismissible: we show it the
  // first time Login/Signup mounts and immediately persist the "seen" flag so it never
  // repeats. Mirrors the BulkIntroSheet once-per-device AsyncStorage pattern.
  const [showSocialHint, setShowSocialHint] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SOCIAL_HINT_SEEN_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value !== '1') {
          setShowSocialHint(true);
          AsyncStorage.setItem(SOCIAL_HINT_SEEN_KEY, '1').catch(() => {
            // non-fatal — if the write fails the hint may reappear next launch
          });
        }
      })
      .catch(() => {
        // Storage unavailable — show the hint anyway (harmless, transient).
        if (mounted) setShowSocialHint(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Persistent OAuth-callback deep-link capture. The callback can arrive via
  // Linking (system openURL) instead of / in addition to the openAuthSessionAsync
  // promise — e.g. if ASWebAuthenticationSession is torn down before it can
  // deliver the callback. A listener scoped to the pending promise is removed in
  // `finally` and can race the delivery, so we keep a persistent one for the
  // component's lifetime and read it as a fallback in runOAuthAttempt.
  const pendingCallbackUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return undefined;
    }
    const sub = Linking.addEventListener('url', ({ url: incomingUrl }) => {
      if (incomingUrl.includes('oauth-callback')) {
        console.log('📲 [persistent] OAuth callback deep link captured:', incomingUrl);
        pendingCallbackUrlRef.current = incomingUrl;
      }
    });
    return () => sub.remove();
  }, []);

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
    setErrorInfo(null);

    try {
      const { data: preAuthSessionData } = await supabase.auth.getSession();
      const preAuthUserId = preAuthSessionData?.session?.user?.id || null;

      const runOAuthAttempt = async (
        redirectUri: string
      ): Promise<{ callbackUrl: string | null; state: string; timedOut: boolean }> => {
        // Step 1: Initiate OAuth flow (get provider URL + CSRF state).
        // supabase-js >=2.x with skipBrowserRedirect:true returns the Supabase
        // /auth/v1/authorize endpoint URL, which does NOT carry a `state` param —
        // the state only lives in the server's 302 redirect to the provider. We must
        // NOT gate the browser-open on `state`; CSRF state is validated on the callback
        // instead (see handleOAuthCallback). P0 fix from Phase 18 (OAUTH_INIT_FAILED).
        const initResult = await initiateSocialLogin(provider, redirectUri);
        if (!initResult?.url) {
          throw new Error('OAUTH_INIT_FAILED');
        }
        const { state, url } = initResult;

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
        let timedOut = false;

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
            // Open OAuth session in browser.
            // NOTE: preferEphemeralSession is intentionally NOT set. On recent iOS it
            // can cause ASWebAuthenticationSession to be torn down
            // (`_UIViewServiceHostSessionErrorDomain Code=4 "Invalidation requested"`)
            // before the custom-scheme callback is delivered. Account selection is
            // still forced for Google via `prompt=select_account` in oauthService,
            // and Facebook presents its own account chooser.
            const authResult = await Promise.race([
              WebBrowser.openAuthSessionAsync(authSessionUrl, appReturnUrl),
              new Promise<{ type: 'timeout' }>((resolve) => {
                setTimeout(() => resolve({ type: 'timeout' }), 45000);
              }),
            ]);

            console.log('🔔 Auth session result:', authResult.type);

            if (authResult.type === 'success' && 'url' in authResult && authResult.url) {
              callbackUrl = authResult.url;
            } else {
              // Not a `success` result. Either:
              //  - `timeout` (45s): the browser is still open / user still
              //    authenticating — keep a recovery window, then surface a failure
              //    message if nothing comes back (never a silent dead-end).
              //  - `cancel`/`dismiss`: the user cancelled the consent browser OR the
              //    auth session was torn down before delivering the callback. Check
              //    the Linking captures + a SHORT session-recovery window so an
              //    explicit cancel returns the button to idle promptly (the old
              //    60×500ms poll made a cancel hang in "Signing you in…" ~30s).
              if (authResult.type === 'timeout') {
                timedOut = true;
                console.log(
                  '[SocialLoginButtons] OAuth session timed out - checking deep link/session recovery'
                );
              }

              const linkingFallback = linkingCallbackUrl || pendingCallbackUrlRef.current;
              if (linkingFallback) {
                callbackUrl = linkingFallback;
                console.log(
                  '[SocialLoginButtons] Using deep-link callback captured during dismiss'
                );
                return { callbackUrl, state, timedOut };
              }

              console.log(
                '[SocialLoginButtons] OAuth flow cancelled or dismissed - checking session...'
              );

              // Bounded recovery (6×500ms for a cancel/dismiss; the full 60× for a
              // timeout where the user may still be authenticating). Catches a
              // just-delivered deep link or a session that lands as the auth session
              // closes.
              const recoveryAttempts = timedOut ? 60 : 6;
              for (let attempt = 0; attempt < recoveryAttempts; attempt += 1) {
                const { data: recoveredSessionData } = await supabase.auth.getSession();
                const recoveredUserId = recoveredSessionData?.session?.user?.id || null;
                const hasRecoveredSession =
                  !!recoveredUserId && (!preAuthUserId || recoveredUserId !== preAuthUserId);

                if (hasRecoveredSession) {
                  callbackUrl = state
                    ? `${redirectUri}?state=${encodeURIComponent(state)}`
                    : redirectUri;
                  console.log('[SocialLoginButtons] Recovered OAuth session after dismiss');
                  break;
                }

                if (pendingCallbackUrlRef.current) {
                  callbackUrl = pendingCallbackUrlRef.current;
                  console.log('[SocialLoginButtons] Recovered via persistent deep-link capture');
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

        return { callbackUrl, state, timedOut };
      };

      // Single attempt with the redirect URI from config (now uses auth.expo.io for Expo Go)
      const { callbackUrl, state, timedOut } = await runOAuthAttempt(getRedirectUri());

      if (!callbackUrl) {
        // No callback and no recovered session. A 45s timeout with nothing to show is a
        // stuck/lost flow — surface it so a parent is never silently dumped back on
        // Login (UX-1 / Fix 2). A plain cancel (user tapped Cancel; no URL, no session)
        // stays silent (AUTH-TC-C06).
        if (timedOut) {
          setErrorInfo({
            provider,
            message: "We couldn't complete your sign-in. Please try again.",
          });
        }
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
        console.log(
          '[SocialLoginButtons] OAuth flow failed:',
          result.errorCode,
          result.errorMessage
        );
        // The consent completed but the session could not be established (e.g. a
        // dropped/failed callback exchange) — surface it so the return to Login is
        // never silent (UX-1 / Fix 2).
        setErrorInfo({
          provider,
          message: "We couldn't complete your sign-in. Please try again.",
        });
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
            onAccountExists(profile.email, provider, profile, !!accountCheck.hasPassword);
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

      const displayName = getProviderDisplayName(provider);

      if (error instanceof ProviderUnavailableError) {
        // Provider server-side outage or initiation timeout.
        setErrorInfo({
          provider,
          message: `${displayName} is temporarily unavailable. ${
            mode === 'signup' ? 'Sign up' : 'Sign in'
          } with email instead?`,
        });
      } else {
        // Initiation/other failures (incl. OAUTH_INIT_FAILED) — never a silent no-op.
        setErrorInfo({
          provider,
          message: `We couldn't connect to ${displayName} right now. Please try again or use your email instead.`,
        });
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
    setErrorInfo(null);
  };

  /**
   * Get capitalized provider name for display
   */
  const getProviderDisplayName = (provider: OAuthProvider): string => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  /**
   * Mode-aware accessibility label for the icon-only provider buttons
   * ("Sign in with Google" on login, "Continue with Google" on signup)
   */
  const getProviderLabel = (provider: OAuthProvider): string => {
    return `${mode === 'login' ? 'Sign in' : 'Continue'} with ${getProviderDisplayName(provider)}`;
  };

  return (
    <View style={styles.container} testID={testID || 'social-login-buttons'}>
      {/* Divider with text - Whisk style */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* OAuth failure banner — provider outage OR initiation failure; never a silent no-op */}
      {errorInfo && (
        <View style={styles.errorBanner} testID="provider-unavailable-banner">
          <Text style={styles.errorText}>{errorInfo.message}</Text>
          <Pressable
            onPress={handleFocusEmailInput}
            style={styles.errorCta}
            accessible={true}
            accessibilityLabel={
              mode === 'signup' ? 'Use email signup instead' : 'Use email login instead'
            }
            accessibilityRole="button"
            testID="provider-error-cta"
          >
            <Text style={styles.errorCtaText}>Use Email</Text>
          </Pressable>
        </View>
      )}

      {/* Circular icon buttons with labels - Whisk style (design-system §4.5) */}
      <View style={styles.buttonsContainer}>
        {/* Google */}
        <View style={styles.providerColumn}>
          <Pressable
            style={styles.iconButton}
            onPress={() => handleSocialLogin('google')}
            disabled={loadingProvider !== null}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              loadingProvider === 'google' ? 'Signing you in…' : getProviderLabel('google')
            }
            testID="google-login-button"
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator size="small" color="#5DBB8E" testID="google-loading-indicator" />
            ) : (
              <Text style={styles.iconText}>G</Text>
            )}
          </Pressable>
          <Text style={styles.providerLabel}>{getProviderDisplayName('google')}</Text>
        </View>

        {/* Apple */}
        <View style={styles.providerColumn}>
          <Pressable
            style={styles.iconButton}
            onPress={() => handleSocialLogin('apple')}
            disabled={loadingProvider !== null}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              loadingProvider === 'apple' ? 'Signing you in…' : getProviderLabel('apple')
            }
            testID="apple-login-button"
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator size="small" color="#5DBB8E" testID="apple-loading-indicator" />
            ) : (
              <AppleLogo size={20} weight="bold" color="#1A1A1A" />
            )}
          </Pressable>
          <Text style={styles.providerLabel}>{getProviderDisplayName('apple')}</Text>
        </View>

        {/* Facebook */}
        <View style={styles.providerColumn}>
          <Pressable
            style={styles.iconButton}
            onPress={() => handleSocialLogin('facebook')}
            disabled={loadingProvider !== null}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              loadingProvider === 'facebook' ? 'Signing you in…' : getProviderLabel('facebook')
            }
            testID="facebook-login-button"
          >
            {loadingProvider === 'facebook' ? (
              <ActivityIndicator size="small" color="#5DBB8E" testID="facebook-loading-indicator" />
            ) : (
              <Text style={styles.iconText}>f</Text>
            )}
          </Pressable>
          <Text style={styles.providerLabel}>{getProviderDisplayName('facebook')}</Text>
        </View>
      </View>

      {/* One-time inline hint under the social row (once per device, ever) */}
      {showSocialHint && (
        <Text style={styles.socialHint} testID="social-login-hint">
          {SOCIAL_HINT_COPY}
        </Text>
      )}
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
  providerColumn: {
    alignItems: 'center',
  },
  providerLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  socialHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 18,
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
