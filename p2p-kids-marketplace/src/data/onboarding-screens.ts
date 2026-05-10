// FILE: p2p-kids-marketplace/src/data/onboarding-screens.ts
// MODULE-18 V1 EDU-004: Onboarding carousel screen definitions
// STATIC content — admin-controlled sections live in DB; this is fallback for first-run

import type { SectionType } from '../types/education';

export interface OnboardingScreenData {
  id: number;
  title: string;
  body: string;
  illustrationName: string; // Asset filename (in src/assets/onboarding/)
  sectionType?: SectionType; // Optional DB section override
  a11yLabel: string; // Accessibility label for screen reader
}

/**
 * Five onboarding screens shown on first app open
 * Screens 2–4 pull body from DB via getSectionByType() if available
 * Screen 5 (safety) also pulls from DB
 */
export const ONBOARDING_SCREENS: readonly OnboardingScreenData[] = [
  {
    id: 1,
    title: 'Welcome to a safe, neighborhood marketplace built exclusively for local families.',
    body: 'Join a trusted community where you can easily buy and sell pre-loved items with people you know and count on.',
    illustrationName: 'welcome.png',
    a11yLabel: 'Onboarding, step 1 of 5, Welcome to a safe neighborhood marketplace',
  },
  {
    id: 2,
    title: 'What are Pass It Up Points?',
    body: 'Pass It Up Points are rewards you earn when you sell items at a discounted price.\n\nUse your points to get discounts when you buy—just like airline miles, but for great finds in your community.',
    illustrationName: 'swap-points-intro.png',
    a11yLabel: 'Onboarding, step 2 of 5, What are Pass It Up Points',
  },
  {
    id: 3,
    title: 'How You Earn PIPs ( Pass It Up Pionts)',
    body: 'List your items and choose to get paid in cash or a mix of cash and PIPs to maximize your value. Boost your earnings with category multipliers and complete seamless local trades with other parents to grow your balance.',
    illustrationName: 'onboarding-sp-earning.png',
    a11yLabel: 'Onboarding, step 3 of 5, How You Earn PIPs',
  },
  {
    id: 4,
    title: 'How You Spend SP',
    body: "Use up to 70% of an item's price in SP (varies by category). You'll always pay a small cash fee to keep the platform safe.",
    illustrationName: 'spending-sp.png',
    sectionType: 'sp_spending',
    a11yLabel: 'Onboarding, step 4 of 5, How You Spend SP',
  },
  {
    id: 5,
    title: 'Safety First!',
    body: 'We check items for recalls, moderate listings, and keep your info private. Trade safely and respectfully.',
    illustrationName: 'safety.png',
    sectionType: 'safety',
    a11yLabel: 'Onboarding, step 5 of 5, Safety First',
  },
] as const;

/**
 * Total number of onboarding screens
 */
export const ONBOARDING_SCREEN_COUNT = ONBOARDING_SCREENS.length;
