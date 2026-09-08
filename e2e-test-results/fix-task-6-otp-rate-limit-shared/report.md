# FIX-Task-6 Verification — AUTH-TC-E04 OTP Rate-Limit Copy (Signup PhoneVerificationScreen)

**Run folder:** `e2e-test-results/fix-task-6-otp-rate-limit-shared/`
**Date:** 2026-09-08 (~13:50–14:20 EDT)
**Purpose:** RE-VERIFY AUTH-TC-E04 (guide: `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`) against the just-shipped FIX-Task-6 (shared OTP rate-limit implementation) on BOTH platforms. VERIFYING only — no code modified.
**Devices:** iOS `iPhone 17 Pro Max` (`3F3293A3-…`, 26.1) · Android `Medium_Phone_API_36.1` (emulator-5554, Android 16)
**HEAD:** `fc6867a3` (QA Task 43M) + uncommitted FIX-Task-6 working-tree files (M `PhoneVerificationScreen.tsx`, M `EditProfileScreen.tsx`, M `usePhoneVerification.ts`; ?? `otpRateLimit.ts`, `useOtpResendCountdown.ts` + 2 new test files). No app-src drift beyond the fix.
**LLM:** DeepSeek V4 Flash. R78 recon-first, R29 busy discipline, R77-series Android facts, §5.2 keyboard/coordinate discipline applied.

## 1. Verdict roll-up

| TC (guide) | Platform | Verdict | Evidence |
|---|---|---|---|
| AUTH-TC-E04 | **iOS** | ✅ **PASS** (corrected signup state verified) | `fix6-ios-e04-rate-limit-copy.png` |
| AUTH-TC-E03 (sanity, via shared hook) | **iOS** | ✅ PASS | `fix6-ios-e03-normal-cooldown.png` |
| AUTH-TC-E04 | **Android** | ⏭️ **BLOCKED — concurrent-agent resource conflict (R29)** | logcat + Referrals-screen evidence (§3) |
| EditProfileScreen / PhoneVerificationModal regression | — | ✅ No regression (57/57 unit tests green + source-confirmed) | jest run |

## 2. Task 2 — AUTH-TC-E04 on iOS — PASS

Fresh throwaway signup (dev-autofill Alice, unique contact) on the **reinstalled/reloaded NEW bundle**:

- Email `qa.alice.17888911637017129@kidsmarketplace.test`, phone `+12025553701443` → Create Account → **PhoneVerificationScreen** ("Verify Your Phone").
- **Send #1** auto-fired on mount → "Code Sent (DEV Bypass)" dialog (send OK) → 60s cooldown renders `otp-resend-countdown` "Resend in 48s/42s/…" (normal E03 behavior, shared hook) → Resend button re-enabled at 0.
- **Send #2** (Resend tap) → Code Sent OK → 60s cooldown → re-enabled.
- **Send #3** (Resend tap) → Code Sent OK → 60s cooldown → re-enabled.
- **Send #4** (Resend tap) → **server rate limit fired. NEW (fixed) behavior rendered:**
  - `otp-rate-limit-message` = **"Too many attempts. Please try again in 3600 seconds."** — INLINE on the screen (no raw `Alert('Error','Rate limit exceeded')`).
  - `otp-resend-countdown` = **"Resend in 3598s"** (live-disabled countdown; the Resend button is NOT rendered while counting down).
  - Tapping the former Resend location did **nothing** (no dialog, countdown continued 3598→3566s) — the disabled-countdown gate holds (source: `handleResendCode` early-returns when `countdown > 0`; button only rendered at 0).
- Screenshot: `screenshots/fix6-ios-e04-rate-limit-copy.png` (inline message + disabled countdown both visible).

**iOS verdict: PASS** — the FIX-Task-6 corrected signup E04 state is confirmed: friendly copy inline, Resend disabled with a live countdown, no raw backend Alert.

### ⚠️ UX observation (reportable, non-blocking — Design/Copy)
The countdown renders **"Resend in 3598s"** (raw seconds), not the intended readable **"Resend in 1h"**. `formatOtpCountdown`'s `≥3600 → "1h"` branch only fires for the ~1s the countdown is exactly 3600 (the shared `useOtpResendCountdown` decrements 1s/tick); the instant it drops below 3600 it renders raw `"3599s"`, `"3598s"`, … for the whole hour. So a real parent glancing at the screen sees a large raw-seconds number that reads as "about an hour" only with mental math — the very readability goal `formatOtpCountdown` was built for is effectively defeated by the live-decrementing hook. **Recommended dev-side follow-up:** format the countdown by range (e.g. `>3600 → "1h"`, `60–3599 → "59m"`, `<60 → "Ns"`) OR display the full window as a stable formatted value (e.g. "Resend available in about 1 hour") rather than a ticking raw-seconds readout, so long rate-limit windows are human-readable for their whole duration. (Same applies to EditProfileScreen's two countdown renders, which use the same hook+formatter.) This is a copy/UX polish item, NOT a functional FAIL of the fix.

## 3. Task 1 — AUTH-TC-E04 on Android — BLOCKED (R29 concurrent-agent conflict)

The Android emulator (`emulator-5554`) is **actively driven by another agent task** this session, making an uninterrupted ~5-minute fresh-signup induction impossible:

- **logcat evidence (device time = host EDT, verified):** `ReactNativeJS [QaLoginAsDeepLink] Logged in as test-buyer` at 13:53:57 and 13:55:09; `…test-seller` at 13:59:09, 14:02:12, 14:05:34; `…test-buyer` at 14:08:21 — i.e. persona deep-link logins landing on the shared emulator every 1–3 min during my session window, repeatedly yanking my in-progress signup (which I confirmed reaching logged-out Landing + Create Account multiple times, only to be interrupted back to an authenticated Home).
- **Direct observation:** after a clean logged-out Landing + Create Account form, the app spontaneously presented authenticated test-buyer/test-seller screens and even a "New Item" surface with a photo I never added; at 14:17 the emulator showed a **Referrals screen as "QA Referral Tester"** (badges Trades 3 / Basket 1) — active multi-step work by another actor, not app state I created.
- **Ruled out an app defect:** full reinstall of the debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`, version 1.0.0) + `pm clear` gave a clean logged-out app that held the Create Account form stably between interruptions; the interruptions correlate exactly with the other actor's qa-login-as deep-link logins (the qa-login-as handler fires on Linking event/getInitialURL in dev builds — source-confirmed the only consumer of persona credentials). No concurrent agent session appears in the session store (latest = QA Task 43m, 17:04), but the emulator telemetry is unambiguous.

Per playbook §5.41 R29 ("never interleave… a verdict read from a screen another agent's action just changed is a false verdict"), I did not force-drive the contended device. **The Android E04 leg is BLOCKED with a stated reason** and should be re-run when `emulator-5554` is exclusive (ideally with the other agent finished, or on a dedicated emulator). The fix code is platform-shared JS and the iOS leg PASSes the identical corrected-state assertion, so this is a resource-coordination blocker, not a product-risk signal.

## 4. Task 3 — E03 sanity (normal 60s cooldown) — PASS on iOS
During the E04 induction, sends #1–#3 each rendered the normal 60s cooldown via the shared hook: `otp-resend-countdown` = "Resend in 48s / 42s / 35s / …", Resend button absent (disabled) until the countdown hit 0, then re-enabled. Screenshot `screenshots/fix6-ios-e03-normal-cooldown.png` ("Resend in 48s" state). No regression of the normal success-path cooldown.

## 5. Task 4 — EditProfileScreen spot-check (light-touch) — no regression
- **Source-confirmed:** `EditProfileScreen.tsx` imports the shared `useOtpResendCountdown` + `resolveOtpRetrySeconds`/`buildOtpRateLimitMessage`/`formatOtpCountdown` (FIX-Task-6); BOTH rate-limit branches (phone change L411-420, email re-verify L786-795) resolve via `resolveOtpRetrySeconds` → `armResendCountdown` + `buildOtpRateLimitMessage` (unchanged friendly "Too many attempts…" copy); countdowns render `formatOtpCountdown(resendCountdown/emailResendCountdown)`. Git diff is bounded (51+/53- over EditProfileScreen + usePhoneVerification) — a mechanical shared-util refactor, not a behavior change.
- `usePhoneVerification.ts` likewise resolves via the shared helpers with unchanged copy.
- **Unit tests green:** `otpRateLimit.test.ts`, `useOtpResendCountdown.test.ts`, `usePhoneVerification.test.ts`, `PhoneVerificationModal.test.tsx`, `EditProfileScreen.test.tsx` → **5 suites / 57 tests all PASS** (re-run this session; matches the fix note).
- **On-device full EditProfile rate-limit induction NOT performed** (expensive: phone change + its own 3-send window) — covered by the green unit tests per the task's explicit allowance.

## 6. Perceived load-time observations
No ≥3s app-behavior transitions flagged. The long waits were the three intentional 60s resend cooldowns (intended app behavior, polled live) and bundle reloads. Signup→PhoneVerificationScreen transition ~1–2s.

## 7. App state left behind / residue
- **iOS:** throwaway Alice account `qa.alice.17888911637017129@kidsmarketplace.test` (phone `+12025553701443`) — created pre-verify, still on PhoneVerificationScreen, now phone rate-limited for ~1h (3 `phone_verification_codes` sends consumed; no 4th row created — the 4th was blocked server-side, which is what surfaced the rate-limit state). No profile completed. Cleanup candidate (BP-70 full delete).
- **Android:** left on the OTHER agent's active session (Referrals as "QA Referral Tester") — untouched by me after confirming the contention. NOTE: the Android app was reinstalled this session (same debug APK v1.0.0) and its app data cleared; the concurrent agent's session/toggles were not otherwise disturbed by me. A partial throwaway signup draft on Android (`qa.fix6.and.1788890118839@…` / phone `+12025550118839`) was created but never submitted (interrupted by the concurrent agent) — no account created, no DB rows expected.
- **No code modified, no admin_config writes, no toggles armed.** Metro :8081/:8082 left running.

## 8. Evidence files
| File | Shows |
|---|---|
| `screenshots/fix6-ios-e04-rate-limit-copy.png` | iOS corrected E04 state: inline `otp-rate-limit-message` "Too many attempts. Please try again in 3600 seconds." + disabled `otp-resend-countdown` "Resend in 3598s" |
| `screenshots/fix6-ios-e03-normal-cooldown.png` | iOS normal 60s cooldown "Resend in 48s" (E03 sanity, shared hook) |
