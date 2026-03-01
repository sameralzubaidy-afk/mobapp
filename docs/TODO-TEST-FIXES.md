# TODO — Test Fixes + Enabling Skipped Suites

## Goal
Fix the currently failing tests without breaking production behavior, and re-enable skipped test suites in a controlled way.

## Current Failing Tests (from latest run)
- `p2p-kids-marketplace/src/__tests__/e2e/referral-listing-bonus.e2e.ts`
  - Failure: Jest test timeout (5s default).
  - Fix: Add explicit per-test timeout.

- `p2p-kids-marketplace/src/components/subscription/__tests__/SubscriptionBanner.test.tsx`
  - Failure: Expected navigation route mismatch.
  - Fix: Align expectation with implemented route OR implement the missing route (decision needed).

## Hook Tests — Enablement Tasks
1) Use the installed `@testing-library/react-native` for hook tests.
2) Remove `describe.skip(...)` for:
   - `src/hooks/__tests__/useSubscription.test.ts`
   - `src/hooks/__tests__/useGracePeriodStatus.test.ts`
3) Ensure Jest setup supports hook tests:
   - `jest.setup.ts` should be loaded in Jest config
   - Fake timers should be used carefully (some RTL helpers require real timers)

## Skipped Suites — Next Steps
Some suites are skipped for reasons beyond missing packages:
- Detox E2E suites: require simulator/emulator setup + Detox configuration.
- Supabase-prod E2E suites: require `RUN_SUPABASE_E2E=true` and correct prod env vars.

## Open Decision
- Should we introduce a real `AddPaymentForKidsClub` route/screen?
  - If yes: add a screen + navigation entry + typed route, and keep the original test expectation.
  - If no: keep routing to `ContinueKidsClub` and update the test to match.
