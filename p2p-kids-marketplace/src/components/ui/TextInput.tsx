// File: p2p-kids-marketplace/src/components/ui/TextInput.tsx
// Design System: Text Input Component
// Reference: Prompts/re-desing/design-system.md Section 6.3

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '@/theme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  inputStyle,
  editable = true,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputContainerStyle = [
    styles.inputContainer,
    isFocused && styles.inputFocused,
    error && styles.inputError,
    !editable && styles.inputDisabled,
    inputStyle,
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={inputContainerStyle}
        placeholderTextColor={theme.colors.neutral[500]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        editable={editable}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },

  label: {
    ...theme.typography.label,
    color: theme.textColors.secondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },

  inputContainer: {
    height: 52,
    backgroundColor: '#F0F0F0', // Filled style - light gray background
    borderWidth: 0, // No border in filled style
    borderRadius: 12,
    paddingHorizontal: 16,
    ...theme.typography.body,
    color: theme.textColors.primary,
  },

  inputFocused: {
    backgroundColor: '#E8E8E8', // Slightly darker on focus
  },

  inputError: {
    borderColor: theme.borderColors.error,
    borderWidth: 2,
  },

  inputDisabled: {
    backgroundColor: theme.backgroundColors.inputDisabled,
    color: theme.colors.neutral[500],
  },

  helperText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.secondary,
    marginTop: theme.spacing.xs,
  },

  errorText: {
    ...theme.typography.bodySmall,
    color: theme.textColors.error,
    marginTop: theme.spacing.xs,
  },
});
