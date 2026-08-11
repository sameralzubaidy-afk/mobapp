/**
 * File: p2p-kids-marketplace/src/theme/discoveryTokens.ts
 * DISCOVER-REDESIGN: Discover screen + Filters sheet design tokens
 *
 * Sourced EXACTLY from docx/design-system.md (colors §2, spacing §4.1, radii §8.2,
 * typography §3.2, shadow Level 1). Per product decision (2026-08-11), the
 * Discover-scoped UI follows design-system.md literally and intentionally differs
 * from the global app theme (src/theme/colors.ts) — the global theme is unchanged.
 *
 * Do NOT add ad hoc colors/font sizes/radii in Discover components — import from
 * here. See design-system.md §6.1 (Icon Button), §6.2 (Item Card), §6.4 (Bottom
 * Sheet Modal), §6.7 (Badges & Pills / SP Badge) for component specs.
 */

// ─── Colors (design-system.md §2) ────────────────────────────────────────────
export const ds = {
  primary: {
    500: '#4A7C59', // Primary 500
    600: '#3A5F47', // Primary 600 (pressed)
    400: '#6B9B7A', // Primary 400 (border)
    100: '#E8F3EC', // Primary 100 (tint)
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
    700: '#4D4D4D', // Secondary text
    500: '#808080', // Tertiary text / placeholder
    300: '#CCCCCC', // Borders
    100: '#F5F5F5', // Backgrounds
    50: '#FAFAFA', // Page background
    white: '#FFFFFF',
  },
} as const;

// ─── Radii (design-system.md §8.2) ───────────────────────────────────────────
export const dsRadii = {
  small: 8, // pills, badges
  medium: 12, // buttons, inputs
  large: 16, // cards
  xlarge: 20, // sheets, modals
  pill: 999,
} as const;

// ─── Typography (design-system.md §3.2 — Inter) ──────────────────────────────
export const dsType = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: 0 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.5 },
} as const;

// ─── Shadow Level 1 (cards) — design-system.md §8.2 ──────────────────────────
export const dsShadowL1 = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;
