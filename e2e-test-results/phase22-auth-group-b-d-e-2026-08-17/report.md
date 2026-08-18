# Phase 22 — AUTH Group B Cleanup (B10–B12) + Group D (Logout) + Group E (Phone Verification)

**Date:** 2026-08-17
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)
**Build:** Expo RN dev build + Metro (`com.sameralzubaidi.p2pmarketplace`)
**Agent:** QA Test Agent (execution-only)

**Cases executed:** AUTH-TC-B10, B11, B12 (Group B cleanup) · AUTH-TC-D01–D03 (Group D) · AUTH-TC-E01–E05 (Group E)

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-B10 | AUTH | ✅ PASS | Back arrow returned to Landing; no session. `login-back-button` NOT in AX tree (BP-53 gap) — tapped via pixel-derived coords. |
| AUTH-TC-B11 | AUTH | ✅ PASS | `login-signup-link` footer → Create Account screen. |
| AUTH-TC-B12 | AUTH | ✅ PASS | `signup-login-link` footer → Login screen. |
| AUTH-TC-D01 | AUTH | ✅ PASS | `profile-logout` → in-app GlobalAlert confirm → confirmed → Landing; AsyncStorage session cleared (no `sb-*` keys). `profile-logout`/utility rows NOT AX-exposed — pixel-derived tap. |
| AUTH-TC-D02 | AUTH | ⏭️ SKIPPED | Per user instruction (Settings sign-out path not executed). |
| AUTH-TC-D03 | AUTH | ✅ PASS | Post-logout Landing shows Sign Up/Log In, no authenticated content; session cleared (§5.11). |
| AUTH-TC-E01 | AUTH | ✅ PASS | OTP screen shows "We sent a 6-digit code to +12025551001"; single auto-formatted field (guide says "6-box" — doc drift); code 123456 → Success! dialog → Continue → Complete Your Profile. |
| AUTH-TC-E02 | AUTH | ✅ PASS* | Incomplete → Verify disabled-gray (the "Please enter all 6 digits" alert is unreachable — disabled button is the guard). Wrong code → "Verification Failed / Verification code expired or not found" (dev-bypass nuance, NOT guide's "Invalid code"), input clears. Expired sub-condition BLOCKED (needs 10-min real wait; OTPExpiredError path empirically triggered). |
| AUTH-TC-E03 | AUTH | ✅ PASS | Resend fires sends, countdown re-enables after ~60s (empirically: a tap fired send #2 ~60s after send #1, and send #3 ~60s after send #2); resend text renders disabled-gray during cooldown. Exact "Resend in Ns" digits not OCR-verifiable (rendered light-gray; source: `countdown=60` + `disabled={countdown>0}`). |
| AUTH-TC-E04 | AUTH | 🚫 BLOCKED | Rate-limit condition NOT inducible in dev: 4 rapid sends for one phone never returned RATE_LIMIT_EXCEEDED (each → SEND_FAILED → DEV bypass dialog). Screen's rate-limit path is a generic `Alert.alert('Error', err.message)` anyway, not the guide's "Too many attempts…" copy (doc/UX note). |
| AUTH-TC-E05 | AUTH | 🚫 BLOCKED | Setup fully achieved (unverified E3 user → Sell tab → **Sell Options Sheet** → "List One Item" → "New Item" create screen). Gate logic source-verified (`ItemCreateScreen.handlePublish` → `isPhoneRequired` → `setShowPhoneVerificationModal(true)` required-mode; `onSuccess` → `handlePublish` retry). Final gate-trigger step NOT executable: the ItemCreate form (title/category/condition/price/publish) is below the fold and the screen would not scroll via the toolset swipe (4 variants, 0 movement), and it requires a photo upload (native picker). |

**Roll-up: 8 PASS / 0 FAIL / 2 BLOCKED / 1 SKIPPED**

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | ≥3s? |
|---|---|---|
| Landing → Login | <1s | no |
| Login → Home (test-buyer / E3 password login) | <1s | no |
| Profile → Logout confirm → Landing | <1s | no |
| Signup submit → Verify Your Phone | ~2s | no |
| "Use & Verify" → Success! dialog | <1s | no |
| Success dialog Continue → Complete Your Profile | <1s | no |
| Verify (wrong code) → Verification Failed dialog | ~1–2s | no |
| Home → Sell sheet → List One Item → New Item | <1s | no |
| Cold-start (terminate+relaunch, dev bundle download) | ~5–10s | ⚠️ environment artifact (Metro bundle download; not an app-behavior transition) |

No in-flow transitions exceeded 3s. **Perceived Load-Time Verdict: GOOD** (the only ≥3s observation is the dev-build cold-start bundle download, an environment artifact, not a screen transition).

---

## Per-case execution traces

### AUTH-TC-B10 · Back button returns to previous screen (PASS)
1. §5.8 clean-state: terminate → plain launch → Landing, no overlay.
2. Tapped `landing-login-button` (220,721) → Login screen ("Welcome Back!"), <1s.
3. **Locator gap:** `login-back-button` (TouchableOpacity + `←` text, testID only, no `accessible`/role/label) NOT in AX tree. Derived the arrow glyph via pixel scan (pt ≈35,107). Tapped (35,107) → Landing.
4. Assert: returned to Landing, unauthenticated. **PASS.** Evidence: `b10-b12/B10-01-login-screen.png`, `B10-02-back-to-landing.png`.

### AUTH-TC-B11 · Sign Up footer link (PASS)
1. Landing → `landing-login-button` → Login.
2. Tapped `login-signup-link` ("Sign Up", 300,727) → **Create Account** screen ("Create Account" / "Join the Kids P2P Marketplace"), <1s. **PASS.** Evidence: `b10-b12/B11-01-create-account-screen.png`.

### AUTH-TC-B12 · Log In footer link (PASS)
1. From Create Account, scrolled the form → footer visible.
2. Tapped `signup-login-link` ("Log In", 307,795) → **Login** screen, <1s. **PASS.** Evidence: `b10-b12/B12-01-login-screen.png`.

### AUTH-TC-D01 · Logout from Profile with confirmation (PASS)
1. Logged in as `test-buyer` (Home, <1s). Tapped `header-profile-btn` (400,94) → Profile.
2. **Locator gap:** utility rows (`profile-logout` etc.) have testID but no `accessible`/role/label → not in AX tree. Scrolled the Profile (AX tree went stale — screenshot ground truth) and located the red `#EF4444` Logout row by pixel scan (pt ≈100,317). Tapped it.
3. **Empirical dialog check:** confirmation dialog = in-app **GlobalAlertProvider** (title "Logout", msg "Are you sure you want to logout?", `global-alert-button-0` Cancel / `-1` Logout) — instrumentable; NOT native Alert.alert (doc-drift consistent with Phase 14/15).
4. Tapped Logout (`global-alert-button-1`, 302,523) → Landing, <1s.
5. **§5.11 session check:** AsyncStorage manifest — no `sb-*`/auth-token keys (session cleared). **PASS.** Evidence: `d01-d03/D01-01…D01-05` (dialog + post-logout Landing).

### AUTH-TC-D02 · Sign Out from Settings (SKIPPED — per user instruction)
Not executed; the Settings sign-out path was deliberately skipped at the user's request.

### AUTH-TC-D03 · After logout, app returns to Landing (PASS)
Verified during D01's post-logout state (and re-verified after the E3 logout): Landing shows **Get Started** / **Log In**, no authenticated content (no header/tabs/avatar), AsyncStorage has no session keys. **PASS.**

### AUTH-TC-E01 · OTP screen sends + verifies 6-digit code (PASS)
1. Fresh signup `qa.p22.e1.1786964375@kidsmarketplace.test` / `+12025551001` (DOB 2000-01-01; form focus/autofill hazards handled per §5.2/§5.10) → submit → **Verify Your Phone** (~2s).
2. Assert: subtitle "We sent a 6-digit code to +12025551001" ✓; OTP input present ✓ — **single auto-formatted field** (`otp-input`, 408×52) — the guide's "6-box OTP input" is **doc drift** vs. the design system's single-field OTP (§4/§7).
3. Tapped `dev-verify-otp-123456` (Use & Verify) → **Success!** dialog ("Your phone number has been verified…") → Continue (`otp-success-dialog-ok-button`) → **Complete Your Profile** (ProfileSetup). **PASS.**
4. Note: the "Code Sent (DEV Bypass)" dialog surfaced late on this screen (see E02's screen for a clean capture) — the auto-send completes asynchronously after mount.
   Evidence: `e01-e05/E01-09…E01-11`.

### AUTH-TC-E02 · Incomplete / invalid / expired code errors (PASS*)
Fresh account E2 (`qa.p22.e2…`, `+12025551002`) → OTP screen.
- **Incomplete:** the **Verify button renders disabled-gray** with <6 digits (observed; also E1 evidence) — the "Please enter all 6 digits" alert in `handleVerify` is **unreachable** because the button is disabled (`disabled={loading || code.length !== 6}`). The disabled button is the actual guard. **Finding (minor):** guide expects an error message for incomplete code; actual UX is a disabled button (acceptable, arguably better, but doc drift).
- **Wrong code:** entered 111111 → Verify → **"Verification Failed"** dialog with **"Verification code expired or not found"** (the `OTPExpiredError` message — because in dev-bypass mode no code row exists for the phone, the "no record" branch fires) → input clears. Guide expects "Invalid code" — **behavior/doc nuance** due to the dev-bypass environment (with a real stored code the message would be "Invalid verification code").
- **Expired (5-min):** not cleanly inducible without a 10-min real-time wait → **sub-condition BLOCKED**; note the `OTPExpiredError` message path was itself empirically triggered by the wrong-code test.
- Verdict **PASS** (error handling works; exact messages differ; expired sub-condition blocked). Evidence: `e01-e05/E02-01…E02-06`.

### AUTH-TC-E03 · Resend cooldown (PASS)
Fresh account E3 (`qa.p22.e3…`, `+12025551003`) → OTP screen.
- Auto-send (#1) on mount sets countdown=60 (source); the resend link (`Didn't receive the code?` + resend text on the same row) is **not AX-exposed** (locator gap) — observed via pixel scan.
- After a send, the resend text renders in **disabled light-gray** (neutral[300]).
- **Enabled after ~60s (empirical):** a tap fired send #2 ~60s after send #1, and send #3 ~60s after send #2 — proving the resend re-enables after the cooldown window.
- **PASS** (cooldown disables resend + re-enables after 60s; exact "Resend in Ns" digits not OCR-verifiable from the light-gray render, but source + color state confirm the behavior). Evidence: `e01-e05/E03-01…E03-05`.

### AUTH-TC-E04 · OTP rate limiting message (BLOCKED)
- Attempted to trigger the backend limit (3/hour/phone, 5/day/user) via 4 rapid resend/sends on `+12025551003` (~7:24–7:28). Every call returned **SEND_FAILED** → DEV-bypass "Code Sent" dialog (LogBox: `FunctionsHttpError: Edge Function returned a non-2xx status code`); **RATE_LIMIT_EXCEEDED never surfaced**.
- **Not cleanly inducible in this dev environment** (SMS unavailable → every send is dev-bypassed before the rate-limit path is observable, or the limit counters don't accumulate as assumed). BLOCKED per batch-size self-check.
- **UX/doc note:** even if triggered, `PhoneVerificationScreen.handleResendCode`'s catch shows a generic `Alert.alert('Error', err.message)` ("Error / Rate limit exceeded"), NOT the guide's "Too many attempts. Try again in {N} seconds." — that friendly copy exists only in the modal hook (`usePhoneVerification.sendCode`). Recommend the screen reuse the friendly message.
- Evidence: `e01-e05/E04-01-rate-limit-not-triggered.png`.

### AUTH-TC-E05 · Gate blocks first listing until verified (BLOCKED — setup achieved, gate source-verified)
- **Setup achieved:** used unverified E3 (signed up, did NOT verify OTP). Terminated → relaunched → session restored → **onboarding carousel** → tapped `skip-button` → **Home** (unverified). Tapped `tab-sell` → **Sell Options Sheet** (2 options: **List One Item** `sell-option-list-one-item` / Bulk Upload `sell-option-bulk-upload`; options not AX-exposed) → tapped "List One Item" → **"New Item" create screen** (photos section, `add-photos-button`, `photo-slot-empty-1/2`).
- **Gate logic source-verified:** `ItemCreateScreen.handlePublish` → `isPhoneRequired(sellerId)` (true when `profiles.phone_verified_at` is null) → `setShowPhoneVerificationModal(true)` (modal `required={true}`, no dismiss) → on success `handlePublish()` retried. Verified `isPhoneRequired` reads `phone_verified_at`; E3's is null.
- **BLOCKED on the final step:** the create form fields (title/category/condition/price) and the publish button sit below the fold, and the ItemCreate screen **would not scroll via the toolset swipe** in this session (4 swipe variants from y 350/450/500 with 250–700pt — 0 screen movement, confirmed by pixel-diff), so the form could not be filled/published. It additionally requires a photo upload (native picker). BLOCKED with reason: tooling friction on the ItemCreate scroll + photo requirement; gate logic itself is source-confirmed.
- Evidence: `e01-e05/E05-01…E05-07`.

---

## Cross-cutting UX findings

1. **AX-tree staleness is pervasive after navigation (HIGH tooling friction).** The tree repeatedly returned stale content (previous screen's elements) during Profile scroll and OTP/signup transitions — screenshots were the reliable ground truth (§5.9). Not an app defect.
2. **BP-53 exposure gaps recur across screens (instrumentation follow-ups):**
   - `login-back-button` (Login) — not in AX tree.
   - Profile utility rows (`profile-logout`, `profile-settings`, etc.) — not in AX tree.
   - Resend link text on the OTP screen — not in AX tree.
   - Sell Options Sheet options (`sell-option-list-one-item` / `sell-option-bulk-upload`) — not in AX tree.
   - ItemCreate fields (below-fold; screen wouldn't scroll in toolset).
3. **Signup form focus/keyboard friction is the dominant time cost.** Fields below the phone field are covered by the number-pad when the keyboard is up; taps then hit keys (corrupted the phone field — recovered via §5.10 long-press → Select All → retype). Dismiss-keyboard-then-tap is the reliable pattern. Below-fold elements report logical (not rendered) coordinates in the tree — the submit button had to be pixel-located.
4. **OTP Verify disabled-guard:** with <6 digits the Verify button is disabled-gray — no error message, no "Please enter all 6 digits" alert (the alert in source is unreachable via the UI). Reasonable UX, but guide copy is doc drift.

## Cross-cutting design-system compliance (vs. `docx/design-system-passitup.md`)

- **No deviations found** on the screens/dialogs visited: Landing, Login, Create Account, OTP screen, Profile, Home, ItemCreate, and all GlobalAlertProvider dialogs (Logout confirm, "Code Sent (DEV Bypass)", Success!, Verification Failed) use the documented tokens — primary green `#5DBB8E` CTAs, white modal surfaces, filled `#F0F0F0` inputs, one primary per dialog, 52px buttons (≥44px targets), text tiers `#1A1A1A/#6B6B6B/#999999`.
- OTP input is the design-system single auto-formatted field (not 6 boxes) — compliant; the guide's "6-box" wording is doc drift.
- The disabled Verify button renders in the documented disabled-gray band (correct disabled state, not a deviation).

---

## QA Session Handoff

**Test Scope:** AUTH-TC-B10–B12 (Group B cleanup), AUTH-TC-D01–D03 (Group D Logout), AUTH-TC-E01–E05 (Group E Phone Verification) from `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (11 cases).
**Design-System Compliance:** PASS — no deviations found against design-system-passitup.md on any screen or dialog visited (colors/tokens, typography, spacing, one-primary-per-dialog, filled inputs, single-field OTP, ≥44px targets).
**Perceived Load-Time Verdict:** GOOD — all in-flow transitions rendered <3s (Landing→Login, Login→Home, signup→OTP ~2s, verify dialogs, navigation). The only ≥3s observation is the dev-build cold-start (Metro bundle download), an environment artifact, not an app transition.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing: wording/layout match design-system.
- CONFIRMED — Login & Create Account: match design-system.
- CONFIRMED — Verify Your Phone (OTP): single auto-formatted field per design system (guide's "6-box" is doc drift, not an app defect).
- CONFIRMED — Profile: match design-system.
- CONFIRMED — Logout-confirm, "Code Sent (DEV Bypass)", "Success!", "Verification Failed" dialogs: in-app GlobalAlertProvider, one primary green CTA, white surface.
- CONFIRMED — Home (unverified user) & ItemCreate top: match design-system.
**Verdict Summary:** 8 PASS / 0 FAIL / 2 BLOCKED / 1 SKIPPED
**Critical Findings:**
1. [MEDIUM] E04 rate-limit condition not inducible in dev (4 sends → always SEND_FAILED/DEV bypass). Also, the OTP *screen's* rate-limit path shows a generic `Alert.alert('Error', err.message)` — the friendly "Too many attempts. Please try again in {N} seconds." exists only in the modal hook; recommend the screen reuse it (also closes the guide's expected-copy gap).
2. [MEDIUM] E02 wrong-code message is "Verification code expired or not found" (OTPExpiredError) in dev-bypass mode, not guide's "Invalid code" — environment-driven behavior; note as doc drift (with a real stored code it's "Invalid verification code").
3. [LOW] "Please enter all 6 digits" for an incomplete OTP is unreachable — the Verify button is disabled-gray with <6 digits (acceptable UX; guide copy is stale).
4. [LOW] Guide says "6-box OTP input" — app uses the design-system single auto-formatted field (doc drift).
5. [TOOLING] AX-tree staleness + BP-53 exposure gaps (login-back-button, profile utility rows, OTP resend link, sell-sheet options) and an ItemCreate screen that wouldn't scroll via the toolset swipe — these blocked/added friction, are not app defects, and are listed as follow-ups.
**App State Left Behind:** Three throwaway staging accounts created via UI signup (unverified/passwords per fixture, do not reuse): `qa.p22.e1.1786964375@kidsmarketplace.test` (phone verified, profile incomplete), `qa.p22.e2.1786964375@kidsmarketplace.test` (unverified), `qa.p22.e3.1786964375@kidsmarketplace.test` (unverified). E1/E2/E3 sessions cleared via the QA logout deep link — app left on clean Landing. `test-buyer` was logged in/out for Group D and left logged out. Phone `+12025551003` had ~4 send attempts within the hour (may affect a later rate-limit test on that number).
**Why It Matters:** Group B is now closed (3/3 PASS), Group D is effectively verified via the Profile path (D02 skipped per request), and Group E's happy path + error states + cooldown are confirmed working with the DEV-bypass code `123456`. The two BLOCKED cases are tooling/environment-gated, not app-behavior failures: the rate limit isn't observable through the dev-bypass send path, and the listing-publish gate couldn't be reached because the ItemCreate form couldn't be filled in-session.
**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/phase22-auth-group-b-d-e-2026-08-17/evidence/{b10-b12,d01-d03,e01-e05}/`.
- B/D: navigate Landing→Login→back (B10); footer links (B11/B12); login test-buyer → Profile → Logout → confirm (D01) → Landing (D03).
- E01: fresh signup → OTP screen shows phone → use DEV `123456` → Success → Profile Setup.
- E02: on a fresh OTP screen enter `111111` → "Verification Failed / …expired or not found"; empty OTP → Verify disabled.
- E03: after any send, resend shows countdown (disabled-gray); re-enables ~60s later.
- E04: BLOCKED — not inducible via UI in dev (needs a real rate-limit scenario or a toggle).
- E05: BLOCKED at form-fill — unverified user reaches "New Item"; to complete, fill the form + photo and tap publish to see the `listing-phone-verification` required modal.
**Known Gaps / Not Tested:**
- AUTH-TC-D02 (Settings sign-out) — skipped per user instruction.
- AUTH-TC-E02 expired-code sub-condition — requires a ≥10-min wait; not executed (the OTPExpiredError path itself was demonstrated).
- AUTH-TC-E04 — rate-limit message not inducible in dev.
- AUTH-TC-E05 — the actual publish gate + modal verification not executed (form could not be filled/scroll in toolset).
**What Needs To Be Fixed Next:**
1. Fix: `PhoneVerificationScreen.handleResendCode` catch — surface the OTPRateLimitError's `retryAfterSeconds` with the friendly "Too many attempts. Please try again in {N} seconds." message (mirror `usePhoneVerification.sendCode`) instead of the generic `Alert.alert('Error', err.message)`.
2. Fix (instrumentation): add `accessible accessibilityRole="button" accessibilityLabel` to `login-back-button`, the Profile utility rows (`profile-logout`, `profile-settings`, …), the OTP resend link, and the Sell Options Sheet options (`sell-option-list-one-item`, `sell-option-bulk-upload`) so they surface in the AX tree (BP-53).
3. Fix (instrumentation): verify ItemCreate fields/publish button are AX-exposed and the screen scroll is reachable for automation (currently below-fold and non-scrollable via the toolset swipe).
4. Fix (doc drift): AUTH guide — OTP input is a single auto-formatted field (not "6-box"); E02 wrong-code copy and incomplete-code behavior (disabled button, not an alert); E04's rate-limit message location.
5. Consider a QA dev toggle for the send-phone-otp rate limit (like the S03/S04 reset-error toggle) so E04 is inducible on demand without hammering shared staging.
**UX Enhancement Ideas (optional, not defects):**
- On the Verify Your Phone screen, the resend control ("Didn't receive the code? Resend in Ns") is small and light-gray when disabled — consider a slightly larger tap target and a more legible disabled countdown (e.g., tertiary text with an explicit "Resend in 59s" that's readable), reducing squint-and-tap friction for parents.
- On the Create Account screen, the phone field can be over-typed when the number-pad covers the DOB row — consider auto-scrolling the focused field above the keyboard (or a "next" affordance) to avoid accidental key taps while typing.
- On the ItemCreate screen (New Item), consider a sticky/always-visible Publish affordance so sellers don't have to scroll a long form to publish (reduces scroll friction observed in-session).
**Suggested Next Session:** AUTH-TC-D02 (Settings sign-out, skipped) + AUTH-TC-E05 re-run once the ItemCreate scroll/locator instrumentation lands (then E04 via a rate-limit toggle).
**Suggested to Improve Agent Rules:** Add a playbook note that a swipe that produces 0 changed pixels on a ScrollView (confirmed by pixel-diff) should be treated as a screen-scroll blocker and reported as tooling friction rather than retried repeatedly — plus record that below-fold AX-tree coordinates are logical (not rendered) positions when a keyboard is up, which is the root cause of most mis-taps this session.
