// File: p2p-kids-marketplace/src/theme/shadows.ts
// Design System: Elevation & Shadow Tokens
// Reference: Prompts/re-desing/design-system.md Section 8

import { ViewStyle } from 'react-native';

export const shadows = {
  // Level 0: Flat (no shadow)
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ViewStyle,

  // Level 1: Cards, inputs
  level1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,

  // Level 2: Modals, bottom sheets
  level2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  } as ViewStyle,

  // Level 3: FAB, overlays
  level3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  } as ViewStyle,
} as const;

// Border radius tokens
export const borderRadius = {
  small: 8,      // Badges, pills, tags
  medium: 12,    // Buttons, inputs, small cards
  large: 16,     // Main cards, item cards
  extraLarge: 20, // Modals, bottom sheets
  pill: 999,     // Pill-shaped elements (search bar)
  circle: 9999,  // Avatars, icon buttons
} as const;

export type ShadowToken = typeof shadows;
export type BorderRadiusToken = typeof borderRadius;
