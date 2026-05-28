// File: p2p-kids-marketplace/src/screens/SignupScreen.tsx
// MODULE-03 AUTH-V2-002: User Signup with Trial Activation
// MODULE-03 AUTH-V3-007: Social Login Integration

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signupWithTrial } from '../services/auth';
import { SignupInput, AuthError } from '../types/user';
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons';
import type { OAuthProvider } from '@/types/auth-v3';

type NavigationProp = NativeStackNavigationProp<any>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  // Ref for email input (for social login error fallback)
  const emailInputRef = useRef<TextInput>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [parentalEmail, setParentalEmail] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Account linking state (when social login detects existing account)
  const [_accountLinkPrompt, setAccountLinkPrompt] = useState<{
    email: string;
    provider: OAuthProvider;
  } | null>(null);

  // Check if user is under 13 (requires parental consent)
  const ageNum = parseInt(age, 10);
  const requiresParentalConsent = !isNaN(ageNum) && ageNum < 13;

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Display name
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    // Age validation
    if (!age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(ageNum) || ageNum < 5 || ageNum > 17) {
      newErrors.age = 'Age must be between 5 and 17';
    }

    // ZIP code validation
    if (!zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}$/.test(zipCode)) {
      newErrors.zipCode = 'ZIP code must be 5 digits';
    }

    // Parental email (if required)
    if (requiresParentalConsent && !parentalEmail.trim()) {
      newErrors.parentalEmail = 'Parent email required for users under 13';
    } else if (requiresParentalConsent && !/\S+@\S+\.\S+/.test(parentalEmail)) {
      newErrors.parentalEmail = 'Parent email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle social signup success (navigate to home OR profile completion)
   */
  const handleSocialSignupSuccess = () => {
    console.log('[SignupScreen] Social signup successful');
    Alert.alert(
      'Welcome to Kids Club+! 🎉',
      'Your profile has been created. Complete your profile to start trading!',
      [
        {
          text: 'Get Started',
          onPress: () => {
            // TODO: Navigate to onboarding wizard when implemented
            navigation.navigate('Home' as any);
          },
        },
      ]
    );
  };

  /**
   * Handle account exists (show linking prompt)
   * TODO: Implement AccountLinkingPrompt modal in AUTH-V3-008
   */
  const handleAccountExists = (emailAddr: string, provider: OAuthProvider) => {
    console.log('[SignupScreen] Account exists:', { email: emailAddr, provider });
    setAccountLinkPrompt({ email: emailAddr, provider });
    // For now, just show an alert and navigate to login
    Alert.alert(
      'Account Exists',
      `An account with ${emailAddr} already exists. Please log in instead.`,
      [
        {
          text: 'Go to Login',
          onPress: () => {
            setAccountLinkPrompt(null);
            navigation.navigate('Login' as any);
          },
        },
      ]
    );
  };

  /**
   * Handle signup submission
   */
  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const signupData: SignupInput = {
        email: email.trim(),
        password,
        name: displayName.trim(),
        age: ageNum,
        zipCode: zipCode.trim(),
        parentalEmail: requiresParentalConsent ? parentalEmail.trim() : undefined,
      };

      const _session = await signupWithTrial(signupData);

      // Show success message
      Alert.alert(
        'Welcome to Kids Club+! 🎉',
        'Your 30-day free trial has started. Complete your profile to start trading!',
        [
          {
            text: 'Get Started',
            onPress: () => {
              // Navigate to onboarding/profile setup
              // TODO: Navigate to onboarding wizard when implemented
              navigation.navigate('Home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Signup error:', error);

      let errorMessage = 'Signup failed. Please try again.';

      if (error instanceof AuthError) {
        switch (error.code) {
          case 'INVALID_AGE':
            errorMessage = error.message;
            break;
          case 'PARENTAL_EMAIL_REQUIRED':
            errorMessage = error.message;
            break;
          case 'SUBSCRIPTION_CREATION_FAILED':
            errorMessage = 'Failed to activate trial. Please contact support.';
            break;
          case 'WALLET_CREATION_FAILED':
            errorMessage = 'Failed to initialize wallet. Please contact support.';
            break;
          default:
            errorMessage = error.message;
        }
      }

      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Join Kids Club+</Text>
          <Text style={styles.subtitle}>Start your 30-day free trial and earn Swap Points!</Text>
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
          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailInputRef}
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="your.email@example.com"
              testID="signup-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="At least 8 characters"
              testID="signup-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!loading}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder="Re-enter password"
              testID="signup-confirm-password-input"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!loading}
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Display Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={[styles.input, errors.displayName && styles.inputError]}
              placeholder="How should we call you?"
              testID="signup-display-name-input"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
            {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}
          </View>

          {/* Age */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age (5-17)</Text>
            <TextInput
              style={[styles.input, errors.age && styles.inputError]}
              placeholder="Your age"
              testID="signup-age-input"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
              editable={!loading}
            />
            {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
          </View>

          {/* ZIP Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ZIP Code</Text>
            <TextInput
              style={[styles.input, errors.zipCode && styles.inputError]}
              placeholder="12345"
              testID="signup-zip-input"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="number-pad"
              maxLength={5}
              autoComplete="postal-code"
              editable={!loading}
            />
            {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
          </View>

          {/* Parental Email (conditional) */}
          {requiresParentalConsent && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Parent/Guardian Email</Text>
              <Text style={styles.helperText}>Required for users under 13 (COPPA compliance)</Text>
              <TextInput
                style={[styles.input, errors.parentalEmail && styles.inputError]}
                placeholder="parent@example.com"
                testID="signup-parent-email-input"
                value={parentalEmail}
                onChangeText={setParentalEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
              {errors.parentalEmail && <Text style={styles.errorText}>{errors.parentalEmail}</Text>}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            testID="signup-submit-button"
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up & Start Trial</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              testID="signup-login-link"
              disabled={loading}
            >
              <Text style={styles.linkText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
