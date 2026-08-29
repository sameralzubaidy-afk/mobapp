// File: p2p-kids-marketplace/src/services/qaPersonas.ts
// QA-ONLY persona registry for the `qa-login-as` deep link (Dev Task 51 item 2).
//
// Collapses the 8–10-tool-call email/password login flow (which repeated 5+
// times per TRD run) into a single deep link: `qa-login-as?persona=<name>`.
//
// SECURITY: these are the documented, non-sensitive per-persona TEST passwords
// already committed in `scripts/seed-staging-data.ts` (TEST_USERS). This module
// is only ever consumed by QaLoginAsDeepLinkHandler, which is gated to dev /
// staging builds only (`__DEV__` or EXPO_PUBLIC_ENVIRONMENT in development/
// staging) — a production build never registers the listener, so these values
// are unreachable in a release build. Reference personas by name in reports,
// never echo credentials.

export interface QaPersona {
  email: string;
  password: string;
}

/**
 * QA persona short-name → credentials. Names mirror the standing personas in
 * /memories/repo/qa-test-accounts.md and TEST_USERS in seed-staging-data.ts.
 * `qa-social-only` is deliberately ABSENT (it is password-less by design — C07
 * fixture, AUTH-TC-C07).
 */
export const QA_PERSONAS: Record<string, QaPersona> = {
  'test-buyer': { email: 'test-buyer@kidsmarketplace.test', password: 'TestBuyer123!' },
  'test-free': { email: 'test-free@kidsmarketplace.test', password: 'TestFree123!' },
  'test-seller': { email: 'test-seller@kidsmarketplace.test', password: 'TestSeller123!' },
  'test-seller-2': { email: 'test-seller-2@kidsmarketplace.test', password: 'TestSeller2123!' },
  'test-seller-3': { email: 'test-seller-3@kidsmarketplace.test', password: 'TestSeller3123!' },
  'test-buyer-2': { email: 'test-buyer-2@kidsmarketplace.test', password: 'TestBuyer2123!' },
  'test-buyer-3': { email: 'test-buyer-3@kidsmarketplace.test', password: 'TestBuyer3123!' },
  'test-grace': { email: 'test-grace@kidsmarketplace.test', password: 'TestGrace123!' },
  'test-suspended': { email: 'test-suspended@kidsmarketplace.test', password: 'TestSuspended123!' },
  'test-admin': { email: 'test-admin@kidsmarketplace.test', password: 'TestAdmin123!' },
  'qa-deleted': { email: 'qa-deleted@kidsmarketplace.test', password: 'TestDeleted123!' },
  'qa-no-profile': { email: 'qa-no-profile@kidsmarketplace.test', password: 'TestNoProfile123!' },
  'qa-linked-provider': { email: 'qa-linked-provider@kidsmarketplace.test', password: 'TestLinked123!' },
};

export function getQaPersona(name: string): QaPersona | null {
  return QA_PERSONAS[name] ?? null;
}
