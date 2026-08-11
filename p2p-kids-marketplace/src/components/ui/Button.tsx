// File: p2p-kids-marketplace/src/components/ui/Button.tsx
// Design System: Button Component
// Reference: Prompts/re-desing/design-system.md Section 6.1

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { theme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'text';
export type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  children,
  style,
  textStyle,
  ...props
}) => {
  const buttonStyle = [
    styles.base,
    styles[variant],
    styles[`${size}Size`],
    disabled && styles.disabled,
    style,
  ];

  const textStyleCombined = [
    styles.baseText,
    styles[`${variant}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessible
      accessibilityRole="button"
      accessibilityLabel={children}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'text' ? theme.colors.secondary[500] : theme.textColors.onPrimary}
        />
      ) : (
        <Text style={textStyleCombined}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.none,
  },

  // Variants
  primary: {
    backgroundColor: theme.colors.primary[500],
  },

  secondary: {
    backgroundColor: theme.backgroundColors.card,
    borderWidth: 2,
    borderColor: theme.colors.primary[500],
  },

  accent: {
    backgroundColor: theme.colors.accent[500],
  },

  text: {
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.sm,
  },

  // Sizes (Pill-shaped: borderRadius = height/2)
  largeSize: {
    height: 52,
    borderRadius: 26, // height/2 for pill shape
    paddingHorizontal: theme.componentSpacing.buttonHorizontal,
  },

  mediumSize: {
    height: 48,
    borderRadius: 24, // height/2 for pill shape
    paddingHorizontal: theme.componentSpacing.buttonHorizontal,
  },

  smallSize: {
    height: 40,
    borderRadius: 20, // height/2 for pill shape
    paddingHorizontal: theme.spacing.md,
  },

  // Text styles
  baseText: {
    ...theme.typography.button,
    textAlign: 'center',
  },

  primaryText: {
    color: theme.textColors.onPrimary,
  },

  secondaryText: {
    color: theme.colors.primary[500],
  },

  accentText: {
    color: theme.textColors.onAccent,
  },

  textText: {
    color: theme.colors.secondary[500],
    textDecorationLine: 'underline',
  },

  // States
  disabled: {
    backgroundColor: theme.colors.neutral[300],
    borderColor: theme.colors.neutral[300],
  },

  disabledText: {
    color: theme.colors.neutral[500],
  },
});
