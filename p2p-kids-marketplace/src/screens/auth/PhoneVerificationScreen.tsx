// File: p2p-kids-marketplace/src/screens/auth/PhoneVerificationScreen.tsx
// FLOW-01: Auth Phone Verification Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/phoneService';
import { Button, OTPInput } from '@/components/ui';
import { theme } from '@/theme';
import { useGlobalAlert } from '@/providers/GlobalAlertProvider';

interface RouteParams {
  userId: string;
  phone: string;
}

export default function PhoneVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, phone } = route.params as RouteParams;

  const { showAlert } = useGlobalAlert();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(false);

  // Auto-send code on mount
  useEffect(() => {
    handleResendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setResending(true);
    try {
      const result = await sendPhoneVerificationCode(phone);
      if (result.devBypass && result.devBypassCode) {
        showAlert({
          title: 'Code Sent (DEV Bypass)',
          message: `SMS provider is unavailable in development. Use code: ${result.devBypassCode}`,
          buttons: [{ text: 'OK', testID: 'otp-dev-bypass-dialog-ok-button' }],
        });
      } else {
        showAlert({
          title: 'Code Sent',
          message: `A verification code has been sent to ${phone}`,
          buttons: [{ text: 'OK', testID: 'otp-code-sent-dialog-ok-button' }],
        });
      }
      setCountdown(60); // 60 second cooldown
    } catch (error) {
      const err = error as Error;
      Alert.alert('Error', err.message || 'Failed to send verification code');
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError(true);
      Alert.alert('Invalid Code', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(false);

    try {
      await verifyPhoneCode(phone, code);
      setLoading(false);
      showAlert({
        title: 'Success!',
        message: "Your phone number has been verified. Let's complete your profile!",
        buttons: [
          {
            text: 'Continue',
            primary: true,
            testID: 'otp-success-dialog-ok-button',
            onPress: () => {
              // Navigate to ProfileSetup screen (consolidated profile + zip code setup)
              (navigation as any).navigate('ProfileSetup', { userId });
            },
          },
        ],
      });
    } catch (error) {
      setLoading(false);
      setError(true);
      const err = error as Error;
      Alert.alert('Verification Failed', err.message || 'Invalid code');
      // Clear code inputs on error
      setCode('');
    }
  };

  const handleDevFillTestCode = () => {
    if (!__DEV__) return;
    setCode('123456');
    setError(false);
  };

  const handleDevVerifyTestCode = async () => {
    if (!__DEV__) return;
    setCode('123456');
    setError(false);
    setLoading(true);

    try {
      await verifyPhoneCode(phone, '123456');
      setLoading(false);
      showAlert({
        title: 'Success!',
        message: "Your phone number has been verified. Let's complete your profile!",
        buttons: [
          {
            text: 'Continue',
            primary: true,
            testID: 'otp-success-dialog-ok-button',
            onPress: () => {
              (navigation as any).navigate('ProfileSetup', { userId });
            },
          },
        ],
      });
    } catch (error) {
      setLoading(false);
      setError(true);
      const err = error as Error;
      Alert.alert('Verification Failed', err.message || 'Invalid code');
      setCode('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Verify Your Phone</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.phone}>{phone}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <OTPInput
              length={6}
              value={code}
              onChange={(newCode) => {
                setCode(newCode);
                setError(false);
              }}
              error={error}
            />
          </View>

          {__DEV__ && (
            <View style={styles.devOtpSection}>
              <Text style={styles.devOtpHint}>Dev: OTP bypass code is 123456</Text>
              <View style={styles.devOtpButtonsRow}>
                <TouchableOpacity
                  onPress={handleDevFillTestCode}
                  style={styles.devOtpButton}
                  testID="dev-fill-otp-123456"
                >
                  <Text style={styles.devOtpButtonText}>Fill 123456</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDevVerifyTestCode}
                  style={styles.devOtpButton}
                  testID="dev-verify-otp-123456"
                >
                  <Text style={styles.devOtpButtonText}>Use & Verify</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Verify Button */}
          <Button
            variant="primary"
            size="large"
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            loading={loading}
            style={styles.verifyButton}
          >
            Verify
          </Button>

          {/* Resend Section */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={countdown > 0 || resending}
            >
              <Text
                style={[
                  styles.resendButton,
                  (countdown > 0 || resending) && styles.resendButtonDisabled,
                ]}
              >
                {resending
                  ? 'Sending...'
                  : countdown > 0
                    ? `Resend in ${countdown}s`
                    : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Change Number Link */}
          <TouchableOpacity
            style={styles.changeNumberButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.changeNumberText}>Change Phone Number</Text>
          </TouchableOpacity>
        </View>
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

  content: {
    flex: 1,
    padding: theme.componentSpacing.pageMargin,
    justifyContent: 'center',
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
    lineHeight: 24,
  },

  phone: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.textColors.primary,
  },

  otpContainer: {
    marginBottom: theme.spacing.xl,
  },

  devOtpSection: {
    marginBottom: theme.spacing.lg,
  },

  devOtpHint: {
    ...theme.typography.caption,
    color: theme.textColors.tertiary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },

  devOtpButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },

  devOtpButton: {
    flex: 1,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.backgroundColors.input,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },

  devOtpButtonText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.primary,
    fontFamily: theme.fontFamily.medium,
  },

  verifyButton: {
    marginBottom: theme.spacing.lg,
  },

  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },

  resendText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    marginRight: theme.spacing.sm,
  },

  resendButton: {
    ...theme.typography.body,
    color: theme.colors.accent[500],
    fontFamily: theme.fontFamily.semiBold,
  },

  resendButtonDisabled: {
    color: theme.colors.neutral[300],
  },

  changeNumberButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },

  changeNumberText: {
    ...theme.typography.body,
    color: theme.textColors.tertiary,
    textDecorationLine: 'underline',
  },
});
