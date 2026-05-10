// File: p2p-kids-marketplace/src/components/auth/AccountLinkingPrompt.tsx
// MODULE-03 AUTH-V3-008: Modal triggered when social login email matches existing account

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { linkSocialAccount } from '@/services/accountService';
import type { OAuthProvider, ProviderProfile } from '@/types/auth-v3';
import { EmailMismatchError } from '@/types/auth-v3-errors';

interface AccountLinkingPromptProps {
  visible: boolean;
  provider: OAuthProvider;
  providerProfile: ProviderProfile;
  hasPassword: boolean;
  onLink: () => void;
  onDismiss: () => void;
  testID?: string;
}

const PROVIDER_NAMES = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
};

/**
 * Account linking prompt modal
 * Shown when user attempts social login with email that matches existing account
 *
 * Flow:
 * - If account has password: prompt for password re-auth → link
 * - If social-only account: require sign-in via already-linked provider → link
 * - "Maybe Later" dismisses and returns to login screen
 */
export default function AccountLinkingPrompt({
  visible,
  provider,
  providerProfile,
  hasPassword,
  onLink,
  onDismiss,
  testID = 'account-linking-prompt',
}: AccountLinkingPromptProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerName = PROVIDER_NAMES[provider];

  const handleLink = async () => {
    if (hasPassword && !password) {
      setError('Password is required');
      return;
    }

    setIsLinking(true);
    setError(null);

    try {
      await linkSocialAccount(provider, providerProfile, hasPassword ? password : undefined);

      setIsLinking(false);
      setPassword('');
      onLink();
    } catch (err) {
      console.error('[AccountLinkingPrompt] Link error:', err);
      setIsLinking(false);

      if (err instanceof EmailMismatchError) {
        setError(`The email on your ${providerName} account doesn't match your account email.`);
      } else if ((err as any).message?.includes('Invalid login credentials')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(`Failed to link ${providerName} account. Please try again.`);
      }
    }
  };

  const handleDismiss = () => {
    setPassword('');
    setError(null);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="link" size={32} color="#5DBB8E" />
            </View>
            <Text style={styles.title}>Link {providerName} Account</Text>
            <Text style={styles.subtitle}>
              An account with email {providerProfile.email} already exists.
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {hasPassword ? (
              // Password re-auth flow
              <>
                <Text style={styles.description}>
                  To link your {providerName} account, please enter your password for security.
                </Text>

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
                    editable={!isLinking}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Password"
                    testID={`${testID}-password-input`}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B6B6B"
                    />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // Social-only account flow
              <View style={styles.socialInfo}>
                <Ionicons name="information-circle-outline" size={24} color="#5DBB8E" />
                <Text style={styles.socialDescription}>
                  You're signing in with {providerName}, and you already have an account with this
                  email using another login method.{'\n\n'}
                  To link your {providerName} account, first sign in using your existing method.
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, isLinking && styles.disabledButton]}
              onPress={handleLink}
              disabled={isLinking || (hasPassword && !password)}
              accessibilityRole="button"
              accessibilityLabel={`Link ${providerName} account`}
              testID={`${testID}-link`}
            >
              {isLinking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Link Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDismiss}
              disabled={isLinking}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
              testID={`${testID}-dismiss`}
            >
              <Text style={styles.secondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#6B6B6B',
    marginBottom: 24,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  passwordContainer: {
    position: 'relative',
  },
  input: {
    height: 56,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F0F0F0',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 18,
    padding: 4,
  },
  socialInfo: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    gap: 12,
  },
  socialDescription: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  actions: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  primaryButton: {
    height: 56,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B6B6B',
  },
});
