# QA Session Report — Group I: Subscription Choice (Onboarding) — AUTH-TC-I01–I03

- **Date:** 2026-08-23/24 (run 20:43–20:48 local)
- **Agent:** QA Test Agent (execution-only)
- **Build under test:** HEAD `24fbd0be` (2026-08-23 20:36:08 -0400, "dev fixes and final tests for QA Session Report — Group H")
- **Device:** iPhone 17 Pro Max simulator (iOS 26.1), `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`
- **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`, Group I (lines 1013–1051)
- **Evidence:** `e2e-test-results/group-i-subscription-choice-2026-08-23/screenshots/`

---

## Summary verdict

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-I01 · Start Free Trial enrolls Kids Club+ | AUTH (Group I) | **BLOCKED** | Subscription Choice screen does not exist; no Start Free Trial CTA anywhere in onboarding; `trial_enabled=false` (precondition unmet) |
| AUTH-TC-I02 · Continue Free stays on free tier | AUTH (Group I) | **BLOCKED** | Subscription Choice screen does not exist; no Continue Free CTA anywhere |
| AUTH-TC-I03 · Trial limit reached hides trial CTA | AUTH (Group I) | **BLOCKED** | Subscription Choice screen does not exist; cannot reach a trial-limit state via UI |

**Roll-up: 0 PASS / 0 FAIL / 3 BLOCKED / 0 SKIPPED**

---

## Root finding (single cause for all 3 cases)

The **"Subscription Choice (Onboarding)" screen is not implemented in the current build.** This is a source-proven and on-device-confirmed absence (not a navigation miss):

1. **No `SubscriptionChoiceScreen.tsx` exists anywhere in the repo** (searched `src/screens/**`; the file referenced by `docs/flow-registry.md` FLOW-12 SUB-020 as `src/screens/onboarding/SubscriptionChoiceScreen.tsx` is absent — **doc drift**).
2. The `SubscriptionChoice` route in `AppNavigator.tsx` (L562–563) maps to **`JoinKidsClubScreen`** (R7 web-first membership value-prop page — *zero purchase UI*, no price cards, no Subscribe button, no Start Free Trial / Continue Free). Same component serves the `JoinKidsClub` route.
3. **Nothing navigates to the `SubscriptionChoice` route** — no `navigate`/`replace('SubscriptionChoice')` anywhere in `src/`. The onboarding flow is: fresh signup → phone verify → Profile Setup → **5-slide EDU carousel (`OnboardingScreen`)** → `replace('Home')`. There is no subscription-choice step.
4. The trial/free *infrastructure* exists (RPCs `create_trial_subscription`, `upgrade_free_subscription_to_trial`, `checkTrialEligibility`, `get_trial_limit_status`; `signupWithTrial` in `src/services/auth.ts`) but **no UI exposes a Start Free Trial / Continue Free choice**.
5. `admin_config` on staging: `trial_enabled = false`, `trial_period_days = 30`, `max_trial_uses = 1` — so AUTH-TC-I01's stated precondition ("Trial is enabled in admin config") is also unmet.

This matches the Phase 23 finding (2026-08-17): **the "Start Free Trial"/"Continue Free" onboarding choice was removed; the route resolves to the web-first JoinKidsClubScreen.** Nothing has changed as of HEAD `24fbd0be`.

---

## On-device confirmation run (the exact flow the task asked to reuse)

Executed the Groups F/H validated fresh-signup flow end-to-end to reach the (supposed) subscription-choice step:

1. **Clean launch** → Landing (after `qa-logout`; prior session from an earlier run was cleared).
2. **Get Started** → Signup. Used `dev-fill-test-user-1` autofill (unique email/phone per tap) → `qa.alice.17875322953503556@kidsmarketplace.test` / `+12025555350603` / DOB 15/01/2000 / password autofilled.
3. **Create Account** → Phone Verification. Dismissed "Code Sent (DEV Bypass)" dialog (AX-exposed `otp-dev-bypass-dialog-ok-button`), filled OTP `123456` via `dev-fill-otp-123456`, tapped Verify → "Success! Your phone number has been verified."
4. **Continue** → Profile Setup. Filled display name "Group I Test Parent" + ZIP `06850` (city resolved "📍 Norwalk, CT"). Dismissed keyboard (Cmd+K) → Complete Setup → "Success — Your profile has been created!" → OK.
5. **Destination after Profile Setup = 5-slide onboarding carousel** (step 1 "Welcome to a safe, neighborhood marketplace…", steps 2–5 PIP/SP/Safety). **No subscription-choice screen appeared.**
6. **Skip** → **Home** on the **free tier** — Home header "Norwalk Central", SP strip **"Unlock Swap Points / Upgrade →"** (subscriber-only features locked), Verify Identity banner, tab bar present.
7. **DB read-back** for `cbaca155-2e1b-41ab-bef2-bc36ad1392aa`: `phone_verified=true`, `onboarding_skipped_at=2026-08-24 00:47:24Z`, **`trial_uses_count=0`, no `subscriptions` row (free tier)** — the user was never offered a trial/free choice and never enrolled.

**Conclusion:** a brand-new user goes from signup → free Home with **no opportunity to start a trial or choose a tier**. All three Group I assertions are unreachable because the screen under test does not exist.

---

## Per-case detail

### AUTH-TC-I01 · Start Free Trial enrolls Kids Club+

- **Assert (from guide):** "The screen shows 'Try Kids Club+ Free for N days' at $0.00; after enrolling, the user proceeds to Home and gains subscriber features (e.g., SP, Accept SP toggle)."
- **Verdict: BLOCKED.** No Subscription Choice screen exists → the "Start Free Trial" CTA (and its "$0.00 / N days" copy) is unreachable. Precondition "Trial is enabled in admin config" is also unmet (`trial_enabled=false`). Legacy case (no Locator hints / Assert fields to reference).
- **Evidence:** I-05 (post-profile = carousel, not subscription choice); I-06 (free-tier Home, "Unlock Swap Points"); DB read-back (no subscription row).

### AUTH-TC-I02 · Continue Free stays on free tier

- **Assert (from guide):** "The user proceeds to Home on the free tier with subscriber-only features locked."
- **Verdict: BLOCKED.** No Continue Free CTA exists. (Note: the *outcome* of I02 — a fresh user landing on free-tier Home with subscriber features locked — was incidentally observed as the actual behavior, but via no explicit choice: Home showed "Unlock Swap Points / Upgrade →" and DB confirmed free tier. This does not satisfy the case's intent, which requires a deliberate "Continue Free" choice on a subscription-choice screen.)
- **Evidence:** I-06; DB read-back (free tier, no subscription row).

### AUTH-TC-I03 · Trial limit reached hides trial CTA

- **Assert (from guide):** "Start Free Trial is hidden; only the paid Kids Club+ option and Continue Free are shown."
- **Verdict: BLOCKED.** No Subscription Choice screen exists; no trial CTA exists to hide; no user with exhausted trials can be produced through the UI (no enrollment path). `max_trial_uses=1` and `trial_uses_count=0` for the throwaway user.
- **Evidence:** I-05, I-06; admin_config read-back.

---

## Execution trace (tool-call sequence)

1. `list_available_devices` → iPhone 17 Pro Max (26.1) online.
2. `terminate_app` (clean state) → `launch_app` → bundle "Downloading 100%…" → poll → **Home with prior session** (left from an earlier run).
3. `xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"` → **Landing** (clean).
4. Tap **Get Started** (220,653) → Signup.
5. Swipe up (220,700→400) → reveal DEV autofill + submit.
6. Tap **Autofill Alice test user** (81,661) → form filled (email/phone unique, DOB, password).
7. Tap **Create Account** (220,735) → Phone Verification. "Code Sent (DEV Bypass)" dialog → tap **OK** (`otp-dev-bypass-dialog-ok-button`, 220,552).
8. Tap **Fill 123456** (116,515) → OTP field "1 2 3 4 5 6" (verified) → tap **Verify** (220,581) → "Success — phone verified" → tap **Continue** (220,535).
9. Profile Setup: tap display-name (236,412) → type "Group I Test Parent" (value verified) → tap ZIP (236,512) → type "06850" → city "📍 Norwalk, CT" resolved → Cmd+K (keyboard hidden, re-listed) → tap **Complete Setup** (220,833) → "Success — Your profile has been created!" → **OK** (220,523).
10. **Observed destination: 5-slide onboarding carousel** ("Onboarding, step 1 of 5…" — not a subscription choice). Screenshot I-05.
11. Tap **Skip** (64,859) → **Home, free tier** ("Norwalk Central", "Unlock Swap Points / Upgrade →"). Screenshot I-06.
12. DB read-backs (profiles + subscriptions + admin_config) — free tier, no trial, `trial_enabled=false`.
13. `xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"` → clean Landing (final state).

**Perceived load times** (simulator, wall-clock, ±polling-interval precision — not a formal performance profile): transitions were not the focus of this run (all 3 cases blocked before any assertion transition); the signup→phone-verify, verify→profile, and profile→carousel transitions each resolved within the normal 1–2s poll window — no ≥3s transitions observed. Full timing table omitted as non-discriminating for a fully-blocked group.

---

## UX review

Since the screen under test is absent, the three-layer UX review applies to the **screens actually visited** (Signup, Phone Verification, Profile Setup, Onboarding carousel, Home).

### Structural / affordance
- No issues observed. The fresh-signup flow is coherent: clear progress (verify → profile → carousel → Home), explicit back/close affordances, visible CTAs, tab bar mounts immediately after Skip (Phase 24 fix holds).

### Wording / copy clarity
- Home free-tier SP strip copy **"Unlock Swap Points / Upgrade →"** is parent-friendly and clear. The onboarding carousel copy is plain and appropriate for a parent/guardian audience.
- No problematic copy encountered.

### Design-system compliance (vs `docx/design-system-passitup.md`)
- Screens visited used the documented primary green `#5DBB8E` for primary CTAs (Create Account, Complete Setup, Verify), white modal surfaces, consistent neutral text tiers. **No deviations found** on the screens visited this run. (Full pixel-level token verification was not the objective of this blocked run; noted for completeness.)

---

## Locator-gap findings

- None this run — all interactive elements used were AX-exposed (`landing-signup-button`, `dev-fill-test-user-1`, `signup-submit-button`, `otp-dev-bypass-dialog-ok-button`, `otp-input`, `dev-fill-otp-123456`, `complete-setup-button`, `skip-button`, `global-alert-button-0`).

## Friction vs operating rules

- **Session state from a prior run:** the first launch restored a logged-in session (Home with tab bar). Cleaned via `qa-logout` before proceeding (per §5.8 clean-state verification). Not a defect.
- **Keyboard re-showing on field focus** (Phase 13.38-known behavior): applied Cmd+K before the Complete Setup tap and verified the keyboard was actually gone via a fresh tree list before tapping the below-fold button (§5.19 Rule 1 hard gate respected).

---

## Recommended follow-ups (dev-side, separate tasks — NOT applied in this run)

1. **Implement the Subscription Choice (Onboarding) screen** (`SubscriptionChoiceScreen` with "Try Kids Club+ Free for N days at $0.00" / "Continue Free"), wired into the flow after Profile Setup and before/around the EDU carousel, honoring `trial_enabled` / `max_trial_uses` / `has_used_trial`. The backend RPCs (`create_trial_subscription`, `upgrade_free_subscription_to_trial`, `checkTrialEligibility`) and `signupWithTrial` already exist — the missing piece is the UI + navigation. (Product decision required: the Phase 23 finding noted the "Continue Free / Start Free Trial" onboarding choice appears intentionally removed in favor of the web-first JoinKidsClub purchase path.)
2. **Fix doc drift:** `docs/flow-registry.md` FLOW-12 SUB-020 references `src/screens/onboarding/SubscriptionChoiceScreen.tsx` which does not exist — update or remove the reference.
3. Decide/confirm product intent: is the free-trial onboarding choice a live requirement (guide Group I) or intentionally removed (current build)? If intentionally removed, the guide's Group I cases should be marked accordingly; if required, implement per item 1.

---

## App state left behind

- **Throwaway account (cleanup candidate):** `qa.alice.17875322953503556@kidsmarketplace.test` (user `cbaca155-2e1b-41ab-bef2-bc36ad1392aa`, "Group I Test Parent", ZIP 06850, Norwalk Central node `550e8400-…0001`, phone-verified, onboarding skipped, **free tier — no subscription row, trial_uses_count 0**). Left **logged out** (app on Landing).
- No subscriptions/trades/items/points created. No shared persona state changed.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-I01–I03 (Group I — Subscription Choice / Onboarding), canonical AUTH guide; iOS simulator.
**Design-System Compliance:** PASS on the screens visited (Signup, Phone Verification, Profile Setup, Onboarding carousel, Home) — no deviations found; the screen under test does not exist.
**Perceived Load-Time Verdict:** GOOD — the transitions actually driven (signup→verify, verify→profile, profile→carousel, carousel→Home) all rendered within the ideal UX threshold (<3s); no flags. (Not a formal performance profile.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Signup screen: layout, labels, and primary-CTA styling match design-system requirements (filled pill, primary green).
- CONFIRMED — Phone Verification: DEV-bypass dialog is an AX-instrumentable in-app dialog using documented styling; copy plain and clear.
- CONFIRMED — Profile Setup: fields/CTAs consistent with the design system; "📍 Norwalk, CT" lookup is clear.
- CONFIRMED — Onboarding carousel: 5-slide EDU carousel, parent-friendly copy, Skip/Get Started affordances.
- CONFIRMED — Home (free tier): header, SP strip "Unlock Swap Points / Upgrade →", and tab bar consistent; no deviations.
**Verdict Summary:** 0 PASS / 0 FAIL / 3 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **[BLOCKING] Subscription Choice (Onboarding) screen does not exist in the build** (HEAD `24fbd0be`) — no `SubscriptionChoiceScreen.tsx`, `SubscriptionChoice` route maps to the web-first `JoinKidsClubScreen`, nothing navigates to it; post-Profile-Setup lands on the EDU carousel → free Home. All of I01–I03 unreachable. (Same as the Phase 23 2026-08-17 finding; unchanged.)
2. **[Precondition] `admin_config.trial_enabled = false`** on staging — even the screen's precondition for I01/I03 is unmet.
3. **[Doc drift] `docs/flow-registry.md` references the nonexistent `src/screens/onboarding/SubscriptionChoiceScreen.tsx`**.
**App State Left Behind:** throwaway `qa.alice.17875322953503556@kidsmarketplace.test` (user `cbaca155-…`) — free tier, logged out; no subscription/trade/item state created. See cleanup note above.
**Why It Matters:** This run proves — on-device, via the exact fresh-signup flow — that no trial/free subscription choice exists in the current onboarding, so the Group I cases cannot pass until the feature (or an explicit product decision to remove it from scope) lands. It also confirms the free-tier Home behavior and that the trial backend RPCs are present but unexposed.
**How to Verify/Reproduce:** Full trace above; screenshots in `e2e-test-results/group-i-subscription-choice-2026-08-23/screenshots/` (I-00 launch, I-01 landing, I-02 signup, I-03 post-submit/phone-verify, I-04 profile keyboard-up, I-05 post-profile = carousel, I-06 free-tier Home). Reproduce: fresh signup → phone verify (DEV bypass 123456) → Profile Setup → observe the carousel (not a subscription choice) → Home free tier. Source check: `rg -l "SubscriptionChoiceScreen" src/` returns only comments/tests; `AppNavigator.tsx` L562 maps `SubscriptionChoice` → `JoinKidsClubScreen`.
**Known Gaps / Not Tested:** The JoinKidsClubScreen (web-first) content itself — not the subscription-choice screen — was not navigated to (no entry point exercised it in the fresh flow). The trial-limit state (I03) is unproducible via UI (no enrollment path). "Try Kids Club+ Free for N days at $0.00" copy unverifiable (no screen).
**What Needs To Be Fixed Next:**
1. Implement `SubscriptionChoiceScreen` (Start Free Trial / Continue Free) wired after Profile Setup, honoring `trial_enabled`/`max_trial_uses`/`has_used_trial` — or make an explicit product decision that Group I is out of scope and update the guide accordingly (the Phase 23 finding indicates the choice was intentionally removed in favor of the web-first JoinKidsClub purchase path).
2. Set `trial_enabled=true` (staging admin_config) when the trial feature ships, or document that I01/I03 stay gated until then.
3. Fix the stale `docs/flow-registry.md` reference to the nonexistent screen file.
**UX Enhancement Ideas (optional, not defects):**
- On the free-tier Home SP strip ("Unlock Swap Points / Upgrade →"), there is no in-app trial offer — consider surfacing a one-tap "Try Kids Club+ free" entry point on Home once the trial feature ships, so parents don't have to leave the app to evaluate the membership (grounded in the observed strip being a dead-end into web-first signup with no trial path).
**Suggested Next Session:** Group J (Listing Creation — Single Item) is the natural next batch; alternatively re-run Group I once the SubscriptionChoice screen ships (verify via the same fresh-signup flow; the trial RPCs and `signupWithTrial` service are already present).
**Suggested to Improve Agent Rules:** none — the fail-fast source check (§5.25) plus the on-device confirmation run correctly identified and evidenced the blocked state without wasted UI exploration.
