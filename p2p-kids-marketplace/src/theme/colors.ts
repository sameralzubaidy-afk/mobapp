// File: p2p-kids-marketplace/src/theme/colors.ts
// Design System: Color Tokens
// Reference: Prompts/re-desing/design-system.md Section 2

export const colors = {
  // Primary Colors (Brand - Whisk-inspired Green)
  primary: {
    500: '#5DBB8E', // Main brand color (Whisk green)
    400: '#7FCAA3', // Light variant (hover states)
    600: '#4DAA7A', // Dark variant (pressed states)
    100: '#E8F5F0', // Tint (subtle backgrounds)
  },

  // Accent Colors (Energy & Action - Warm Orange)
  accent: {
    500: '#FF8C42', // Main accent
    400: '#FFB380', // Light variant
    600: '#E67A2E', // Dark variant
    100: '#FFF4ED', // Tint (notifications, badges)
  },

  // Secondary Colors (Supporting - Calm Blue)
  secondary: {
    500: '#5B8FB9', // Information, links, messages
    400: '#7BA9CC',
    600: '#4A7699',
    100: '#EBF4F9',
  },

  // Neutral Colors (Text & UI Elements)
  neutral: {
    900: '#1A1A1A', // Primary text
    700: '#6B6B6B', // Secondary text — MODULE-15.1 spec
    500: '#999999', // Tertiary text, placeholders — MODULE-15.1 spec
    300: '#CCCCCC', // Borders, dividers
    200: '#E0E0E0', // Subtle borders
    100: '#F0F0F0', // Input fill — MODULE-15.1 spec
    50:  '#F7F7F7', // Stats / section backgrounds
    white: '#FFFFFF', // Card backgrounds, modals
  },

  // Semantic Colors
  success: {
    500: '#5DBB8E', // Success messages, completed trades — canonical brand green (design-system §1)
    100: '#E8F5E9', // Success banner backgrounds
  },

  // Warning scale. 500/100 are the canonical design-system steps (design-system §1).
  // The 900/800/400 steps are the dark-TEXT and border variants for amber-tinted
  // surfaces — the design system previously defined only the light 500/100 steps, so
  // screens had no token for dark text on an amber card and fell back to one-off
  // Tailwind amber hexes (FIX-Task-49 item 2). Contrast ratios are WCAG AA measured
  // against the amber card surface #FEF3C7; see design-system §1 "Warning — Dark Text
  // & Borders on Tinted Surfaces".
  warning: {
    900: '#78350F', // Dark warning text — body/labels on #FEF3C7 · 8.15:1 (AA)
    800: '#92400E', // Dark warning text — titles/emphasis on #FEF3C7 · 6.37:1 (AA)
    500: '#FFA726', // Caution, pending actions
    400: '#FBBF24', // Warning borders/dividers on amber-tinted cards (non-text)
    100: '#FFF3E0', // Warning banner backgrounds
  },

  error: {
    500: '#E85D75', // Error messages, CPSC recalls — MODULE-15.1 spec
    100: '#FFF0F2', // Error banner backgrounds
  },

  info: {
    500: '#5B8FB9', // Informational messages — canonical info blue (design-system §1)
    100: '#E1F5FE', // Info banner backgrounds
  },

  // Swap Points Brand Color
  sp: {
    500: '#F59E0B', // SP currency indicator (gold)
    100: '#FEF3C7', // SP balance backgrounds
  },
} as const;

// Text color roles
export const textColors = {
  primary: colors.neutral[900],
  secondary: colors.neutral[700],
  tertiary: colors.neutral[500],
  link: colors.secondary[500],
  error: colors.error[500],
  success: colors.success[500],
  onPrimary: colors.neutral.white,
  onAccent: colors.neutral.white,
} as const;

// Background color roles
export const backgroundColors = {
  page:          '#F7F7F7',
  card:          colors.neutral.white,
  input:         colors.neutral[100], // #F0F0F0 filled input bg
  inputFocused:  '#E8F5F0',
  inputDisabled: '#F5F5F5',
  overlay:       'rgba(0, 0, 0, 0.4)',
} as const;

// Border color roles
export const borderColors = {
  default: colors.neutral[300],
  focus: colors.primary[500],
  error: colors.error[500],
  divider: colors.neutral[300],
  subtle: colors.neutral[100],
} as const;

export type ColorToken = typeof colors;
