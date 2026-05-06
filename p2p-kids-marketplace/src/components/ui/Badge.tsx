// File: p2p-kids-marketplace/src/components/ui/Badge.tsx
// Design System: Badge Component (Status Pills & SP Badges)
// Reference: Prompts/re-desing/design-system.md Section 6.7

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/theme';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'sp';

interface BadgeProps {
  variant?: BadgeVariant;
  children: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  style,
  textStyle,
}) => {
  const badgeStyle = [styles.base, styles[variant], style];
  const textStyleCombined = [styles.text, styles[`${variant}Text`], textStyle];

  return (
    <View style={badgeStyle}>
      <Text style={textStyleCombined}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 24,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },

  text: {
    ...theme.typography.label,
  },

  // Variants
  success: {
    backgroundColor: theme.colors.success[500],
  },

  successText: {
    color: theme.textColors.onPrimary,
  },

  warning: {
    backgroundColor: theme.colors.warning[500],
  },

  warningText: {
    color: theme.textColors.onPrimary,
  },

  error: {
    backgroundColor: theme.colors.error[500],
  },

  errorText: {
    color: theme.textColors.onPrimary,
  },

  neutral: {
    backgroundColor: theme.colors.neutral[500],
  },

  neutralText: {
    color: theme.textColors.onPrimary,
  },

  sp: {
    backgroundColor: theme.colors.sp[100],
    borderWidth: 1,
    borderColor: theme.colors.sp[500],
  },

  spText: {
    color: theme.colors.sp[500],
  },
});
