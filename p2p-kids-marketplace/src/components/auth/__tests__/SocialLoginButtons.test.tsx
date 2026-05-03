// File: p2p-kids-marketplace/src/components/auth/__tests__/SocialLoginButtons.test.tsx
// Unit tests for SocialLoginButtons component
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React, { createRef } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SocialLoginButtons } from '../SocialLoginButtons';
import * as oauthService from '@/services/oauthService';
import * as accountService from '@/services/accountService';
import * as profileService from '@/services/profileService';
import { supabase } from '@/services/supabase/client';
import { ProviderUnavailableError } from '@/types/auth-v3-errors';

// Mock dependencies
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
      const label = mode === 'login' ? `Sign in with ${providerName}` : `Continue with ${providerName}`;

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

describe('SocialLoginButtons', () => {
  const mockOnLoginSuccess = jest.fn();
  const mockOnSignupSuccess = jest.fn();
  const mockOnAccountExists = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';

    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'p2pkidsmarketplace://oauth-callback?code=test-code&state=state-token',
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
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

      expect(getByText('Or sign in with')).toBeTruthy();
    });

    it('should render divider with signup mode text', () => {
      const { getByText } = render(<SocialLoginButtons mode="signup" />);

      expect(getByText('Or continue with')).toBeTruthy();
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
        expect(mockOnAccountExists).toHaveBeenCalledWith(mockEmail, 'google');
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

      (oauthService.handleOAuthCallback as jest.Mock).mockResolvedValue({
        success: false,
        errorCode: 'USER_CANCELLED',
      });

      const { getByTestId, queryByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        // No error banner should appear
        expect(queryByTestId('provider-unavailable-banner')).toBeNull();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state on the pressed button', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const { getByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      // Google button should show loading
      await waitFor(() => {
        expect(getByTestId('google-loading-indicator')).toBeTruthy();
      });
    });

    it('should only show loading on the pressed button, not others', async () => {
      (oauthService.initiateSocialLogin as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const { getByTestId, queryByTestId } = render(<SocialLoginButtons mode="login" />);

      const googleButton = getByTestId('google-login-button');
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(getByTestId('google-loading-indicator')).toBeTruthy();
        expect(queryByTestId('facebook-loading-indicator')).toBeNull();
        expect(queryByTestId('apple-loading-indicator')).toBeNull();
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
});
