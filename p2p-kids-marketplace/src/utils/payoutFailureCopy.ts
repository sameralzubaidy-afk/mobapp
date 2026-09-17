/**
 * File: p2p-kids-marketplace/src/utils/payoutFailureCopy.ts
 *
 * FIX-Task-47 item 5 (2026-09-16) — the seller-facing copy for a failed payout.
 *
 * WHY THIS EXISTS
 * `seller_payouts.failure_reason` is FREE TEXT written by several writers, so it
 * cannot be rendered to an end user:
 *   - `supabase/functions/_shared/payouts/webhookReconcile.ts` writes Stripe's
 *     `failure_message`, or a `'; '`-joined list of raw provider error messages,
 *     or the literal `'Payout failed'`.
 *   - `supabase/functions/dispatch-manual-payouts/index.ts` writes the dispatch
 *     error text.
 *   - QA/cleanup fixtures write arbitrary operator notes — the leak that produced
 *     this task (`⚠️ qa cleanup: FIX-Task-7 P1 auto-complete artifact…`) shipped to
 *     a real seller's Payout History verbatim.
 *
 * There is no enumerable vocabulary to map from, so this is an ALLOWLIST: only
 * phrases we positively recognise as seller-actionable are shown; everything else
 * (operator notes, internal task ids, stacked provider errors, anything the shared
 * infrastructure-dump guard rejects) collapses to ONE generic sentence. Unknown
 * text can therefore never reach a user by accident.
 *
 * The raw value is still logged for developers — visible in the console, never on
 * screen.
 */

import { sanitizeUserFacingMessage } from './authError';

/** The only thing we show when the reason is not a recognised, seller-actionable phrase. */
export const GENERIC_PAYOUT_FAILURE_COPY =
  "We couldn't complete this payout. Please check your payout method and try again.";

/**
 * Phrases a seller can actually act on. Kept deliberately narrow — broadening this
 * list is a safety decision, not a copy tweak.
 */
const SELLER_ACTIONABLE_REASON_PATTERNS: RegExp[] = [
  /insufficient funds/i,
  /account (?:is )?(?:closed|restricted|disabled|blocked)/i,
  /(?:invalid|incorrect|unverified) (?:bank )?account/i,
  /payment method (?:is )?(?:invalid|expired|declined)/i,
  /(?:recipient|bank) account (?:not found|does not exist)/i,
  /verification (?:is )?(?:required|incomplete)/i,
];

/**
 * Map a raw `failure_reason` to seller-facing copy.
 * Always returns a complete, safe sentence — never the raw column contents.
 */
export function getFriendlyPayoutFailureReason(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return GENERIC_PAYOUT_FAILURE_COPY;

  const trimmed = raw.trim();
  if (!trimmed) return GENERIC_PAYOUT_FAILURE_COPY;

  const isRecognised = SELLER_ACTIONABLE_REASON_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (!isRecognised) {
    // Keep the operator's text diagnosable without ever rendering it.
    console.warn(
      '[payoutFailureCopy] Unrecognised payout failure_reason withheld from the user (FIX-Task-47 item 5):',
      trimmed
    );
    return GENERIC_PAYOUT_FAILURE_COPY;
  }

  // Even a recognised phrase must survive the shared render-path guard (rejects
  // infrastructure dumps / oversized payloads).
  return sanitizeUserFacingMessage(trimmed, GENERIC_PAYOUT_FAILURE_COPY, 160);
}
