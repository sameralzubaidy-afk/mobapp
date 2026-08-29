// File: p2p-kids-marketplace/src/screens/auth/ResetPasswordScreen.tsx
// FLOW-01: Auth Reset Password Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';
import { captureException } from '@/services/errorReporter';
import { Button, TextInput } from '@/components/ui';
import { theme } from '@/theme';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hasResetSession, setHasResetSession] = useState(false);

  // When app opened via deep link from the email, Supabase may include tokens
  // in the fragment (hash). Parse the URL to derive access_token/refresh_token
  // or show an error if link contains error params (e.g., otp_expired).
  //
  // NOTE: must use a STATIC import of Linking. A dynamic `import('react-native')`
  // makes Metro enumerate RN's lazy getters (e.g. PushNotificationIOS) to build the
  // namespace, and those getters force-load native modules that are not linked in
  // this build (React-RCTPushNotification is not installed) -> `new NativeEventEmitter()`
  // crash on the reset-password deep link. Static imports are resolved at bundle time
  // and never trigger that enumeration.
  useEffect(() => {
    let isMounted = true;

    const handleResetUrl = async (url: string | null) => {
      try {
        if (!url) return;

        // Split hash (fragment) portion after '#'
        const hash = url.split('#')[1] ?? '';

        if (!hash) return;

        const params = new URLSearchParams(hash);
        const error = params.get('error');
        const error_description = params.get('error_description');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (error) {
          // Friendly message for common codes like otp_expired
          if ((error_description || '').toLowerCase().includes('expired')) {
            setLinkError('This reset link has expired. Please request a new password reset email.');
          } else {
            setLinkError(decodeURIComponent(error_description || error));
          }
          return;
        }

        if (access_token) {
          // A valid reset token supersedes any prior Link Error state. Without
          // this, a stale expired-link fragment keeps linkError set and hides
          // the submit button, so a genuinely valid reset link delivered
          // afterwards becomes unusable without an app relaunch (QA: Group Q+S
          // 2026-08-23, Phase 16 finding #1 — reconfirmed live). Clear it BEFORE
          // establishing the session so the form recovers immediately.
          if (isMounted) setLinkError(null);

          // Set session so supabase.auth.updateUser works
          // supabase.auth.setSession exists in Supabase JS client
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({
            access_token,
            refresh_token,
          });
          if (setErr) {
            captureException(setErr, {
              tags: { screen: 'ResetPasswordScreen', action: 'set_session_deep_link' },
            });
            setLinkError(
              'Failed to set auth session from reset link. Please request a new reset email.'
            );
            return;
          }
          if (isMounted) setHasResetSession(true);
        }
      } catch (e: any) {
        // A malformed/unsupported URL must never leave the parent stuck on a
        // blank form — surface a friendly state instead of failing silently.
        captureException(e, {
          tags: { screen: 'ResetPasswordScreen', action: 'parse_initial_url' },
        });
        if (isMounted) {
          setLinkError(
            'This reset link could not be opened. Please request a new password reset email.'
          );
        }
      }
    };

    // Cold start: app launched via the deep link.
    Linking.getInitialURL().then(handleResetUrl);

    // Warm: deep link received while the app is already running.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleResetUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Log that user arrived from deep link or via in-app navigation
    console.log('ResetPasswordScreen loaded with params:', route.params);

    // If route params contain access_token/refresh_token (navigated from dev helper), set session
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = route.params || {};
      const access_token = params?.access_token;
      const refresh_token = params?.refresh_token;
      const err = params?.error;
      const errDesc = params?.error_description;

      if (err) {
        if ((errDesc || '').toLowerCase().includes('expired')) {
          setLinkError('This reset link has expired. Please request a new password reset email.');
        } else {
          setLinkError(errDesc || err);
        }
      }

      if (access_token) {
        // Same recovery as the deep-link path: a valid token clears any prior
        // Link Error so the submit button is not left hidden.
        setLinkError(null);
        (async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({
            access_token,
            refresh_token,
          });
          if (setErr) {
            captureException(setErr, {
              tags: { screen: 'ResetPasswordScreen', action: 'set_session_params' },
            });
            setLinkError(
              'Failed to set auth session from reset link. Please request a new reset email.'
            );
            return;
          }
          setHasResetSession(true);
        })();
      }
    } catch (e) {
      captureException(e, {
        tags: { screen: 'ResetPasswordScreen', action: 'handle_route_params' },
      });
    }
  }, [route.params]);

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return false;
    }

    // Check for at least one uppercase, one lowercase, and one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setErrors({
        password: 'Password must contain uppercase, lowercase, and number',
      });
      return false;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword(password)) {
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting password reset');

      // Ensure we have a valid session from the deep link before attempting
      // to update password. If not, inform the user to request a new link.
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session && !hasResetSession) {
        Alert.alert(
          'No active reset session',
          'This link does not provide a valid reset session. Please request a new password reset email.'
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      } as any);

      if (error) {
        captureException(error, {
          tags: { screen: 'ResetPasswordScreen', action: 'update_password' },
        });

        Alert.alert(
          'Reset Failed',
          error.message || 'Failed to update password. Please try again.'
        );
      } else {
        console.log('Password reset successful');

        Alert.alert('Success!', 'Your password has been reset successfully.', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            },
          },
        ]);
      }
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'ResetPasswordScreen', action: 'reset_password_exception' },
      });

      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your new password below.</Text>
          </View>

          {/* New Password Input */}
          <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            label="New Password"
            testID="reset-new-password-input"
            placeholder="Enter new password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({});
            }}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            editable={!loading}
            containerStyle={styles.input}
          />

          {/* Confirm Password Input */}
          <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            label="Confirm Password"
            testID="reset-confirm-password-input"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors({});
            }}
            error={errors.confirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            editable={!loading}
            containerStyle={styles.input}
          />

          {/* Link Error Card */}
          {linkError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Link Error</Text>
              <Text style={styles.errorCardMessage}>{linkError}</Text>
              <Button
                variant="primary"
                size="medium"
                onPress={() => (navigation as any).navigate('ForgotPassword')}
                testID="reset-request-new-email-button"
                style={styles.errorCardButton}
              >
                Request New Reset Email
              </Button>
            </View>
          ) : (
            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={styles.requirementsText}>
                • At least 8 characters{'\n'}• Contains uppercase letter{'\n'}• Contains lowercase
                letter{'\n'}• Contains number
              </Text>
            </View>
          )}

          {/* Reset Button */}
          {/* Design system: max one primary CTA per screen (docx/design-system-passitup.md). When
              the Link Error card is visible the reset link is expired/invalid, so there is no valid
              reset session and this submit button is non-functional (it would only surface the
              "No active reset session" alert). Hide it so "Request New Reset Email" is the single
              primary action for that recovery state. AUTH-TC-S10 (no active reset session) is
              unaffected: that path has linkError === null, so the button remains visible. */}
          {!linkError && (
            <Button
              variant="primary"
              size="large"
              onPress={handleResetPassword}
              disabled={loading || !password || !confirmPassword}
              loading={loading}
              testID="reset-submit-button"
              style={styles.resetButton}
            >
              Reset Password
            </Button>
          )}

          {/* Back to Login Link */}
          <TouchableOpacity
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            }}
            disabled={loading}
            style={styles.backLinkButton}
            testID="reset-back-to-login"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to Login"
          >
            <Text style={[styles.backLinkText, loading && styles.backLinkTextDisabled]}>
              Back to Login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColors.page,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    padding: theme.componentSpacing.pageMargin,
    justifyContent: 'center',
    paddingBottom: theme.spacing.xl,
  },

  header: {
    marginBottom: theme.spacing.xl,
  },

  title: {
    ...theme.typography.h1,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
  },

  subtitle: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    lineHeight: 24,
  },

  input: {
    marginBottom: theme.spacing.md,
  },

  errorCard: {
    backgroundColor: theme.colors.error[100],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
  },

  errorCardTitle: {
    ...theme.typography.label,
    color: theme.textColors.error,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },

  errorCardMessage: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },

  errorCardButton: {
    width: '100%',
  },

  requirementsCard: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
  },

  requirementsTitle: {
    ...theme.typography.label,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },

  requirementsText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    lineHeight: 20,
  },

  resetButton: {
    marginBottom: theme.spacing.md,
  },

  backLinkButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  backLinkText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  backLinkTextDisabled: {
    color: theme.colors.neutral[300],
  },
});
