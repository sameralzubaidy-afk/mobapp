// File: p2p-kids-marketplace/src/components/auth/__tests__/SocialLoginButtons.test.tsx
// Unit tests for SocialLoginButtons component
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React, { createRef } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextInput, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SocialLoginButtons } from '../SocialLoginButtons';
import * as oauthService from '@/services/oauthService';
import * as accountService from '@/services/accountService';
import * as profileService from '@/services/profileService';
import { supabase } from '@/services/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProviderUnavailableError } from '@/types/auth-v3-errors';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('@/services/oauthService');
jest.mock('@/services/accountService');
jest.mock('@/services/profileService');
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('@/services/oauthProviderConfig', () => ({
  getRedirectUri: jest.fn(() => 'p2pkidsmarketplace://oauth-callback'),
}));
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));
jest.mock('../ProviderButton', () => {
  const React = require('react');
  const { Pressable, Text, ActivityIndicator } = require('react-native');

  return {
    ProviderButton: ({ provider, mode, isLoading, onPress, testID }: any) => {
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      const label =
        mode === 'login' ? `Sign in with ${providerName}` : `Continue with ${providerName}`;

      return (
        <Pressable
          onPress={onPress}
          disabled={Boolean(isLoading)}
          testID={testID || `${provider}-login-button`}
        >
          <Text>{label}</Text>
          {isLoading ? <ActivityIndicator testID={`${provider}-loading-indicator`} /> : null}
        </Pressable>
      );
    },
  };
});
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    refreshSession: jest.fn(),
  }),
}));

const mockSupabase = supabase as any;
const originalNodeEnv = process.env.NODE_ENV;
let addEventListenerSpy: jest.SpyInstance;

describe('SocialLoginButtons', () => {
  const mockOnLoginSuccess = jest.fn();
  const mockOnSignupSuccess = jest.fn();
  const mockOnAccountExists = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    process.env.NODE_ENV = 'development';

    addEventListenerSpy = jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation(() => ({ remove: jest.fn() }) as any);

    (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
      url: 'https://example.com/oauth',
      state: 'state-token',
    });
    (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
      success: false,
      errorCode: 'USER_CANCELLED',
    });
    (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
      exists: false,
    });
    (profileService.autoFillProfile as jest.Mock).mockResolvedValue({
      success: true,
    });

    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'p2pkidsmarketplace://oauth-callback?code=test-code&state=state-token',
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Rendering', () => {
    it('should render all 3 provider buttons', () => {
      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      expect(getByTestId('google-login-button')).toBeTruthy();
      expect(getByTestId('facebook-login-button')).toBeTruthy();
      expect(getByTestId('apple-login-button')).toBeTruthy();
    });

    it('should render divider with login mode text', () => {
      const { getByText } = render(<SocialLoginButtons mode="login" />);

      expect(getByText('or')).toBeTruthy();
    });

    it('should render divider with signup mode text', () => {
      const { getByText } = render(<SocialLoginButtons mode="signup" />);

      expect(getByText('or')).toBeTruthy();
    });

    it('should not show error banner initially', () => {
      const { queryByTestId } = render(<SocialLoginButtons mode="login" />);

      expect(queryByTestId('provider-unavailable-banner')).toBeNull();
    });
  });

  describe('OAuth Flow - Success Cases', () => {
    it('should handle successful Google login', async () => {
      const mockSession = { user: { id: 'user-123', name: 'John Doe' } };

      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: 'user-123',
        session: mockSession,
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const { getByTestId } = render(
        <SocialLoginButtons mode="login" onLoginSuccess={mockOnLoginSuccess} />
      );

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(oauthService.initiateSocialLogin).toHaveBeenCalledWith('google', expect.any(String));
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });

    it('should auto-fill profile on signup', async () => {
      const mockProfile = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        avatar: 'https://example.com/avatar.jpg',
        provider: 'facebook' as const,
        providerUserId: 'fb-456',
      };

      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://facebook.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: 'user-456',
        session: { user: { id: 'user-456' } },
        profile: mockProfile,
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
        exists: false,
      });

      (profileService.autoFillProfile as jest.Mock).mockResolvedValue({
        success: true,
      });

      const { getByTestId } = render(
        <SocialLoginButtons mode="signup" onSignupSuccess={mockOnSignupSuccess} />
      );

      const facebookButton = getByTestId('facebook-login-button');
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(profileService.autoFillProfile).toHaveBeenCalledWith(mockProfile);
        expect(mockOnSignupSuccess).toHaveBeenCalled();
      });
    });

    it('should NOT auto-fill profile on login', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: 'user-123',
        session: { user: { id: 'user-123' } },
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const { getByTestId } = render(
        <SocialLoginButtons mode="login" onLoginSuccess={mockOnLoginSuccess} />
      );

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(profileService.autoFillProfile).not.toHaveBeenCalled();
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Account Exists Handling', () => {
    it('should trigger onAccountExists when email collision detected', async () => {
      const mockEmail = 'existing@example.com';

      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: 'new-user-id',
        session: { user: { id: 'new-user-id' } },
        profile: {
          name: 'John Doe',
          email: mockEmail,
          provider: 'google',
          providerUserId: 'google-123',
        },
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
        exists: true,
        userId: 'existing-user-id',
        hasPassword: true,
      });

      const { getByTestId } = render(
        <SocialLoginButtons mode="signup" onAccountExists={mockOnAccountExists} />
      );

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(mockOnAccountExists).toHaveBeenCalledWith(
          mockEmail,
          'google',
          expect.objectContaining({ email: mockEmail, provider: 'google' }),
          true // hasPassword from checkAccountExists mock
        );
      });
    });

    it('should NOT trigger onAccountExists when same user logs in again', async () => {
      const userId = 'user-123';

      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: userId,
        session: { user: { id: userId } },
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({
        exists: true,
        userId: userId, // Same user ID
      });

      const { getByTestId } = render(
        <SocialLoginButtons
          mode="login"
          onLoginSuccess={mockOnLoginSuccess}
          onAccountExists={mockOnAccountExists}
        />
      );

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(mockOnAccountExists).not.toHaveBeenCalled();
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling - Provider Unavailable', () => {
    it('should show error banner when provider is unavailable', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockRejectedValue(
        new ProviderUnavailableError('google', '503')
      );

      const { getByTestId, getByText } = render(<SocialLoginButtons mode="signup" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(getByTestId('provider-unavailable-banner')).toBeTruthy();
        expect(getByText(/Google is temporarily unavailable/i)).toBeTruthy();
        expect(getByText(/Sign up with email instead/i)).toBeTruthy();
      });
    });

    it('should focus email input when error CTA is tapped', async () => {
      const emailInputRef = createRef<TextInput>();
      const mockFocus = jest.fn();

      (emailInputRef as any).current = { focus: mockFocus };

      (oauthService.initiateSocialLogin as jest.Mock).mockRejectedValue(
        new ProviderUnavailableError('facebook', '503')
      );

      const { getByTestId } = render(
        <SocialLoginButtons mode="login" emailInputRef={emailInputRef} />
      );

      // Trigger error
      const facebookButton = getByTestId('facebook-login-button');
      fireEvent.press(facebookButton);

      await waitFor(() => {
        expect(getByTestId('provider-unavailable-banner')).toBeTruthy();
      });

      // Tap CTA
      const errorCta = getByTestId('provider-error-cta');
      fireEvent.press(errorCta);

      expect(mockFocus).toHaveBeenCalled();
    });

    it('should hide error banner when CTA is tapped', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockRejectedValue(
        new ProviderUnavailableError('apple', '503')
      );

      const { getByTestId, queryByTestId } = render(<SocialLoginButtons mode="signup" />);

      // Trigger error
      const appleButton = getByTestId('apple-login-button');
      fireEvent.press(appleButton);

      await waitFor(() => {
        expect(getByTestId('provider-unavailable-banner')).toBeTruthy();
      });

      // Tap CTA
      const errorCta = getByTestId('provider-error-cta');
      fireEvent.press(errorCta);

      // Banner should disappear
      expect(queryByTestId('provider-unavailable-banner')).toBeNull();
    });
  });

  describe('User Cancel Handling', () => {
    it('should handle user cancel gracefully (no error UI)', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      // The real handleOAuthCallback returns `null` for a user cancel (access_denied)
      // — a `{success:false}` result is a genuine callback failure and DOES surface
      // the failure banner (see "OAuth Callback Failure Banner" below).
      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue(null);

      const { getByTestId, queryByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        // No error banner should appear
        expect(queryByTestId('provider-unavailable-banner')).toBeNull();
      });
    });
  });

  describe('OAuth Callback Failure Banner (Fix 2 — no silent no-session return)', () => {
    it('should show a failure banner when the OAuth callback cannot establish a session', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://google.com/oauth',
        state: 'state-token',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: false,
        errorCode: 'OAUTH_CALLBACK_FAILED',
        errorMessage: 'Failed to exchange code',
      });

      const { getByTestId, getByText } = render(<SocialLoginButtons mode="login" />);

      fireEvent.press(getByTestId('google-login-button'));

      await waitFor(() => {
        expect(getByTestId('provider-unavailable-banner')).toBeTruthy();
        expect(getByText(/We couldn't complete your sign-in/i)).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should disable providers while a login attempt is in progress', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(getByTestId('google-login-button').props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('should disable all providers while one provider is running', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(getByTestId('google-login-button').props.accessibilityState?.disabled).toBe(true);
        expect(getByTestId('facebook-login-button').props.accessibilityState?.disabled).toBe(true);
        expect(getByTestId('apple-login-button').props.accessibilityState?.disabled).toBe(true);
      });
    });
  });

  describe('Cross-Platform Rendering', () => {
    it('should render Apple button on both iOS and Android', () => {
      // iOS
      const { getByTestId: getByTestIdIOS, unmount } = render(<SocialLoginButtons mode="login" />);
      expect(getByTestIdIOS('apple-login-button')).toBeTruthy();
      unmount();

      // Android (Apple button should still render for App Store compliance)
      const { getByTestId: getByTestIdAndroid } = render(<SocialLoginButtons mode="login" />);
      expect(getByTestIdAndroid('apple-login-button')).toBeTruthy();
    });
  });

  describe('P0 Regression - state-less authorize URL (supabase-js 2.x)', () => {
    it('should open the browser even when signInWithOAuth returns no state param', async () => {
      // supabase-js 2.89.0 + skipBrowserRedirect:true returns the Supabase
      // /auth/v1/authorize endpoint URL with NO state param (the state lives in the
      // server's 302 redirect). The old guard `!initResult?.state` threw
      // OAUTH_INIT_FAILED here, blocking the browser. See Phase 18 P0 fix.
      (oauthService.initiateSocialLogin as jest.Mock).mockResolvedValue({
        url: 'https://drntwgporzabmxdqykrp.supabase.co/auth/v1/authorize?provider=google',
        state: '',
      });

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: true,
        userId: 'user-123',
        session: { user: { id: 'user-123' } },
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          provider: 'google',
          providerUserId: 'google-123',
        },
      });

      (accountService.checkAccountExists as jest.Mock).mockResolvedValue({ exists: false });

      const { getByTestId } = render(
        <SocialLoginButtons mode="login" onLoginSuccess={mockOnLoginSuccess} />
      );

      fireEvent.press(getByTestId('google-login-button'));

      await waitFor(() => {
        expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Init Failure Banner (no silent no-op)', () => {
    it('should show a failure banner when OAuth initiation fails', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockRejectedValue(
        new Error('OAUTH_INIT_FAILED')
      );

      const { getByTestId, getByText } = render(<SocialLoginButtons mode="login" />);

      fireEvent.press(getByTestId('google-login-button'));

      await waitFor(() => {
        expect(getByTestId('provider-unavailable-banner')).toBeTruthy();
        expect(getByText(/We couldn't connect to Google right now/i)).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should expose accessible button roles and labels on all provider buttons', () => {
      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      const google = getByTestId('google-login-button');
      const apple = getByTestId('apple-login-button');
      const facebook = getByTestId('facebook-login-button');

      expect(google.props.accessibilityRole).toBe('button');
      expect(google.props.accessibilityLabel).toBe('Sign in with Google');
      expect(apple.props.accessibilityLabel).toBe('Sign in with Apple');
      expect(facebook.props.accessibilityLabel).toBe('Sign in with Facebook');
    });

    it('should use "Continue with" labels in signup mode', () => {
      const { getByTestId } = render(<SocialLoginButtons mode="signup" />);

      expect(getByTestId('google-login-button').props.accessibilityLabel).toBe(
        'Continue with Google'
      );
    });
  });

  describe('Provider Labels', () => {
    it('should render a text label under each provider icon', () => {
      const { getByText } = render(<SocialLoginButtons mode="login" />);

      expect(getByText('Google')).toBeTruthy();
      expect(getByText('Apple')).toBeTruthy();
      expect(getByText('Facebook')).toBeTruthy();
    });
  });

  describe('Per-Provider Loading Indicator', () => {
    it('should show a loading indicator on the tapped provider and hide its icon', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { getByTestId, queryByText } = render(<SocialLoginButtons mode="login" />);

      fireEvent.press(getByTestId('google-login-button'));

      await waitFor(() => {
        expect(getByTestId('google-loading-indicator')).toBeTruthy();
      });
      // The icon is replaced by the spinner while that provider loads.
      expect(queryByText('G')).toBeNull();
    });

    it('should announce "Signing you in…" while the provider is loading', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      fireEvent.press(getByTestId('google-login-button'));

      await waitFor(() => {
        expect(getByTestId('google-login-button').props.accessibilityLabel).toBe('Signing you in…');
      });
    });
  });

  describe('Social Login Hint (once per device)', () => {
    it('should show the inline hint on first visit and persist the seen flag', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { findByText } = render(<SocialLoginButtons mode="login" />);

      expect(await findByText('Prefer to sign in with Google, Apple, or Facebook?')).toBeTruthy();
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@kids_marketplace:social_login_hint_seen_v1',
          '1'
        );
      });
    });

    it('should not show the hint once it has been seen', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');

      const { queryByText } = render(<SocialLoginButtons mode="login" />);

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith(
          '@kids_marketplace:social_login_hint_seen_v1'
        );
      });
      expect(queryByText('Prefer to sign in with Google, Apple, or Facebook?')).toBeNull();
    });
  });
});
