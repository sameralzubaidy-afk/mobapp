// File: p2p-kids-marketplace/src/components/shared/Button.tsx
// MODULE-15.1: Whisk-inspired Button component (D-008)
// Design: pill-shaped (borderRadius = height/2), 52px primary, 48px medium, 40px small

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const height = size === 'large' ? 52 : size === 'medium' ? 48 : 40;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { height, borderRadius: height / 2 },
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : '#5DBB8E'}
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.label,
              styles[`${variant}Label` as keyof typeof styles],
              icon ? styles.labelWithIcon : undefined,
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Variants
  primary: {
    backgroundColor: '#5DBB8E',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#5DBB8E',
  },
  danger: {
    backgroundColor: '#E85D75',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  // Labels
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  primaryLabel: {
    // WCAG AA: #1A1A1A on #5DBB8E = 7.43:1 ✅ (white = 2.34:1 ❌)
    color: '#1A1A1A',
  },
  secondaryLabel: {
    color: '#5DBB8E',
  },
  dangerLabel: {
    color: '#FFFFFF',
  },
  ghostLabel: {
    color: '#5DBB8E',
  },
  labelWithIcon: {
    marginLeft: 8,
  },
  // States
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
