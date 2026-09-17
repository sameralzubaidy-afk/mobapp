/**
 * File: p2p-kids-marketplace/src/utils/memberFeeCopy.ts
 *
 * FIX-Task-47 item 4 (2026-09-16) — ONE place that turns the Kids Club+ flat
 * member fee (`admin_config.buyer_fee_active_member_cents`) into user-facing copy.
 *
 * Why this exists: `getActiveMemberFeeCents()` used to fall back to a hardcoded
 * `149` (and `getDefaultConfig()` supplied the same 149), so a failed config read
 * made every subscription surface advertise a PLAUSIBLE-BUT-WRONG $1.49. Nobody —
 * user or QA — can tell that number is stale, which is strictly worse than saying
 * the value is unavailable. The reader now returns `null` for "could not read it",
 * and every surface renders the same explicit state from here.
 *
 * NOTE: the value is a real cents amount, so `0` is a legitimately configured
 * value and renders as `$0` — it is NOT the unavailable state.
 */

import { formatPrice } from './formatPrice';

/** Shown wherever the flat member fee could not be read. */
export const MEMBER_FEE_UNAVAILABLE = 'Fee unavailable';

/**
 * Type guard + the single definition of "we actually have a live value".
 * `undefined` (key absent from admin_config) and `NaN` (unparsable) are both
 * unavailable; negative values are rejected as nonsense.
 */
export function isMemberFeeAvailable(cents: number | null | undefined): cents is number {
  return typeof cents === 'number' && Number.isFinite(cents) && cents >= 0;
}

/** `$1.49` or `Fee unavailable` — for a value that stands alone. */
export function formatMemberFee(cents: number | null | undefined): string {
  return isMemberFeeAvailable(cents) ? formatPrice(cents) : MEMBER_FEE_UNAVAILABLE;
}

/**
 * `Flat $1.49 Safety & Platform Fee on every trade` — the canonical Kids Club+
 * benefit sentence (Manage Kids Club+ / Continue Kids Club+ / Subscription
 * Payment). When the fee is unknown the sentence simply drops the amount rather
 * than inventing one.
 */
export function memberFeeBenefitText(cents: number | null | undefined): string {
  return isMemberFeeAvailable(cents)
    ? `Flat ${formatPrice(cents)} Safety & Platform Fee on every trade`
    : 'Flat Safety & Platform Fee on every trade';
}

/** `Pay a flat $1.49 Safety & Platform Fee on every trade` (Subscription Payment). */
export function memberFeePaymentLine(cents: number | null | undefined): string {
  return isMemberFeeAvailable(cents)
    ? `Pay a flat ${formatPrice(cents)} Safety & Platform Fee on every trade`
    : 'Pay a flat Safety & Platform Fee on every trade';
}

/** `$1.49 flat` — the Compare Plans comparison-table cell. */
export function memberFeeComparisonCell(cents: number | null | undefined): string {
  return isMemberFeeAvailable(cents) ? `${formatPrice(cents)} flat` : 'Flat fee unavailable';
}
