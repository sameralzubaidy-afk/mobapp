// File: p2p-kids-marketplace/src/services/subscriptionStatus.ts
// FIX-Task-53 item 3 (2026-09-17): the canonical subscription-status predicates.
//
// WHY THIS IS ITS OWN MODULE
// These are PURE functions with no I/O, and they are called during render. Living
// inside `services/subscription.ts` meant every test that auto-mocks that I/O module
// (`jest.mock('@/services/subscription')`) turned them into `jest.fn()` returning
// `undefined` — silently disabling the SP control for EVERY status, which passes
// review and ships (BP-94). Keeping them in a dependency-free module makes them
// un-mockable by accident and removes the whole class of failure.
//
// WHY PREDICATES AND NOT LITERAL LISTS
// `subscriptions.status` legally admits TWO spellings of the grace state
// ('grace_period' canonical, 'grace' legacy — the CHECK constraint allows both, and
// FIX-Task-51 normalized the last legacy row). Ad-hoc literal lists then drifted:
// `TradeOfferScreen` accepted `'grace'` but not `'grace_period'`, so a grace buyer
// was shown the member fee and a "Join Kids Club+" upsell instead of the SP control
// (item 1 of FIX-Task-53). One predicate per SEMANTIC, never re-inline the literals.
//
// Do NOT collapse these into one list — membership benefits, the buyer-fee tier and
// the SP entitlement are three DIFFERENT server rules that merely look alike.

/** Both legal spellings of the grace state (BP-76 / FIX-Task-51). */
export function isGraceStatus(status: string | null | undefined): boolean {
  return status === 'grace_period' || status === 'grace';
}

/**
 * Membership BENEFITS — Kids Club+ badge, member surfaces, no "upgrade" prompts.
 * Mirrors the server's `is_subscriber` (`trial, active, paused, cancelled, grace`).
 * Note `canceled` is the legacy spelling of `cancelled`.
 */
export function isSubscriberStatus(status: string | null | undefined): boolean {
  return (
    status === 'trial' ||
    status === 'active' ||
    status === 'paused' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    isGraceStatus(status)
  );
}

/**
 * The buyer-fee engine's `active_member` gate AS DECLARED by the tiered-fee engine —
 * `trial | active` ONLY, mirroring `fn_get_buyer_fee_for_checkout`.
 *
 * Use this (NOT `isSubscriberStatus`) for any FEE fallback or fee label: membership
 * BENEFITS and the FEE tier are two different server rules, and conflating them is a
 * silent-money-bug class.
 *
 * ⚠️ FIX-Task-53 (2026-09-17) — UNRESOLVED DISCREPANCY, do not "fix" it by guessing:
 * the DECLARED gate above says grace is NOT `active_member`, and `subscription.ts`'
 * `getTransactionFee` doc-comment and its unit test agree (`$2.99` for
 * `grace_period`). But driving a real grace buyer on-device returned the MEMBER fee:
 * the Make Offer summary and the created trade's timeline both showed
 * `Safety & Platform Fee $1.49` (= `buyer_fee_active_member_cents`) for
 * `test-grace` (status `grace_period`). So the LIVE resolver appears to include
 * grace, contradicting the migration comment. Which is authoritative is an OWNER
 * DECISION (fee policy), so this helper deliberately keeps the declared gate and the
 * existing fallback behaviour; the discrepancy is reported, not silently resolved.
 */
export function isFeeActiveMemberStatus(status: string | null | undefined): boolean {
  return status === 'trial' || status === 'active';
}

/**
 * May SPEND existing Swap Points — mirrors `fn_get_sp_entitlement` (R6): grace users
 * keep spending and stop earning. The wallet-state half of that rule lives at the
 * call sites (`sp_wallets.state`), because this predicate only sees the status.
 */
export function canSpendSpStatus(status: string | null | undefined): boolean {
  return isSubscriberStatus(status);
}

/**
 * FIX-Task-53 item 1 (2026-09-17): the value to record in
 * `trades.buyer_subscription_status` at checkout.
 *
 * Preserves the established narrowing (only the paying/grace states are recorded;
 * every other status is snapshotted as 'free') while accepting BOTH grace spellings
 * and always writing the canonical one. Before this, the checkouts omitted
 * `'grace_period'`, so a grace buyer's trade was snapshotted 'free' while
 * `trade-payment` recorded the raw status — two writers disagreeing about one fact.
 *
 * The snapshot is INFORMATIONAL: the server resolves the fee from the DB (DT-54 —
 * the client's fee field is ignored) and `buyer_fee_state` carries the tier. It is
 * read by `monitor-mid-trade-subscription-changes` (change detection) and the admin
 * trades views.
 */
export function buyerSubscriptionSnapshotStatus(status: string | null | undefined): string {
  if (isGraceStatus(status)) return 'grace_period';
  if (status === 'active' || status === 'trial') return status;
  return 'free';
}
