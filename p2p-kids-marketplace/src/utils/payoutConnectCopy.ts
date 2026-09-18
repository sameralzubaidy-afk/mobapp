// File: p2p-kids-marketplace/src/utils/payoutConnectCopy.ts
// FIX-Task-53 item 4 (2026-09-17): the Add-Payout-Method → Stripe Connect
// redirect-alert copy.
//
// History: FIX-Task-52 item 1 made `create-stripe-connect-account` return an
// explicit `created` flag plus the reused account's onboarding state, so the alert
// could stop claiming "Stripe account created!" for a reuse. That fix kept
// `resumingOnboarding` FIRST, though — and that flag is true for EXACTLY the
// "existing account, onboarding still incomplete" state, so it shadowed the
// reused-and-incomplete copy. The guide's documented string could never render for
// its own case (QA SUB Android Round 8, finding F4).
//
// Extracted into this pure module so the branch ORDER — which WAS the defect and had
// no test — becomes unit-testable. Mirrors the `tradeCancellationCopy.ts` convention
// (copy logic in a pure, tested utils module rather than inline in the screen).

export interface ConnectAccountRedirectResult {
  /** `false` = the EF reused an existing Connect account; nothing was created. */
  created?: boolean;
  /** Only meaningful when `created === false`: has the reused account finished onboarding? */
  onboardingComplete?: boolean | null;
}

/**
 * DT-121 item 4's phone re-verification hint. Relevant only while RESUMING a
 * partially-complete hosted onboarding.
 */
export const CONNECT_PHONE_REVERIFY_NOTE =
  'Note: You may need to re-verify your phone number before continuing.';

export const CONNECT_CREATED_MESSAGE =
  'Stripe account created! You will now be redirected to complete your onboarding.';

export const CONNECT_REUSED_VERIFIED_MESSAGE =
  'This payout account is already connected and verified. You will now be redirected to Stripe.';

export const CONNECT_REUSED_INCOMPLETE_MESSAGE =
  'This payout account is already connected. You will now be redirected to continue your onboarding.';

/** The resume-only arm (no `created` flag from the EF). */
export const CONNECT_RESUME_MESSAGE = `You will now be redirected to continue your Stripe onboarding.\n\n${CONNECT_PHONE_REVERIFY_NOTE}`;

/**
 * Copy for the redirect alert after Add Payout Method → Stripe Connect.
 *
 * ORDER MATTERS: `created` is evaluated BEFORE `resumingOnboarding`, because
 * `resumingOnboarding` is a strict SUBSET of `created === false` (an existing
 * account whose onboarding is incomplete). Testing the flag first is what made the
 * reused-incomplete string unreachable.
 */
export function getConnectRedirectMessage(
  result: ConnectAccountRedirectResult | null | undefined,
  resumingOnboarding = false
): string {
  if (result?.created === false) {
    if (result.onboardingComplete) return CONNECT_REUSED_VERIFIED_MESSAGE;
    return resumingOnboarding
      ? `${CONNECT_REUSED_INCOMPLETE_MESSAGE}\n\n${CONNECT_PHONE_REVERIFY_NOTE}`
      : CONNECT_REUSED_INCOMPLETE_MESSAGE;
  }

  // Defensive: unreachable while the EF reuses an existing account for a seller who
  // already has one. Retained so a future EF change cannot silently drop the resume
  // guidance.
  if (resumingOnboarding) return CONNECT_RESUME_MESSAGE;

  return CONNECT_CREATED_MESSAGE;
}
