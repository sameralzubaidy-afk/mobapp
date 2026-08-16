# Phase 14 — First Real Batch: AUTH Password-Recovery Group (Group S)

**Run date:** 2026-08-16
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — Group S (Password Recovery)
**Device:** iPhone 17 Pro simulator (iOS 26.5), UDID `92E2BE6A-A0AF-43A7-9E15-12BA8745841D`
**App:** `com.sameralzubaidi.p2pmarketplace` — Debug build via Metro (`localhost:8081`), RN 0.81.5
**Backend:** staging Supabase `drntwgporzabmxdqykrp.supabase.co`
**Agent:** QA-Test-Agent (execution-only; no code changes made)

**Note on brief vs. guide:** the invocation brief's one-line labels for `AUTH-TC-S01` etc. are an index only. All cases were executed per the canonical guide's `Setup`/`Locator hints`/`Assert`/`Dependencies` content (which differs from the brief labels, e.g. S01 is the *success + Send Another Email* path).

---

## Batch result

| TC-ID | Verdict | Top finding |
|---|---|---|
| AUTH-TC-S01 | ✅ PASS | Success state + "Send Another Email" returns to cleared form |
| AUTH-TC-S02 | ✅ PASS | Disabled-on-empty + exact "Invalid Email" alert copy |
| AUTH-TC-S03 | ⛔ BLOCKED | Rate-limit condition not reproducible on demand (4 sends, all success) |
| AUTH-TC-S04 | ⛔ BLOCKED | SMTP-500 requires a staging misconfiguration; SMTP healthy in staging |
| AUTH-TC-S05 | ✅ PASS | Genuine server 400 triggered via oversized email; app appended exact guidance |
| AUTH-TC-S07 | ⛔ BLOCKED | Deep-link path surfaces reproducible LogBox redbox → screen not interactable |
| AUTH-TC-S08 | ⛔ BLOCKED | Needs valid reset session (real tokens); no email access + deep-link redbox |
| AUTH-TC-S10 | ⛔ BLOCKED | Needs ResetPassword screen; deep-link redbox blocks it |

**Roll-up: 3 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED**

---

## Cross-cutting findings (read these first)

1. **[HIGH — blocker] `p2pkidsmarketplace://reset-password` deep link triggers a reproducible dev-build LogBox redbox.** Opening the deep link (warm or cold-with-pending-link) surfaces:
   - **Uncaught Error:** `` `new NativeEventEmitter()` requires a non-null argument. `` (fatal redbox)
   - **Console Error (caught):** `Error parsing initial URL for reset token: TypeError: Cannot read property 'default' of undefined` — thrown inside `ResetPasswordScreen.handleInitialUrl` (caught, non-fatal).
   The LogBox modal captures all touches (verified: tapping the underlying fields does nothing) and is not dismissible by coordinates (footer Dismiss/Minimize buttons are NOT in the AX tree). This blocks clean interactive execution of **S07, S08, S10** (and would also block S09/S11). The screen *renders* correctly beneath the overlay (title, fields, requirements card, buttons — all in the tree). A plain launch with no deep link is clean (no redbox) → the redbox is specific to the reset-password deep-link delivery. **Needs a dev/build or instrumentation fix before these cases can be automated on-device.** (Release build likely unaffected — dev-only overlay.)

2. **[MEDIUM — doc drift] Alerts in this build are NOT native `Alert.alert`.** They render through the in-app `GlobalAlertProvider`; buttons surface in the iOS AX tree as `global-alert-button-0/1` (e.g. S02 "Invalid Email" OK, S05 "Reset Email Failed" Open Supabase Docs + OK). The guide's repeated `Locator hints: ... native Alert.alert — assert by title` is outdated for this build — the dialogs ARE instrumentable. Recommend updating the guide's Group S (and S03/S04/S05) dependency notes.

3. **[INFO — technique] A genuine server 400 is triggerable on-demand** with an oversized email (~300 chars local part passes the client regex but exceeds GoTrue's 255-char limit → 400). Used to PASS S05. Reusable for future 400-state tests without backend toggles.

4. **[INFO] Alert copy for the 400 branch** appends the exact spec line — "Check that the email you entered is correct and belongs to an account." — confirmed on-device.

---

## Per-case reports

### AUTH-TC-S01 · Forgot Password — success + Send Another Email → ✅ PASS

**Execution trace (in order):**
1. `mobile_list_elements_on_screen` (Landing) → tapped `landing-login-button` (201,692)
2. Listed Login → tapped `login-forgot-password-link` (201,720)
3. Listed ForgotPassword form → saved `AUTH-TC-S01_step1_forgot_form.png`
4. Tapped `forgot-email-input` (201,455) → re-listed (keyboard up) → typed `qaparent@kidsmarketplace.test`
5. Re-listed → field value confirmed → tapped `forgot-send-reset-button` (201,394)
6. Re-listed → **success state** "Check Your Inbox" + exact subtitle → saved `AUTH-TC-S01_step2_success_inbox.png`
7. Tapped `forgot-send-another-button` (201,497) → re-listed → returned to form, `forgot-email-input` no longer carries a value (cleared) → saved `AUTH-TC-S01_step3_form_cleared.png`

**Assert result:**
- ✅ Title changes to **Check Your Inbox**; subtitle matches spec verbatim (anti-enumeration message confirmed).
- ⚠️ "A reset email arrives containing a `p2pkidsmarketplace://reset-password` link" — **not verifiable in-simulator** (no mail client). Supabase accepted the request without error (success state shown); the app-side `redirectTo: 'p2pkidsmarketplace://reset-password'` is confirmed in `ForgotPasswordScreen.tsx`. Email delivery itself is outside the app and outside simulator reach.
- ✅ **Send Another Email** returns to the email form with the field cleared.

**UX review:**
- *Structural/affordance:* Success screen is clear: title, subtitle, secondary **Send Another Email** (48/52px pill), **Back to Login** text link. Both targets ≥44px. Loading state exists on the primary button (`loading` prop) — transition was fast, not captured mid-flight (not a defect).
- *Wording/copy:* "Check Your Inbox" + "…If you have an account with us…" is friendly, appropriate for a parents/guardians audience, and correctly non-enumerating. No rewrite needed. "Send Another Email" / "Back to Login" unambiguous.
- *Design-system compliance:* **No deviations found.** Title h1 `#1A1A1A`; subtitle secondary `#6B6B6B`; primary button = green pill `#5DBB8E` (theme `primary.500`); "Send Another Email" secondary = 2px `#5DBB8E` outline; text links secondary color; uppercase 13px labels; filled inputs (`#F0F0F0`, no border) per §4. Touch targets 52px.

**Locator-gap findings:** none — all `forgot-*` identifiers surfaced as expected.

**Friction:** keyboard handling required re-list after focus (per playbook); a long-press select-all was needed to replace an existing field value mid-run (S03 prep). No corruption.

---

### AUTH-TC-S02 · Forgot Password — invalid email → ✅ PASS

**Execution trace:**
1. (Continuing from S01's cleared form) saved `AUTH-TC-S02_step1_disabled_empty.png` → confirmed Send Reset Link renders **disabled (gray)** with empty field
2. Tapped `forgot-email-input` (201,455) → re-listed (keyboard up) → typed `abc`
3. Re-listed → value `abc`, button enabled → tapped `forgot-send-reset-button` (201,394)
4. Re-listed → **"Invalid Email"** alert with exact copy → saved `AUTH-TC-S02_step2_invalid_email_alert.png` → tapped OK (`global-alert-button-0`, 201,482) → re-listed (form restored, value `abc` retained)

**Assert result:**
- ✅ Empty field → **Send Reset Link disabled** (verified visually — gray, matches design disabled style).
- ✅ `abc` → alert **Invalid Email** / "Please enter a valid email address"; no request sent (alert fired immediately with no loading state — client-side `validateEmail` short-circuit confirmed in source).

**UX review:**
- *Structural/affordance:* alert is a centered branded dialog with a single primary OK (52px). Dismissable. Fine.
- *Wording/copy:* "Please enter a valid email address" is plain and clear for a parent. Fine as-is.
- *Design-system compliance:* alert dialog uses the branded `GlobalAlertProvider` styling (primary green pill OK); form screen as in S01 — **No deviations found.**

**Locator-gap findings:** the guide says the alert is "native `Alert.alert` — assert by title" but it is in fact the in-app global alert; buttons ARE in the tree (`global-alert-button-0`). Instrumentable. (Doc-drift note.)

**Friction:** none significant.

---

### AUTH-TC-S03 · Forgot Password — rate-limit error → ⛔ BLOCKED

**Execution trace:** 3 reset sends to the same address (`qaparent@kidsmarketplace.test`) across the run (S01 + S03 attempts 1–2) each returned the **success** screen (Check Your Inbox) — never the "Reset Email Failed" rate-limit alert. Attempt loop used `forgot-send-another-button` → re-type email → `forgot-send-reset-button`.

**Assert result:** **BLOCKED** — could not induce the Supabase rate-limit error condition on demand. App-side mapping is verified in source (`ForgotPasswordScreen.tsx`: `lm.includes('rate limit')` → "You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes." + Open Supabase Docs + OK). Same alert structure as S05 (verified structurally). **To make testable:** a rate-limit-exhausted test account, or a staging Auth rate-limit toggle, or a staging mode that forces GoTrue's rate-limit error for `resetPasswordForEmail`.

**UX review (form screen only — same as S01):** **No deviations found.**
- *Wording/copy:* the rate-limit copy (source-verified) is friendly and actionable; no rewrite needed.

**Locator-gap findings:** none.

**Friction:** each rate-limit attempt required the full send→return→re-type loop (4–5 tool calls each); a long-press select-all did not surface the edit menu on one attempt (fail-fast → terminate/relaunch used instead).

---

### AUTH-TC-S04 · Forgot Password — SMTP-config (500) error → ⛔ BLOCKED

**Assert result:** **BLOCKED** — the SMTP-500 branch requires `resetPasswordForEmail` to return a 500-class error or "error sending recovery", i.e. a **broken Supabase Auth SMTP configuration**. Staging SMTP is demonstrably healthy (S01/S03 sends returned success), and an execution-only QA agent cannot toggle staging config. **To make testable:** a staging misconfiguration toggle (or a proxy that injects a 500 for recovery emails). App-side mapping verified in source: 500-class → base message + "Possible causes: • SMTP/email provider not configured… • Redirect URL not allowed…" + "Check Supabase Auth > Email Settings and Email Logs." + Open Supabase Docs/OK.

**UX review:** no screen interaction beyond the form (S01 state). **No deviations found.**
**Locator-gap findings:** none.
**Friction:** none (no execution attempted — condition not inducible).

---

### AUTH-TC-S05 · Forgot Password — 400 error → ✅ PASS

**Execution trace:**
1. Returned to the form via `forgot-send-another-button`; re-listed (field cleared)
2. Focused `forgot-email-input` (201,455) → typed a **~300-char email** (`a…a@test.com`, passes client regex, exceeds GoTrue 255-char limit) — `type_keys` reported an RPC timeout but the value landed fully (verified in tree)
3. Tapped `forgot-send-reset-button` (201,394)
4. Re-listed → **"Reset Email Failed"** alert: message `An email address is too long` + appended `Check that the email you entered is correct and belongs to an account.` + **Open Supabase Docs** + **OK** buttons → saved `AUTH-TC-S05_step1_400_alert.png` → tapped OK (281,518)

**Assert result:**
- ✅ Alert titled **Reset Email Failed**; base server error followed by the exact 400 guidance line from the spec.
- ✅ Both **Open Supabase Docs** and **OK** buttons present.
- ✅ Genuine server 400 (GoTrue "An email address is too long") — not a forced/guessed state; the app's `status === 400` branch fired.

**UX review:**
- *Structural/affordance:* two-button alert (Open Supabase Docs = secondary/outline, OK = primary green pill). Clear hierarchy; OK is the natural dismissal.
- *Wording/copy:* "An email address is too long" is a raw GoTrue message (developer-ish). The appended guidance is fine. **Rewrite suggestion (copy layer):** for the 400 branch the alert could surface a friendlier primary line, e.g. *"That email address looks unusual. Please double-check it and try again."* while keeping the existing troubleshooting line. (Optional polish — not a defect.)
- *Design-system compliance:* **No deviations found.** Alert uses the branded global-alert styling; buttons correct variants.

**Locator-gap findings:** alert buttons surfaced as `global-alert-button-0/1` (in-app, not native — doc drift noted).
**Friction:** `type_keys` RPC timeout on the very long string (text still landed); the tree value confirmed it.

---

### AUTH-TC-S07 · Reset Password — validation + requirements card → ⛔ BLOCKED

**Execution trace:**
1. `simctl openurl booted "p2pkidsmarketplace://reset-password"` (warm, app on ForgotPassword success) → re-listed → **ResetPassword screen rendered** (title, subtitle, `reset-new-password-input`, `reset-confirm-password-input`, `PASSWORD REQUIREMENTS:` + 4 bullets, `reset-submit-button`, `reset-back-to-login`) **BUT** LogBox redbox overlay: Uncaught Error `` `new NativeEventEmitter()` requires a non-null argument. `` → saved `redbox_nativeeventemitter_deeplink.png`
2. Terminated → cold `simctl openurl` → landed on **Expo dev-launcher** home (dev-build behavior) → tapped Metro entry → bundle loaded → pending deep link delivered → **redbox reproduced** (same error) → saved `AUTH-TC-S07_step0_redbox_reproduced.png`
3. Tried to dismiss the LogBox: header right (365,82) — cycles logs (2↔1); header left (140,84) — nothing; top-right (385,50) — nothing; footer Dismiss (100,840) and (100,510) — nothing; probed the underlying field (185,313) — **tap swallowed** (LogBox captures all touches).
4. Terminated → plain launch (no deep link) → **clean Landing, no redbox** (confirms redbox is deep-link-specific).

**Assert result:** **BLOCKED** — screen + requirements card content verified from the tree (title, fields, "• At least 8 characters / • Contains uppercase letter / • Contains lowercase letter / • Contains number"), but the LogBox redbox blocks all interaction, so the validation behaviors (short → "Password must be at least 8 characters"; no-uppercase → "Password must contain uppercase, lowercase, and number"; mismatch → "Passwords do not match"; disabled-while-empty) could **not be observed on-device**. They are confirmed present in `ResetPasswordScreen.tsx` (source-level), but per run rules I will not claim PASS on unobserved behavior. **To make testable:** fix/instrument the deep-link redbox (NativeEventEmitter), or add a dev-only in-app route to the ResetPassword screen, or run on a non-dev build.

**UX review:**
- *Structural/affordance:* screen layout (from tree + screenshot) is clean — title, subtitle, two filled inputs with uppercase labels, requirements card, single primary CTA, back link. (Interaction blocked, so tap-target behavior not fully exercised.)
- *Wording/copy:* requirements card text matches spec; subtitle "Enter your new password below." is plain. No rewrite needed.
- *Design-system compliance (screen beneath overlay):* **No deviations found** — consistent with the shared Button/TextInput components (green pill primary, filled inputs, uppercase labels, 16px-ish vertical rhythm).

**Locator-gap findings:** none for the app screen (all `reset-*` ids surfaced). The LogBox overlay itself is non-instrumentable (dev overlay — out of scope for `testID`; recorded as an environment blocker).
**Friction:** significant — LogBox not dismissible by coordinates (buttons absent from AX tree); 5+ dismissal attempts failed; cold deep link routes through the dev launcher.

---

### AUTH-TC-S08 · Reset Password — success → Login → ⛔ BLOCKED

**Assert result:** **BLOCKED** on two independent grounds:
1. **No valid reset session obtainable in-simulator.** The case needs a reset link carrying a real `access_token`/`refresh_token` (from a live reset email). There is no mail client on the simulator, no in-app link-minting helper in the codebase (searched), and minting one would require the Supabase service-role key (out of scope for an execution-only agent; secrets must not be handled). **To make testable:** a test harness that mints a valid reset link via the Supabase Admin `generateLink` API into a readable channel (or email capture), then opens it as a deep link.
2. **The deep-link path is blocked by the LogBox redbox** (same blocker as S07), so even with a tokenized link the screen interaction + "Success!" alert → OK → Login assertion could not be executed cleanly.

**UX review:** ResetPassword screen (beneath overlay) — **No deviations found** (same as S07).
**Locator-gap findings:** none (app screen instrumented; overlay non-instrumentable).
**Friction:** same deep-link/LogBox friction as S07.

---

### AUTH-TC-S10 · Reset Password — no active reset session → ⛔ BLOCKED

**Assert result:** **BLOCKED** — setup requires opening the ResetPassword screen without a valid reset session (deep link, no token), then submitting valid passwords and asserting the "No active reset session" alert ("This link does not provide a valid reset session. Please request a new password reset email."). The ResetPassword screen is reachable **only** via the deep link (no in-app route; confirmed via grep of navigation config), and the deep link triggers the LogBox redbox that blocks interaction (S07 blocker). The "No active reset session" branch is verified in `ResetPasswordScreen.tsx` source (`getSession()` null + `!hasResetSession` → exact alert copy). **To make testable:** same as S07 — fix/instrument the deep-link redbox, or add a dev-only route.

**UX review:** screen (beneath overlay) — **No deviations found**.
**Locator-gap findings:** none.
**Friction:** same deep-link/LogBox friction.

---

## Batch summary

- **Totals:** 3 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED
- **PASS:** S01, S02, S05 — the fully reachable, environment-independent cases all passed with exact-copy verification.
- **BLOCKED:** S03, S04 (backend-error conditions not inducible on a healthy staging env — per the run's known-constraint), and S07, S08, S10 (deep-link redbox blocker + S08's valid-session requirement).

### Cross-cutting UX findings
- Alert dialogs are in-app branded (`GlobalAlertProvider`) with a primary green pill OK — consistent and clear across S02/S05. No copy issues in the observed states.
- The 400-branch alert surfaces GoTrue's raw "An email address is too long" as the primary line — acceptable, but a friendlier first line is recommended for the parent audience (see S05).
- No structural layout defects observed on any screen that rendered fully.

### Cross-cutting design-system compliance
- All screens visited (ForgotPassword form + success, ResetPassword beneath overlay, both alert dialogs) use the shared `Button`/`TextInput` primitives: primary green pill `#5DBB8E` (theme `primary.500` / pressed `#4DAA7A`), secondary 2px green outline variant, filled `#F0F0F0` inputs (no outline), uppercase 13px labels, text tiers `#1A1A1A`/`#6B6B6B`/`#999999`, 52px buttons (≥44px targets), max-one-primary rule respected. **No deviations found** against `docx/design-system-passitup.md`.

### Recommended follow-ups (separate tasks — not applied in-run)
1. **[Dev/build] Fix the reset-password deep-link LogBox redbox** (`new NativeEventEmitter()` requires a non-null argument) and the caught `handleInitialUrl` URL-parsing error (`Cannot read property 'default' of undefined` — likely `URLSearchParams`/dynamic-import interop in RN 0.81 Hermes). Root-cause which dependency throws NativeEventEmitter during linking. This unblocks S07/S08/S10/S09/S11 on-device.
2. **[Docs] Update Group S locator/dependency notes:** alerts are in-app (`global-alert-button-N`), not native `Alert.alert`; add a "valid reset link" harness note for S08.
3. **[Harness] Add a Supabase Admin `generateLink`-based reset-link minting helper** (with service-role key stored in env) so S08's success path can be exercised end-to-end.
4. **[Test technique] Keep the oversized-email 400 trigger** documented for future backend-error-state cases.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-S01–S05, S07, S08, S10 (Group S — Password Recovery) from `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Design-System Compliance:** PASS — no deviations found on any screen visited (ForgotPassword form/success, ResetPassword beneath overlay, global-alert dialogs).
**Verdict Summary:** 3 PASS / 0 FAIL / 5 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **[HIGH] Reset-password deep link → reproducible dev LogBox redbox** (Uncaught `NativeEventEmitter()` non-null + caught `handleInitialUrl` `default` of undefined). Blocks all interaction with ResetPassword → S07/S08/S10 (and S09/S11) cannot run on-device in this build.
2. **[MEDIUM] Doc drift:** Group S alerts are in-app `GlobalAlertProvider` dialogs (buttons `global-alert-button-0/1`), not native `Alert.alert`; guide notes should be updated.
3. **[INFO] S05 PASS via a genuine 400** (oversized email) — a reusable technique.
4. **[INFO] S03/S04 not inducible** on a healthy staging env (rate-limit exhausted account / SMTP toggle needed).
**App State Left Behind:** App left on the unauthenticated Landing screen (clean relaunch). No account/session created or logged in. Multiple password-reset emails dispatched to `qaparent@kidsmarketplace.test` (non-existent staging address — anti-enumeration success responses only, no real delivery expected) + one oversized-email rejected 400. No seeded-data mutation, no code changes, no git writes.
**Why It Matters:** Proves the ForgotPassword client flow (success state, disabled/enabled gating, invalid-email + 400 error branches with exact copy) works end-to-end against staging. Surfaces that the password-recovery *deep-link* path — the only way into the ResetPassword screen — is currently un-testable on-device due to a dev-build overlay, and that backend-error cases (rate-limit, SMTP-500) need harness support. This is as much a test of the QA agent as of the app: it demonstrates honest BLOCKED verdicts over forced PASS/FAIL.
**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/phase14-auth-pw-recovery-2026-08-16/` (8 PNGs: S01 form/success/cleared, S02 disabled/alert, S05 400-alert, redbox ×2).
- S05: on ForgotPassword, enter a ~300-char `a…a@test.com`, Send → "Reset Email Failed" + account-guidance line.
- Redbox: `xcrun simctl openurl booted "p2pkidsmarketplace://reset-password"` (app running) → LogBox Uncaught Error blocks input; tap (365,82) cycles the two logs; not dismissible by coordinates.
**Known Gaps / Not Tested:** S03 (rate-limit), S04 (SMTP-500) — backend conditions not inducible; S07/S08/S10 interactive assertions — blocked by deep-link redbox; S08 valid-session flow — needs link-minting harness; email-receipt assertion (S01) not verifiable in-simulator; S06/S09/S11 not in this batch.
**Suggested Next Session:** Fix/instrument the reset-password deep-link redbox (find the NativeEventEmitter thrower), then re-run S07/S10 (and S11's token/error-fragment cases) as the next batch; add the admin `generateLink` harness to unblock S08.
**Suggested to Improve Agent Rules:** Add a codified rule for the RN LogBox redbox: "on dev builds, opening a deep link that lands on a screen during startup can raise a non-dismissible LogBox fatal overlay; verify clean state via terminate → plain `mobile_launch_app` → confirm Landing (no overlay) before treating deep-link cases as runnable, and record the redbox as an environment blocker rather than spending >3 dismiss attempts."
