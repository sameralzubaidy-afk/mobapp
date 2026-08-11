# Stage 3 QA Report — Final On-Device Verification of Commits a870e295 (QA logout deep link) & 7f3a39ca (Branded GlobalAlertProvider dialogs)

**Date:** 2026-08-11 · **Device:** iOS Simulator (iPhone 17 Pro Max, iOS 26.1) · **App:** Pass It Up! (com.sameralzubaidi.p2pmarketplace)
**Purpose:** On-device accessibility-tree confirmation (the element-listing tool became unavailable mid-session in the prior session; unit tests alone were NOT treated as sufficient evidence — this run re-confirmed everything directly on the running simulator).
**Commits under test (HEAD):**
- `a870e295` — QA logout deep link (`p2pkidsmarketplace://qa-logout`) — mounted inside AuthProvider in AppNavigator, gated to `__DEV__`/staging.
- `7f3a39ca` — Signup/OTP native `Alert.alert` calls migrated to branded GlobalAlertProvider dialogs with testIDs (`age-gate-dialog-ok-button`, `referral-invalid-fix-it-button`, `referral-invalid-continue-anyway-button`, `otp-dev-bypass-dialog-ok-button`, `otp-success-dialog-ok-button`).

**Overall result:** **Task 1 (deep link): FULLY VERIFIED — no outstanding gaps.** **Task 2 (branded dialogs): NOT fully verified — all 4 dialogs ARE visually branded on-device, but NONE of their button testIDs are discoverable in the real iOS accessibility tree (systematic GlobalAlertProvider exposure bug).** Regression on pre-existing dialogs: Login Failed fully verified; Signup Failed uses the identical mechanism (on-device trigger blocked by environment form-entry fragility, not a code defect).

---

## 1. Task 2 On-Device Results (4 Branded Dialogs)

| Dialog | Branded visually? | Button testID(s) found in tree? | Dismissal via identifier worked? |
|---|---|---|---|
| **Age gate** (under-18) | ✅ YES — white rounded card; button pixel RGB `(93,187,142)` = `#5DBB8E` brand green | ❌ **NO** — `age-gate-dialog-ok-button` absent; tree shows only "Sorry" + message text | ❌ **NO** (identifier not resolvable). Coordinate tap at the green button DOES dismiss (functionally present). |
| **Invalid referral** (2 buttons) | ✅ YES — neutral "Fix it" (RGB 214,214,214) + green "Continue anyway" (#5DBB8E) | ❌ **NO** — `referral-invalid-fix-it-button` and `referral-invalid-continue-anyway-button` both absent; tree shows only "Invalid Referral Code" + message text | ❌ **NO** (identifiers not resolvable). Coordinate tap on "Continue anyway" DOES proceed to OTP. |
| **OTP DEV-bypass** | ✅ YES — green OK (#5DBB8E), white card | ❌ **NO** — `otp-dev-bypass-dialog-ok-button` absent; tree shows only "Code Sent (DEV Bypass)" + message | ❌ **NO** (identifier not resolvable). Coordinate tap dismisses. |
| **OTP success** | ✅ YES — green Continue (#5DBB8E), white card | ❌ **NO** — `otp-success-dialog-ok-button` absent; tree shows only "Success!" + message | ❌ **NO** (identifier not resolvable). Coordinate tap proceeds to Profile Setup. |

### Root cause (verified in source + on-device contrast)
- All 4 dialogs render through the **GlobalAlertProvider** modal, whose buttons are raw `<TouchableOpacity>` with **only `testID`** set — **no `accessible`, no `accessibilityRole`, no `accessibilityLabel`**. On iOS, a bare TouchableOpacity's identifier is not exposed to the accessibility tree.
- **Contrast proof (on-device):** the pre-existing **Login Failed** dialog (rendered by `@/components/ui/Modal` + `@/components/ui/Button`) DOES expose its button — the tree returned `{"type":"Button","label":"OK","name":"login-failed-dialog-ok-button","identifier":"login-failed-dialog-ok-button"}`. `ui/Button` sets `accessible` + `accessibilityRole="button"` + `accessibilityLabel`. This proves the element-listing tool CAN see modal buttons with identifiers — the GlobalAlertProvider absence is a REAL exposure bug (same class as the earlier tab-bar `role="tab"` bug the pilot warned about), not a tool limitation.
- **Fix needed (follow-up, NOT part of this verification pass):** add `accessible` + `accessibilityRole="button"` (+ `accessibilityLabel` = button text) to the TouchableOpacity in `src/providers/GlobalAlertProvider.tsx`, matching `ui/Button`. This will make all 4 identifiers discoverable.

### Evidence files (e2e-test-results/stage3/)
- `TC-A04_age_gate_dialog.png`, `TC-A04_dialog_crop.png`
- `TC-A06_invalid_referral_dialog.png`
- `TC-OTP_dev_bypass_dialog.png`
- `TC-OTP_success_dialog.png`
- `TC-B02_login_failed_dialog.png` (positive control — identifier RESOLVES)

---

## 2. Logout Deep Link Regression Result (Step 2)

**Claim now confirmed: across all login → lifecycle-check → deep-link-logout cycles, ZERO human intervention was required.**

| Cycle | Lifecycle case | Steps (all by automation) | Result |
|---|---|---|---|
| 0 (bonus) | — | New-account signup → Home → `openurl p2pkidsmarketplace://qa-logout` | Home → **Landing** directly ✅ |
| 1 | B04 session restore | Login test-buyer → Home → terminate + relaunch → **restored to Home without re-entering creds** → deep-link logout | Home → **Landing** ✅ |
| 2 | B05 background/resume | Login test-buyer → Home → HOME button (background) → foreground resume → **same Home, no spinner** → deep-link logout | Home → **Landing** ✅ |
| 3 | B06 cold launch | Login test-buyer → Home → terminate while authenticated → cold launch → **Home restored, no hang** → deep-link logout | Home → **Landing** ✅ |

- **No repeated OTP prompts, no stuck loaders, no residual banners across any cycle** — the app's session handling remains robust (Stage 2 finding reconfirmed).
- The deep link works deterministically from the authenticated Home screen every time (4/4), transitioning directly to the unauthenticated Landing — **no scrolling, no profile navigation** (the exact stuck point that required user-assisted logout in Stage 2 is eliminated).
- **One observation to note:** at the very start of this run, a relaunch after a *stale* Stage-2 session token went to Landing (restore failed) — with a *fresh* login the session restored reliably in all three cycles. Conclusion: this is token-expiry behavior, not a regression introduced by commit `a870e295`.

---

## 3. Regression Check on Pre-Existing Branded Dialogs (Step 3)

- **Login Failed — PASS (fully verified on-device):** wrong password → branded dialog "Login Failed / Invalid login credentials"; **`login-failed-dialog-ok-button` resolves in the tree** (Button, label "OK", y=496); dismissal via the button works; remains on Login with fields retained. Unaffected by `7f3a39ca`'s GlobalAlertProvider changes (it uses `ui/Modal`, not the provider).
- **Signup Failed (duplicate email) — mechanism verified, on-device trigger BLOCKED by environment, NOT a code issue:** the dialog uses the **identical** `ui/Modal` + `primaryButtonTestID` path as Login Failed (`SignupScreen.tsx` line 596 → `signup-error-dialog-ok-button`), so its identifier will resolve exactly like `login-failed-dialog-ok-button`. The on-device duplicate-email submission could not be completed because the ~8-field signup form repeatedly corrupted fields under automation (keyboard/scroll coordinate divergence — the documented Stage 2 fragility, §9.4/§11 #4/#10), preventing a valid submission from reaching the duplicate-email dialog. This is an environment limitation, not a code defect; the identifier path is the proven `ui/Button` path.

---

## 4. Final Gap-Closure Verdict

- **Task 1 (QA logout deep link, commit `a870e295`):** ✅ **FULLY verified on-device.** No outstanding gaps. The deep-link teardown is repeatable, deterministic, and requires zero manual intervention. This gap from Stage 2 is CLOSED.
- **Task 2 (branded dialogs, commit `7f3a39ca`):** ❌ **NOT fully verified — outstanding gap remains.** The 4 dialogs are visually branded (the design-compliance goal is met — no more native system alerts), **but their button testIDs are NOT discoverable on the real iOS accessibility tree**, so automation cannot target them by identifier. The stated goal of the commit (stable accessibility identifiers for QA automation) is **not achieved on-device**.
- **Verdict: the pilot should NOT advance to Stage 3 (read-only Supabase awareness) until the GlobalAlertProvider button-exposure gap is fixed and re-verified on-device.** The dialog is the exact class of bug (code correct + unit tests pass, but not exposed on the real accessibility tree) that this pilot exists to catch — leaving it unresolved would propagate un-targetable identifiers into Stage 3+ automation.
- **What remains (precisely):**
  1. Add `accessible` + `accessibilityRole="button"` (+ `accessibilityLabel`) to the GlobalAlertProvider `TouchableOpacity` buttons (mirror `ui/Button`).
  2. Re-run this same on-device verification of all 4 dialogs to confirm the identifiers surface.
  3. Optionally re-attempt the Signup Failed duplicate-email on-device trigger once the signup-form automation fragility is mitigated (dev autofill targeting or form fixtures), to close the last "mechanism-verified but not triggered" item.
  4. Recommended (per Stage 2 §10): keep the deep-link logout as the canonical teardown; it is proven.

---

## 5. Testing Challenges Faced This Round (retrospective — added per team lead request)

> Goal of this section: capture every struggle so the next round is faster and less error-prone. **Important context:** the app itself handled these flows correctly in Stage 2 (e.g., TC-A05 duplicate-email → Signup Failed **PASSED**). The friction below is **driver-technique / automation-environment**, NOT app defects.

### 5.1 The single dominant root cause: stale tree coordinates while the keyboard is up
When a field is typed into, the form auto-scrolls (keyboard avoidance scrolls the focused field into view). The accessibility tree then reports coordinates that **no longer match the visible screen positions** — but the driver has no way to know it's stale. Consequence: tapping the "next field" using the last tree's y-coordinate lands on the WRONG element, and the typed text is appended to the wrong field.

**Failures caused by this one bug:**
- **Signup Failed (duplicate email) — the password struggle you flagged:** typed the email → tapped where the password "was" → password text landed in the **email** field (`...@example.comDemoPass456`). Repaired email via Select All, then tapped password → typed OK. Then for the confirm-password field, a tap using stale coords hit the **password** field again → password grew 14 → **29 dots** and confirm stayed empty → form unrecoverable without a full reset. This is why the duplicate-email submission never completed.
- **Phone-field corruption during DOB entry:** with the phone keypad up, taps intended for the Day/Month/Year row (y≈712) hit keyboard keys / the still-focused phone field → phone grew to `+1202555010011521320158QaStage2_2026!`.
- Repeated across the age-gate and referral signups too — recovered only by terminate/relaunch resets.

### 5.2 Slow DOB entry (flagged)
Each of the 3 DOB fields (Day/Month/Year) required a slow, defensive sequence: dismiss keyboard → re-list → tap at fresh coords → type → re-list to verify → dismiss keyboard again for the next one. ~6+ tool calls per DOB field just to avoid the §5.1 corruption. This is the single slowest part of any signup.

### 5.3 Keyboard dismissal was unreliable
Tapping a non-input header/label dismissed the keyboard **sometimes** but not consistently; the tree often still listed keyboard keys (`shift`, `return`) at off-screen coordinates (y≈1075–1131), making it ambiguous whether the keyboard was actually up. The most reliable dismiss was tapping the visible **Return key** (bottom-right ≈ (382, 858)) — but that also failed intermittently.

### 5.4 Field repair (Select All) was unreliable on SecureTextFields
Long-press → Select All → retype worked on **text** fields (email, DOB year) but **never surfaced the menu on the password (SecureTextField) field** — so a corrupted password was unrecoverable in place and forced a full form reset. Double-tap did **not** select all (it placed the caret mid-string and made corruption worse).

### 5.5 Full-form resets are expensive
Terminate/relaunch → Landing → Get Started → Create Account → refill ~8 fields = 15+ taps each. This round needed several resets (age-gate form ×1 reset, duplicate-email form ×2 resets, plus one LogBox overlay reset).

### 5.6 "Dev: Autofill Test Users" buttons were unreachable
The intended escape hatch (Alice/Bob/Charlie autofill fills all fields incl. matching passwords) sits below the fold / behind the keyboard on the scrolled form, and the swipe-scroll gesture did not scroll the form. So the 1-tap autofill that would have collapsed the whole password/DOB struggle was not usable this round.

### 5.7 React Native dev menu / LogBox overlay hijacked the session once
A tap near the keyboard bottom-right opened the dev "Console Error" LogBox (showing a stale "Invalid login credentials" log). Its Dismiss/Close buttons are **not exposed in the tree**, so dismissing it wasted several cycles; terminate/relaunch was the reliable recovery.

---

## 6. What Worked Well (keep for next round)

- **Verify-after-every-field using the tree** — caught every corruption immediately (never trust what you typed; confirm the value landed in the right field).
- **Dismiss-keyboard-then-tap pattern** — when followed strictly, the age-gate form filled **correctly on the first clean pass** (name → email → phone → DOB → password → confirm).
- **Long-press → Select All → retype** on text fields (email, DOB year) repaired corruption reliably.
- **Terminate/relaunch** as a deterministic form + overlay reset.
- **The deep-link logout** (`p2pkidsmarketplace://qa-logout`) worked flawlessly 4/4 — keep it as the canonical teardown.

---

## 7. Recommendations for Next Round (make signups 3–5× faster & corruption-proof)

1. **Primary recommendation — use "Dev: Autofill Test Users" as the ONLY path for full signups.** It fills name/email/phone/DOB/password/confirm in one tap with valid, matching values — eliminating the password struggle (§5.1) and the DOB slowness (§5.2) entirely. Next round, before relying on it, **solve reachability**: either (a) figure out the exact scroll/tap that brings the buttons into a tappable, keyboard-free position, or (b) recommend a tiny dev-only change to surface the autofill buttons higher on the form. Then: autofill Bob → **edit ONLY the email** field (Select All → retype to `seller.charlie.smith@example.com`) → submit → the duplicate-email Signup Failed dialog triggers with one manual field edit instead of 8.
2. **Codify `dismissKeyboard()` with a post-check.** Sequence: tap a known label above the keyboard → re-list the tree → **confirm no keyboard keys are present** → only then tap the next field at its freshly-reported y. If dismissal failed, tap the visible Return key (≈(382, 858)) and re-check. Never tap the next field from a listing taken while the keyboard was up (§5.1).
3. **Codify `fillField(fieldY, value)` = dismiss-keyboard → re-list → tap → type → re-list → assert value.** One subroutine, used for every field. This makes the slow DOB sequence (6 calls/field) a mechanical, reliable pattern.
4. **Codify `selectAllRetype(fieldY, value)` and TEST it on a SecureTextField early** (long-press Select All failed on the password field this round — confirm a working method, e.g., long-press on the password text area vs. elsewhere, before relying on it).
5. **Fail-fast reset rule:** if a form entry corrupts a field twice, **reset (terminate/relaunch) immediately** instead of repairing in place — repairing was consistently slower than a clean refill.
6. **Codify `dismissDevOverlay()`:** if the LogBox/dev menu appears, do NOT hunt for unexposed dismiss buttons — terminate/relaunch immediately (§5.7).
7. **DOB-specific note:** always dismiss the keyboard BEFORE the first DOB tap (the phone keypad overlaps the DOB row). If autofill (#1) is adopted, DOB becomes a non-issue.
8. **Per-screen landmark map (carry from Stage 2 §11.6):** record the initial keyboard-down positions of Landing buttons, Login fields, and Create Account fields so screens are not re-discovered every run.

### Expected outcome
With autofill (#1) + the codified subroutines (#2–#6), a full signup collapses from ~15 taps / multiple resets to **1 tap (autofill) + 1 field edit + submit**, and the duplicate-email regression becomes a single quick pass instead of the round's longest, most failure-prone segment.

---

## Test data touched this run
- **Created:** `stage3.invalidref.demo@example.com` (QA Stage3 Referral; phone +12025550100; ZIP 10001 → Little Falls Central node; waitlist dialog "Continue Trading" used). Note: this account now exists in staging.
- **Blocked (no account):** duplicate-email attempt with `seller.charlie.smith@example.com` (attempted, form never submitted due to environment); under-18 attempt (age gate).
- **Left state:** app logged out on Landing (clean teardown via deep link).
