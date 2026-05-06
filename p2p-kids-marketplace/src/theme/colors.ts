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
    700: '#4D4D4D', // Secondary text
    500: '#808080', // Tertiary text, placeholders
    300: '#CCCCCC', // Borders, dividers
    100: '#F5F5F5', // Light backgrounds, cards
    50: '#FAFAFA', // Page backgrounds
    white: '#FFFFFF', // Card backgrounds, modals
  },

  // Semantic Colors
  success: {
    500: '#4CAF50', // Success messages, completed trades
    100: '#E8F5E9', // Success banner backgrounds
  },

  warning: {
    500: '#FFA726', // Caution, pending actions
    100: '#FFF3E0', // Warning banner backgrounds
  },

  error: {
    500: '#E53935', // Error messages, CPSC recalls
    100: '#FFEBEE', // Error banner backgrounds
  },

  info: {
    500: '#29B6F6', // Informational messages
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
  page: colors.neutral[50],
  card: colors.neutral.white,
  input: colors.neutral.white,
  inputDisabled: colors.neutral[100],
  overlay: 'rgba(0, 0, 0, 0.4)',
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
