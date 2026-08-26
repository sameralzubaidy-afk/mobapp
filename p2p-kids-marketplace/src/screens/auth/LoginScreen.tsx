// File: p2p-kids-marketplace/src/screens/auth/LoginScreen.tsx
// FLOW-01: Auth Login Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { loginWithContext } from '@/services/auth';
import { captureException } from '@/services/errorReporter';
import { AuthError } from '@/types/user';
import { useAuth } from '@/hooks/useAuth';
import { Button, Modal, TextInput } from '@/components/ui';
import { theme } from '@/theme';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import AccountLinkingPrompt from '@/components/auth/AccountLinkingPrompt';
import { OAuthProvider, ProviderProfile } from '@/types/auth-v3';

type NavigationProp = NativeStackNavigationProp<any>;

// Default export for existing navigation
export default function LoginScreen() {
  const { setSession, refreshSession } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const emailInputRef = useRef<RNTextInput>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "Login Failed" dialog (branded modal so its OK button carries a stable accessibility identifier)
  const [loginFailedVisible, setLoginFailedVisible] = useState(false);
  const [loginFailedMessage, setLoginFailedMessage] = useState('');

  // Account-linking prompt state — shown when a social login email matches an existing account
  const [linkPrompt, setLinkPrompt] = useState<{
    visible: boolean;
    provider: OAuthProvider;
    profile: ProviderProfile;
    hasPassword: boolean;
  }>({
    visible: false,
    provider: 'google',
    profile: { name: '', email: '', provider: 'google', providerUserId: '' },
    hasPassword: false,
  });

  const handleSocialLoginSuccess = () => {
    // Root navigator transitions based on auth session + onboarding state.
  };

  const handleAccountExists = (
    _email: string,
    provider: OAuthProvider,
    profile: ProviderProfile,
    hasPassword: boolean
  ) => {
    // Show the branded AccountLinkingPrompt modal (password re-auth to link the provider).
    setLinkPrompt({ visible: true, provider, profile, hasPassword });
  };

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle login submission
   */
  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const session = await loginWithContext({
        email: email.trim(),
        password,
      });

      // Success - update auth context which triggers automatic navigation
      // Session context includes subscription status and SP balance
      console.log('Login successful:', {
        user: session.user.name,
        subscription: session.subscription_status,
        availablePoints: session.available_points,
      });

      // Update auth context - this triggers automatic navigation to Home via RootNavigator
      setSession(session);
    } catch (error: any) {
      // Report to Sentry instead of console.error — a raw console.error on a
      // dev/staging build makes RN LogBox render a duplicate, internals-leaking
      // red banner (AuthError) stacked under the branded "Login Failed" modal
      // (QA: Group A+B+D 2026-08-23, finding #4 — incl. the PROFILE_NOT_FOUND
      // 'User profile not found' branch reconfirmed live).
      captureException(error, {
        tags: { screen: 'LoginScreen', action: 'login' },
        extra: {
          hasEmail: !!email,
          authCode: (error as any)?.code,
          authStatus: (error as any)?.status,
        },
      });

      let errorMessage = 'Login failed. Please check your credentials.';

      if (error instanceof AuthError) {
        switch (error.code) {
          case 'INVALID_CREDENTIALS':
          case 'LOGIN_FAILED':
            errorMessage = 'Invalid email or password.';
            break;
          case 'PROFILE_NOT_FOUND':
            errorMessage = 'Profile not found. Please contact support.';
            break;
          case 'ACCOUNT_DELETED':
            errorMessage = 'Your account has been deleted. Please contact support.';
            break;
          default:
            errorMessage = error.message;
        }
      }

      // Show a branded modal (native Alert buttons can't carry a testID/accessibility identifier)
      setLoginFailedMessage(errorMessage);
      setLoginFailedVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              testID="login-back-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>
                Log in to continue trading and earning Swap Points
              </Text>
            </View>

            {/* Social Login Buttons */}
            <SocialLoginButtons
              mode="login"
              onLoginSuccess={handleSocialLoginSuccess}
              onAccountExists={handleAccountExists}
              emailInputRef={emailInputRef}
              testID="login-social-buttons"
            />

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <TextInput
                label="Email"
                placeholder="your.email@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
                testID="login-email-input"
              />

              {/* Password */}
              <TextInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
                testID="login-password-input"
              />

              {/* Login Button */}
              <Button
                variant="primary"
                size="large"
                onPress={handleLogin}
                disabled={loading}
                loading={loading}
                testID="login-submit-button"
                style={styles.loginButton}
              >
                Log In
              </Button>

              {/* Signup Link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Signup')}
                  testID="login-signup-link"
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Sign Up"
                  disabled={loading}
                >
                  <Text style={styles.linkText}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword' as any)}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
                testID="login-forgot-password-link"
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Contact Support Link (logged-out users can submit a ticket) */}
              <TouchableOpacity
                style={styles.contactSupportLink}
                onPress={() => navigation.navigate('ContactSupport' as any)}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Contact Support"
                testID="login-contact-support-link"
                disabled={loading}
              >
                <Text style={styles.contactSupportLinkText}>Need help? Contact Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* "Login Failed" dialog — branded modal; OK carries a stable accessibility identifier */}
      <Modal
        type="alert"
        visible={loginFailedVisible}
        title="Login Failed"
        message={loginFailedMessage}
        primaryButtonText="OK"
        primaryButtonTestID="login-failed-dialog-ok-button"
        onPrimaryPress={() => setLoginFailedVisible(false)}
        onClose={() => setLoginFailedVisible(false)}
        showCloseButton={false}
      />

      {/* Account-linking prompt — shown when a social login matches an existing email account */}
      <AccountLinkingPrompt
        visible={linkPrompt.visible}
        provider={linkPrompt.provider}
        providerProfile={linkPrompt.profile}
        hasPassword={linkPrompt.hasPassword}
        onLink={() => {
          setLinkPrompt((prev) => ({ ...prev, visible: false }));
          // Refresh auth context so the newly-linked session routes to Home.
          refreshSession(true);
        }}
        onDismiss={() => setLinkPrompt((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColors.page,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },

  content: {
    flex: 1,
    padding: theme.componentSpacing.pageMargin,
    justifyContent: 'center',
  },

  backButton: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    padding: theme.spacing.sm,
    zIndex: 10,
  },

  backButtonText: {
    ...theme.typography.h1,
    color: theme.colors.primary[500],
  },

  header: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },

  title: {
    ...theme.typography.h1,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },

  subtitle: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
  },

  form: {
    gap: theme.spacing.md,
  },

  loginButton: {
    marginTop: theme.spacing.sm,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },

  footerText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  linkText: {
    ...theme.typography.body,
    color: theme.textColors.link,
    fontFamily: theme.fontFamily.semiBold,
  },

  forgotPassword: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },

  forgotPasswordText: {
    ...theme.typography.body,
    color: theme.textColors.link,
  },

  contactSupportLink: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },

  contactSupportLinkText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.secondary,
    textDecorationLine: 'underline',
  },
});

// Named export for convenience
export { LoginScreen };
