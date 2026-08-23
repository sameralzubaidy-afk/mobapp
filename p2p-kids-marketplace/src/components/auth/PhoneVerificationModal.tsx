// File: p2p-kids-marketplace/src/components/auth/PhoneVerificationModal.tsx
// MODULE-03 AUTH-V3-008: 2-step phone verification modal (enter phone → send code → enter code → verify)

import React, { useRef, useEffect } from 'react';
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
import { usePhoneVerification } from '@/hooks/usePhoneVerification';
import { DEV_SMS_BYPASS_CODE } from '@/services/phoneService';

interface PhoneVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When true, modal cannot be dismissed (transaction gate mode) */
  required?: boolean;
  testID?: string;
}

/**
 * Phone verification modal for first-transaction gate
 * Step 1: Enter phone number with country code picker (defaults to +1)
 * Step 2: Enter 6-digit code with auto-advance and resend timer
 *
 * Required mode: NO close/dismiss affordance (user MUST verify to proceed)
 * Optional mode: Shows close button (user can dismiss)
 */
export default function PhoneVerificationModal({
  visible,
  onClose,
  onSuccess,
  required = false,
  testID = 'phone-verification-modal',
}: PhoneVerificationModalProps) {
  const {
    phone,
    code,
    step,
    isSending,
    isVerifying,
    error,
    resendCountdown,
    canResend,
    setPhone,
    setCode,
    sendCode,
    verifyCode,
    reset,
  } = usePhoneVerification();

  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  // Focus phone input when modal opens
  useEffect(() => {
    if (visible && step === 'phone') {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [visible, step]);

  // Auto-focus first code digit when entering code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handlePhoneChange = (text: string) => {
    // Auto-format with E.164 (+1 for US)
    let formatted = text.replace(/[^0-9+]/g, '');

    // Auto-add +1 if user starts typing digits
    if (formatted.length > 0 && !formatted.startsWith('+')) {
      formatted = '+1' + formatted;
    }

    setPhone(formatted);
  };

  const handleSendCode = async () => {
    await sendCode();
  };

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    // Update code
    const newCode = code.split('');
    newCode[index] = digit;
    const updatedCode = newCode.join('').slice(0, 6);
    setCode(updatedCode);

    // Auto-advance to next digit
    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when 6 digits entered
    if (updatedCode.length === 6) {
      handleVerifyCode(updatedCode);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Handle backspace - move to previous digit
    if (key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    // Pass the freshly-typed code through so verification doesn't race React's
    // state flush (auto-verify previously read a stale state.code and failed).
    const success = await verifyCode(codeToVerify);
    if (success) {
      onSuccess();
      reset();
      onClose();
    }
  };

  const handleResend = async () => {
    if (canResend) {
      setCode('');
      await sendCode();
    }
  };

  const handleClose = () => {
    if (!required) {
      reset();
      onClose();
    }
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
            <Text style={styles.title}>
              {step === 'phone' ? 'Verify Your Phone' : 'Enter Verification Code'}
            </Text>
            {!required && (
              <TouchableOpacity
                accessible
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                testID={`${testID}-close`}
              >
                <Ionicons name="close" size={24} color="#6B6B6B" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Step 1: Phone Input */}
            {step === 'phone' && (
              <View style={styles.step}>
                <Text style={styles.description}>
                  {required
                    ? 'Phone verification is required before you can publish listings or make purchases.'
                    : 'Enter your phone number to receive a verification code.'}
                </Text>

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.phoneInput}
                  placeholder="+1 (555) 123-4567"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!isSending}
                  accessibilityLabel="Phone number"
                  testID={`${testID}-phone-input`}
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  accessible
                  style={[styles.primaryButton, isSending && styles.disabledButton]}
                  onPress={handleSendCode}
                  disabled={isSending || phone.length < 10}
                  accessibilityRole="button"
                  accessibilityLabel="Send verification code"
                  testID={`${testID}-send-code`}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Code Input */}
            {step === 'code' && (
              <View style={styles.step}>
                <Text style={styles.description}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={styles.phone}>{phone}</Text>
                </Text>
                <View style={styles.codeContainer}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        codeInputRefs.current[index] = ref;
                      }}
                      style={styles.codeDigit}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={code[index] || ''}
                      onChangeText={(text) => handleCodeChange(text, index)}
                      onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
                      editable={!isVerifying}
                      accessibilityLabel={`Digit ${index + 1}`}
                      accessibilityHint={`Enter digit ${index + 1} of 6`}
                      testID={`${testID}-code-digit-${index}`}
                    />
                  ))}
                </View>
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                accessible
                {/* Resend Timer */}
                <View style={styles.resendContainer}>
                  {canResend ? (
                    <TouchableOpacity
                      accessible
                      onPress={handleResend}
                      accessibilityRole="button"
                      accessibilityLabel="Resend code"
                      testID={`${testID}-resend`}
                    >
                      <Text style={styles.resendText}>Resend Code</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.timerText}>Resend code in {resendCountdown}s</Text>
                  )}
                </View>
                {/* Manual Verify Button (backup if auto-verify fails) */}
                <TouchableOpacity
                  accessible
                  style={[
                    styles.primaryButton,
                    (isVerifying || code.length < 6) && styles.disabledButton,
                  ]}
                  onPress={() => handleVerifyCode()}
                  disabled={isVerifying || code.length < 6}
                  accessibilityRole="button"
                  accessibilityLabel="Verify code"
                  testID={`${testID}-verify`}
                >
                  {isVerifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
                {/* DEV-ONLY: auto-fill + verify the fixed dev bypass code in one
                    tap, so QA never has to type the 6 digits one at a time (the
                    auto-advance input drops bulk-pasted characters). Never
                    rendered in release builds (__DEV__ false). */}
                {__DEV__ && (
                  <TouchableOpacity
                    style={styles.devAutofillButton}
                    onPress={() => {
                      setCode(DEV_SMS_BYPASS_CODE);
                      void handleVerifyCode(DEV_SMS_BYPASS_CODE);
                    }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Autofill dev verification code ${DEV_SMS_BYPASS_CODE}`}
                    testID={`${testID}-dev-autofill`}
                  >
                    <Text style={styles.devAutofillButtonText}>
                      Dev: Autofill &amp; Verify ({DEV_SMS_BYPASS_CODE})
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Back to Phone */}
                <TouchableOpacity
                  accessible
                  onPress={() => {
                    setCode('');
                    reset();
                  }}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Change phone number"
                  testID={`${testID}-back`}
                >
                  <Text style={styles.backText}>Change Phone Number</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
  step: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  phone: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  phoneInput: {
    height: 56,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F0F0F0',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  codeDigit: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A1A1A',
    backgroundColor: '#F0F0F0',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  primaryButton: {
    height: 56,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  devAutofillButton: {
    height: 48,
    backgroundColor: '#EAF7F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  devAutofillButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  timerText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
  },
});
