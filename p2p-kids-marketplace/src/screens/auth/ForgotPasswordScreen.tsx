// File: p2p-kids-marketplace/src/screens/auth/ForgotPasswordScreen.tsx
// FLOW-01: Auth Forgot Password Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React, { useState } from 'react';
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
import {
  SafeAreaView } from 'react-native-safe-area-context'; import { useNavigation } from '@react-navigation/native'; import { Linking
} from 'react-native';
import { supabase } from '@/services/supabase/client';
import { Button, TextInput } from '@/components/ui';
import { theme } from '@/theme';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSendResetEmail = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      console.log('Password reset requested:', { email });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'p2pkidsmarketplace://reset-password',
      });

      if (error) {
        console.error('Password reset error:', error);

        const baseMessage = error.message || 'Failed to send password reset email.';
        let detailMessage = baseMessage;

        const lm = baseMessage.toLowerCase();
        if (lm.includes('rate limit')) {
          detailMessage =
            'You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes.';
        } else if (lm.includes('error sending recovery') || (error as any)?.status >= 500) {
          detailMessage +=
            '\n\nPossible causes:\n• SMTP/email provider not configured in Supabase Auth\n• Redirect URL not allowed in Auth settings\n\nCheck Supabase Auth > Email Settings and Email Logs.';
        } else if ((error as any)?.status === 400) {
          detailMessage +=
            '\n\nCheck that the email you entered is correct and belongs to an account.';
        } else {
          detailMessage += '\n\nIf this persists, check Supabase Auth email settings and logs.';
        }

        Alert.alert('Reset Email Failed', detailMessage, [
          {
            text: 'Open Supabase Docs',
            onPress: () => Linking.openURL('https://supabase.com/docs/guides/auth/passwords'),
          },
          { text: 'OK' },
        ]);
      } else {
        setEmailSent(true);
        console.log('Password reset email sent successfully');
      }
    } catch (error: any) {
      console.error('Password reset exception:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successContent}>
          <View style={styles.successHeader}>
            <Text style={styles.successTitle}>Check Your Inbox</Text>
            <Text style={styles.successSubtitle}>
              Check your inbox! If you have an account with us, you'll find a link to reset your password. Don't forget to check your spam folder if you don't see it in a few minutes.
            </Text>
          </View>

          <Button
            variant="secondary"
            size="large"
            onPress={() => {
              setEmailSent(false);
              setEmail('');
            }}
            testID="forgot-send-another-button"
            style={styles.resendButton}
          >
            Send Another Email
          </Button>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backLinkButton}
            testID="forgot-back-to-login-success"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Back to Login"
          >
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Email Input */}
          <TextInput
            label="Email Address"
            testID="forgot-email-input"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loading}
            containerStyle={styles.emailInput}
          />

          {/* Submit Button */}
          <Button
            variant="primary"
            size="large"
            onPress={handleSendResetEmail}
            disabled={loading || !email}
            loading={loading}
            testID="forgot-send-reset-button"
            style={styles.submitButton}
          >
            Send Reset Link
          </Button>

          {/* Back to Login Link */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
            style={styles.backLinkButton}
            testID="forgot-back-to-login"
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

  emailInput: {
    marginBottom: theme.spacing.lg,
  },

  submitButton: {
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

  // Success state styles
  successContent: {
    flex: 1,
    padding: theme.componentSpacing.pageMargin,
    justifyContent: 'center',
  },

  successHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },

  successEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },

  successTitle: {
    ...theme.typography.h1,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },

  successSubtitle: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  successEmail: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.textColors.primary,
  },

  instructionsCard: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
  },

  instructionsText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    lineHeight: 20,
  },

  resendButton: {
    marginBottom: theme.spacing.md,
  },
});
