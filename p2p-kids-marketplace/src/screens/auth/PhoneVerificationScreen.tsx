// File: src/screens/auth/PhoneVerificationScreen.tsx
// Phone verification screen for verifying user phone number via SMS code

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/verification';

interface RouteParams {
  userId: string;
  phone: string;
}

export default function PhoneVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, phone } = route.params as RouteParams;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Refs for TextInputs to manage focus
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Auto-send code on mount
  useEffect(() => {
    handleResendCode();
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
    const result = await sendPhoneVerificationCode(userId, phone);
    setResending(false);

    if (result.success) {
      Alert.alert(
        'Code Sent',
        `A verification code has been sent to ${phone}\n\n🧪 For testing, use code: 123456`
      );
      setCountdown(60); // 60 second cooldown
    } else {
      Alert.alert('Error', result.error || 'Failed to send verification code');
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && text && newCode.every(digit => digit)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Handle backspace
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const verificationCode = codeToVerify || code.join('');

    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);

    const result = await verifyPhoneCode(userId, phone, verificationCode);

    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Success!',
        'Your phone number has been verified. Let\'s complete your profile!',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to ProfileSetup screen (consolidated profile + zip code setup)
              (navigation as any).navigate('ProfileSetup', { userId });
            },
          },
        ]
      );
    } else {
      Alert.alert('Verification Failed', result.error || 'Invalid code');
      // Clear code inputs on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Phone</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{phone}</Text>
          </Text>

          <Text style={styles.testNote}>
            🧪 For testing, use code: <Text style={styles.testCode}>123456</Text>
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref: TextInput | null) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || code.some(digit => !digit)}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

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
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  phone: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  testNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  testCode: {
    fontWeight: 'bold',
    color: '#ff6b35',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  codeInputFilled: {
    borderColor: '#ff6b35',
    backgroundColor: '#fff5f2',
  },
  verifyButton: {
    backgroundColor: '#ff6b35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ffa07a',
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  resendButton: {
    fontSize: 14,
    color: '#ff6b35',
    fontWeight: '600',
  },
  resendButtonDisabled: {
    color: '#ccc',
  },
  changeNumberButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  changeNumberText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
});
