// File: p2p-kids-marketplace/src/components/auth/ProviderButton.tsx
// Single branded OAuth provider button with icon + label
// TASK: AUTH-V3-007 — Mobile UI SocialLoginButtons
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { OAuthProvider } from '@/types/auth-v3';

/**
 * Provider-specific branding configuration
 * Colors per official brand guidelines:
 * - Google: #4285F4 (official Google Blue)
 * - Facebook: #1877F2 (official Facebook Blue)
 * - Apple: #000000 (official Apple Black)
 */
const PROVIDER_CONFIG: Record<
  OAuthProvider,
  { backgroundColor: string; textColor: string; icon: string }
> = {
  google: {
    backgroundColor: '#FFFFFF',
    textColor: '#1F1F1F',
    icon: 'google',
  },
  facebook: {
    backgroundColor: '#1877F2',
    textColor: '#FFFFFF',
    icon: 'f', // TODO: Replace with actual Facebook icon/logo
  },
  apple: {
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    icon: '', // TODO: Replace with actual Apple icon/logo
  },
};

/**
 * Capitalize first letter for display
 */
function capitalizeProvider(provider: OAuthProvider): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export interface ProviderButtonProps {
  /** OAuth provider (google, facebook, apple) */
  provider: OAuthProvider;

  /** Display mode: 'login' shows "Sign in with", 'signup' shows "Continue with" */
  mode: 'login' | 'signup';

  /** Loading state during OAuth flow */
  isLoading?: boolean;

  /** Disabled state (e.g., provider unavailable) */
  disabled?: boolean;

  /** Callback when button is pressed */
  onPress: () => void;

  /** Test ID for automation */
  testID?: string;
}

/**
 * PROVIDER BUTTON COMPONENT
 *
 * Single branded button for one OAuth provider.
 * Uses official brand colors and icons per provider guidelines.
 *
 * Accessibility:
 * - accessibilityLabel: "Sign in with <Provider>, button"
 * - Loading state announces: "Signing you in…"
 *
 * @example
 * ```tsx
 * <ProviderButton
 *   provider="google"
 *   mode="signup"
 *   onPress={() => handleSocialLogin('google')}
 *   testID="google-signup-button"
 * />
 * ```
 */
export const ProviderButton: React.FC<ProviderButtonProps> = ({
  provider,
  mode,
  isLoading = false,
  disabled = false,
  onPress,
  testID,
}) => {
  const config = PROVIDER_CONFIG[provider];
  const providerName = capitalizeProvider(provider);
  const labelPrefix = mode === 'login' ? 'Sign in with' : 'Continue with';
  const label = `${labelPrefix} ${providerName}`;

  // Accessibility label
  const accessibilityLabel = isLoading ? 'Signing you in…' : `${label}, button`;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: config.backgroundColor },
        provider === 'google' && styles.googleButton,
        (disabled || isLoading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || isLoading,
        busy: isLoading,
      }}
      testID={testID || `provider-button-${provider}`}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={config.textColor}
          testID={`${provider}-loading-indicator`}
        />
      ) : (
        <View style={styles.content}>
          <View style={[styles.iconContainer, provider === 'google' && styles.googleIconContainer]}>
            {provider === 'google' ? (
              <FontAwesome name="google" size={18} color="#4285F4" />
            ) : (
              <Text style={[styles.iconPlaceholder, { color: config.textColor }]}>
                {config.icon}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.label,
              { color: config.textColor },
              provider === 'google' && styles.googleLabel,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  googleButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DADCE0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconContainer: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  iconPlaceholder: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  googleLabel: {
    letterSpacing: 0,
    fontWeight: '600',
  },
});
