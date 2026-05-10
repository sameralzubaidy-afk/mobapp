// File: p2p-kids-marketplace/src/components/auth/SetPasswordModal.tsx
// MODULE-03 AUTH-V3-008: Password creation modal for social-only users

import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setPasswordForSocialUser, validatePasswordStrength } from '@/services/passwordService';

interface SetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testID?: string;
}

/**
 * Set password modal for social-only users
 * Allows users to add password as backup login method
 *
 * Features:
 * - Live password strength validation
 * - Strength meter visual indicator
 * - Submit disabled until password is strong enough
 */
export default function SetPasswordModal({
  visible,
  onClose,
  onSuccess,
  testID = 'set-password-modal',
}: SetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strengthResult, setStrengthResult] = useState<{
    valid: boolean;
    reasons: string[];
  }>({ valid: false, reasons: [] });

  // Validate password strength on change
  useEffect(() => {
    if (password) {
      const result = validatePasswordStrength(password);
      setStrengthResult(result);
    } else {
      setStrengthResult({ valid: false, reasons: [] });
    }
  }, [password]);

  const getStrengthColor = (): string => {
    if (!password) return '#E0E0E0';
    if (strengthResult.valid) return '#10B981';
    if (password.length >= 6) return '#F59E0B';
    return '#E85D75';
  };

  const getStrengthLabel = (): string => {
    if (!password) return 'Enter a password';
    if (strengthResult.valid) return 'Strong password';
    if (password.length >= 6) return 'Weak password';
    return 'Too short';
  };

  const handleSubmit = async () => {
    // Validate
    if (!strengthResult.valid) {
      setError('Please create a stronger password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await setPasswordForSocialUser(password);

      setIsSubmitting(false);
      setPassword('');
      setConfirmPassword('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[SetPasswordModal] Submit error:', err);
      setIsSubmitting(false);
      setError('Failed to set password. Please try again.');
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Set Password</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID={`${testID}-close`}
            >
              <Ionicons name="close" size={24} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.description}>
              Add a password to your account as a backup login method.
            </Text>

            {/* Password Input */}
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  editable={!isSubmitting}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="New password"
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

              {/* Strength Meter */}
              <View style={styles.strengthMeter}>
                <View style={[styles.strengthBar, { backgroundColor: getStrengthColor() }]} />
                <Text style={[styles.strengthLabel, { color: getStrengthColor() }]}>
                  {getStrengthLabel()}
                </Text>
              </View>

              {/* Strength Requirements */}
              {password && !strengthResult.valid && (
                <View style={styles.requirements}>
                  {strengthResult.reasons.map((reason, index) => (
                    <View key={index} style={styles.requirement}>
                      <Ionicons name="close-circle" size={16} color="#DC2626" />
                      <Text style={styles.requirementText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError(null);
                  }}
                  editable={!isSubmitting}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Confirm password"
                  testID={`${testID}-confirm-input`}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6B6B6B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!strengthResult.valid || isSubmitting) && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={!strengthResult.valid || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Set password"
              testID={`${testID}-submit`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Set Password</Text>
              )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#6B6B6B',
    marginBottom: 24,
    lineHeight: 24,
  },
  field: {
    marginBottom: 24,
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
  strengthMeter: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirements: {
    marginTop: 12,
    gap: 6,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requirementText: {
    fontSize: 12,
    color: '#E85D75',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#E85D75',
    flex: 1,
  },
  actions: {
    padding: 20,
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
});
