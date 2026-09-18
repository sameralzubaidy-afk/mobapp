/**
 * File: p2p-kids-marketplace/src/utils/subscriptionCancellation.ts
 * FIX-Task-55 item 7 (2026-09-18) — single source of truth for subscription
 * cancellation reason ids and their human labels.
 *
 * Why this file exists: `cancelSubscription()` stores the reason **id**
 * (`too_expensive`, `not_using`, …) in `subscriptions.cancel_reason` — it is an
 * analytics code, not display copy. Any surface that shows that column must
 * translate it first; rendering the raw column puts a snake_case machine string
 * in front of a parent (the raw-code-on-a-user-surface class). The list lives
 * here rather than in `ManageKidsClubScreen` so the picker and the display
 * surface read ONE canonical set and cannot drift apart (BP-86).
 *
 * Verified on-device 2026-09-18: before this mapping, the Subscription Status
 * "Reason" row rendered `too_expensive` verbatim.
 */

export interface CancellationReason {
  id: string;
  label: string;
}

/** The canonical reasons the cancel picker offers, in the picker's own order. */
export const CANCELLATION_REASONS: CancellationReason[] = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using', label: 'Not using it enough' },
  { id: 'child_lost_interest', label: 'My child lost interest' },
  { id: 'found_alternative', label: 'Found an alternative' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'other', label: 'Other reason' },
];

const LABELS_BY_ID = new Map(CANCELLATION_REASONS.map((reason) => [reason.id, reason.label]));

/**
 * Human-readable label for a stored cancellation reason.
 *
 * - A known id maps to its canonical label (`too_expensive` → "Too expensive").
 * - An UNKNOWN non-empty value is returned as-is rather than discarded, because
 *   `cancel_reason` is free text on older rows (the service's own fallback is
 *   the human-readable "User requested cancellation"), and silently hiding the
 *   only record of why the user left would be worse than showing it. A future
 *   code that reaches this branch should be added to CANCELLATION_REASONS above.
 * - A null / blank / whitespace-only value returns null so callers keep their own
 *   placeholder (the shared `Row` renders "—" for null).
 */
export function cancellationReasonLabel(reason: string | null | undefined): string | null {
  const raw = reason?.trim();
  if (!raw) return null;
  return LABELS_BY_ID.get(raw) ?? raw;
}
