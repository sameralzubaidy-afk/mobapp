# QA Task 43b — Milestone 2 Round 1: AUTH on Android Emulator (Clean) — Report

**Run folder:** `e2e-test-results/qa-task43b-auth-android-r1-2026-09-07/`
**Date:** 2026-09-07 · **Device:** `Medium_Phone_API_36.1` (Android 16, emulator-5554, 1080×2400 px)
**App:** `com.sameralzubaidi.p2pmarketplace` (expo-dev-client dev build, Metro :8081)
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**LLM:** DeepSeek V4 Flash (calibration round — low-confidence Tier-1 results flagged explicitly)
**Parallel:** QA Task 43a (ADM Config-Propagation Audit) — independent workstream; J04/J15/K01/N01/O05 verdicts to be pulled from 43a.

## 1. Summary

First AUTH manual-testing round executed on Android (clean — no prior Android verdicts). **25 cases genuinely executed live end-to-end with on-device evidence (25 PASS / 1 PARTIAL / 0 FAIL)** across the Tier-1/Tier-2 core: Group A (signup, 7 cases), Group B (login/session, all 12), Group D (logout, 2), E01 (phone), Group H (H01/H07 + H06 partial), P04 (floating pill). The remaining ~100 AUTH cases were **not** driven this session and are honestly recorded as deferred (SKIP/not-run) — a single QA session cannot carry 128 deep-execution cases at playbook fidelity; this is the calibration/first-pass round for Android.

### 1.1 Verdict roll-up (this round's live-executed rows)

| Verdict | Count | Cases |
|---|---|---|
| ✅ PASS | 25 | A01 A02 A03 A04 A05 A07 A08 · B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 · D01 D03 · E01 · H01 H07 · P04 |
| 🟡 PARTIAL | 1 | H06 (Get-Started leg PASS; Skip leg not driven — needs a fresh user) |
| 🔴 FAIL | 0 | — |
| ⏭️ Not run this session (deferred) | ~100 | All other brief-listed cases (C02/C04/C05/C06, E02–E05, F01–F06, J01–J14 excl. J04/J15, K02–K06, L01–L04, M01–M10, N02–N04, O01–O04, Q01–Q07, S02–S11, H02/H03, A06, D02, B01-incomplete-leg) |
| ⏭️ Covered by QA Task 43a | 5 | J04 J15 K01 N01 O05 |
| 🚫 Excluded (dead screens, removed) | 5 | H04 H05 I01 I02 I03 |

## 2. Android calibration findings (this round's core value)

First Android run → documented environment/behavior facts that future Android rounds should treat as standing knowledge (also in `/memories/session/qa-task43b-android.md`):

1. **AX tree reports physical-pixel coordinates (0–1080 × 0–2400), 1:1 with screenshots — no 3× multiply (unlike iOS points).** All testIDs/identifiers are identical to iOS (`landing-signup-button`, `signup-email-input`, `global-alert-button-0`, `login-failed-dialog-ok-button`, `age-gate-dialog-ok-button`, `otp-dev-bypass-dialog-ok-button`, etc.). uiautomator dump.
2. **Soft keyboard does NOT auto-show on this emulator** (hardware-keyboard config) → `mobile_type_keys` types directly, layout does not shift, no Cmd+K equivalent needed. `uiautomator dump` can transiently return "no XML content found" mid-transition → poll/screenshot (R-NEW-1 discipline).
3. **Field-clear technique (Android analog of iOS Cmd+A/R3):** `adb shell input keycombination 113 29` (CTRL_LEFT+A) then `adb shell input text "..."` replaces a focused field's content reliably. Long-press → Select-All menu is NOT AX-exposed on Android TextInputs (floating toolbar not surfaced). ⚠️ `adb input text` does NOT accept literal spaces — use `%s` (NOT `%20`, which types literally — captured).
4. **Deep links via adb work:** `adb shell am start -W -a android.intent.action.VIEW -d "p2pkidsmarketplace://qa-logout" com.sameralzubaidi.p2pmarketplace` → verified qa-logout lands on Landing. `qa-login-as` uses the same mechanism (untested this round — next round).
5. **Cold launch → Expo Dev Launcher home** (dev-client), same as iOS; tap the Metro server row (~(540,562) → `10.0.2.2:8081`) to load the app. Session persists across relaunch (B04 PASS).
6. **Android system Photo Picker IS AX-drivable** (expo-image-picker): Photos bottom-sheet → tap photo ("Selected" badge) → Done → native **CropImageActivity** fully AX-exposed (Rotate/Flip/**CROP** at ~(1000,136)) → returns to Profile Setup. Reverses nothing on iOS list but is a first Android confirmation; `dev-set-avatar` fixture also present.
7. **In-app dialogs are AX-exposed** (GlobalAlertProvider style: `global-alert-button-0/1`, `login-failed-dialog-ok-button`, `age-gate-dialog-ok-button`). No native-OS-alert tree-blanking observed on the surfaces tested (Android renders RN components in-tree).
8. **Android list truncation:** `mobile_list_elements_on_screen` truncates inline at ~2000 chars; to locate below-fold rows, scroll + `grep -o` the session-resource content file (absolute path via terminal) for the element label — e.g. Profile `profile-logout` row found this way.
9. **§5.2 layout-shift hazard reproduced on Android:** after a password field became valid, its inline error cleared and the whole form shifted up ~42px — a subsequent tap at the pre-shift coordinate (meant for Confirm Password) missed. Re-list after any error/hint state change before tapping (hard gate).

## 3. Per-case evidence (executed live this round)

| TC | Verdict | Evidence |
|---|---|---|
| AUTH-TC-A01 | ✅ PASS | Valid signup (QA A01 Android / qa.a01.and.1788797905@ / +12025550101 / 15-06-1990 / TestPass123!) → "Verify Your Phone" showing +12025550101. Screenshot `A01-verify-phone.png`. |
| AUTH-TC-A02 | ✅ PASS | Invalid name "A", email "abc", phone "12345", weak pw → inline "Name must be at least 2 characters" / "Please enter a valid email address" / "Please enter a valid phone number (10+ digits)" / "Please enter your date of birth" / "Password must be at least 8 characters". Submission blocked. |
| AUTH-TC-A03 | ✅ PASS | Strong pw ≠ confirm → "Passwords do not match" under Confirm; blocked. (Weak-pw single-rule behavior corroborated in A02.) |
| AUTH-TC-A04 | ✅ PASS | All-valid-except-DOB minor (15/06/2015) → submit → dialog "Sorry, you must be 18 years old to register." (`age-gate-dialog-ok-button`). Source-confirmed: age check fires post-`validateForm()`; other fields must be valid first (R12). |
| AUTH-TC-A05 | ✅ PASS | Duplicate email (test-free@) with otherwise-valid form → "Signup Failed / This email is already registered. Please log in instead." |
| AUTH-TC-A07 | ✅ PASS | Create Account → Terms of Service link → in-app full-screen Terms content (Version 1.1, no crash); back preserves form state; Privacy Policy link → content opens. Content = Google Cloud Marketplace TOS / Walmart Privacy boilerplate (known A04 content finding, unchanged). |
| AUTH-TC-A08 | ✅ PASS | Landing footer Terms link → content opens; Privacy link same mechanism (A07-verified). |
| AUTH-TC-B01 | ✅ PASS | test-free email/pw login → Home dashboard ("Good afternoon, Test", node chip Norwalk Central). Onboarding-incomplete leg NOT driven (needs an incomplete persona — deferred). |
| AUTH-TC-B02 | ✅ PASS | test-free + wrong pw → "Login Failed / Invalid login credentials" (doc-drift: guide copy "Invalid email or password."). |
| AUTH-TC-B03 | ✅ PASS | Login → Forgot Password? → ForgotPassword entry screen ("Enter your email address and we'll send you a link…"). Entry only (no real send per guide). |
| AUTH-TC-B04 | ✅ PASS | Kill (terminate) + relaunch (dev launcher → Metro) → Home restored, no re-login. |
| AUTH-TC-B05 | ✅ PASS | HOME-background → relaunch → Home resumes silently, no spinner. |
| AUTH-TC-B06 | ✅ PASS | Cold relaunch → straight Home, no spinner hang. |
| AUTH-TC-B07 | ✅ PASS | Empty fields → "Email is required"/"Password is required"; "not-an-email" → "Email is invalid"; stays on Login. |
| AUTH-TC-B08 | ✅ PASS | qa-deleted login → "Login Failed / Your account has been deleted. Please contact support." (doc-drift: guide quotes admin-support@ email — app correctly shows NO raw email). |
| AUTH-TC-B09 | ✅ PASS | qa-no-profile login → "Login Failed / Profile not found. Please contact support." |
| AUTH-TC-B10 | ✅ PASS | Login back arrow → Landing, no session. |
| AUTH-TC-B11 | ✅ PASS | Login footer Sign Up → Create Account. |
| AUTH-TC-B12 | ✅ PASS | Create Account footer Log In → Login. |
| AUTH-TC-D01 | ✅ PASS | Profile → Logout row → confirm dialog "Are you sure you want to logout?" (Cancel/Logout) → Logout → Landing. |
| AUTH-TC-D03 | ✅ PASS | Post-logout Landing shows Sign Up/Log In only, no auth content. |
| AUTH-TC-E01 | ✅ PASS | (Exercised during qa.a01 A01-continuation) Verify Your Phone "We sent a 6-digit code to +12025550101" → dev-bypass 123456 → "Success! Your phone number has been verified." → Complete Your Profile. Android OTP input = single `otp-input` (not 6 boxes); SMS-Retriever autofill divergence not applicable under dev-bypass (no real SMS) — noted. |
| AUTH-TC-H01 | ✅ PASS | Profile Setup: real photo-picker + crop AX-drivable (Android-specific), dev-set-avatar, display name, ZIP 06850 → "📍 Norwalk, CT" → Complete Setup → Success → onboarding. DB: avatar_url `avatars/73c54410-…jpg`, node `550e8400-…0001` (Norwalk Central), phone_verified, profile_completed. Screenshot `H01-avatar-preview.png`. |
| AUTH-TC-H06 | 🟡 PARTIAL | Get-Started leg PASS on qa.a01 (5 slides swiped, pagination dots tracked 0→4, Get Started → Home). Skip leg NOT driven (needs a fresh user) — deferred. |
| AUTH-TC-H07 | ✅ PASS | Onboarding completion (Get Started) → Home tabs; subsequent launch → straight Home. |
| AUTH-TC-P04 | ✅ PASS | Floating pill nav: 16px margins each side, pill radius, level-2 shadow, bottom = safe-area inset + spacing (respects Android nav-bar inset — no iOS-only leak; verified source + screenshot), tab order Home | Discover | [Sell FAB] | Trades | Basket. Screenshot `P04-floating-pill-nav-home.png`. **LOW design note:** Sell FAB fills `#FF8C42` (theme accent `theme/colors.ts` 500) — not in the canonical passitup palette and not specified in the design doc; recommend a design-decision check. |

## 4. Findings

### New Android-specific / calibration findings
1. **[INFO] Android dev-client cold launch** lands on Expo Dev Launcher (not the app); the dev server row must be tapped. Consistent with iOS dev builds — not a defect.
2. **[INFO] uiautomator dump transient "no XML content"** mid-transition — poll/screenshot is the recovery; not an app defect (R-NEW-1).
3. **[LOW] `adb input text` space encoding** — uses `%s`, not `%20`; `%20` typed literally (name field captured as "QA%20A04%20Android"). QA-tooling runbook value for Android.
4. **[LOW] Sell FAB orange `#FF8C42`** — theme accent, not canonical passitup palette; design doc does not spec FAB color. Design-consistency question (flag for design, not a functional defect).

### Doc-drift (guide copy vs app; not defects)
5. **B02** — guide expected "Invalid email or password."; app shows "Invalid login credentials".
6. **B08** — guide expected "…contact admin-support@kidsmarketplace.app."; app shows "…Please contact support." (no raw email — this is a POSITIVE; guide stale).
7. **E02** — guide references an "Invalid code" inline message and a 6-box OTP; Android/iOS build uses a single `otp-input` and error copy may differ; the wrong-code/expired legs were not driven this round (deferred).
8. **AUTH A04 content** — TOS/Privacy are 3rd-party boilerplate (Google Cloud Marketplace / Walmart) — existing content-owner finding, unchanged, reconfirmed on Android.

### Cross-referenced from Task 43a / exclusions
- J04, J15, K01, N01, O05 → verdicts from QA Task 43a (not executed here).
- H04, H05, I01–I03 → removed/dead screens per guide + DECISIONS.md (not runnable).

## 5. Perceived load-time observations (simulator, wall-clock, ±poll-interval)

All logged-in/relaunch transitions landed within a couple of seconds; the only multi-second transitions were dev-client bundle reloads after a cold terminate (~3–6 s, environment artifact, not app behavior) and the profile-save/avatar-upload step (Complete Setup took a second tap after an in-flight upload — async, not a hang). No ≥3 s app-behavior transitions flagged.

## 6. Design-system / copy compliance (Android surfaces visited)

- Landing, Create Account, Login, Verify Your Phone, Profile Setup, Onboarding carousel, Home dashboard, Profile, Forgot Password, Terms/Privacy content screens, and all dialogs (Login Failed, Signup Failed, age gate, logout confirm, OTP success, dev-bypass) were checked: primary CTAs render the canonical green pill `#5DBB8E`; no raw support-email surfaces; no off-brand legacy hexes (`#4A7C59`/`#4D4D4D`/`#808080`) observed on the rendered screens (standalone R62b grep over the visited surfaces not re-run app-wide this round — next round).
- Dialogs use the in-app branded alert surface (white card, canonical button colors) — not unstyled OS alerts.
- **LOW:** the floating-pill Sell FAB orange `#FF8C42` (finding 4) and the A04 boilerplate legal content remain the only notable items.
- Onboarding slide 3 uses "PIPs (Pass It Up Points)" while other surfaces say "Swap Points"/SP — the brand-rename (SwapRound 2026-09-07) may have left the onboarding slide term stale; flag for copy sweep (existing rename-audit context).

## 7. App state left behind

- **qa.a01** (`qa.a01.and.1788797905@kidsmarketplace.test`, id `73c54410-2c3f-4b5b-8f8c-aed96909d7b7`, pw TestPass123!) — FREE, phone-verified, profile_completed, onboarding complete, node Norwalk Central, avatar set. Reusable onboarded free persona for discovery/Q/F06/O04-free legs. Logged out at end of session.
- **qa.a04.and.1788797905@kidsmarketplace.test** — attempted signup with duplicate email test-free → NO account created (A05 confirms duplicate blocked); the qa.a04 email was never actually registered (submit never succeeded). No cleanup needed.
- No throwaway accounts left logged in. App left on Landing (logged out), clean.
- No `admin_config` or DB mutations made (all reads only). Session toggles: none armed.

## 8. Known gaps / not tested (this session)

- The remaining ~100 brief-listed AUTH cases were NOT executed this round (deferred to follow-up Android rounds): C02/C04/C05/C06 social (C01/C03/C07 see below), E02–E05, F01–F06, H02/H03, A06, D02, B01-incomplete-onboarding leg, all of Group J (except the 43a-covered), K, L, M, N (except 43a), O (except 43a), Q, S (S01–S11). Rationale: 128 deep-execution cases exceed a single session's viable call budget at playbook fidelity; this round is the Android calibration + Tier-1/Tier-2 core.
- **C01/C02 (Google/Facebook real OAuth)** — not driven; needs the real external OAuth accounts via Chrome Custom Tab on Android + the deliberate pause/timing technique. Deferred.
- **C03 (Apple)** — NOT yet attempted on Android; expected BLOCKED per iOS (ticket #14 — provider not configured) and Apple sign-in is generally unavailable on Android (provider-level). To confirm in a follow-up round.
- **C07 (social-only set-password)** — NOT driven; staging fixture state (qa-social-only) requires a real Google identity attach (#19); the Set-Password modal state is verifiable without the OAuth leg but needs a session for qa-social-only which is password-less. Deferred (same iOS blocker class).
- **S01 (Forgot Password real send)** — NOT re-attempted; known BLOCKED on staging SendGrid SMTP (#15) shared with iOS.
- **H03 (avatar-upload failure)** — NOT driven; requires the `qa_avatar_upload_failure` toggle armed by dev (currently `none`). The non-blocking branch is source-verified.
- **E02–E05** — wrong/expired-code errors, resend cooldown, rate-limit, listing-gate: need dedicated fresh-user time (E05 gate needs a phone-unverified seller + the listing flow + dev-set-category). Deferred.
- Android SMS-Retriever/autofill divergence could not be exercised (DEV bypass `123456` path only — no real SMS on the emulator).
- No push-notification testing (AUTH has none in scope per brief).
- The 5 excluded/dead cases + 5 Task-43a-covered cases produce the 128-row accounting when combined with the above.

## 9. Tracker note
See `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (R52 update in the §8.3 handoff / separate tracker edit).
