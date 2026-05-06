// File: p2p-kids-marketplace/src/components/ui/OTPInput.tsx
// Design System: OTP Input Component (Whisk-inspired single auto-formatted field)
// Reference: Prompts/re-desing/design-system.md Section 6.3

import React, { useState, useRef, useEffect } from 'react';
import {
  TextInput,
  StyleSheet,
  View,
} from 'react-native';
import { theme } from '@/theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  error?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error = false,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChangeText = (text: string) => {
    // Only allow digits
    const digits = text.replace(/[^0-9]/g, '');
    // Limit to specified length
    const trimmed = digits.slice(0, length);
    onChange(trimmed);
  };

  // Format display: "1 2 3 4 5 6" with spacing between digits
  const formatDisplayValue = (val: string): string => {
    return val.split('').join(' ');
  };

  const inputStyle = [
    styles.input,
    isFocused && styles.inputFocused,
    error && styles.inputError,
  ];

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={inputStyle}
        keyboardType="number-pad"
        maxLength={length * 2 - 1} // Account for spaces in display
        value={formatDisplayValue(value)}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        selectTextOnFocus
        autoFocus
        testID="otp-input"
        placeholder="0 0 0 0 0 0"
        placeholderTextColor="#999"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  input: {
    height: 52,
    backgroundColor: '#F0F0F0', // Filled style
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    letterSpacing: 10,
    textAlign: 'center',
    color: theme.textColors.primary,
  },

  inputFocused: {
    backgroundColor: '#E8E8E8',
  },

  inputError: {
    backgroundColor: '#FFE8E8', // Light red tint
  },
});
