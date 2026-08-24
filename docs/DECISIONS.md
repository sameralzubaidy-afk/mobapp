# Product & Architecture Decisions Log

Standing record of durable product/architecture decisions for the Kids P2P Marketplace.
This is the repo's canonical location for decisions that shape UI, flows, or backend
contracts and that future sessions should NOT re-litigate.

> **How to add an entry:** prepend a new `## D-### — <Short Title>` section below the
> header (newest first). Give it: **Date**, **Status** (Decided / Superseded / Reverted),
> **Decision**, **Rationale**, **Scope / Permanence**, and **Reference** (task, PR, commit,
> or doc link). If a decision leaves backend symbols or tests unused, add a
> **FLAG — deprecation candidates** note under the entry so a future keep-vs-remove review
> can find it (see D-001 for the pattern).

---

## D-001 — Subscription Choice: Web-First Only (no native trial-choice screen)

- **Date:** 2026-08-24
- **Status:** Decided
- **Decision:** The native "Subscription Choice (Onboarding)" step — Start Free Trial /
  Continue Free — is **NOT implemented**. There is no `SubscriptionChoiceScreen.tsx` and no
  in-app trial-choice step. Post-Profile-Setup, the app routes to the 5-slide EDU carousel
  (`OnboardingScreen`) → free-tier Home. Subscription upsell/purchase is handled **entirely
  via the web-first `JoinKidsClubScreen` purchase path**: the `SubscriptionChoice` route maps
  to `JoinKidsClubScreen` (`p2p-kids-marketplace/src/navigation/AppNavigator.tsx` L562).
- **Rationale:** Final product decision by the project owner (Samer). The web-first purchase
  page is the intended, permanent design — the native trial-choice screen was scoped out.
  This closes out the recurring Phase 23 (2026-08-17) finding that Group I (AUTH-TC-I01–I03)
  was BLOCKED.
- **Scope / Permanence:** `SubscriptionChoice` → `JoinKidsClubScreen` mapping is PERMANENT and
  intentional — not a placeholder or unfinished state. Test cases AUTH-TC-I01/I02/I03 are
  deprecated/removed in
  `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`.
- **Staging config:** `admin_config.trial_enabled=false`, `trial_period_days=30`,
  `max_trial_uses=1` on staging is CONFIRMED intentional given this decision. **Do not change.**
- **Reference:** Docs/guide-cleanup task "close out Subscription Choice — web-first-only,
  deprecate AUTH-TC-I01–I03" (2026-08-24). QA evidence: `e2e-test-results/group-i-subscription-choice-2026-08-23/report.md`.

### FLAG — Deprecation candidates (trial backend / services) — NOT to be changed now

Do **NOT** remove or change anything below in this task. These are candidates for a SEPARATE
future keep-vs-remove review (same pattern as the `nodes.member_count` deprecation). No live UI
path reaches any of them given D-001.

Current usage (verified by grep, 2026-08-24):

- **RPC `create_trial_subscription(p_user_id)`** — defined in
  `supabase/migrations/20251215100001_auth_v2_rpc_functions.sql` and re-created in
  `20251227_fix_trial_enrollment_idempotency.sql`. No live UI caller. Referenced only by tests
  (`src/__tests__/services/subscription-sub-003.unit.test.ts`) and historical docs in `archive/`.
- **RPC `upgrade_free_subscription_to_trial(p_user_id)`** — defined in
  `supabase/migrations/20251219_upgrade_free_to_trial.sql`. No live UI caller. Referenced by
  tests (`subscription-sub-003.unit.test.ts`) and historical docs.
- **Service `checkTrialEligibility`** (`src/services/subscription.ts:406`) — no live UI caller.
  Imported only by tests (`src/__tests__/e2e/sub-020-trial-limit.e2e.ts`,
  `src/__tests__/e2e/subscription-sub-003.e2e.ts`, `src/services/__tests__/subscription.test.ts`).
- **Service `enrollInTrialSubscription`** (`src/services/auth.ts:261`) — no live UI caller.
  Imported only by tests (`subscription-sub-003.e2e.ts`, `src/services/__tests__/auth.test.ts`).
- **Service `signupWithTrial`** (`src/services/auth.ts:137`) — **STILL LIVE** (called by the
  registered Signup screen `src/screens/auth/SignupScreen.tsx:294`), but the name is a legacy
  misnomer: it now creates a **FREE** subscription (`create_free_subscription`), not a trial.
  Its docstring comment referencing `SubscriptionChoiceScreen` is stale. Candidate for a rename /
  cleanup, NOT removal (it is the live signup path).
- **Test assets referencing the removed screen / trial UI** (no live screen exists to exercise
  them): `p2p-kids-marketplace/.maestro/sub-020-trial-limit.yaml`,
  `p2p-kids-marketplace/src/__tests__/e2e/sub-020-trial-limit.e2e.ts`, and
  `archive/docs/manual-verification/SUB-020-TRIAL-LIMIT-MANUAL-TEST-CASES.md` (note:
  `docs/flow-registry.md` still points at `docs/manual-verification/SUB-020-TRIAL-LIMIT-MANUAL-TEST-CASES.md`
  — the file currently lives under `archive/docs/manual-verification/`; address in the review).
- **No callers** were found in `supabase/functions/` or `p2p-kids-admin/src/` (only
  `p2p-kids-admin/SQL-FILE-STRUCTURE.md` / `SQL-SETUP-SUMMARY.md` historical references).

Suggested future task: keep-vs-remove review of the above, including whether the trial RPCs can be
dropped or left as dormant (they are harmless but dead), and whether `signupWithTrial` should be
renamed (e.g. `signup`) to stop implying a trial flow.
