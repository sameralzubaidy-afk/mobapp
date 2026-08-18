// File: p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx
// FLOW-01: Auth Signup Screen (Redesigned)
// Design System: Prompts/re-desing/design-system.md

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { signupWithTrial } from '@/services/auth';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import { isAtLeastAge } from '@/utils/age';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import AccountLinkingPrompt from '@/components/auth/AccountLinkingPrompt';
import { OAuthProvider, ProviderProfile } from '@/types/auth-v3';
import { Button, Modal, TextInput } from '@/components/ui';
import { theme } from '@/theme';
import { useGlobalAlert } from '@/providers/GlobalAlertProvider';
import { useAuth } from '@/hooks/useAuth';
import { getAllTestUsers, TestUser } from '@/utils/testUsers';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';
// TODO: Integrate Sentry
// import * as Sentry from '@sentry/react-native';

// DEV-only: generate a unique email + phone so each autofill tap creates a genuinely fresh,
// non-colliding account (removes the QA long-press → Select All → retype override step).
// Email stays valid for the signup regex; phone keeps the test area/prefix (+1202555) and appends
// a unique 7-digit suffix so it stays within the valid 10–15 digit range.
const buildUniqueContact = (base: TestUser) => {
  const emailSuffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const phoneSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7);
  return {
    email: `qa.${base.firstName.toLowerCase()}.${emailSuffix}@kidsmarketplace.test`,
    phone: `+1202555${phoneSuffix}`,
  };
};

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const emailInputRef = useRef<RNTextInput>(null);
  const { showAlert } = useGlobalAlert();
  const { refreshSession } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // "Signup Failed" dialog (branded modal so its OK button carries a stable accessibility identifier)
  const [signupFailedVisible, setSignupFailedVisible] = useState(false);
  const [signupFailedMessage, setSignupFailedMessage] = useState('');

  // Account-linking prompt state — shown when a social signup email matches an existing account
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

  useEffect(() => {
    const params = (route as any).params as { prefillTestUserId?: string } | undefined;
    if (!__DEV__ || !params?.prefillTestUserId) return;

    const user = getAllTestUsers().find((candidate) => candidate.id === params.prefillTestUserId);
    if (user) {
      applyTestUser(user);
    }
  }, [route]);

  // Dev-only navigation params handled elsewhere if needed

  // Validation functions
  const validateName = (name: string): string | null => {
    if (!name || name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.length > 100) {
      return 'Name must be less than 100 characters';
    }
    return null;
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validatePhone = (phone: string): string | null => {
    // Accept formats: +1234567890 or 1234567890
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return 'Please enter a valid phone number (10+ digits)';
    }
    return null;
  };

  const validateDob = (dob: string): string | null => {
    // Expect YYYY-MM-DD
    if (!dob) return 'Please enter your date of birth';
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
    if (!m) return 'Date of birth must be in YYYY-MM-DD format';
    const date = new Date(dob + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return 'Invalid date of birth';
    // Age check will be performed separately
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const validateReferralCode = (code: string): string | null => {
    // If empty, that's OK (referral code is optional)
    if (!code || code.trim().length === 0) {
      return null;
    }

    const trimmedCode = code.trim().toLowerCase();

    // Must be 8 characters
    if (trimmedCode.length !== 8) {
      return 'Referral code must be exactly 8 characters';
    }

    // Must contain only lowercase letters and numbers
    if (!/^[a-z0-9]+$/.test(trimmedCode)) {
      return 'Referral code must contain only letters and numbers';
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(
      formData.password,
      formData.confirmPassword
    );
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    const dobError = validateDob(formData.dob);
    if (dobError) newErrors.dob = dobError;

    // Validate referral code if provided
    const referralError = validateReferralCode(formData.referralCode);
    if (referralError) newErrors.referralCode = referralError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    // TODO: Track signup started when analytics service is ready
    // trackEvent(AUTH_EVENTS.SIGNUP_STARTED, {
    //   method: 'email',
    //   timestamp: new Date().toISOString(),
    // });

    // Validate form
    if (!validateForm()) {
      // TODO: Track validation errors
      // trackEvent(AUTH_EVENTS.SIGNUP_FAILED, {
      //   reason: 'validation_error',
      //   errors: Object.keys(errors),
      // });
      return;
    }

    setLoading(true);

    try {
      // Age check: ensure user is at least 18
      if (!isAtLeastAge(formData.dob, 18)) {
        // Branded dialog (native Alert buttons can't carry a testID/accessibility identifier)
        showAlert({
          title: 'Sorry',
          message: 'Sorry, you must be 18 years old to register.',
          buttons: [{ text: 'OK', testID: 'age-gate-dialog-ok-button' }],
        });
        setLoading(false);
        return;
      }

      // TC-005 Validate referral code exists BEFORE creating auth user
      // This prevents the "Email already registered" error if the referral check fails later.
      if (formData.referralCode && formData.referralCode.trim()) {
        const codeValid = await ReferralCodeServiceV2.checkCodeExists(formData.referralCode.trim());
        if (!codeValid) {
          setLoading(false);
          // Branded dialog with stable accessibility identifiers (native alerts expose none)
          showAlert({
            title: 'Invalid Referral Code',
            message:
              'The referral code you entered is invalid. Would you like to fix it or continue without a code?',
            buttons: [
              {
                text: 'Fix it',
                style: 'cancel',
                testID: 'referral-invalid-fix-it-button',
                onPress: () => {
                  // Do nothing, let user edit
                },
              },
              {
                text: 'Continue anyway',
                primary: true,
                testID: 'referral-invalid-continue-anyway-button',
                onPress: async () => {
                  // Proceed without the referral code
                  setFormData((prev) => ({ ...prev, referralCode: '' }));
                  // We need to trigger handleSignup again but without the code
                  await runFinalSignup('');
                },
              },
            ],
          });
          return;
        }
      }

      await runFinalSignup(formData.referralCode.trim().toLowerCase());
    } catch (error: any) {
      handleSignupError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Final signup execution after validation passes
   */
  const runFinalSignup = async (finalReferralCode: string) => {
    setLoading(true);
    try {
      const { user, error } = await signupWithTrial({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob.trim(),
        referralCode: finalReferralCode,
      });

      if (error) {
        throw error;
      }

      if (!user) {
        throw new Error('Signup succeeded but no user returned');
      }

      // Navigate to phone verification screen
      (navigation as any).navigate('PhoneVerification', {
        userId: user.id,
        phone: formData.phone,
      });
    } catch (error: any) {
      handleSignupError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Unified error handling for signup process
   */
  const handleSignupError = (error: any) => {
    const debugInfo = {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
    };
    console.error('Signup error:', debugInfo, error);

    // Show user-friendly error message
    let errorMessage = 'Signup failed. Please try again.';

    if (error.message?.includes('already registered')) {
      errorMessage = 'This email is already registered. Please log in instead.';
    } else if (error.message?.includes('weak password')) {
      errorMessage = 'Password is too weak. Please choose a stronger password.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message?.includes('Invalid referral code')) {
      errorMessage =
        'The referral code you entered is invalid. Please check the code and try again.';
    } else if (error.message?.includes('Referral code')) {
      errorMessage =
        'There was an error applying the referral code. Please try again or skip this step.';
    } else if (error.message?.includes('Database error saving new user')) {
      errorMessage =
        'Signup failed due to a backend database trigger error. Please check Supabase Auth logs for the underlying SQL error (often caused by a failing auth.users trigger).';
    } else if (
      error.message?.includes('POLICY_ACCEPTANCE_FAILED') ||
      error.message?.includes('policy acceptance') ||
      error.message?.includes('terms_of_service') ||
      error.message?.includes('privacy_policy')
    ) {
      errorMessage = 'Signup could not save your policy agreement. Please try again in a moment.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Show a branded modal (native Alert buttons can't carry a testID/accessibility identifier)
    setSignupFailedMessage(errorMessage);
    setSignupFailedVisible(true);
  };

  const handleSocialSignupSuccess = () => {
    // Root navigator transitions based on auth session + onboarding state.
  };

  const applyTestUser = (user: TestUser, options?: { uniqueContact?: boolean }) => {
    // uniqueContact (dev autofill buttons only): generate a fresh email/phone per tap so QA can
    // create a new account without overriding the two contact fields. The route-param prefill path
    // omits this option and keeps fixed values (existing behavior).
    const contact = options?.uniqueContact ? buildUniqueContact(user) : null;
    setFormData({
      name: `${user.firstName} ${user.lastName}`,
      email: contact?.email ?? user.email,
      phone: contact?.phone ?? user.phone,
      dob: user.dob,
      password: user.password,
      confirmPassword: user.password,
      referralCode: '',
    });
    setErrors({});
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Keyboard handling — gentler auto-scroll:
          iOS → native inset adjustment (automaticallyAdjustKeyboardInsets): focusing a field scrolls
          it just above the keyboard in ONE smooth native move; no jump when the field is already
          visible. KeyboardAvoidingView 'padding' is disabled on iOS because its instant padding change
          + ScrollView auto-scroll caused a jumpy double-movement (QA friction, phases 17/20/22).
          Android → KeyboardAvoidingView 'height' (soft-input resize is handled there). */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            testID="signup-back-button"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the Kids P2P Marketplace</Text>
          </View>

          {/* Social Login Buttons */}
          <SocialLoginButtons
            mode="signup"
            onSignupSuccess={handleSocialSignupSuccess}
            onAccountExists={handleAccountExists}
            emailInputRef={emailInputRef}
            testID="signup-social-buttons"
          />

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <TextInput
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
              autoCapitalize="words"
              autoCorrect={false}
              testID="signup-display-name-input"
            />

            {/* Email Input */}
            <TextInput
              label="Email"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="signup-email-input"
            />

            {/* Phone Input */}
            <TextInput
              label="Phone Number"
              placeholder="+1234567890"
              value={formData.phone}
              onChangeText={(text) => {
                setFormData({ ...formData, phone: text });
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
              error={errors.phone}
              keyboardType="phone-pad"
              autoCorrect={false}
              testID="signup-phone-input"
            />

            {/* DOB Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <DateOfBirthPicker
                value={formData.dob}
                onChangeText={(text) => {
                  setFormData({ ...formData, dob: text });
                  if (errors.dob) setErrors({ ...errors, dob: '' });
                }}
                error={!!errors.dob}
                testID="signup-dob-picker"
              />
              {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
            </View>

            {/* Password Input */}
            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
              helperText="Must be 8+ characters with uppercase, lowercase, and number"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              testID="signup-password-input"
            />

            {/* Confirm Password Input */}
            <TextInput
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(text) => {
                setFormData({ ...formData, confirmPassword: text });
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              testID="signup-confirm-password-input"
            />

            {/* Referral Code Input (Optional) */}
            <TextInput
              label="Referral Code (Optional)"
              placeholder="Enter referral code"
              value={formData.referralCode}
              onChangeText={(text) => {
                setFormData({ ...formData, referralCode: text });
                if (errors.referralCode) setErrors({ ...errors, referralCode: '' });
              }}
              error={errors.referralCode}
              helperText="Get 5 bonus points when you complete your first trade!"
              autoCapitalize="none"
              maxLength={8}
              autoCorrect={false}
              autoComplete="off"
              testID="referralCode-input"
            />

            {__DEV__ && (
              <View style={styles.devAutofillSection}>
                <Text style={styles.devAutofillTitle}>Dev: Autofill Test Users</Text>
                <View style={styles.devAutofillButtonsRow}>
                  {getAllTestUsers()
                    .slice(0, 3)
                    .map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        onPress={() => applyTestUser(user, { uniqueContact: true })}
                        style={styles.devAutofillButton}
                        testID={`dev-fill-${user.id}`}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={`Autofill ${user.firstName} test user`}
                      >
                        <Text style={styles.devAutofillButtonText}>{user.firstName}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            {/* Signup Button */}
            <Button
              variant="primary"
              size="large"
              onPress={handleSignup}
              disabled={loading}
              loading={loading}
              testID="signup-submit-button"
              style={styles.signupButton}
            >
              Create Account
            </Button>

            {/* Login Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('Login')}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Log In"
                testID="signup-login-link"
              >
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>

            {/* Terms and Privacy */}
            <View style={styles.terms}>
              <View style={styles.termsRow}>
                <Text style={styles.termsText}>By signing up, you agree to our </Text>
                <Text
                  style={styles.termsLink}
                  accessible
                  accessibilityRole="link"
                  accessibilityLabel="Terms of Service"
                  testID="signup-terms-of-service-link"
                  onPress={() => (navigation as any).navigate('TermsOfService')}
                >
                  Terms of Service
                </Text>
                <Text style={styles.termsText}> and </Text>
                <Text
                  style={styles.termsLink}
                  accessible
                  accessibilityRole="link"
                  accessibilityLabel="Privacy Policy"
                  testID="signup-privacy-policy-link"
                  onPress={() => (navigation as any).navigate('PrivacyPolicy')}
                >
                  Privacy Policy
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* "Signup Failed" dialog — branded modal; OK carries a stable accessibility identifier */}
      <Modal
        type="alert"
        visible={signupFailedVisible}
        title="Signup Failed"
        message={signupFailedMessage}
        primaryButtonText="OK"
        primaryButtonTestID="signup-error-dialog-ok-button"
        onPrimaryPress={() => setSignupFailedVisible(false)}
        onClose={() => setSignupFailedVisible(false)}
        showCloseButton={false}
      />

      {/* Account-linking prompt — shown when a social signup matches an existing email account */}
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
    padding: theme.componentSpacing.pageMargin,
    paddingBottom: theme.spacing.xl,
  },

  backButton: {
    marginBottom: theme.spacing.md,
    width: 40,
  },

  backButtonText: {
    ...theme.typography.h1,
    color: theme.colors.primary[500],
  },

  header: {
    marginTop: theme.spacing.md,
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
  },

  form: {
    flex: 1,
  },

  inputGroup: {
    marginBottom: theme.spacing.md,
  },

  devAutofillSection: {
    marginBottom: theme.spacing.md,
  },

  devAutofillTitle: {
    ...theme.typography.caption,
    color: theme.textColors.tertiary,
    marginBottom: theme.spacing.sm,
  },

  devAutofillButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },

  devAutofillButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.backgroundColors.input,
  },

  devAutofillButtonText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.primary,
    fontFamily: theme.fontFamily.medium,
  },

  label: {
    ...theme.typography.label,
    color: theme.textColors.secondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },

  errorText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.error,
    marginTop: theme.spacing.xs,
  },

  signupButton: {
    marginTop: theme.spacing.md,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },

  footerText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  loginLink: {
    ...theme.typography.body,
    color: theme.textColors.link,
    fontFamily: theme.fontFamily.semiBold,
  },

  terms: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.borderColors.divider,
  },

  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },

  termsText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  termsLink: {
    color: theme.textColors.link,
    fontFamily: theme.fontFamily.semiBold,
  },
});
