/**
 * FIX-Task-53 item 4 (2026-09-17) — the redirect-alert copy for the
 * Add Payout Method → Stripe Connect flow.
 *
 * The defect was pure branch ORDER, so the first test is the regression guard: an
 * account that was REUSED while its onboarding is still incomplete must render the
 * reused-incomplete string. The previous implementation tested `resumingOnboarding`
 * first, and that flag is true for exactly this state — so the documented string
 * could never render for its own case (QA SUB Android Round 8, finding F4).
 */

import {
  getConnectRedirectMessage,
  CONNECT_CREATED_MESSAGE,
  CONNECT_REUSED_VERIFIED_MESSAGE,
  CONNECT_REUSED_INCOMPLETE_MESSAGE,
  CONNECT_RESUME_MESSAGE,
  CONNECT_PHONE_REVERIFY_NOTE,
} from '../payoutConnectCopy';

describe('getConnectRedirectMessage', () => {
  it('REGRESSION: a reused, onboarding-incomplete account never reports as resuming', () => {
    const message = getConnectRedirectMessage(
      { created: false, onboardingComplete: false },
      true // resumingOnboarding is TRUE for exactly this state
    );

    expect(message).toContain(CONNECT_REUSED_INCOMPLETE_MESSAGE);
    expect(message).not.toBe(CONNECT_RESUME_MESSAGE);
  });

  it('leads with the documented reused-incomplete copy and keeps the DT-121 phone hint', () => {
    const message = getConnectRedirectMessage({ created: false, onboardingComplete: false }, true);

    expect(message.startsWith(CONNECT_REUSED_INCOMPLETE_MESSAGE)).toBe(true);
    expect(message).toContain(CONNECT_PHONE_REVERIFY_NOTE);
  });

  it('omits the phone hint when the seller is not resuming', () => {
    const message = getConnectRedirectMessage({ created: false, onboardingComplete: false }, false);

    expect(message).toBe(CONNECT_REUSED_INCOMPLETE_MESSAGE);
    expect(message).not.toContain(CONNECT_PHONE_REVERIFY_NOTE);
  });

  it('a reused VERIFIED account gets the verified copy, even with a stale resume flag', () => {
    expect(getConnectRedirectMessage({ created: false, onboardingComplete: true }, false)).toBe(
      CONNECT_REUSED_VERIFIED_MESSAGE
    );
    expect(getConnectRedirectMessage({ created: false, onboardingComplete: true }, true)).toBe(
      CONNECT_REUSED_VERIFIED_MESSAGE
    );
  });

  it('a newly created account gets the created copy', () => {
    expect(getConnectRedirectMessage({ created: true, onboardingComplete: false }, false)).toBe(
      CONNECT_CREATED_MESSAGE
    );
  });

  it('falls back to the resume copy when the EF returns no `created` flag (defensive arm)', () => {
    expect(getConnectRedirectMessage(undefined, true)).toBe(CONNECT_RESUME_MESSAGE);
    expect(getConnectRedirectMessage({}, true)).toBe(CONNECT_RESUME_MESSAGE);
  });

  it('treats an unknown result as a fresh creation when not resuming', () => {
    expect(getConnectRedirectMessage(null, false)).toBe(CONNECT_CREATED_MESSAGE);
  });
});
