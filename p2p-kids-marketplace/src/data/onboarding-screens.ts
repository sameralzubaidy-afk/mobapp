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
    title: 'Welcome to P2P Kids Marketplace!',
    body: 'A safe space for kids to trade items, learn entrepreneurship, and earn Swap Points.',
    illustrationName: 'welcome.png',
    a11yLabel: 'Onboarding, step 1 of 5, Welcome to P2P Kids Marketplace',
  },
  {
    id: 2,
    title: 'What are Swap Points?',
    body: 'Swap Points (SP) are rewards you earn when selling items. Use them to buy things you want!',
    illustrationName: 'swap-points-intro.png',
    sectionType: 'sp_definition',
    a11yLabel: 'Onboarding, step 2 of 5, What are Swap Points',
  },
  {
    id: 3,
    title: 'How You Earn SP',
    body: 'Earn SP by selling items. Different item categories earn different amounts - check the SP calculator!',
    illustrationName: 'earning-sp.png',
    sectionType: 'sp_earning',
    a11yLabel: 'Onboarding, step 3 of 5, How You Earn SP',
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
