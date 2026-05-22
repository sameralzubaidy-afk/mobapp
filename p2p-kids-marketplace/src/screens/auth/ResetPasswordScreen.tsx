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
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';
import { Button, TextInput } from '@/components/ui';
import { theme } from '@/theme';

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
  // in the fragment (hash). Parse the initial URL to derive access_token/refresh_token
  // or show an error if link contains error params (e.g., otp_expired).
  useEffect(() => {
    const handleInitialUrl = async () => {
      try {
        const url = await (await import('react-native')).Linking.getInitialURL();
        if (!url) return;

        // Split hash (fragment) portion after '#'
        const parts = url.split('#');
        const hash = parts[1] ?? '';

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
          // Set session so supabase.auth.updateUser works
          // supabase.auth.setSession exists in Supabase JS client
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({
            access_token,
            refresh_token,
          });
          if (setErr) {
            console.error('Failed to set session from deep link:', setErr);
            setLinkError(
              'Failed to set auth session from reset link. Please request a new reset email.'
            );
            return;
          }
          setHasResetSession(true);
        }
      } catch (e: any) {
        console.error('Error parsing initial URL for reset token:', e);
      }
    };

    handleInitialUrl();
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
        (async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({
            access_token,
            refresh_token,
          });
          if (setErr) {
            console.error('Failed to set session from params:', setErr);
            setLinkError(
              'Failed to set auth session from reset link. Please request a new reset email.'
            );
            return;
          }
          setHasResetSession(true);
        })();
      }
    } catch (e) {
      console.error('Failed to handle route params in ResetPasswordScreen', e);
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
        console.error('Password update error:', error);

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
      console.error('Password reset exception:', error);

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
          <TextInput
            label="New Password"
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
          <TextInput
            label="Confirm Password"
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
                style={styles.errorCardButton}
              >
                Request New Reset Email
              </Button>
            </View>
          ) : (
            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={styles.requirementsText}>
                • At least 8 characters{'\n'}
                • Contains uppercase letter{'\n'}
                • Contains lowercase letter{'\n'}
                • Contains number
              </Text>
            </View>
          )}

          {/* Reset Button */}
          <Button
            variant="primary"
            size="large"
            onPress={handleResetPassword}
            disabled={loading || !password || !confirmPassword}
            loading={loading}
            style={styles.resetButton}
          >
            Reset Password
          </Button>

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
