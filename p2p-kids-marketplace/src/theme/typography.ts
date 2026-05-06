// File: p2p-kids-marketplace/src/theme/typography.ts
// Design System: Typography Tokens
// Reference: Prompts/re-desing/design-system.md Section 3

import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

// Fallback to system fonts if Inter is not loaded
export const fontFamilyFallback = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

export const typography = {
  // Headings
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.25,
  } as TextStyle,

  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0,
  } as TextStyle,

  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0,
  } as TextStyle,

  // Body Text
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  } as TextStyle,

  body: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  } as TextStyle,

  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  } as TextStyle,

  // UI Elements
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0.5,
  } as TextStyle,

  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.medium,
    letterSpacing: 0.5,
  } as TextStyle,

  caption: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  } as TextStyle,
} as const;

export type TypographyToken = typeof typography;
