// File: p2p-kids-marketplace/src/theme/index.ts
// Design System: Unified Theme Export
// Reference: Prompts/re-desing/design-system.md

import { colors, textColors, backgroundColors, borderColors } from './colors';
import { typography, fontFamily } from './typography';
import { spacing, componentSpacing, touchTarget, componentSize } from './spacing';
import { shadows, borderRadius } from './shadows';

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';

// Unified theme object
export const theme = {
  colors,
  textColors,
  backgroundColors,
  borderColors,
  typography,
  fontFamily,
  spacing,
  componentSpacing,
  touchTarget,
  componentSize,
  shadows,
  borderRadius,
} as const;

export type Theme = typeof theme;
