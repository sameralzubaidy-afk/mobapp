/**
 * File: p2p-kids-marketplace/src/theme/discoveryTokens.ts
 * DISCOVER-REDESIGN: Discover screen + Filters sheet design tokens
 *
 * Sourced from the CANONICAL design system docx/design-system-passitup.md
 * (colors §1, typography §2, spacing §3). Per the design-system QA audit
 * (2026-08-17), the color palette was reconciled against passitup (primary
 * #5DBB8E) and now matches the global app theme (src/theme/colors.ts) exactly,
 * so Discover no longer drifts from the canonical brand palette.
 *
 * This file stays separate from colors.ts only so Discover-scoped component
 * specs (radii, type scale, shadow) live in one import — its COLOR values MUST
 * NOT diverge from design-system-passitup.md / colors.ts.
 *
 * Do NOT add ad hoc colors/font sizes/radii in Discover components — import from
 * here. See design-system-passitup.md §4 (Buttons, Pills, Badges) for specs.
 */

// ─── Colors (design-system-passitup.md §1 — matches src/theme/colors.ts) ─────
export const ds = {
  primary: {
    500: '#5DBB8E', // Primary 500 (passitup Whisk green)
    600: '#4DAA7A', // Primary 600 (pressed)
    400: '#7FCAA3', // Primary 400 (light variant / border)
    100: '#E8F5F0', // Primary 100 (tint)
  },
  accent: {
    500: '#FF8C42', // Accent 500 (notifications, badges)
    100: '#FFF4ED', // Accent 100
  },
  sp: {
    500: '#F59E0B', // SP Gold 500
    100: '#FEF3C7', // SP Gold 100
  },
  neutral: {
    900: '#1A1A1A', // Primary text
    700: '#6B6B6B', // Secondary text
    500: '#999999', // Tertiary text / placeholder
    300: '#E0E0E0', // Borders / drag handle / disabled track
    100: '#F0F0F0', // Backgrounds / input fill
    50: '#FAFAFA', // Page background
    white: '#FFFFFF',
  },
} as const;

// ─── Radii (design-system-passitup.md — pill/buttons/inputs) ─────────────────
export const dsRadii = {
  small: 8, // pills, badges
  medium: 12, // buttons, inputs
  large: 16, // cards
  xlarge: 20, // sheets, modals
  pill: 999,
} as const;

// ─── Typography (design-system-passitup.md §2 — system fonts) ────────────────
export const dsType = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5 },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: 0 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.5 },
} as const;

// ─── Shadow Level 1 (cards) — design-system-passitup.md ──────────────────────
export const dsShadowL1 = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;
