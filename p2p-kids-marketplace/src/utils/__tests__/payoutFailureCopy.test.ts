/**
 * Unit Tests: payoutFailureCopy — FIX-Task-47 item 5 (2026-09-16)
 *
 * `seller_payouts.failure_reason` is FREE TEXT: provider webhooks write Stripe's
 * `failure_message` (or a '; '-joined list of raw provider errors), while QA and
 * cleanup scripts write operator notes. It was rendered verbatim, so a real seller
 * saw this on Payout History:
 *
 *   "⚠️ qa cleanup: FIX-Task-7 P1 auto-complete artifact (dispute should have
 *    paused auto-complete)"
 *
 * The load-bearing assertion is that the exact leaked string must NEVER appear in
 * the output — the mapper is an allowlist, so unknown text can only ever collapse
 * to the generic sentence.
 */

import {
  GENERIC_PAYOUT_FAILURE_COPY,
  getFriendlyPayoutFailureReason,
} from '../payoutFailureCopy';

describe('payoutFailureCopy — FIX-Task-47 item 5 (raw failure_reason never shown)', () => {
  it('withholds the exact QA note that leaked to a seller', () => {
    const leaked =
      '⚠️ qa cleanup: FIX-Task-7 P1 auto-complete artifact (dispute should have paused auto-complete)';

    const rendered = getFriendlyPayoutFailureReason(leaked);

    expect(rendered).toBe(GENERIC_PAYOUT_FAILURE_COPY);
    expect(rendered).not.toContain('qa cleanup');
    expect(rendered).not.toContain('FIX-Task-7');
    expect(rendered).not.toContain('auto-complete');
  });

  it('maps recognised, seller-actionable provider reasons to their own copy', () => {
    expect(getFriendlyPayoutFailureReason('Insufficient funds in recipient account')).toBe(
      'Insufficient funds in recipient account'
    );
    expect(getFriendlyPayoutFailureReason('Your bank account is closed')).toBe(
      'Your bank account is closed'
    );
  });

  it('collapses anything unrecognised to the generic sentence', () => {
    const unrecognised = [
      'stripe_status_requires_capture',
      'Payout failed',
      'errors: 429 too many requests; idempotency key reuse',
      'internal ref 8f3a-qa-seed',
    ];

    for (const raw of unrecognised) {
      expect(getFriendlyPayoutFailureReason(raw)).toBe(GENERIC_PAYOUT_FAILURE_COPY);
    }
  });

  it('returns the generic sentence for absent/blank values (never an empty box)', () => {
    expect(getFriendlyPayoutFailureReason(null)).toBe(GENERIC_PAYOUT_FAILURE_COPY);
    expect(getFriendlyPayoutFailureReason(undefined)).toBe(GENERIC_PAYOUT_FAILURE_COPY);
    expect(getFriendlyPayoutFailureReason('   ')).toBe(GENERIC_PAYOUT_FAILURE_COPY);
  });

  it('is case-insensitive for recognised reasons', () => {
    expect(getFriendlyPayoutFailureReason('INSUFFICIENT FUNDS')).toBe('INSUFFICIENT FUNDS');
  });
});
