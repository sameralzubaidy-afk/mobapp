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
  'test-expired': { email: 'test-expired@kidsmarketplace.test', password: 'TestExpired123!' },
  // DEV-TASK-109 (item 2): standing disposable SP-wallet persona for the
  // freeze/suspend mobile legs (L05/L07/L08, B04) — Kids Club+ active with an
  // admin-freezable wallet. Provision via `npm run qa:wallet-persona -- ensure`.
  'qa-wallet': { email: 'qa-wallet@kidsmarketplace.test', password: 'TestWallet123!' },
  // DEV-TASK-96 (item 7): MSG-TC-A01 empty-inbox persona — full profile, zero
  // conversations (see seedNoConversationPersonaFixture in seed-staging-data.ts).
  'test-noconvo': { email: 'test-noconvo@kidsmarketplace.test', password: 'TestNoConvo123!' },
  'test-suspended': { email: 'test-suspended@kidsmarketplace.test', password: 'TestSuspended123!' },
  'test-admin': { email: 'test-admin@kidsmarketplace.test', password: 'TestAdmin123!' },
  // DEV-TASK-113 (item 4): free genuinely-first-trade persona for F08's remaining
  // leg — created on demand (zero trade history, NO trial/active sub). Provision
  // via `npm run qa:r41-first-trade -- create`; reset via `-- reset`.
  'qa-first-trade': { email: 'qa-first-trade@kidsmarketplace.test', password: 'TestFirstTrade123!' },
  'qa-deleted': { email: 'qa-deleted@kidsmarketplace.test', password: 'TestDeleted123!' },
  'qa-no-profile': { email: 'qa-no-profile@kidsmarketplace.test', password: 'TestNoProfile123!' },
  'qa-linked-provider': {
    email: 'qa-linked-provider@kidsmarketplace.test',
    password: 'TestLinked123!',
  },
};

export function getQaPersona(name: string): QaPersona | null {
  return QA_PERSONAS[name] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Dev Task 77 item 4 — which test-seller owns which Accept-SP item.
//
// QA Task 15 (2026-08-31) logged a wasted persona round-trip: the agent assumed
// "Board Game Set" belonged to test-seller when it is owned by test-seller-2
// (C4 friction, ~5 calls). This map documents seller ownership for the standing
// seed fixtures (TEST_LISTINGS / SELLER2_LISTINGS / QA_POOL_LISTINGS /
// DONATION_LISTING / CASH_ONLY_LISTING in scripts/seed-staging-data.ts) so QA
// can `qa-login-as` the right persona up front instead of guessing.
//
// NOTE: this is a STATIC doc map — if you need certainty about a live listing,
// verify against the DB first (`items.seller_id`), per the QA standing rule
// (R-NEW-4). Titles here mirror the seed constants exactly (case-sensitive).
// ────────────────────────────────────────────────────────────────────────────
export interface QaItemOwnership {
  title: string;
  /** Persona short-name that owns this item (see QA_PERSONAS). */
  seller: string;
  /** Whether the item is SP-eligible at checkout (accepts_swap_points + real category). */
  acceptsSp: boolean;
  note?: string;
}

export const QA_ACCEPT_SP_ITEM_OWNERSHIP: QaItemOwnership[] = [
  // TEST_LISTINGS — test-seller (all Accept SP by default)
  { title: 'Nintendo Switch Games Bundle', seller: 'test-seller', acceptsSp: true },
  { title: 'LEGO Star Wars Set', seller: 'test-seller', acceptsSp: true },
  {
    title: 'Kids Bicycle - 20 inch',
    seller: 'test-seller',
    acceptsSp: true,
    note: 'Sports 75% SP cap (QA Task 15 C1)',
  },
  { title: 'Harry Potter Book Set', seller: 'test-seller', acceptsSp: true },
  { title: 'Basketball', seller: 'test-seller', acceptsSp: true },
  // DONATION / CASH-ONLY — test-seller (NOT SP-eligible)
  {
    title: 'Free Art Supplies',
    seller: 'test-seller',
    acceptsSp: false,
    note: 'Donation (price $0)',
  },
  {
    title: 'Vintage Comic Book Collection',
    seller: 'test-seller',
    acceptsSp: false,
    note: 'Cash only',
  },
  // QA_POOL_LISTINGS — test-seller (all Accept SP)
  { title: 'Remote Control Car', seller: 'test-seller', acceptsSp: true },
  { title: 'Kids Kindle Tablet', seller: 'test-seller', acceptsSp: true },
  { title: 'Soccer Ball & Goal Set', seller: 'test-seller', acceptsSp: true },
  { title: 'Puzzle Set — 4 Pack', seller: 'test-seller', acceptsSp: true },
  { title: 'Roald Dahl Collection', seller: 'test-seller', acceptsSp: true },
  { title: 'Skateboard — Youth', seller: 'test-seller', acceptsSp: true },
  // B08 frozen-chat fixture — test-seller (Accept SP)
  {
    title: 'QA Canned Cancelled-Trade Item',
    seller: 'test-seller',
    acceptsSp: true,
    note: 'TRD-TC-B08 fixture',
  },
  // SELLER2_LISTINGS — test-seller-2 (all Accept SP by default)
  { title: 'Science Kit', seller: 'test-seller-2', acceptsSp: true },
  {
    title: 'Board Game Set',
    seller: 'test-seller-2',
    acceptsSp: true,
    note: 'Owned by test-seller-2, NOT test-seller',
  },
  { title: "Children's Dictionary", seller: 'test-seller-2', acceptsSp: true },
];

/** Returns the documented owner for an item title (exact, case-sensitive match), or null. */
export function getQaItemOwner(title: string): QaItemOwnership | null {
  return QA_ACCEPT_SP_ITEM_OWNERSHIP.find((o) => o.title === title) ?? null;
}
