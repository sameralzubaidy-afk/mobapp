// File: supabase/functions/_shared/refund-decision.ts
//
// FIX-Task-32 item 3 (2026-09-14) — the void-vs-refund discriminator, extracted so
// it is covered by an ALWAYS-RUNNING pure unit test.
//
// WHY THIS EXISTS
// ---------------
// `trade-refund` gets the Stripe half right: when the PaymentIntent is still an
// UNCAPTURED authorization hold it cancels the hold (never capture-then-refund).
// But it then recorded the ledger leg as a REFUND unconditionally, which:
//   * inflated `payments.refunded_*` and set `derived_state='partially_refunded'`
//     for money that was never charged; and
//   * forwarded the tax leg to `rpc_record_stripe_refund`, which refuses a
//     `quoted` tax record but STILL stamps `stripe_refund_id`,
//     `refunded_at` and `reconciliation_status='needs_review'` — leaving the tax
//     `quoted` forever and raising a spurious reconciliation row.
//
// The correct discriminator already ships in this repo: `admin-trade-action` and
// `resolve-dispute` branch on the `cancelled_` prefix of the Stripe refund id and
// VOID instead. `trade-refund` was the one writer missing it.
//
// Keeping the decision in a pure function means the regression test runs in the
// default test suite (no staging, no Stripe, no feature flag) — the previous
// gap was only observable through a live uncaptured-PI drive.

/** Which ledger leg a refund request must take. */
export type RefundLedgerLeg = "void_uncaptured" | "record_refund";

/**
 * Sentinels `trade-refund` / `admin-trade-action` use to mark a Stripe
 * PaymentIntent CANCELLATION rather than a refund (`cancelled_<pi_id>`).
 */
export const CANCELLED_REFUND_ID_PREFIX = "cancelled_";

/**
 * The Stripe action `trade-refund` assigns when it cancelled an uncaptured
 * authorization hold.
 */
export const STRIPE_ACTION_CANCELLED_UNCAPTURED = "cancelled_uncaptured";

/**
 * True when a Stripe refund id is really a CANCELLATION sentinel — i.e. the money
 * was never captured, so nothing may be booked as refunded. Mirrors the
 * fail-closed guard now enforced inside `rpc_record_payment_refund`
 * (`REFUND_ON_CANCELLED_PI`), so the client-side branch and the DB guard agree.
 */
export function isCancelledRefundId(
  refundId: string | null | undefined,
): boolean {
  return (
    typeof refundId === "string" &&
    refundId.startsWith(CANCELLED_REFUND_ID_PREFIX)
  );
}

/**
 * FIX-Task-32 item 3 — which ledger leg to take for a refund request.
 *
 * `cancelled_uncaptured` = the PI was cancelled while still an uncaptured
 * authorization hold ⇒ VOID (void the tax record, mark the payment row cancelled,
 * write NO `refunded_*` totals).
 *
 * EVERY other action keeps the pre-existing recorded-refund path, unchanged:
 *   * `refunded` — a real partial Stripe refund of captured money;
 *   * `skip`     — `issue_refund: false` but a PI exists (DB-side record only);
 *   * `no_pi`    — a zero-cash / donate trade with no PI (DB-side record only);
 *   * `none`     — the PI was already cancelled/void at Stripe (noop).
 * This function deliberately does NOT reinterpret those cases — it only closes
 * the uncaptured-void hole the owner decision (2026-09-13) requires.
 */
export function classifyRefundLedgerLeg(stripeAction: string): RefundLedgerLeg {
  return stripeAction === STRIPE_ACTION_CANCELLED_UNCAPTURED
    ? "void_uncaptured"
    : "record_refund";
}

/** True when the void leg should also be used, judged from the refund id alone. */
export function shouldVoidFromRefundId(
  stripeAction: string,
  refundId: string | null | undefined,
): boolean {
  return (
    classifyRefundLedgerLeg(stripeAction) === "void_uncaptured" ||
    isCancelledRefundId(refundId)
  );
}
