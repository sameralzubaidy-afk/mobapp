// File: p2p-kids-marketplace/src/utils/tradeCancellationCopy.ts
// DEV-TASK-113 (2026-09-05) — item 1: friendly copy for cancelled-trade
// cancellation_reason codes. Both trade timeline screens (TradeTimelineScreen,
// TradeDetailScreen) previously rendered `Reason: {trade.cancellation_reason}`
// verbatim, leaking raw machine codes (e.g. `dispute_resolved_refund`) to
// parents. This shared map converts a stored reason code into a meaningful,
// role-appropriate sentence. Unknown codes fall back to a generic sentence and
// NEVER render the raw code. Mirrors the getUserFriendlyAiError convention in
// aiErrorFormat.ts (raw machine string -> parent-friendly copy).

import type { Trade } from '@/types/trade';

export type TradeViewerRole = 'buyer' | 'seller';

/**
 * Refund context for the dispute-refund reason.
 * - `{ refunded: true }`  -> a real `trade_refunds` row exists (payment was
 *   captured, then refunded). The buyer line confirms the refund.
 * - `{ refunded: false }` -> trade cancelled with no refund rows (payment was
 *   never captured; nothing was taken). The buyer line says no payment was taken.
 * - `null` (unknown)      -> caller has no refund data (legacy TradeDetail
 *   screen). We do NOT claim a refund; we stay neutral.
 */
export type CancellationRefundContext = { refunded: boolean } | null;

/** Sentinel returned for unknown codes and guarded viewer cases. Screens render
 *  the friendly sub-line only when it differs from this (avoids a redundant
 *  "Cancelled / This trade was cancelled." pairing). */
export const GENERIC_CANCELLATION_COPY = 'This trade was cancelled.';

/**
 * Map a stored cancellation_reason to friendly, role-appropriate copy.
 *
 * Rationale notes:
 * - `dispute_resolved_refund`: dispute resolved in the buyer's favor. Money
 *   movement depends on capture state (refund rows present = captured+refunded;
 *   absent = uncaptured auth hold, nothing taken). D1 (owner, 2026-09-05):
 *   buyer copy branches on refund data; never claim a refund that didn't happen.
 * - `requested_by_customer` is written by BOTH the buyer's own cancel flow and
 *   admin force-cancel, so we can't safely say "you requested" to the buyer;
 *   buyer sees the generic line, seller sees the buyer-request phrasing.
 * - `changed_mind`/`found_elsewhere`/`no_longer_need_item`/`meetup_issue` are
 *   buyer-selectable ids (CancellationReasonModal BUYER_*_REASONS), and
 *   `cant_do_pickup`/`item_no_longer_available` are seller-selectable ids
 *   (SELLER_INPROGRESS_REASONS) -> role-appropriate initiator phrasing.
 */
export function getFriendlyCancellationReason(
  reason: string | null | undefined,
  role: TradeViewerRole,
  refund: CancellationRefundContext = null
): string {
  const key = (reason ?? '').trim();

  switch (key) {
    case 'dispute_resolved_refund':
      if (role === 'buyer' && refund?.refunded) {
        return 'This trade was cancelled and your payment was refunded.';
      }
      if (role === 'buyer' && refund?.refunded === false) {
        return 'This trade was cancelled. No payment was taken.';
      }
      // Buyer with unknown refund state, or any seller view: stay neutral.
      return 'This trade was cancelled by our support team.';
    case 'dispute_resolved_refund_uncaptured':
      return role === 'buyer'
        ? 'This trade was cancelled. No payment was taken.'
        : 'This trade was cancelled by our support team.';
    case 'seller_declined':
      return role === 'seller' ? 'You declined this offer.' : 'The seller declined this offer.';
    case 'offer_expired_competing':
    case 'Another offer accepted':
      return 'Another offer on this item was accepted.';
    case 'authorization_expired':
      return 'This trade was cancelled because the payment authorization expired.';
    case 'payment_hold_failed':
      return 'This trade was cancelled because the payment could not be authorized.';
    case 'extension_denied':
      return 'The other party declined your extension request.';
    case 'extension_timeout':
      return 'The extension request expired without a response.';
    case 'extension_reauth_failed':
      return 'The extension request could not be completed.';
    case 'Offer expired':
    case 'offer_expired':
      return 'This offer expired.';
    case 'buyer_cancelled':
      return 'This trade was cancelled by the buyer.';
    case 'requested_by_customer':
      // Buyer-initiated cancel OR admin force-cancel both write this code, so the
      // buyer view stays generic (safe) and the seller view uses the finding #1 copy.
      return role === 'seller'
        ? 'This trade was cancelled at the buyer\u2019s request.'
        : GENERIC_CANCELLATION_COPY;
    // Buyer-selectable cancel reasons (CancellationReasonModal BUYER_*_REASONS)
    case 'changed_mind':
    case 'found_elsewhere':
    case 'no_longer_need_item':
    case 'meetup_issue':
      return role === 'seller' ? 'The buyer cancelled this trade.' : 'You cancelled this trade.';
    // Seller-selectable cancel reasons (CancellationReasonModal SELLER_INPROGRESS_REASONS)
    case 'cant_do_pickup':
    case 'item_no_longer_available':
      return role === 'buyer' ? 'The seller cancelled this trade.' : 'You cancelled this trade.';
    default:
      return GENERIC_CANCELLATION_COPY;
  }
}

/** True when a cancelled trade was closed by a dispute resolved in the buyer's
 *  favor (resolve-dispute EF / admin dispute-action write this exact reason). */
export function isDisputeRefundCancelled(
  trade: Pick<Trade, 'status' | 'cancellation_reason'>
): boolean {
  return trade.status === 'cancelled' && trade.cancellation_reason === 'dispute_resolved_refund';
}
