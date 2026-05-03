// File: p2p-kids-marketplace/src/components/auth/__tests__/ProviderButton.test.tsx
// Unit tests for ProviderButton component
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProviderButton } from '../ProviderButton';
import type { OAuthProvider } from '@/types/auth-v3';

describe('ProviderButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Google button with correct label in login mode', () => {
      const { getByText } = render(
        <ProviderButton provider="google" mode="login" onPress={mockOnPress} />
      );

      expect(getByText('Sign in with Google')).toBeTruthy();
    });

    it('should render Google button with correct label in signup mode', () => {
      const { getByText } = render(
        <ProviderButton provider="google" mode="signup" onPress={mockOnPress} />
      );

      expect(getByText('Continue with Google')).toBeTruthy();
    });

    it('should render Facebook button with correct label', () => {
      const { getByText } = render(
        <ProviderButton provider="facebook" mode="login" onPress={mockOnPress} />
      );

      expect(getByText('Sign in with Facebook')).toBeTruthy();
    });

    it('should render Apple button with correct label', () => {
      const { getByText } = render(
        <ProviderButton provider="apple" mode="signup" onPress={mockOnPress} />
      );

      expect(getByText('Continue with Apple')).toBeTruthy();
    });

    it('should render all 3 providers with different labels', () => {
      const providers: OAuthProvider[] = ['google', 'facebook', 'apple'];

      providers.forEach((provider) => {
        const { getByText, unmount } = render(
          <ProviderButton provider={provider} mode="login" onPress={mockOnPress} />
        );

        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        expect(getByText(`Sign in with ${providerName}`)).toBeTruthy();

        unmount();
      });
    });
  });

  describe('Loading State', () => {
    it('should show ActivityIndicator when loading', () => {
      const { getByTestId, queryByText } = render(
        <ProviderButton provider="google" mode="login" isLoading={true} onPress={mockOnPress} />
      );

      // Loading indicator should be visible
      expect(getByTestId('google-loading-indicator')).toBeTruthy();

      // Button text should not be visible
      expect(queryByText('Sign in with Google')).toBeNull();
    });

    it('should disable button when loading', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          isLoading={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      fireEvent.press(button);

      // onPress should not be called when loading
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable button when disabled prop is true', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          disabled={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      fireEvent.press(button);

      // onPress should not be called when disabled
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should apply disabled opacity style', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          disabled={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      expect(button.props.style).toMatchObject(expect.objectContaining({ opacity: 0.6 }));
    });
  });

  describe('Interaction', () => {
    it('should call onPress when button is tapped', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          disabled={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      fireEvent.press(button);

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          isLoading={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      fireEvent.press(button);

      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have correct accessibility label for idle state', () => {
      const { getByLabelText } = render(
        <ProviderButton provider="google" mode="login" onPress={mockOnPress} />
      );

      expect(getByLabelText('Sign in with Google, button')).toBeTruthy();
    });

    it('should have correct accessibility label for loading state', () => {
      const { getByLabelText } = render(
        <ProviderButton provider="google" mode="login" isLoading={true} onPress={mockOnPress} />
      );

      expect(getByLabelText('Signing you in…')).toBeTruthy();
    });

    it('should have correct accessibility role', () => {
      const { getByRole } = render(
        <ProviderButton provider="google" mode="login" onPress={mockOnPress} />
      );

      expect(getByRole('button')).toBeTruthy();
    });

    it('should have correct accessibility state when disabled', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          disabled={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      expect(button.props.accessibilityState).toMatchObject({
        disabled: true,
        busy: false,
      });
    });

    it('should have correct accessibility state when loading', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          isLoading={true}
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      expect(button.props.accessibilityState).toMatchObject({
        disabled: true,
        busy: true,
      });
    });
  });

  describe('Branding', () => {
    it('should use Google standard button style (white with border)', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          onPress={mockOnPress}
          testID="google-button"
        />
      );

      const button = getByTestId('google-button');
      expect(button.props.style).toMatchObject(
        expect.objectContaining({
          backgroundColor: '#FFFFFF',
          borderColor: '#DADCE0',
        })
      );
    });

    it('should use Facebook brand color (#1877F2)', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="facebook"
          mode="login"
          onPress={mockOnPress}
          testID="facebook-button"
        />
      );

      const button = getByTestId('facebook-button');
      expect(button.props.style).toMatchObject(
        expect.objectContaining({ backgroundColor: '#1877F2' })
      );
    });

    it('should use Apple brand color (#000000)', () => {
      const { getByTestId } = render(
        <ProviderButton provider="apple" mode="login" onPress={mockOnPress} testID="apple-button" />
      );

      const button = getByTestId('apple-button');
      expect(button.props.style).toMatchObject(
        expect.objectContaining({ backgroundColor: '#000000' })
      );
    });
  });

  describe('Test IDs', () => {
    it('should use default testID when not provided', () => {
      const { getByTestId } = render(
        <ProviderButton provider="google" mode="login" onPress={mockOnPress} />
      );

      expect(getByTestId('provider-button-google')).toBeTruthy();
    });

    it('should use custom testID when provided', () => {
      const { getByTestId } = render(
        <ProviderButton
          provider="google"
          mode="login"
          onPress={mockOnPress}
          testID="custom-google-btn"
        />
      );

      expect(getByTestId('custom-google-btn')).toBeTruthy();
    });
  });
});
