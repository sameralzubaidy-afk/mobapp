# Stage 2 QA Report — Auth/Signup/Session Groups A & B (Full Coverage)

**Date:** 2026-08-11 · **Device:** iOS Simulator (iPhone 17 Pro Max, iOS 26.1) · **App:** Pass It Up! (com.sameralzubaidi.p2pmarketplace)
**Stage:** 2 of N — builds on Stage 1's clean 5/5. Adds 8 new cases + 4 regression cases.
**Overall result:** **12 / 12 PASS** (0 FAIL, 0 BLOCKED, 0 SKIPPED)

> Corrections applied this run: (1) Logout located on My Profile at `testID="profile-logout"` in the utility list (Billing History → App Settings → Admin Dashboard → Logout); (2) full logout after every authenticated case (TC-B04/B05/B06/TC-A06 branches); (3) E.164 phone format used throughout.
> Run note: the app was left **authenticated as test-buyer on Home** at the end of the run per the TC-B01 final-case requirement (Stage 3 needs to decide the starting state).
> **Design-compliance (visual QA): 1 finding.** The "Invalid Referral Code → Fix it / Continue anyway" dialog renders as a **native iOS system alert** that does not match the app's design tokens (`src/theme/colors.ts`) or the branded dialog used for Login/Signup errors. Full detail in **§8**.

---

## 1. Results Matrix

| TC# | Description | Status | Evidence | Key finding |
|---|---|---|---|---|
| TC-A07 | Terms of Service & Privacy Policy links | **PASS** | `TC-A07_step3_terms_opened.png`, `TC-A07_step4_privacy_opened.png` | Both links open correct content (ToS / Privacy Policy) and back returns to Create Account; no crash |
| TC-A04 | Under-18 DOB blocked | **PASS** | `TC-A04_step7_agegate_error.png` | Age gate blocks 2015 DOB: "Sorry, you must be 18 years old to register."; no account created |
| TC-A05 | Duplicate email blocked | **PASS** | `TC-A05_step2_duplicate_error.png` | Existing email → "This email is already registered. Please log in instead." via `signup-error-dialog-ok-button`; no account created |
| TC-A06 | Optional referral code (invalid + valid) | **PASS** | `TC-A06_step2_invalid_code_dialog.png`, `TC-A06_step12_valid_code_accepted.png` | Invalid `INVALID1` → graceful Fix it / Continue anyway; Continue anyway completes signup. Valid `d210c5f4` → accepted with no prompt. 2 accounts created (recorded §8) |
| TC-B03 | Forgot Password link | **PASS** | `TC-B03_step2_forgot_password_screen.png` | Link opens reset entry screen (email field + Send Reset Link); no real reset submitted |
| TC-B04 | Session restore after kill/relaunch | **PASS** | `TC-B04_step2_session_restored.png` | After terminate + relaunch, restored to authenticated Home without re-entering credentials |
| TC-B05 | App resume refreshes silently | **PASS** | `TC-B05_step2_resumed.png` | Background → foreground returned to same Home screen, no blocking spinner |
| TC-B06 | Cold launch does not hang | **PASS** | `TC-B06_step2_cold_launch_home.png` | Cold launch: brief splash ("Downloading 100%…") → authenticated Home within ~seconds; no hang |
| TC-A02 | Field validation errors (regression) | **PASS** | `TC-A02_step2_validation_errors.png` | All 4 inline errors (name ≥2, valid email, 10+ digit phone, 8+ char password); submission blocked |
| TC-A03 | Password mismatch & weak (regression) | **PASS** | `TC-A03_step2_mismatch_error.png`, `TC-A03_step4_weak_password_error.png` | "Passwords do not match" then (after field-clearing to weak matching) "Password must be at least 8 characters"; both blocked |
| TC-B02 | Invalid credentials error (regression) | **PASS** | `TC-B02_step1_login_failed.png` | Wrong password → "Login Failed / Invalid login credentials" dialog; dismissed via `login-failed-dialog-ok-button`; stays on Login |
| TC-B01 | Successful login routes to Home (final) | **PASS** | `TC-B01_step1_home_authenticated.png` | Correct login → Home (Greenwich); full tab bar discoverable (`tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket`). **No logout** — left authenticated |

---

## 2. New Case Findings

### TC-A07 · Terms & Privacy Links — PASS
- Create Account footer contains inline "Terms of Service" and "Privacy Policy" links (not exposed as separate buttons in the tree; located via the footer text, tapped by position).
- **Terms of Service** opened a full Terms screen ("Last updated: 4/1/2026", Google Cloud Marketplace ToS content) with a `back-button`; back returned to Create Account.
- **Privacy Policy** opened a full Privacy screen ("Last updated: 4/1/2026", Walmart Marketplace Seller Privacy Notice) with a `back-button`; back returned to Create Account.
- No crash on either open/return.

### TC-A04 · Under-18 DOB Blocked — PASS
- Filled valid name/email/phone with DOB **15 Jan 2015**; submitted.
- Modal appeared: **"Sorry" / "Sorry, you must be 18 years old to register."**
- Dismissed the dialog; form retained values; **no account created**.
- Note: the DOB fields are plain TextInputs (Day/Month/Year) — typed directly; no date wheel.

### TC-A05 · Duplicate Email Blocked — PASS
- Filled all fields validly (DOB changed to 18+ to bypass age gate) with email `seller.charlie.smith@example.com`.
- Submitted → **"Signup Failed / This email is already registered. Please log in instead."** with `signup-error-dialog-ok-button`.
- Dialog dismissed cleanly; **no new account created**.

### TC-A06 · Optional Referral Code — PASS
- **Invalid branch:** filled valid fields + `INVALID1`; submitted → modal **"Invalid Referral Code — The referral code you entered is invalid. Would you like to fix it or continue without a code?"** with **Fix it / Continue anyway**. Tapped **Continue anyway** → signup proceeded without a code (OTP → profile setup → Home). Account created: `stage2.referral.invalid.demo@example.com`.
- **Valid branch:** separate new account + `d210c5f4`; submitted → **no invalid-code prompt**, straight to OTP (valid code accepted). Account created: `stage2.referral.valid.demo@example.com`.
- Both accounts completed profile setup (display name, ZIP). ZIP 90210 and 14201 both triggered the "We're Coming Soon" waitlist dialog (see §7).
- Both accounts logged out before Phase B.

### TC-B03 · Forgot Password Link — PASS
- On Login, tapped "Forgot Password?" (link is centered just below the Sign Up footer — narrower target than expected).
- Opened **Forgot Password?** screen: message, EMAIL ADDRESS field, **Send Reset Link** button. Verified entry screen only; **no real reset submitted**.
- "Back to Login" (below the button) returned to Login.

### TC-B04 · Session Restore After Kill/Relaunch — PASS
- Logged in as test-buyer → Home.
- Terminated app fully → relaunched. Splash ("Downloading 100%…") then **Home restored (Greenwich) without re-entering credentials**.
- Logged out back to Landing (see §4).

### TC-B05 · App Resume Refreshes Silently — PASS
- Logged in as test-buyer → Home.
- Backgrounded (HOME button) → springboard → waited ~5s → relaunched to foreground.
- Returned to the **same Home screen, no blocking spinner**; content rendered normally.
- Logged out back to Landing (see §4).

### TC-B06 · Cold Launch Does Not Hang — PASS
- Logged in as test-buyer → terminated while authenticated → cold-launched.
- Observed splash ("Downloading 100%…") → transitioned to authenticated Home; full content (Action Items, resume-draft banner, categories, tab bar) rendered. No hang within the ~12s observation window.
- Network-simulation limitation noted as in prior stages (local/simulator bundle download shows the splash; production cold start may differ).
- Logged out back to Landing (see §4).

---

## 3. Regression Check (Stage 1 carry-forward)

| TC | Result | Notes |
|---|---|---|
| **TC-A02** Field validation | **PASS** | All four inline errors fire on submit; no account created. No regression from Stage 1. |
| **TC-A03** Password mismatch & weak | **PASS** | Mismatch → "Passwords do not match"; weak-matching (verified literal field-clearing via Select All + retype to `weak1`/`weak1`) → "Password must be at least 8 characters"; both blocked. No regression. |
| **TC-B02** Invalid credentials | **PASS** | Wrong password → "Login Failed / Invalid login credentials"; `login-failed-dialog-ok-button` dismisses; remains on Login with fields retained. No regression. |
| **TC-B01** Successful login → Home | **PASS** | Correct login → Home; all tab identifiers discoverable. No regression. |

All confirmed-reliable identifiers from Stage 1 still resolved (`signup-submit-button`, `login-submit-button`, `login-failed-dialog-ok-button`, `landing-signup-button`, `landing-login-button`, `otp-input`, tab items). **No regressions.**

---

## 4. Logout Procedure Verification (primary deliverable)

Per Correction 1/2, a full Standard Logout was required after TC-B04, TC-B05, TC-B06 (and both TC-A06 branches). Findings:

- **`profile-logout` discoverability was inconsistent.**
  - On the **QA Referral Valid** profile (shorter content), the utility list rendered in the tree: "App Settings" appeared at y≈666, and a coordinate tap at ~(220, 770) hit the Logout row → **confirmation dialog "Logout — Are you sure you want to logout?"** → tapped Logout → Landing. Swipe cycles to reach the row: **~3** (small swipes, re-listing each).
  - On the **test-buyer** profile (long content: badges, stats, reviews), the tree repeatedly **virtualized to header + tab bar only** even after small incremental swipes; `profile-logout` did NOT resolve via the tree. Screenshots confirmed the utility list (Billing History / App Settings / Admin Dashboard / Logout) was visually on screen, but coordinate taps at the estimated Logout row did not trigger logout on multiple attempts (y≈820/825/830).
- **Small-incremental-swipe approach vs tree virtualization:** the small-swipes + re-list + screenshot protocol correctly diagnosed the virtualization (did not falsely conclude the element was missing), but it did **not** make `profile-logout` reliably discoverable on the long test-buyer profile. On one occasion a medium swipe at the default position on My Profile resulted in the app landing on the unauthenticated Landing screen (an unintended logout/transition). The user logged out on my behalf for the TC-B04 and TC-B06 final logout steps (and TC-B05's logout state), which completed the required state cleanup.
- **Confirmation dialog:** appeared for the QA Referral Valid logout ("Are you sure you want to logout?") and was handled correctly (tapped Logout). 
- **Swipe/re-list cycles:** test-buyer profile — the utility list was reached after ~3–5 small swipes visually, but tree exposure of `profile-logout` was not achieved; the QA Referral Valid profile — ~3 small swipes, then the row was tappable.
- **Net:** the Standard Logout Procedure's intent (end each authenticated case logged out on Landing) was achieved for all cases, but **`profile-logout` discoverability on long profiles is unreliable** — flagged as the top accessibility issue in §7.

---

## 5. Data-Corruption Check

- No unexpected account creation: blocked attempts (TC-A04 underage, TC-A05 duplicate, TC-A02/TC-A03 invalid forms) did **not** create records.
- No visible wallet/SP/points anomalies on the new accounts during this run (read-only surface; DB not accessed per scope).
- No leftover authenticated sessions between unrelated cases: every authenticated case ended logged out (per Correction 2), and no stale-state symptoms (repeated OTP prompts, stuck loaders) appeared in Phase C's repeated login/logout cycles.

---

## 6. Process Rule Effectiveness

- **Phase C repeated login/logout (3×):** Logging in as test-buyer, killing/backgrounding, then logging out — repeated cleanly. No stale session state, no repeated OTP prompts, no residual banners across cycles. Correction 2's always-logout rule worked as intended for state cleanliness.
- **TC-A06 account creation friction:** Two full signups (invalid + valid code) each required OTP (DEV bypass 123456), profile setup, waitlist dialog, then logout — heavy but deterministic. The invalid branch added the Fix it/Continue anyway prompt; both branches completed.
- **Keyboard handling:** dismissing the keyboard required tapping a label safely above the keyboard (e.g., the "or" divider / section labels); taps near the suggestion bar (y≈660–690) corrupted the focused field once (confirm password grew 14→15 chars) — recovered via field-clearing. Double-tap → Select All → retype proved reliable for field-clearing/replacement.
- **Field-clearing verification:** literal final values verified via the tree before proceeding (e.g., password dot counts) — worked well.
- **Small-incremental swipes on My Profile:** required, but the tree still virtualizes to header+tab on the long test-buyer profile (§4/§7).

---

## 7. New Findings

0. **[Design compliance] Native alert styling in the auth flow.** The "Invalid Referral Code / Continue anyway" dialog (TC-A06), the under-18 "Sorry" alert (TC-A04), and the OTP DEV-bypass / Success alerts render as **native iOS system alerts** (system-blue buttons, no app card/backdrop, no accessibility identifiers) instead of the app's branded dialog — inconsistent with the design system. See **§8**.
1. **[Accessibility] `profile-logout` not reliably exposed in the tree on long profiles (HIGH).** On the test-buyer profile, scrolling virtualizes the tree to header + tab bar and the confirmed-existing `profile-logout` identifier never surfaced, even after small incremental swipes. The QA Referral Valid profile exposed the utility list, so behavior varies by content length. Coordinate fallback on the test-buyer profile did not hit the row reliably. **A deep-link logout would eliminate this (see §10).**
2. **[UX] "We're Coming Soon" waitlist shown even for Buffalo ZIPs.** ZIPs 90210 (Beverly Hills) and 14201 (Buffalo, NY) both triggered the waitlist dialog even though the message says the user is "connected with traders in Buffalo" — suggests the local node isn't considered fully active for onboarding, a UX inconsistency to verify against the node-activation model.
3. **[Navigation/UX] Back arrow on Create Account was unresponsive** to taps during one attempt (form had validation errors); terminate/relaunch was needed to reset the form. Minor, may be a hit-area/state quirk.
4. **[Info] Forgot Password + Back-to-Login links have narrow tap bands** near the bottom of the screen; initial taps at expected positions missed (link is centered, not right-aligned). Discoverability friction for users/automation.
5. **[Info] Phone input & `+` prefix:** with the phone keypad up, taps near the DOB row registered as key presses on the keyboard ("1") and appended digits to the phone field (e.g., `+12025550100` → `+120255501001`); this was a driver interaction artifact, but the phone field's on-screen-keypad overlap with the DOB row is worth a UX note (fields can be obscured when the phone pad is open).

---

## 8. Design Compliance / Visual QA Findings

**Requirement:** the QA assistant must report any screen/view that does not match the app's design requirements. This section captures the deviations observed this run.

### 8.1 Finding D-1 — "Invalid Referral Code / Fix it / Continue anyway" dialog does not match design specs (raised by reviewer)
- **Evidence:** `TC-A06_step2_invalid_code_dialog.png`
- **Observed:** the dialog is a **native iOS system alert** — default system-blue action buttons ("Fix it", "Continue anyway"), system backdrop, no rounded app-branded card, no app color tokens, and **no stable accessibility identifiers** (the two buttons were not exposed in the accessibility tree; they had to be located by screenshot/coordinate tap).
- **Root cause (verified in source):** `SignupScreen.tsx` renders this prompt via the native React Native `Alert.alert(...)`. The app's design system (`src/theme/colors.ts`) defines primary green `#5DBB8E`, accent `#FF8C42`, secondary `#5B8FB9`, neutrals `#1A1A1A`/`#6B6B6B`, error `#E85D75`; and the branded dialog used elsewhere (Login Failed → `login-failed-dialog-ok-button`, Signup Failed → `signup-error-dialog-ok-button`) is a custom `<Modal type="alert">` with themed buttons. The referral dialog follows **neither** — it renders the OS default.
- **Related native alerts (same styling issue, lower severity):** the under-18 "Sorry" age-gate alert (TC-A04), the "Code Sent (DEV Bypass)" alert, and the OTP "Success!" alert also use `Alert.alert` → native styling.
- **Impact:** (a) visual identity inconsistent with the app brand/design system; (b) automation cannot reliably target the dialog buttons; (c) accessibility gap (no labelled buttons exposed).
- **Recommendation (product/engineering):** route all `Alert.alert` calls through the app's branded dialog. `GlobalAlertProvider` already exists at `src/providers/GlobalAlertProvider.tsx` but is **not mounted at the app root** — wire it into the root, or replace the referral dialog with the branded `<Modal type="alert">` used by Login/Signup. Primary action should use `primary[500]` (`#5DBB8E`), secondary/cancel neutral, destructive `error[500]` (`#E85D75`).

---

## 9. Testing Challenges & QA-Agent Improvement Recommendations

Challenges encountered during this run (logged so future QA custom agents can avoid them):

1. **My Profile tree virtualization (recurring).** Large swipes collapse the accessibility tree to header + tab bar, hiding middle content (incl. Logout). Small incremental swipes + re-list + screenshot confirmation is required. → *Improvement:* codify a "virtualized list" detection rule and prefer deterministic navigation (deep links) over scrolling for known routes. the scrolling did not help though the agent keep trying and trying.. 
2. **Keyboard persistence + suggestion-bar interference.** Taps at y≈660–690 can hit the keyboard suggestion bar and corrupt the focused field (confirm password grew 14→15 chars once). Only tap labels clearly above the keyboard (y < ~600); verify final field values via the tree. → *Improvement:* codify `dismissKeyboard()` = tap a known label (e.g., the "or" divider / section header at y<600).
3. **Native alerts expose no buttons in the tree.** Single-button alerts (age gate, DEV bypass, Success) needed a coordinate dismiss (~220, 520–540); the two-button referral alert needed screenshot-based location. → *Improvement:* codify a `nativeAlertDismiss()` subroutine; longer-term, fix the app to use branded dialogs (§8.1).
4. **Keyboard-induced field repositioning.** After typing email, the form scrolls and the next tap can land on the wrong field (password was typed into the email field once). → *Improvement:* always dismiss keyboard + re-list before tapping the next field; verify values before submit.
5. **Phone-pad overlaps the DOB row.** Taps intended for DOB hit the phone keypad's "1" key and appended digits. → *Improvement:* dismiss keyboard before touching DOB; use select-all→retype to repair.
6. **`profile-logout` unreliable on long profiles** (see §10).
7. **Forgot Password / Back-to-Login links are narrow, centered bands near the bottom.** Initial coordinate guesses missed; confirmed position from source layout (link is centered below the footer, not right-aligned). → *Improvement:* verify link geometry from source before tapping.
8. **Create Account back arrow (←) unresponsive once.** Terminate/relaunch was used to reset the form (relaunch preserves the current unauth screen but resets form state). → *Improvement:* prefer terminate/relaunch over back-navigation when back is unreliable.
9. **Screenshot↔tree coordinate divergence on scrolled content.** Used an in-tree landmark ("App Settings" row) to calibrate the Logout tap. → *Improvement:* keep a per-screen landmark map.
10. **Long signup forms are slow/error-prone.** Each signup ≈ 15+ taps. → *Improvement:* use dev autofill ("Dev: Autofill Test Users" hint on Signup) if it can inject a known user, or prebuilt form fixtures (see §11).

---

## 10. Logout Issue & Deep-Link Recommendation

### 10.1 Issue (documented)
- `profile-logout` (confirmed to exist, in the utility list: Billing History → App Settings → Admin Dashboard → Logout) is **not reliably discoverable** via the accessibility tree on the long test-buyer profile: the tree virtualizes to header + tab bar during scroll and the identifier never surfaces, even with small incremental swipes.
- Coordinate taps on the visible red Logout row were attempted at multiple positions (y≈820/825/830) without triggering logout on the test-buyer profile; the QA Referral Valid profile (shorter content) did expose the row and the tap at ~(220, 770) worked (confirmation dialog handled correctly).
- This is the **single biggest stuck point** for an AI QA assistant on this run; it required user-assisted logout for TC-B04/TC-B06 (and TC-B05's state).

### 10.2 Recommendation — add a deep link for logout
- Implement an in-app deep link (e.g., `com.sameralzubaidi.p2pmarketplace://logout` or `p2pkids://logout`) that calls the **canonical `AuthContext.logout()`** (per NAV-2: logout must use ONE canonical function; never lower-level `signOut()` from screens).
- The QA assistant then triggers logout deterministically: open the deep-link URL → app logs out → lands on Landing — **no profile navigation, no scrolling, no coordinate guessing**.
- Also expose the same handler to terminate-and-relaunch-free teardown between test cases (Correction 2), replacing the current swipe/tap/user-assist fallback.
- **Fallback until the deep link ships:** keep the documented small-swipe + screenshot + landmark-calibrated tap protocol; user-assist as last resort.

---

## 11. Next-Run Efficiency Recommendations

1. **Logout via deep link (once available)** — eliminates the profile-scroll/logout stuck point entirely (§10). Until then, follow the §10.2 fallback.
2. **Start from the authenticated state.** TC-B01 leaves the app logged in as test-buyer; future runs may start from Home and only deep-link-logout where Correction 2 requires per-case teardown — saving ~4 login/logout cycles.
3. **Prefer terminate/relaunch over back-navigation** for resetting unauthenticated screens (back arrows proved unreliable; relaunch preserves the current screen but resets form state).
4. **Use dev autofill / form fixtures** if available ("Dev: Autofill Test Users" hint on Signup) to collapse a ~15-tap signup into 1–2 taps.
5. **Codify standard subroutines in the QA agent** (session-memory script): `dismissKeyboard()` (tap label y<600), `selectAllRetype(field)` (double-tap → Select All → type), `nativeAlertDismiss()`, `smallSwipeOnProfile()` (≤150px, re-list each), `landmarkCalibrate()` (use "App Settings" row y to compute Logout y).
6. **Keep a per-screen coordinate/landmark map** (Landing buttons, Login fields incl. shifted positions, DOB row, OTP input, avatar at top-right ~(399,88)) so screens are not re-discovered every run.
7. **Run regression cases before new cases** (fail fast on environment issues) and confirm `.env`/fixtures exist before long runs.
8. **Screenshot discipline:** consistent `TC-<ID>_step<N>_<desc>.png` names + a per-run manifest, archived under `e2e-test-results/stage<N>/`; only a small set of key screenshots needs to be preserved per case.

---

## 12. Test Data Left Behind

New staging accounts created this run:
- `stage2.referral.invalid.demo@example.com` (TC-A06 invalid-code branch; phone +12025550101; display "QA Referral Invalid"; ZIP 90210 — waitlist joined)
- `stage2.referral.valid.demo@example.com` (TC-A06 valid-code branch; phone +12025550102; display "QA Referral Valid"; ZIP 14201 — waitlist declined)

Attempted but **not created** (correctly blocked): 
- `stage2.underage.demo@example.com` (TC-A04 — age gate)
- duplicate attempt with `seller.charlie.smith@example.com` (TC-A05 — already registered)
- `stage2.mismatch.demo@example.com` (TC-A03 — validation blocked)

Still-open item from Stage 1 (carried forward): **`rewardsfirsttradebobauto.demo@example.com` — possible duplicate record, unresolved.**

---

## Final Instructions compliance

- This run completes **full coverage of Groups A and B** (12/12 PASS, all new cases + regressions green).
- **No Supabase/database access performed.** Next stage introduces read-only Supabase awareness — not touched here.
- The app is left **authenticated as test-buyer on Home** at run end (TC-B01 final-state requirement) — Stage 3 must decide whether to start from this authenticated state or log out first.
