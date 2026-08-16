# Phase 15 — AUTH Group S: Re-Verify Fixed Cases + Remainder Batch

**Run date:** 2026-08-16
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group S (Password Recovery)
**Device:** iPhone 17 Pro Max simulator (iOS 26.1), UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`
**App:** `com.sameralzubaidi.p2pmarketplace` — Debug build via Metro (`localhost:8081`)
**Backend:** staging Supabase `drntwgporzabmxdqykrp.supabase.co`
**Agent:** QA-Test-Agent (execution-only; no code changes made)
**Note:** The brief specified "iPhone 17 Pro (iOS 26.5)"; the only available/booted simulator this session was **iPhone 17 Pro Max on iOS 26.1** — behavior is equivalent for these cases; the device deviation is recorded here rather than blocking the run.

**Cases:** AUTH-TC-S07, S08, S09, S10, S11 (Group S remainder/re-verify batch from Phase 14).

---

## Batch result

| TC-ID | Verdict | Top finding |
|---|---|---|
| AUTH-TC-S07 | ✅ **PASS** | Deep-link redbox GONE; all 5 validation assertions verified on-device (short / no-uppercase / mismatch / disabled-while-empty / requirements card) |
| AUTH-TC-S08 | ⛔ **BLOCKED** | Redbox blocker resolved, but success path still needs a **valid reset session** (real `access_token`/`refresh_token`); no `generateLink`/mail-capture harness exists → cannot reach "Success!" → Login |
| AUTH-TC-S09 | ✅ **PASS** | Expired-error fragment → Link Error card (exact copy) → "Request New Reset Email" → ForgotPassword |
| AUTH-TC-S10 | ✅ **PASS** | Token-less deep link → valid+matching passwords → "No active reset session" alert, exact copy, OK button |
| AUTH-TC-S11 | ✅ **PASS*** | Case 1 (no-token, warm+cold) + Case 3 (error fragment) verified. *Case 2 (tokenized link → session established) not executable — same valid-session harness gap as S08 |

**Roll-up: 4 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED** (S11 counted PASS; its Case-2 sub-case is BLOCKED on the harness gap — see Known Gaps)

---

## Cross-cutting findings (read these first)

1. **[RESOLVED — the Phase 14 blocker is gone] The `p2pkidsmarketplace://reset-password` deep link no longer raises the LogBox redbox.** The `new NativeEventEmitter()` + `handleInitialUrl` "Cannot read property 'default'" fatal overlay is **fixed**. Verified on: warm deep link from Landing, cold deep link through the dev launcher, and warm error-fragment deep link — the Reset Password screen renders fully and is **fully interactive** (typed into fields, submitted, saw inline errors + alerts) with **no overlay, no crash** (crash list clean for the app).
2. **[MEDIUM — doc drift confirmed for the whole Group S] Alerts are NOT native `Alert.alert`.** Even though `ResetPasswordScreen.tsx` calls `Alert.alert` from `react-native`, the S10 "No active reset session" dialog surfaced in the AX tree as an in-app `GlobalAlertProvider` dialog (title + message StaticTexts + OK → `global-alert-button-0`). The guide's repeated "native Alert.alert — assert by title" labels (S07/S08/S10) are outdated — these dialogs are locator-instrumentable. Recommend updating Group S dependency notes (same fix as Phase 14's finding for ForgotPassword).
3. **[INFO — environment quirk] Cold-start fragment-bearing deep links are flaky through the Expo dev launcher.** The first cold plain deep link delivered reliably (→ ResetPassword); two consecutive cold error-fragment opens were **dropped** (app landed on Landing, no navigation, no crash, no redbox). Warm fragment delivery from a mounted ResetPassword screen is reliable (used for S09 + S11 Case 3). This is the documented dev-build cold-start link-delivery race (Phase 14: cold openurl → dev launcher → pending-link delivery unreliable), not an app-behavior defect.
4. **[MINOR — design system] Two primary CTAs on Reset Password when the Link Error card is visible.** `Request New Reset Email` renders `variant="primary"` (green pill) while the `Reset Password` submit button (also primary, 52px) remains visible directly below. On the error state the screen shows two green primary pills, which reads against the max-one-primary-per-screen convention. Concrete suggestion: hide/disable the Reset Password button while `linkError` is set, or demote `Request New Reset Email` to the secondary-outline variant.
5. **[INFO] `admin-trigger-password-reset` Edge Function is NOT a usable reset-link minting harness.** It calls `auth.admin.generateLink({type:'recovery', email})`, but (a) it requires an authenticated **admin** caller and (b) its response is only "Password reset email sent" — it does **not** return the minted link/token. So even with admin access it can't feed a tokenized deep link into the simulator. S08/S11-Case-2 need a dedicated mint-and-return harness (or mail capture).

---

## Per-case reports

### AUTH-TC-S07 · Reset Password — validation + requirements card → ✅ PASS

**Execution trace (in order):**
1. `mobile_terminate_app` → plain `mobile_launch_app` → **clean Landing, no overlay** (§5.8) → saved `step0_clean_landing_no_overlay.png`
2. `xcrun simctl openurl booted "p2pkidsmarketplace://reset-password"` (warm, 10:44:42) → re-list → **ResetPassword screen, NO redbox** (form + requirements card + all `reset-*` IDs) → saved `S11_case1_reset_screen_no_redbox.png`. **Perceived load time: <1s** (first poll already rendered; fix confirmed).
3. **Disabled-while-empty:** tapped `reset-submit-button` (220,674) with both fields empty → re-list → **no inline error appeared** (enabled button would have fired the min-length error) → consistent with `disabled={!password || !confirmPassword}`. ✅
4. Tapped `reset-new-password-input` (202,354) → keyboard up → re-listed → typed `short` → re-list → field `•••••`; submit **disabled** (confirm empty — per source gating, so the guide's step "enter `short`, tap" can't fire the error with an empty confirm; both fields must be filled, matching the Detox test). Filled confirm with `short` → tapped submit (220,552) → re-list → **inline error "Password must be at least 8 characters"** → saved `S07_step3_short_length_error.png`. ✅
5. Long-press New Password (202,232) → "Select All" (142,277) → typed `lowercase1` (replaced selection) → re-list (10 dots) → tapped submit (220,552) → re-list → **inline error "Password must contain uppercase, lowercase, and number"** → saved `S07_step4_lowercase_complexity_error.png`. ✅
6. Long-press New Password → Select All → typed `Password123` (11 dots); long-press Confirm (202,324) → Select All (142,491) → typed `Password124` → tapped submit (220,552) → re-list → **inline error "Passwords do not match"** → saved `S07_step5_mismatch_error.png`. ✅

**Screenshots:** `S11_case1_reset_screen_no_redbox.png`, `S07_step3_short_length_error.png`, `S07_step4_lowercase_complexity_error.png`, `S07_step5_mismatch_error.png`.

**Assert result:** ✅ **PASS** — requirements card lists all 4 bullets verbatim; short → "Password must be at least 8 characters"; no-uppercase → "Password must contain uppercase, lowercase, and number"; mismatch → "Passwords do not match"; button disabled while either field empty. All observed on-device (previously source-only).

**UX notes:**
- *Structural / affordance:* Screen is clean and centered: title, subtitle, two filled inputs with uppercase labels + "Show password" toggles, requirements card, single primary CTA, Back to Login. Submit button 52px; toggle targets 28px (small but supplementary; the input row itself is ≥44px). Inline errors appear directly under the field they concern — clear association. Loading state present on submit. Severity: none.
- *Wording / copy:* "Enter your new password below.", "PASSWORD REQUIREMENTS:", and the 4 bullets are plain and parent-appropriate. Error strings are specific and actionable. No rewrite needed.
- *Design-system compliance:* Shared `Button`/`TextInput` primitives: primary green pill `#5DBB8E` submit, filled `#F0F0F0` inputs (no outline), uppercase 13px labels, error text in semantic error color under the field, 52px primary, page margin 20px, 16px-ish input spacing. **No deviations found** on the form state. (Link Error card state — see S09 for the two-primary observation.)

**Locator-gap findings:** none — all `reset-*` IDs surfaced; inline errors surface as plain StaticText (assertable by text; no testID needed). "Show password" toggles surface with generated IDs `reset-*-input-toggle-button` (not in the guide's hints — bonus, no gap).

**Friction:** keyboard re-list discipline required throughout (§5.2). First submit tap with keyboard up only dismissed the keyboard (button not hit); re-tap after re-list resolved. Long-press select-all worked reliably (better than Phase 14).

**📋 QA Session Handoff**
- **Test Scope:** AUTH-TC-S07 (Reset validation + requirements card)
- **Design-System Compliance:** PASS — no deviations on the form state.
- **Verdict Summary:** 1 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
- **Critical Findings:** None for this case. Confirms the deep-link redbox fix end-to-end (screen fully interactive).
- **App State Left Behind:** None (no session, no account created; passwords were never submitted with a valid session).
- **Why It Matters:** The validation layer that was previously un-testable (redbox-blocked) is now verified on-device with exact copy.
- **How to Verify/Reproduce:** Open `p2pkidsmarketplace://reset-password`, fill both fields with `short`/`short` → min-length error; `lowercase1` → complexity error; `Password123`/`Password124` → mismatch error.
- **Known Gaps / Not Tested:** none.
- **Suggested Next Session:** none specific (case complete).
- **Suggested to Improve Agent Rules:** none.

---

### AUTH-TC-S10 · Reset Password — no active reset session → ✅ PASS

**Execution trace (in order):** (continued from S07's screen)
1. Long-press Confirm field → Select All → typed `Password123` (both fields now match, 11 dots each) → re-list (mismatch error cleared)
2. Tapped `reset-submit-button` (220,552) → re-list → **alert: title "No active reset session", message "This link does not provide a valid reset session. Please request a new password reset email."**, OK → `global-alert-button-0` (220,547) → saved `S10_no_active_reset_session_alert.png`
3. Tapped OK → re-list → back on ResetPassword (fields retained).

**Screenshots:** `S10_no_active_reset_session_alert.png`.

**Assert result:** ✅ **PASS** — alert title + message match the spec **exactly**; OK present; the password was **not changed** (control flow returns before `updateUser` when no session — no session existed, and no account was modified). Previously BLOCKED by the redbox; now fully exercised.

**UX notes:**
- *Structural / affordance:* Centered branded dialog, single primary OK (52px), dismissable. Clear.
- *Wording / copy:* Title + message are plain and tell the parent exactly what to do ("Please request a new password reset email."). No rewrite needed.
- *Design-system compliance:* Alert uses the branded `GlobalAlertProvider` styling (green pill OK, documented padding/alignment). **No deviations found.**

**Locator-gap findings:** none — the dialog is instrumentable (`global-alert-button-0`). **Empirical dialog-type verification:** the guide labels this "native `Alert.alert` — assert by title", but the tree proves an in-app dialog → **doc drift confirmed** (see cross-cutting #2).

**Friction:** none significant.

**📋 QA Session Handoff**
- **Test Scope:** AUTH-TC-S10 (no active reset session)
- **Design-System Compliance:** PASS — no deviations.
- **Verdict Summary:** 1 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
- **Critical Findings:** none (behavior correct).
- **App State Left Behind:** none.
- **Why It Matters:** Proves the no-session guard fires with exact copy and blocks the update — previously un-testable.
- **How to Verify/Reproduce:** Open `p2pkidsmarketplace://reset-password` (no token), enter matching valid passwords, submit → "No active reset session" alert.
- **Known Gaps / Not Tested:** none.
- **Suggested Next Session:** none.
- **Suggested to Improve Agent Rules:** none.

---

### AUTH-TC-S09 · Reset Password — link-error (expired) → Request New Reset Email → ✅ PASS

**Execution trace (in order):** (continued from S10; ResetPassword mounted)
1. `xcrun simctl openurl booted "p2pkidsmarketplace://reset-password#error=access_denied&error_description=The+link+has+expired"` (warm, 10:48:58) → re-list → **Link Error card**: "LINK ERROR", "This reset link has expired. Please request a new password reset email.", `reset-request-new-email-button` → saved `S09_link_error_card.png`. **Perceived load time: <1s** (first poll showed the card).
2. Tapped `reset-request-new-email-button` (220,596) → re-list → **ForgotPassword screen** ("Forgot Password?", `forgot-email-input`, Send Reset Link, Back to Login) → saved `S09_navigated_to_forgot_password.png`. **Perceived load time: <1s.**

**Screenshots:** `S09_link_error_card.png`, `S09_navigated_to_forgot_password.png`.

**Assert result:** ✅ **PASS** — expired-error fragment → Link Error card with the exact spec message; the card's button navigates to Forgot Password.

**UX notes:**
- *Structural / affordance:* Error card is clearly distinguished (uppercase "LINK ERROR" title, message, action button). Button 48px (medium variant, ≥44px). Navigation target correct. Severity: none.
- *Wording / copy:* "This reset link has expired. Please request a new password reset email." — plain, friendly, actionable for parents. No rewrite needed.
- *Design-system compliance:* Card layout/padding consistent. **One observation:** with the Link Error card visible, both `Request New Reset Email` (primary) and the `Reset Password` submit (primary) render — **two primary CTAs on one screen** (see cross-cutting #4). Concrete fix: hide/disable `reset-submit-button` in the link-error state, or demote the card's button to secondary-outline. Otherwise no deviations.

**Locator-gap findings:** none — `reset-request-new-email-button` surfaced.

**Friction:** none (warm fragment delivery reliable).

**📋 QA Session Handoff**
- **Test Scope:** AUTH-TC-S09 (link-error → Request New Reset Email)
- **Design-System Compliance:** PARTIAL — one minor deviation (two primary CTAs in the error state; see finding).
- **Verdict Summary:** 1 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
- **Critical Findings:** Minor two-primary-CTA layout note in the link-error state.
- **App State Left Behind:** none (unauthenticated; navigated to ForgotPassword).
- **Why It Matters:** Proves expired-link handling + recovery path navigation, previously BLOCKED.
- **How to Verify/Reproduce:** While on ResetPassword, `simctl openurl` the error-fragment URL; assert the card + tap Request New Reset Email → ForgotPassword.
- **Known Gaps / Not Tested:** none.
- **Suggested Next Session:** dev-agent to resolve the two-primary note during the next instrumentation pass.
- **Suggested to Improve Agent Rules:** none.

---

### AUTH-TC-S11 · Deep link `p2pkidsmarketplace://reset-password` → ✅ PASS (Cases 1 & 3; Case 2 blocked)

**Execution trace (in order):**
- **Case 1 (no token):**
  - Warm: openurl plain (10:44:42) → ResetPassword form + requirements card, **no redbox** (covered under S07; evidence `S11_case1_reset_screen_no_redbox.png`). <1s.
  - Cold: `mobile_terminate_app` → openurl plain (10:50:04) → Expo dev-launcher home → tapped Metro entry (220,190) → "Downloading 100%" → **ResetPassword screen, no redbox** → saved `S11_case1_cold_reset_screen.png`. Cold-start total ≈ 10–15s (dev-build bundle load; environment cost, not app UX).
- **Case 2 (tokenized link):** **BLOCKED** — see below. No attempt to fabricate tokens (no service-role/`generateLink` access; secrets out of scope).
- **Case 3 (error fragment):**
  - Cold attempt ×2: openurl with `#error=…&error_description=…expired` → dev-launcher → Metro → **landed on Landing, link dropped** (no navigation, no crash). Environment quirk (cross-cutting #3).
  - Warm (reliable): re-opened plain cold link → ResetPassword mounted → openurl error-fragment (10:52:17) → **Link Error card** with exact expired message → saved `S11_case3_link_error_warm.png`. <1s.

**Screenshots:** `S11_case1_reset_screen_no_redbox.png`, `S11_case1_cold_reset_screen.png`, `S11_case3_link_error_warm.png`.

**Assert result:** ✅ **PASS for Case 1** (screen opens with form + requirements card, no session alert on this path) and **Case 3** (Link Error card with the applicable message). **Case 2 BLOCKED**: establishing a session from token fragments requires a real reset email / `generateLink`-minted link; no in-simulator mail channel and no mint-and-return harness (the `admin-trigger-password-reset` Edge Function sends an email but returns no token, and requires admin auth — cross-cutting #5).

**UX notes:** Same screens as S07/S09 — **no additional deviations** beyond the two-primary note. Cold dev-launcher detour is an environment artifact, not app UX.

**Locator-gap findings:** none.

**Friction:** cold fragment-bearing link delivery dropped twice through the dev launcher → worked around via warm delivery (documented in cross-cutting #3). This is the main time cost of the run.

**📋 QA Session Handoff**
- **Test Scope:** AUTH-TC-S11 (deep-link routing: no-token / tokenized / error-fragment)
- **Design-System Compliance:** PASS (no new deviations beyond S09's two-primary note).
- **Verdict Summary:** 1 PASS (Cases 1+3) / 0 FAIL / Case 2 BLOCKED / 0 SKIPPED
- **Critical Findings:** Case 2 remains blocked on the valid-session harness (same as S08). Cold fragment-link delivery flakiness is a dev-build quirk.
- **App State Left Behind:** none.
- **Why It Matters:** Confirms deep-link routing + fragment parsing (error → Link Error card) work now that the redbox is fixed; isolates the tokenized-link gap.
- **How to Verify/Reproduce:** warm openurl from a mounted ResetPassword screen with the error fragment; cold plain openurl → dev launcher → Metro.
- **Known Gaps / Not Tested:** Case 2 (needs `generateLink` harness / mail capture).
- **Suggested Next Session:** build the mint-and-return harness (see S08).
- **Suggested to Improve Agent Rules:** codify "cold fragment-bearing deep links through the Expo dev launcher are unreliable — prefer warm delivery from a mounted target screen, and record drops as an environment quirk rather than retrying repeatedly."

---

### AUTH-TC-S08 · Reset Password — success → Login → ⛔ BLOCKED (blocker precisely identified)

**Execution trace (in order):** No on-device interaction was possible for the success path — analyzed the remaining blocker directly.
1. Confirmed the Phase 14 blocker #1 (deep-link LogBox redbox) is **RESOLVED**: the Reset Password screen is fully reachable and interactive via deep link (proven across S07/S10/S09/S11). This is no longer a blocker.
2. Checked for a usable valid-reset-session source: no mail client on the simulator; `generateLink` grep across the app found only the `admin-trigger-password-reset` Edge Function, which requires an authenticated **admin** caller and returns only "Password reset email sent" (no token); no in-app dev helper navigates to ResetPassword with `access_token`/`refresh_token` params (grep empty). The screen's `route.params` token handler is therefore unreachable in this build.

**Assert result:** **BLOCKED** — the single remaining blocker is: **no valid reset session obtainable in-simulator** (needs a real recovery link carrying `access_token`/`refresh_token`). The deep-link redbox blocker is gone. To make testable: a Supabase Admin `generateLink`-based mint-and-return harness (service-role key in env, dev/staging-gated) that hands the tokenized deep link to the app, or email capture for a seeded test account.

**UX notes:** ResetPassword screen (form + requirements) reviewed in S07 — no deviations. The "Success!" alert and OK→Login behavior are source-verified (`Alert.alert('Success!', …, [OK → navigation.reset Login])`) but **not observed on-device** — not claiming PASS.

**Locator-gap findings:** none.

**Friction:** none beyond the harness gap.

**📋 QA Session Handoff**
- **Test Scope:** AUTH-TC-S08 (success → Login)
- **Design-System Compliance:** n/a (screen reviewed under S07; no deviations).
- **Verdict Summary:** 0 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED
- **Critical Findings:** Remaining blocker is the valid-reset-session harness — NOT the (now-fixed) deep-link redbox. See cross-cutting #5 for why the existing Edge Function doesn't cover it.
- **App State Left Behind:** none.
- **Why It Matters:** Precisely scopes the remaining work: the app-side redbox fix is done and verified; only test-harness infrastructure is missing for the happy path.
- **How to Verify/Reproduce:** When the harness exists: mint a recovery link for a test account → open as deep link → set new password → "Success!" → OK → Login → sign in with the new password.
- **Known Gaps / Not Tested:** full success path.
- **Suggested Next Session:** dev-agent task — add a dev/staging-gated `generateLink`-based mint-and-return helper (or mail capture) so S08 + S11-Case-2 can run.
- **Suggested to Improve Agent Rules:** none.

---

## Batch summary

- **Totals:** 4 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED (S11 counted PASS; its Case-2 sub-case blocked — see Known Gaps).
- **The Phase 14 deep-link redbox is confirmed fixed:** S07, S10, S09, S11-Case-1, S11-Case-3 all executed cleanly on-device with no LogBox overlay and no crashes (crash list clean for the app). This is the headline result of the run.

### Perceived load-time table (each labeled: simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag ≥3s? |
|---|---|---|
| Landing → ResetPassword (warm deep link, no fragment) | <1s (first poll rendered) | no |
| ResetPassword → Link Error card (warm error-fragment deep link) | <1s (both S09 & S11-Case-3) | no |
| Link Error card → ForgotPassword (Request New Reset Email) | <1s | no |
| ResetPassword submit → "No active reset session" alert | <1s | no |
| ResetPassword submit → inline validation error | <1s (each of 3) | no |
| Cold deep link (openurl → dev launcher → Metro → bundle → screen) | ≈10–15s | ⚠️ environment (dev-build bundle download — not app UX) |

No app-behavior transition ≥3s. The only ≥3s transition is the dev-build cold-start bundle load, which is an environment artifact (same class as Phase 14's dev-launcher detour).

### Cross-cutting UX findings
- In-app branded alerts remain consistent (green pill OK) across ForgotPassword (Phase 14) and ResetPassword (S10) — no copy issues in any observed state.
- The link-error state on ResetPassword shows two primary CTAs (Request New Reset Email + Reset Password) — see S09 / cross-cutting #4.
- Copy is uniformly clear and parent-appropriate; no rewrites needed anywhere this run.

### Cross-cutting design-system compliance
- Screens visited (ResetPassword form + requirements card, Link Error card, ForgotPassword, both alert dialogs) use the shared `Button`/`TextInput` primitives: primary green pill `#5DBB8E` (pressed `#4DAA7A`), filled `#F0F0F0` inputs, uppercase 13px labels, semantic error color for inline errors, 52px primary CTAs (48px medium variant on the error card, still ≥44px), 20px page margin. **One deviation:** two primary buttons on the ResetPassword screen in the link-error state (cross-cutting #4). Otherwise no deviations against `docx/design-system-passitup.md`.

### Recommended follow-ups (separate tasks — not applied in-run)
1. **[Harness — unblocks S08 + S11-Case-2]** Add a dev/staging-gated Supabase Admin `generateLink`-based reset-link **mint-and-return** helper (service-role key in env; returns the tokenized `p2pkidsmarketplace://reset-password#…` URL to a readable channel). The existing `admin-trigger-password-reset` Edge Function does not return the link.
2. **[Docs]** Update Group S `Locator hints:`/`Dependencies:` — the "native `Alert.alert`" labels are wrong; all Group S dialogs render in-app via `GlobalAlertProvider` (`global-alert-button-N`) and are instrumentable. (Also carries over Phase 14's same finding.)
3. **[Dev/build]** Consider making fragment-bearing deep-link cold delivery through the Expo dev launcher reliable (or document that warm delivery is the supported test path).
4. **[Design-system]** Resolve the two-primary-CTA state on ResetPassword when the Link Error card is visible (hide/disable `reset-submit-button`, or demote the card button to secondary-outline).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-S07–S11 (Group S — Password Recovery, re-verify + remainder batch) from `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Design-System Compliance:** PARTIAL — one deviation: two primary CTAs on ResetPassword in the link-error state. All other screens/dialogs compliant.
**Verdict Summary:** 4 PASS / 0 FAIL / 1 BLOCKED (S08) / 0 SKIPPED (S11 Case-2 sub-case also blocked on the same harness gap)
**Critical Findings:**
1. **[RESOLVED — HIGH] Deep-link redbox is fixed and verified:** the `NativeEventEmitter`/`handleInitialUrl` LogBox fatal overlay is gone. S07, S10, S09, S11 all executed cleanly (warm + cold), fully interactive, no overlay, no crash.
2. **[MEDIUM] S08 + S11-Case-2 remain BLOCKED on the valid-reset-session harness** — the app-side redbox blocker is no longer the cause. No `generateLink`-mint-return harness or mail capture exists; the `admin-trigger-password-reset` Edge Function doesn't return a token and needs admin auth.
3. **[MEDIUM — doc drift]** Group S "native `Alert.alert`" labels are wrong — dialogs are in-app `GlobalAlertProvider` (`global-alert-button-0`), instrumentable.
4. **[INFO — environment quirk]** Cold fragment-bearing deep links are dropped ~50% through the dev launcher; warm delivery from a mounted screen is reliable.
5. **[MINOR — design system]** Two primary CTAs on ResetPassword in the link-error state.
**App State Left Behind:** App left clean on the unauthenticated Landing screen. No account/session created or logged in; no passwords changed (no valid session ever existed); no seeded-data mutation; no code changes; no git writes. Evidence directory: `e2e-test-results/phase15-auth-group-s-reverify-2026-08-16/` (10 PNGs).
**Why It Matters:** This run closes the Phase 14 gap: the password-recovery *deep-link* path (the only way into ResetPassword) is now fully testable on-device, and every reachable assertion in S07/S09/S10/S11 passed with exact copy. It also isolates the one remaining blocker (S08's happy path) to **test infrastructure, not app code** — a precise, actionable handoff for the dev agent.
**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/phase15-auth-group-s-reverify-2026-08-16/` — `step0_clean_landing_no_overlay.png`, `S11_case1_reset_screen_no_redbox.png`, `S11_case1_cold_reset_screen.png`, `S07_step3/4/5_*.png`, `S10_no_active_reset_session_alert.png`, `S09_link_error_card.png`, `S09_navigated_to_forgot_password.png`, `S11_case3_link_error_warm.png`.
- S07: `simctl openurl "p2pkidsmarketplace://reset-password"` → fill both fields (`short`/`short` → length error; `lowercase1` → complexity error; `Password123`/`Password124` → mismatch).
- S10: matching valid passwords → submit → "No active reset session".
- S09/S11-Case-3: while on ResetPassword, openurl with `#error=access_denied&error_description=…expired` → Link Error card → Request New Reset Email → ForgotPassword.
- S08: mint a real recovery link (harness) → deep link → set password → "Success!" → OK → Login.
**Known Gaps / Not Tested:** S08 full success path and S11-Case-2 (valid-session establishment) — harness gap. Cold error-fragment link delivery (environment quirk) — verified warm instead. (S03 rate-limit / S04 SMTP-500 remain Phase 14 gaps — backend conditions, not in this batch.)
**Suggested Next Session:** Dev-agent task: add the `generateLink` mint-and-return harness (unblocks S08 + S11-Case-2), then run the remaining Group S uncovered cases (S03/S04 harness-dependent) or move to the next AUTH group.
**Suggested to Improve Agent Rules:** Codify that on Expo dev builds, **cold fragment-bearing deep links are unreliable through the dev launcher** (drops land on Landing with no navigation) — prefer warm delivery from a mounted target screen, and record drops as an environment quirk rather than repeatedly retrying. Also record the empirical rule: `Alert.alert` in this codebase renders in-app via `GlobalAlertProvider` regardless of the import source, so Group-S-style "native alert" labels should be treated as doc drift until proven otherwise.
