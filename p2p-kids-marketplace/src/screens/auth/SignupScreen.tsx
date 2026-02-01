// File: p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx
// MODULE-03 AUTH-V2-002: User Signup with Automatic Trial Activation

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signupWithTrial } from '@/services/auth';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import { isAtLeastAge } from '@/utils/age';
import { getAllTestUsers, getRandomTestUser, TestUser } from '@/utils/testUsers';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';
// TODO: Integrate Sentry
// import * as Sentry from '@sentry/react-native';

export default function SignupScreen() {
  const navigation = useNavigation();
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
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
        Alert.alert('Sorry', 'Sorry, you must be 18 years old to register.');
        setLoading(false);
        return;
      }

      // TC-005 Validate referral code exists BEFORE creating auth user
      // This prevents the "Email already registered" error if the referral check fails later.
      if (formData.referralCode && formData.referralCode.trim()) {
        const codeValid = await ReferralCodeServiceV2.checkCodeExists(formData.referralCode.trim());
        if (!codeValid) {
          setLoading(false);
          Alert.alert(
            'Invalid Referral Code',
            'The referral code you entered is invalid. Would you like to fix it or continue without a code?',
            [
              {
                text: 'Fix it',
                style: 'cancel',
                onPress: () => {
                  // Do nothing, let user edit
                }
              },
              {
                text: 'Continue anyway',
                onPress: async () => {
                   // Proceed without the referral code
                   setFormData(prev => ({ ...prev, referralCode: '' }));
                   // We need to trigger handleSignup again but without the code
                   await runFinalSignup('');
                }
              }
            ]
          );
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
      errorMessage = 'The referral code you entered is invalid. Please check the code and try again.';
    } else if (error.message?.includes('Referral code')) {
      errorMessage = 'There was an error applying the referral code. Please try again or skip this step.';
    } else if (error.message?.includes('Database error saving new user')) {
      errorMessage =
        'Signup failed due to a backend database trigger error. Please check Supabase Auth logs for the underlying SQL error (often caused by a failing auth.users trigger).';
    } else if (error.message) {
      errorMessage = error.message;
    }

    Alert.alert('Signup Failed', errorMessage);
  };

  function applyTestUser(user: TestUser) {
    setFormData({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone ?? '',
      dob: user.dob ?? '',
      password: user.password ?? '',
      referralCode: '',
      confirmPassword: user.password ?? '',
    });
    setErrors({});
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the Kids P2P Marketplace</Text>
        </View>

        <View style={styles.form}>
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Enter your full name"
              value={formData.name}
              testID="name-input"
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Enter your email"
              value={formData.email}
              testID="email-input"
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="+1234567890"
              value={formData.phone}
              testID="phone-input"
              onChangeText={(text) => {
                setFormData({ ...formData, phone: text });
                if (errors.phone) {
                  setErrors({ ...errors, phone: '' });
                }
              }}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* DOB Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={[styles.input, errors.dob && styles.inputError]}
              placeholder="YYYY-MM-DD"
              value={formData.dob}
              testID="dob-input"
              onChangeText={(text) => {
                setFormData({ ...formData, dob: text });
                if (errors.dob) {
                  setErrors({ ...errors, dob: '' });
                }
              }}
              keyboardType="numeric"
              autoCorrect={false}
            />
            {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, errors.password && styles.inputError, styles.inputWithIcon]}
                placeholder="Enter your password"
                value={formData.password}
                testID="password-input"
                onChangeText={(text) => {
                  setFormData({ ...formData, password: text });
                  if (errors.password) {
                    setErrors({ ...errors, password: '' });
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                passwordRules="minlength: 8; required: upper; required: lower; required: digit;"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIconText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            <Text style={styles.helperText}>
              Must be 8+ characters with uppercase, lowercase, and number
            </Text>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError, styles.inputWithIcon]}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                testID="confirmPassword-input"
                onChangeText={(text) => {
                  setFormData({ ...formData, confirmPassword: text });
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: '' });
                  }
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIconText}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          {/* Referral Code Input (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Referral Code (Optional)</Text>
            <TextInput
              style={[styles.input, errors.referralCode && styles.inputError]}
              placeholder="Enter referral code"
              value={formData.referralCode}
              testID="referralCode-input"
              onChangeText={(text) => {
                  setFormData({ ...formData, referralCode: text });
                if (errors.referralCode) {
                  setErrors({ ...errors, referralCode: '' });
                }
              }}
                autoCapitalize="none"
              maxLength={8}
              autoCorrect={false}
                autoComplete="off"
            />
            {errors.referralCode && <Text style={styles.errorText}>{errors.referralCode}</Text>}
            <Text style={styles.helperText}>
              Get 5 bonus points when you complete your first trade!
            </Text>
          </View>

          {__DEV__ && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Dev: Autofill</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  testID="dev-fill-random-user"
                  style={{ padding: 8, backgroundColor: '#eee', borderRadius: 6 }}
                  onPress={() => applyTestUser(getRandomTestUser())}
                >
                  <Text>Fill Random</Text>
                </TouchableOpacity>
                {getAllTestUsers().slice(0, 3).map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    testID={`dev-fill-${u.id}`}
                    style={{ padding: 8, backgroundColor: '#f5f5f5', borderRadius: 6 }}
                    onPress={() => applyTestUser(u)}
                  >
                    <Text>{u.firstName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Signup Button */}
          <TouchableOpacity
            style={[styles.signupButton, loading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>

          {/* Terms and Privacy */}
          <View style={styles.terms}>
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputWithIcon: {
    paddingRight: 50,
  },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  signupButton: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  signupButtonDisabled: {
    backgroundColor: '#ccc',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  terms: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 13,
    padding: 4,
    zIndex: 1,
  },
  eyeIconText: {
    fontSize: 20,
  },
});
