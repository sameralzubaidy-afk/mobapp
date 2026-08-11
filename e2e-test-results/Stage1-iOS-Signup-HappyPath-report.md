# iOS Stage 1 — Signup Happy Path + Harness Cases — QA Report

Date: 2026-08-11 · iOS Simulator (iPhone 17 Pro Max, iOS 26.1) · App `Pass It Up!` (com.sameralzubaidi.p2pmarketplace) · Staging
Run mode: manual, UI-only (Mobile MCP). No Supabase access, no build, no simulator automation.

Pre-requisite gate (per prompt): the 6-file accessibility fix set was **uncommitted** at run start → per
user authorization it was committed as `05a43fd2` (Button/Modal/LoginScreen/SignupScreen/LoginScreen.test/
PersistentTabBar) before running. App was knowingly continued in the same Metro dev session that already
proved the fix live (commit did not change running JS).

---

## 1. Results Matrix

| TC# | Description | Status | Evidence | Key finding |
|---|---|---|---|---|
| TC-A02 | Field validation errors (regression) | PASS | `TC-A02_step1_create_account_keyboard.png`, `TC-A02_step2_invalid_values_entered.png`, `TC-A02_step3_validation_errors.png` | All 6 inline errors appear on submit; submission blocked; stays on Create Account |
| TC-A03 | Password mismatch + weak password (regression) | PASS | `TC-A03_step2_mismatch_error.png`, `TC-A03_step3_weak_password_error.png` | "Passwords do not match" on mismatch; both fields literally replaced with `abc` (verified via Show toggle); "Password must be at least 8 characters"; blocked |
| TC-B02 | Invalid credentials error | PASS | (captured earlier this run) | "Invalid login credentials" dialog; dismissible via `login-failed-dialog-ok-button`; user remains on Login |
| TC-B01 | Successful login → Home | PASS | (captured earlier this run) | Lands on Home; all tab-bar items discoverable with visible labels (`tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket`) — tab-bar fix verified live |
| TC-A01 | Successful signup (NEW — creates state) | PASS* | `TC-A01_step2_form_filled.png`, `TC-A01_step3_submitted.png`, `TC-A01_step3_phone_e164_error.png`, `TC-A01_step4_verify_phone.png`, `TC-A01_step5_phone_verified.png`, `TC-A01_step6_complete_profile.png` | Valid 6-field form → no validation errors → navigates to Verify Your Phone → DEV OTP bypass `123456` accepted → verification success → Complete Your Profile. *Caveat: provided phone is not E.164, SMS send failed with an error dialog (transient), but flow still advanced and bypass verified. |

Status legend: PASS / FAIL / BLOCKED / SKIPPED. All 5 cases PASS. No FAIL, BLOCKED, or SKIPPED.

---

## 2. Regression Check (Stage 0.5 Carry-Forward)

All previously-fixed identifiers remain discoverable via the accessibility tree — **no regressions**:

| Identifier | Screens | Discoverable |
|---|---|---|
| `landing-signup-button` / `landing-login-button` | Landing | ✓ |
| `signup-submit-button` | Create Account | ✓ |
| `signup-display-name-input` / `signup-email-input` / `signup-phone-input` | Create Account | ✓ |
| `signup-password-input` / `signup-confirm-password-input` (+ Show toggles) | Create Account | ✓ |
| `login-email-input` / `login-password-input` / `login-submit-button` | Login | ✓ |
| `login-failed-dialog-ok-button` | Login-failed dialog | ✓ |
| `tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket` | Home tab bar | ✓ (all with labels) |

The 4 harness cases (A02, A03, B02, B01) all still pass exactly as in Stage 0.5.

---

## 3. TC-A01 Findings (New Case)

1. From Landing → **Get Started** (`landing-signup-button`).
2. Filled the 6-field form:
   - Full Name `QA Stage1 Test`, Email `rewardsfirsttradebobauto.demo@example.com`, Phone `5519985018`
   - DOB via the 3-part picker: Day `15`, Month `01`, Year `1995` (composes to `1995-01-15`, age 31 → passes 18+ gate)
   - Password `QaStage1_2026!` + Confirm `QaStage1_2026!` (both 14 chars, matching)
3. Tapped `signup-submit-button` → **no inline validation errors** (form passed).
4. A transient dialog appeared: `Failed to send verification code: Invalid phone number format (use E.164: +12025551234)` — the provided phone `5519985018` is **not E.164** (no country code). Dismissed via OK.
5. Despite that error, the app **navigated to Verify Your Phone** showing `We sent a 6-digit code to <phone>` (phone printed in full on screen — redacted in this report per data hygiene).
6. OTP screen showed `otp-input` + a dev hint **"Dev: OTP bypass code is 123456"**. Entered `123456`, tapped **Verify** (button had no testID; label "Verify").
7. Success dialog: "Your phone number has been verified. Let's complete your profile!" → **Continue**.
8. Landed on **Complete Your Profile** (Display Name / ZIP / Bio fields). Per scope, onboarding was **not** progressed.

Final state: app authenticated as the newly created account, sitting on Complete Your Profile (first onboarding step).

---

## 4. Data-Corruption Check

**No** — no interaction landed on the wrong element to corrupt a field or trigger an unintended control.

- All field entries verified via the tree (values/char-counts) before proceeding.
- One near-miss caught and corrected: the first attempt to clear Confirm Password tapped at a stale position (field had shifted off-screen after validation errors pushed the layout); the tree still showed 11 dots, so no edit occurred. Re-listed after scrolling and cleared it cleanly.
- `Continue` on the success dialog was tapped intentionally (in-scope to reveal the next screen).
- The `←` back-chevron on Create Account was **not** used.

---

## 5. Process Rule Effectiveness

- **Keyboard-aware re-listing:** Needed constantly on the longer 6-field form — every field switch required dismiss + re-list. Worked reliably; coordinates from a keyboard-open tree were never reused.
- **Keyboard dismissal method:** Tapping the non-input title ("Create Account"/"Welcome Back!") after scrolling it into view is the only reliable dismiss (empty-space/status-bar taps and drags do NOT dismiss). On the OTP screen no dismiss method worked; the Verify button sits well above the keyboard, so it was tapped with fresh coordinates — minor, justified deviation, flagged here.
- **Field-clearing:** Double-tap-to-select-all + type worked for both password fields; literal `abc` verified via the Show-password toggles in both fields.
- **No-back-chevron assumption:** App terminate/relaunch was used to reset between A02/A03/B02. After B01 the simulator **persisted the test-buyer session across relaunch**, so a clean logout required the Profile path — the user logged out manually. **Improvement note added: bake "log out via Profile → scroll down to Log Out" into TC-B01's reset step** (see session note; applied to the test case going forward).
- **No software-keyboard Return/Done coordinate taps:** complied throughout.

---

## 6. New Findings

- **DOB picker** is a 3-field numeric input (Day `DD` / Month `MM` / Year `YYYY`), number-pad, auto-advances to the next field when complete. It has identifiers (`signup-dob-picker-day/month/year`) — good. Not a date-wheel picker.
- **Phone field requires E.164** (e.g. `+12025551234`). The provided `5519985018` was rejected when sending the SMS. The failure surfaced as a dialog, yet the app **still navigated to the Verify Your Phone screen** — the "failed to send" error is effectively non-fatal/transient in the UI, which is arguably misleading and worth a look.
- **OTP screen**: `otp-input` has a testID; the **Verify button has no testID** (accessibility gap — label only). The success dialog's OK/Continue are exposed as plain StaticText with no identifiers.
- **Dev LogBox noise**: a `[SocialLoginButtons] Unexpected error: OAUTH_INIT_FAILED` overlay appeared once on Create Account (cleared via relaunch); a `[phoneService] sendPhoneVerificationCode failed …` console line showed during verification. Dev-only, non-blocking.
- Create Account now exposes a `←` StaticText (top-left) that wasn't relied upon before; not used during this run.

---

## 7. Test Data Left Behind

- **Account created in staging** via this run: email `rewardsfirsttradebobauto.demo@example.com`, display name `QA Stage1 Test`, DOB 1995-01-15, password `QaStage1_2026!` (dev build). Phone verified via DEV OTP bypass `123456`.
- The **phone stored is the non-E.164 value** `5519985018` (SMS send failed; verification succeeded via bypass). No automated cleanup at this stage — track manually.
- **Recommendation**: the first submit attempt (same email) triggered the E.164 error before the account was fully finalized; worth a quick check in staging for any duplicate/partial record under this email before it is reused in a later stage.
- App left authenticated as this new account (per prompt: do not reset to test-buyer at the end).

Process note (user-requested): after TC-B01 login, reset to Landing by logging out via Profile screen (tap header avatar → scroll down to **Log Out**) rather than terminate/relaunch, since the simulator persists the auth session. Recorded in session memory `stage1-qa-notes.md`.
