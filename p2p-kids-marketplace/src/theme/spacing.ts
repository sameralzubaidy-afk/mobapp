// File: p2p-kids-marketplace/src/theme/spacing.ts
// Design System: Spacing Tokens (8px Grid System)
// Reference: Prompts/re-desing/design-system.md Section 4

export const spacing = {
  xs: 4,    // Icon padding, tight gaps
  sm: 8,    // Compact spacing, button padding (vertical)
  md: 16,   // Default spacing, card padding, button padding (horizontal)
  lg: 24,   // Section spacing, modal padding
  xl: 32,   // Page margins, large section gaps
  xxl: 40,  // Extra large gaps (rare)
} as const;

// Component-specific spacing
export const componentSpacing = {
  pageMargin: spacing.md,       // 16px left/right page margins
  cardPadding: spacing.md,      // 16px internal card padding
  sectionGap: spacing.lg,       // 24px between sections
  inputVertical: spacing.sm,    // 8px vertical padding in inputs
  inputHorizontal: spacing.md,  // 16px horizontal padding in inputs
  buttonVertical: spacing.sm,   // 8px vertical padding in buttons (small)
  buttonHorizontal: spacing.md, // 16px horizontal padding in buttons
} as const;

// Touch targets (WCAG AA compliance)
export const touchTarget = {
  minimum: 44,    // Minimum 44x44 touch target
  preferred: 48,  // Preferred 48x48 touch target
  gap: spacing.sm, // Minimum 8px gap between targets
} as const;

// Component sizing
export const componentSize = {
  buttonLarge: 56,      // Primary CTA buttons
  buttonMedium: 48,     // Secondary action buttons
  buttonSmall: 40,      // Tertiary, inline actions
  inputHeight: 48,      // Text input height
  textareaMinHeight: 96, // Textarea minimum height
  avatarSmall: 32,
  avatarMedium: 48,
  avatarLarge: 64,
  iconSmall: 16,
  iconMedium: 20,
  iconDefault: 24,
  iconLarge: 32,
  iconHero: 48,
  tabBarHeight: 64,
  headerHeight: 56,
} as const;

export type SpacingToken = typeof spacing;
