# Quick Check — Tab-Bar-After-Skip Fix Re-verification (2026-08-18)

**Run:** 2026-08-18 · **Device:** iPhone 17 Pro Max Simulator (iOS 26.1) · Expo RN dev build + Metro
**Guide:** cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md (Group H signup/onboarding path; AUTH-TC-H06/H07 intent)
**Agent:** QA Test Agent (execution-only) · **Scope:** iOS mobile surface only
**Request:** Fresh signup → phone verify → carousel → **Skip** → **no relaunch** → does the persistent tab bar (Home/Discover/Sell/Trades/Basket) render on Home?

---

## Verdict

| Check | Result |
|---|---|
| Tab bar renders **immediately after Skip, without relaunch** | ❌ **NO — the tab bar is ABSENT** |
| Tab bar appears **after a relaunch** (control) | ✅ **YES — all 5 tabs present** |
| **Conclusion** | **The fix does NOT hold for this exact path.** The tab bar requires a relaunch to appear after Skip. This is **NOT a regression** — the `initialParams` wiring was **never implemented** (verified via `git log -S`). The previously-verified fix (Addendum 73 / EDU-004) is **incomplete**: `OnboardingScreen` calls `route?.params?.onOnboardingFinished?.()`, but `AppNavigator.tsx` never provides that param, so it silently no-ops. |

---

## 1. Execution trace

| # | Step | Action | Evidence / Result |
|---|---|---|---|
| 1 | Source pre-read (pre-device) | Grep `AppNavigator.tsx` for `initialParams`/`onOnboardingFinished`; read `OnboardingScreen.tsx`, `types.ts`, tab-bar render condition, flow-registry L3493–3496 | **Found: `OnboardingScreen` calls `route?.params?.onOnboardingFinished?.()` in `navigateToHome()` (both Skip + Get Started), but `AppNavigator.tsx` has ZERO occurrences of `initialParams` or `onOnboardingFinished`.** Flow-registry claims "wired in AppNavigator.tsx via `initialParams`" — **documentation does not match source.** Working-tree diff of AppNavigator.tsx shows only the render-condition change (`!showOnboardingCarousel`), no wiring. |
| 2 | Git history check | `git log -S "initialParams"` and `git log -S "onOnboardingFinished"` on `src/navigation/AppNavigator.tsx` | **Both empty — the wiring NEVER existed in any commit.** → Not a regression; never fully effective. |
| 3 | Clean-state verify (§5.8) | terminate → plain launch → list | Clean Landing (`landing-signup-button`), no LogBox overlay. |
| 4 | Signup | Landing → **Get Started** → Create Account | "Create Account" / "Join the Kids P2P Marketplace". |
| 5 | Autofill | Tap **Autofill Alice** (`dev-fill-test-user-1`) | Filled: email `qa.alice.17870697215208569@kidsmarketplace.test`, phone `+12025551520910`, DOB 15/01/2000, passwords matched. |
| 6 | Submit | **Create Account** (`signup-submit-button`) | "Code Sent (DEV Bypass)" dialog → OK (`otp-dev-bypass-dialog-ok-button`). |
| 7 | Phone verify | **Use & Verify** (`dev-verify-otp-123456`) | "Success!" → Continue (`otp-success-dialog-ok-button`). |
| 8 | Profile setup | Display name "QA TabBar Check", ZIP `06850` → "📍 Norwalk, CT" → **Complete Setup** | "Success — Your profile has been created!" → OK. |
| 9 | Onboarding carousel | **Skip** (`skip-button`, "Skip onboarding") — after tapping, **NO relaunch** | Navigated to Home (header "Norwalk Central"). |
| 10 | **DISCRIMINATING ASSERT — no relaunch** | `list_elements_on_screen` immediately after Skip | **NO `tab-home` / `tab-discover` / `tab-sell` / `tab-trades` / `tab-trade-basket` in the AX tree.** Screenshot OCR of bottom region: only "Recommended for You" + LogBox footer — **no floating pill / tab labels.** |
| 11 | Control — relaunch | terminate → launch (fresh mount) | **All 5 tab items present** (`tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket` at y≈846–903). Screenshot OCR confirms labels. |
| 12 | DB isolation | SQL: `profiles` for fresh account | `onboarding_skipped_at` = `2026-08-18 16:34:40`, `onboarding_completed_at` = null, node = Norwalk Central, `phone_verified` = true → **Skip worked at the data layer; the defect is purely the root gate.** |
| 13 | Teardown | `p2pkidsmarketplace://qa-logout` deep link | Clean Landing, session cleared. |

**Perceived load time (Skip → Home):** ~2s (wall-clock, simulator, ±polling precision) — sub-3s, no load-time flag.

---

## 2. Screenshots captured (`e2e-test-results/tabbar-after-skip-recheck-2026-08-18/evidence/`)

- `tabbar_recheck_01_signup_state.png` — Create Account form (autofilled) pre-submit.
- `tabbar_recheck_02_profilesetup_filled.png` — Profile Setup filled, keyboard up.
- `tabbar_recheck_03_profilesetup_scrolled.png` / `04` — Profile Setup scroll attempts.
- `tabbar_recheck_05_profilesetup_keyboard_gone.png` — Profile Setup, keyboard dismissed, Complete Setup visible.
- `tabbar_recheck_06_home_after_skip_NO_RELAUNCH.png` — **KEY:** Home after Skip, **NO tab bar** (bottom region OCR: no tab labels).
- `tabbar_recheck_07_home_after_RELAUNCH_tabbar_present.png` — **KEY (control):** Home after relaunch, **tab bar present**.
- `tabbar_bottom_crop.png` / `tabbar_control_bottom.png` — bottom-region crops for OCR.

---

## 3. Assert result

**FAIL (fix does not hold)** for the exact requested path: fresh signup → phone verify → carousel → Skip → no relaunch → tab bar must render on Home.

- Asserted presence of `tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket` immediately after Skip: **NOT present** (AX tree + screenshot OCR).
- Control (after relaunch): **present** — proves the behavior is relaunch-dependent, not a broken build.

**Root cause (exact sequence for the dev side):**
1. `OnboardingScreen.handleSkip()` → `markOnboardingSkipped(userId)` (DB flag set ✓) → `navigateToHome()`.
2. `navigateToHome()` runs `navigation.replace('Home')` **and** `route?.params?.onOnboardingFinished?.()`.
3. `route.params.onOnboardingFinished` is `undefined` because `AppNavigator.tsx`'s `Onboarding` Stack.Screen (≈L473–478) has **no `initialParams={{ onOnboardingFinished: … }}`** — the optional-call `?.()` silently no-ops.
4. Root gate `shouldShowOnboardingCarousel` stays `true` → `showOnboardingCarousel` stays `true` → `PersistentTabBar` (`{isAuthenticated && !isSuspended && !showOnboardingCarousel && <PersistentTabBar />}`, AppNavigator L970) never mounts.
5. Only a **fresh mount** re-runs the `[currentUserId]` effect → `shouldShowOnboarding` now returns false (skipped_at set) → gate flips → tab bar mounts. Hence the relaunch dependency.

**Why the "previously verified fix" appeared to pass:** `OnboardingScreen.test.tsx` mocks `params: { onOnboardingFinished: mockOnOnboardingFinished }` (8 tests) — it verifies the screen *calls* the callback given the param, but **nothing verifies the param is actually provided by AppNavigator**. The wiring gap is invisible to the unit suite.

---

## 4. UX notes

### 4.1 Structural / affordance
- Onboarding→Home transition itself works (Home renders fully, header "Norwalk Central", composer, action tiles). No crash, no frozen state.
- **Finding (HIGH):** after Skip, the user lands on Home with **no way to navigate** to Discover/Sell/Trades/Basket until they kill and reopen the app. This is a real functional regression for first-run users who Skip onboarding — they are effectively stranded on Home.

### 4.2 Wording / copy clarity
- No wording defects observed in the signup/OTP/ProfileSetup/onboarding path this run. Copy was clear and child-marketplace-appropriate (e.g., "We'll assign you to your nearest community node", onboarding slide copy).

### 4.3 Design-system compliance
- Signup, OTP, Profile Setup, carousel, and the "Success"/"Code Sent (DEV Bypass)"/OTP-success dialogs all rendered in-app with the documented palette (primary `#5DBB8E` pills confirmed via pixel scan; white modal surfaces; correct spacing). **No deviations found** on the screens/dialogs visited.
- Note (environment, not a defect): a dev-only LogBox footer "[phoneService] send-phone-otp invoke error" (the dev SMS-bypass fallback) appeared at the bottom during Profile Setup/Home — a known dev-environment artifact, non-fatal, matching Phase 23.

---

## 5. Locator-gap findings

- `complete-setup-button` did not surface in the AX tree even when visible on screen (below the tree's listed range). Fallback: pixel-scan of the primary-green pill (#5DBB8E) → measured bbox `1176x156+72+58` (in y2200 crop) → tapped center (220,779)pt. **Recommended instrumentation fix:** ensure the button's `accessible`/`accessibilityRole` exposure is consistent so it surfaces reliably.
- All other controls (signup autofill, OTP dev buttons, skip-button, tab bar items) were properly AX-exposed.

---

## 6. Friction vs. operating rules

- **Software keyboard would not dismiss** (Cmd+K toggle blocked by macOS Accessibility permission for the script process; swipe-down-on-keyboard ineffective; number-pad has no Return). Resolved via ScrollView default `keyboardShouldPersistTaps='never'` → neutral-area tap dismissed it. ~4 extra steps.
- Profile Setup form would not scroll while the keyboard was up (swipes produced no layout change) — the Complete Setup button sat behind the keyboard. Once the keyboard was dismissed, the button was reachable.
- Both items are consistent with the Phase 22 notes on below-fold coordinates + keyboard-compressed layouts; cost ~2 min, no impact on the verdict.

---

## 📋 QA Session Handoff

**Test Scope:** Tab-bar-after-Skip quick re-check (fresh signup → phone verify → carousel → Skip → no-relaunch; AUTH-TC-H06/H07 intent)
**Design-System Compliance:** PASS — No deviations found on the screens/dialogs visited (Signup, OTP, Profile Setup, Onboarding carousel, Success/DEV-bypass dialogs all matched `design-system-passitup.md` palette/typography/spacing; primary pills verified `#5DBB8E` via pixel scan). Dev LogBox footer is an environment artifact, not a design deviation.
**Perceived Load-Time Verdict:** GOOD — Skip → Home rendered in ~2s (simulator wall-clock, ±polling precision); no transition ≥3s observed.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Create Account screen: wording + layout match design-system requirements.
- CONFIRMED — Verify Your Phone screen + DEV-bypass/OTP-success dialogs.
- CONFIRMED — Complete Your Profile screen (+ Success dialog).
- CONFIRMED — Onboarding carousel (Skip control + slide copy).
- CONFIRMED — Home (dashboard) after Skip and after relaunch.
**Verdict Summary:** 0 PASS / **1 FAIL** / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **(HIGH) Tab bar does NOT render after Skip without a relaunch** — fresh users who Skip onboarding land on Home with no tab navigation until they force-quit/reopen. Reproduced on-device; control relaunch shows all 5 tabs. **Not a regression — the `initialParams={{ onOnboardingFinished }}` wiring was never implemented** in `AppNavigator.tsx` (`git log -S` empty; unit tests mock the param so they pass).
2. **(MEDIUM) Doc/memory drift:** flow-registry L3495 and repo memory `onboarding-gate-tabbar.md` claim the wiring exists "via `initialParams` on the Onboarding screen" — the source contradicts this.
3. **(LOW) Locator gap:** `complete-setup-button` not AX-exposed when on-screen (pixel-scan fallback used).
**App State Left Behind:** Throwaway fresh account `qa.alice.17870697215208569@kidsmarketplace.test` (user_id `09a61811-1d5c-4993-9241-53115fbe2781`, "QA TabBar Check", ZIP 06850 → Norwalk Central, phone verified, `onboarding_skipped_at` set). **Logged out** via `p2pkidsmarketplace://qa-logout`; app left on clean Landing, session cleared. No code, seed, or config files touched.
**Why It Matters:** The Phase 23 retrospective flagged the relaunch-after-Skip pattern as possibly a "habitual workaround"; this run proves it is a **real, reproducible defect** — the tab bar genuinely requires a relaunch, so the "previously verified fix" (Addendum 73 / EDU-004) is incomplete. Every fresh user who Skips onboarding hits a dead-end Home.
**How to Verify/Reproduce:** Exact sequence in §1/§3 (fresh signup → phone verify → ProfileSetup ZIP 06850 → carousel Skip → list AX tree on Home → no `tab-*` elements; screenshot OCR of bottom region confirms). Control: terminate → relaunch → all 5 `tab-*` present. Evidence in `e2e-test-results/tabbar-after-skip-recheck-2026-08-18/evidence/`.
**Known Gaps / Not Tested:** Get Started (onboarding-complete) path not re-run this session (both paths share `navigateToHome`/the same broken callback, so the defect applies to both — source-verified; Get Started completion path is covered by AUTH-TC-H07 historically). Android out of scope.
**What Needs To Be Fixed Next:**
1. **Fix (blocking):** wire the callback — add `initialParams={{ onOnboardingFinished: () => setShouldShowOnboardingCarousel(false) }}` (or equivalent) to the `Onboarding` `Stack.Screen` in `AppNavigator.tsx`, per the intended Addendum 73 design. Verify on-device that Skip → Home shows the tab bar immediately (no relaunch).
2. **Fix (medium):** add a regression test that exercises the **real AppNavigator wiring** (render AppNavigator with a mocked auth/session + onboarding state, tap Skip, assert `tab-*` mounts) — the current `OnboardingScreen.test.tsx` only mocks the param and cannot catch this.
3. **Fix (low):** reconcile doc drift — update flow-registry L3495 and `/memories/repo/onboarding-gate-tabbar.md` to reflect the actual (unwired) state, then flip to "wired" after fix #1 lands.
4. **Fix (low):** AX-expose `complete-setup-button` consistently.
**UX Enhancement Ideas (optional, not defects):** None this run — no friction or enhancement opportunities observed beyond what's already noted above.
**Suggested Next Session:** After the dev-side fix #1 lands, re-run this exact quick-check (fresh signup → Skip → no-relaunch → assert all 5 `tab-*`), plus the Get Started (H07) completion path, in one small batch.
**Suggested to Improve Agent Rules:** none — the existing §5.9 (screenshot as source of truth) + §5.4 (native-modal pixel-scan) + git-history verification (borrowed from A0-4/`git log -S`) discipline was sufficient; the keyboard-dismiss fallback (neutral-tap on a `keyboardShouldPersistTaps='never'` ScrollView) is worth noting in repo memory for future signup-flow runs.

*Generated 2026-08-18 · QA Test Agent (execution-only).*
