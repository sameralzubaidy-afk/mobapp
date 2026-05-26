// File: p2p-kids-marketplace/src/components/shared/TextInput.tsx
// MODULE-15.1: Whisk-inspired filled TextInput component (D-009)
// Design: backgroundColor #F0F0F0, borderRadius 12, height 52, NO borderWidth

import React, { useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  testID?: string;
}

export function TextInput({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  testID,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputFocused,
          error ? styles.inputError : undefined,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <RNTextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            style,
          ]}
          placeholderTextColor="#999999"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          accessibilityLabel={label}
          {...rest}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {!error && hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    marginBottom: 6,
  },
  inputRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  inputFocused: {
    backgroundColor: '#E8F5F0',
  },
  inputError: {
    backgroundColor: '#FFF0F2',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  iconLeft: {
    paddingLeft: 14,
    justifyContent: 'center',
  },
  iconRight: {
    paddingRight: 14,
    justifyContent: 'center',
  },
  error: {
    fontSize: 12,
    color: '#E85D75',
    marginTop: 4,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    marginLeft: 4,
  },
});
