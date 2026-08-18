# Phase 22 — Decision-and-Outcome Log (execution trace with reasoning)

**Purpose:** A full decision-and-outcome log of the Phase 22 QA run (AUTH Group B cleanup B10–B12, Group D logout D01–D03, Group E phone verification E01–E05), for an AI agent to mine for:
- **(a) what slows execution** (bottlenecks),
- **(b) what patterns an agent should adopt proactively**,
- **(c) what instrumentation/fixture work removes the friction.**

Each entry records: **Action** → **Reasoning** → **Tool calls that mattered** → **Outcome / friction signal**.

Run: 2026-08-17 · iPhone 17 Pro Max Simulator (iOS 26.1) · Expo RN dev build + Metro · QA Test Agent (execution-only).

---

## 0. Pre-flight (context gathering) — before any test execution

| # | Action | Reasoning | Tool calls that mattered | Outcome / friction |
|---|---|---|---|---|
| 0.1 | Read the operating playbook `.github/instructions/QA-Test-Agent.instructions.md` (§4–§9) + repo memory (`qa-test-accounts.md`, `locator-conventions.md`, `simulator-keyboard-suppression.md`, `qa-test-agent.md`). | The playbook mandates reading it before the first run and following it every run; memory holds standing personas + verified environment facts. | `read_file`, `memory view` | Established: personas (test-buyer/TestBuyer123!), §5.1 locate-then-tap rule, §5.2 keyboard/focus discipline, §5.4 dialog-type verification, §5.7 load-time, §5.8 clean-state, §5.11 session checks. |
| 0.2 | Located the canonical cases (B10–B12, D01–D03, E01–E05) in `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`. | TC-IDs are reused across guides; must disambiguate by the named guide. | `grep_search`, `read_file` | Confirmed case definitions + "DEV SMS bypass 123456" note in the prompt. |
| 0.3 | Activated the mobile-mcp tool categories (they are gated behind `activate_*` calls). | The device/interaction/screen tools are disabled by default; must activate before use. | `activate_mobile_device_fleet_management`, `activate_screen_interaction_tools`, `activate_app_management_tools`, `activate_screen_capture_tools`, etc. | All needed tools available. |
| 0.4 | Checked device availability. | Confirm simulator present/booted. | `mobile_list_available_devices` | iPhone 17 Pro Max, iOS 26.1, online. |
| 0.5 | Read source for every screen/services the cases touch: `LoginScreen`, `SignupScreen` (+`DateOfBirthPicker`, `testUsers`), `PhoneVerificationScreen`, `OTPInput`, `phoneService`, `verification`, `devTestingService`, `usePhoneVerification`, `ItemCreateScreen`, `ProfileScreen`, `SettingsScreen`, `AppNavigator`, `educationAnalyticsService`, `seed-staging-data.ts`, `send-phone-otp` Edge Function. | Pre-build a full locator + behavior map (error messages, rate-limit flow, gate logic, unverified-user path, dev-autofill, DOB picker mechanics) so execution is deliberate, not fumbling. **Key proactive pattern.** | `grep_search`, `read_file` (parallel) | Mapped: `login-back-button`/`login-signup-link`/`signup-login-link`; `profile-logout`/`settings-sign-out-button`; OTP flow (auto-send on mount, `countdown=60`, Verify disabled unless 6 digits, DEV bypass `123456`); E04 rate limits (3/hr phone, 5/day user, enforced in Edge Function before insert/send); E05 gate (`isPhoneRequired` → `PhoneVerificationModal required=true`); signup dev-autofill fills the whole form; `DateOfBirthPicker` = three TextInputs DD/MM/YYYY with auto-advance; onboarding carousel → `replace('Home')`. |

**Pre-flight verdict:** source-first preparation eliminated nearly all "what does this do" questions mid-run. The cost was ~15 read/grep calls, saved many more later.

---

## 1. Setup + clean-state (§5.8)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 1.1 | `mkdir -p …/phase22…/evidence/{b10-b12,d01-d03,e01-e05}`. | Standard evidence layout. | `run_in_terminal` | **Friction:** the tool *simplified* the command and dropped the leading `cd` to the workspace root → dirs were created under `p2p-kids-marketplace/e2e-test-results/` instead. Found via `ls`, fixed with `mv`. Lesson: verify where side-effectful terminal commands land. |
| 1.2 | Terminate → plain launch → poll for Landing. | §5.8: prove no deep-link LogBox overlay before any case. | `mobile_terminate_app`, `mobile_launch_app`, `mobile_list_elements_on_screen` | Clean Landing; observed dev cold-start bundle download (70%→100%→Landing) — environment artifact, ~5–10s. |

---

## 2. Group B — B10 / B11 / B12 (all PASS)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 2.1 | **B10:** Landing → `landing-login-button` → Login. | Straightforward nav. | list → click | Login rendered <1s. |
| 2.2 | **Locator gap:** `login-back-button` NOT in the AX tree (testID-only TouchableOpacity with `←` text; no `accessible`/role/label). | §5.1: never reuse stale coords; if a target isn't exposed, **flag it** and derive coords from pixels — don't silently guess. | `mobile_list_elements_on_screen` (found `←` only as StaticText once, absent otherwise), `mobile_save_screenshot` + PIL scan for the dark arrow glyph | Found arrow at pt ≈(35,107) via a pure-PIL scan (venv python; base python lacked PIL and numpy). Tapped → Landing. **PASS.** First of several **BP-53 exposure gaps** this run. |
| 2.3 | **B11:** `login-signup-link` ("Sign Up" footer) → Create Account. | Footer-link nav; locator exposed. | list → click → list | Create Account screen, <1s. **PASS.** |
| 2.4 | **B12:** on Create Account, swipe the form up to reveal the footer, tap `signup-login-link` → Login. | Footer is below the fold. | swipe → list → click → list | Login screen, <1s. **PASS.** |

**Group B friction:** only the B10 back button (locator gap → pixel scan). Everything else was clean.

---

## 3. Group D — D01 / D02 / D03 (D01 PASS, D02 SKIPPED, D03 PASS)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 3.1 | Log in as `test-buyer` (`TestBuyer123!`). | Standing persona per registry; reuse, don't create. | click field → type → re-list after each focus (autofill bars appear) → click Log In | Home <1s. |
| 3.2 | `header-profile-btn` → Profile. | Reach Profile via the header avatar. | click → list | Profile rendered (large tree). |
| 3.3 | **Locator gap:** utility rows (`profile-logout` etc.) not in AX tree (testID only). Scroll Profile to reach them. | §5.1 flag + derive. | swipe → list (tree returned the *same* content → suspected §5.9 staleness) → `save_screenshot` + PIL diff of before/after screenshots (190K changed px → first swipe DID scroll; tree was stale) | Confirmed screenshots are ground truth. Second swipe produced **0 changed px** (bounce/consumed) — early signal of the "0-movement swipe" pattern that later blocked E05. |
| 3.4 | Pixel-scan the Profile for the red `#EF4444` Logout row (icon + text are red). | Non-exposed row; its unique red color makes it locatable. | PIL scan → row at pt ≈(100,317) | Tapped Logout row. |
| 3.5 | **Empirical dialog check:** confirm dialog = in-app `GlobalAlertProvider` (title "Logout", msg "Are you sure…", `global-alert-button-0/-1`). | §5.4: don't trust the `Alert.alert` label; verify which dialog type it actually is. | list (buttons surfaced → instrumentable) | Confirmed in-app GlobalAlert (consistent with Phase 14/15 doc drift). Tapped Logout → Landing <1s. |
| 3.6 | §5.11 session check: AsyncStorage manifest has no `sb-*` keys. | UI observation alone isn't enough proof of logout. | `xcrun simctl get_app_container` + python json parse | No auth keys → session cleared. **D01 PASS.** D03 satisfied (Landing shows Sign Up/Log In, no authenticated content). |
| 3.7 | **D02:** SKIPPED per user instruction. | User explicitly asked to skip the Settings sign-out path. | — | Marked SKIPPED; reported honestly. |

**Group D friction:** profile scroll + AX staleness + pixel-scan for the Logout row. No app defects; all instrumentable once the row is located.

---

## 4. Group E — the long tail (E01 PASS, E02 PASS*, E03 PASS, E04 BLOCKED, E05 BLOCKED)

### 4.1 E01 — fresh signup → OTP → verify (the signup form was the session's biggest time sink)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.1.1 | Fresh signup E1 (`qa.p22.e1.<ts>@kidsmarketplace.test`, `+12025551001`, DOB 2000-01-01). | `new-user` persona is created per-run via UI; need a fresh OTP screen. | Get Started → form | — |
| 4.1.2 | Fill name → email → phone, re-listing after each field. | §5.2 verify each field landed; autofill bars are focus-stealing hazards. | click → type → list (per field) | All landed. |
| 4.1.3 | **Corruption event:** typed DOB digits; tree later showed `signup-phone-input = "+12025551001415012000"` — the DOB keystrokes went into the *phone* field. | **Root-cause reasoning:** when the phone field is focused, the number-pad keyboard is up and covers the DOB row (y≈733 is under the keyboard) → my tap at (80,733) hit a *key*, not the Day field, so focus never left phone. | list (revealed corruption) | **Friction (HIGH).** §5.2 says don't repair corrupted fields — but §5.10 says try long-press → Select All → retype *first* for text fields. |
| 4.1.4 | §5.10 recovery: long-press phone field → Select All → retype `+12025551001`. | Field clearing before a resetting relaunch; verified working for text/phone inputs (Phase 14/15). | long-press → list (menu: Paste/Select/Select All) → click Select All → type → list | Phone corrected. **Verified data point: §5.10 works for phone TextInputs.** |
| 4.1.5 | DOB refill: after dismissing the keyboard (tap a non-input label), tap Day box-center → `15` → `01` → `2000`. | Keyboard-dismiss-then-tap avoids the covered-field problem; the DOB fields' auto-advance (day→month→year) keeps focus on the right field. | click label (dismiss) → click Day → type → click Month → type → click Year → type | DOB landed (`15/01/2000` surfaced in the tree). |
| 4.1.6 | Password/confirm: initial taps at tree text-line y **missed** (keyboard coverage again → empty password → submit showed "Password must be at least 8 characters"). | The tree reports the *text-line* y, not the tappable box center; with keyboard up, positions shift. | list (saw validation error) → click field at **box-center (y+10)** → type | **Key pattern learned:** tap the input's box center (~+10pt below the tree text-line y), then type. Both password fields filled (12 masked chars). Confirm field briefly showed 13 chars (a stray leftover) — fixed via Select All → retype. |
| 4.1.7 | Submit: tree said `signup-submit-button` at y≈709, but taps there did nothing. | **Root-cause reasoning:** below-fold AX coords are *logical* (content) positions, not *rendered* screen positions when the keyboard compresses the layout. | `save_screenshot` + PIL scan for the green `#5DBB8E` pill → found at pt ≈(220,552), ~160pt higher than the tree. | Tapped real position → navigated to **Verify Your Phone** (~2s). **Key pattern learned: for below-fold buttons, pixel-locate the green primary pill.** |
| 4.1.8 | On OTP screen: tapped `dev-verify-otp-123456` (Use & Verify) → **Success!** dialog → Continue → **Complete Your Profile**. | E01 assertion: valid code shows success and proceeds to profile setup. | click → list → click Continue | **PASS.** Also captured: subtitle "We sent a 6-digit code to +12025551001"; OTP is a **single auto-formatted field** (guide's "6-box" = doc drift). |

### 4.2 E02 — error states (fresh E2 via autofill)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.2.1 | New signup via **DEV autofill** (Alice) + override email/phone via Select All. | Autofill fills name/DOB/password/confirm in one tap; only email+phone need fresh values (autofill emails are already registered). Big time-saver. | scroll → click `dev-fill-test-user-1` → long-press email → Select All → type → long-press phone → Select All → type → dismiss keyboard → pixel-locate green submit → tap | OTP screen for `+12025551002`. |
| 4.2.2 | **Dev-bypass dialog surfaced late:** "Code Sent (DEV Bypass)" appeared *after* I'd typed a code (async completion after mount). | Don't assume the auto-send dialog is absent; poll. | list | Dialog confirmed DEV code `123456`. Dismissed OK. |
| 4.2.3 | Wrong code `111111` → Verify → **"Verification Failed / Verification code expired or not found"**. | Expected "Invalid code"; got the OTPExpiredError message because in dev-bypass mode no code row exists → the "no record" branch fires. | click → type → click Verify → list | **PASS with doc/behavior nuance** (environment-driven; with a real stored code it'd be "Invalid verification code"). Input cleared. |
| 4.2.4 | Incomplete (<6 digits): Verify button is disabled-gray. | The guide's "Please enter all 6 digits" alert is unreachable — the disabled button is the guard. | screenshot | Finding (minor) + doc drift. Expired sub-condition → BLOCKED (needs ≥10-min wait; OTPExpiredError path already demonstrated). |

### 4.3 E03 — resend cooldown

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.3.1 | Resend link is not AX-exposed → pixel-scan the "Didn't receive the code?" row. | §5.1 flag + derive. | PIL scan of resend row | Found resend text beside the "Didn't receive…" text (same row). |
| 4.3.2 | **Mistap:** tapped y≈695 → navigated BACK to the signup form (the tap hit **"Change Phone Number"**, not the resend; my pixel-band reading mis-attributed the row). Lost E2's OTP screen. | The resend + "Change Phone Number" are two separate rows; I misread band 2 as the resend. | click → list (stale tree showed signup form → screenshot confirmed navigation) | **Friction (MEDIUM):** lost OTP screen. Recovered via `p2pkidsmarketplace://qa-logout` (clean, no overlay) + a fresh E3 autofill signup. |
| 4.3.3 | E3 OTP screen: observed cooldown behavior — after a send the resend text renders **disabled light-gray** (neutral[300]); a tap ~60s later fired send #2, and another ~60s later fired send #3. | E03 assertion: disabled + countdown after send; enabled after 60s. | click resend → list (Code Sent dialog) → color scan of resend region | **PASS** (disabled during cooldown + re-enabled ~60s; exact "Resend in Ns" digits not OCR-verifiable from the light-gray render — source `countdown=60` + `disabled={countdown>0}` confirms). |

### 4.4 E04 — rate limiting (BLOCKED)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.4.1 | Trigger the limit via repeated resends on one phone (+12025551003): 4 sends total (~7:24–7:28). | Edge Function enforces 3/hr per phone, 5/day per user; rate check precedes insert/send, so repeated sends should hit it. | resend taps → list (each returned a "Code Sent (DEV Bypass)" dialog) | **Every call returned SEND_FAILED → DEV bypass; RATE_LIMIT_EXCEEDED never surfaced** (LogBox: `FunctionsHttpError: Edge Function returned a non-2xx status code`). |
| 4.4.2 | **Batch-size self-check → BLOCKED.** | Don't hammer shared staging or force a condition that isn't cleanly inducible; report BLOCKED with reason. | — | **BLOCKED.** Plus UX/doc note: even if triggered, the OTP *screen* catch shows generic `Alert.alert('Error', err.message)`, not the guide's "Too many attempts…" (that copy only exists in the modal hook `usePhoneVerification.sendCode`). |

### 4.5 E05 — gate blocks first listing (BLOCKED at the final step)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.5.1 | Use unverified E3 (signed up, never verified OTP). Terminate → relaunch → session restored → **onboarding carousel** → `skip-button` → Home. | `shouldShowOnboarding` = true for an unverified, un-onboarded user; OnboardingScreen `replace('Home')` routes to Home without phone verification. | terminate → launch → list → click skip → list | Home, unverified phone. Setup achieved. |
| 4.5.2 | First attempt: tap `tab-sell` → tree showed only "Sell". | I concluded the create screen had unexposed fields; actually I was on the **Sell Options Sheet**. | list (stale/incomplete) | **Friction:** the sheet's options weren't AX-exposed; I initially misread the state and attempted to fill a non-existent form. |
| 4.5.3 | **User note:** "the sell options has 2 options — one item and batch". | Confirmed the sheet exists (`sell-option-list-one-item` / `sell-option-bulk-upload` in source). Re-logged E3 → Sell → sheet → pixel-located "List One Item" row → tapped → **"New Item" create screen**. | login → click tab-sell → screenshot + PIL scan of sheet rows → click first option → list | Reached ItemCreate; fields now surface (`add-photos-button`, `photo-slot-empty-1/2`). |
| 4.5.4 | Attempt to scroll the form to title/price/publish: 4 swipe variants (y 350/450/500, 250–700pt) → **0 screen movement** (pixel-diff confirmed). | The form fields are below the fold; need to scroll to fill them (which also requires a photo via native picker). | swipe (4 variants) → list → screenshot → PIL diff | **BLOCKED.** The ItemCreate screen would not scroll via the toolset swipe in this session — form could not be filled, publish unreachable. Gate logic is source-verified (`handlePublish` → `isPhoneRequired` → `setShowPhoneVerificationModal(true)`, required mode; `onSuccess` → retry). |

### 4.6 Cleanup + reporting

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 4.6.1 | `p2pkidsmarketplace://qa-logout` to clear E3's session → clean Landing. | Leave a clean state; documented teardown helper. | `xcrun simctl openurl` | Clean Landing. |
| 4.6.2 | Wrote `report.md` (per-case traces, batch table, load-time table, design compliance, full QA Session Handoff) + appended Phase 22 facts to repo memory. | Reporting format + handoff per playbook §8; memory for future sessions. | `create_file`, `memory insert` | Deliverables complete. |

---

## (a) What slows execution — bottlenecks (ranked)

1. **Keyboard/focus fights on the signup form (the dominant time sink).** The number-pad covers fields below the phone field; taps hit keys, corrupt fields, and keystrokes land in the wrong field. Recovery (Select All → retype, or terminate+relaunch) is slow. Multiple minutes per signup.
2. **AX-tree coordinate inaccuracy below the fold when a keyboard is up.** The tree reports *logical* (content) y, not the *rendered* position (the submit button rendered ~160pt higher). Every below-fold tap needed a pixel-scan of the green primary pill. Also `0-movement swipes` cost repeated attempts.
3. **AX-tree staleness after navigation/scroll.** The tree returned previous-screen content (Profile scroll, OTP/signup transitions); screenshots had to be re-taken as ground truth, and pixel-diffs used to confirm movement.
4. **BP-53 exposure gaps force pixel-derivation on every non-exposed control.** `login-back-button`, Profile utility rows, OTP resend link, Sell Options Sheet options — each required a screenshot + color/glyph scan + coordinate math instead of a one-line tap.
5. **Environment hides real code paths (dev bypass).** Every OTP send returns SEND_FAILED → DEV bypass, so the rate-limit path (E04) never fires and E02's wrong-code message differs from the guide. Both cost time to diagnose and then had to be BLOCKED.
6. **Repeated full signups for Group E.** Even with DEV autofill, each fresh account needs email/phone override + submit + navigation (~2 min each).
7. **The ItemCreate screen wouldn't scroll via the toolset swipe**, which alone blocked the entire E05 final step (form fill + photo + publish).

## (b) Patterns an agent should adopt proactively

1. **Source-first preparation.** Read the screens/services/edge functions before executing; build a locator + behavior + error-message map. This paid off repeatedly (gate logic, rate-limit flow, autofill, DOB picker, onboarding routing).
2. **Fresh tree before every tap + verify-after-every-type.** Re-list before each interaction and after each field entry to confirm the value landed in the right field.
3. **Keyboard discipline: dismiss → tap box-center → type.** For fields that can be covered by the keyboard, dismiss the keyboard first (tap a non-input label), tap the input's **box center (~+10pt below the tree text-line y)**, then type. Prefer filling keyboard-covered fields (DOB) while the keyboard is down.
4. **Treat the screenshot as ground truth, the tree as advisory.** When a tree looks stale or an assertion doesn't match, screenshot + pixel-diff; don't act on stale trees (§5.9).
5. **Pixel-locate non-exposed controls by unique color/glyph.** Green `#5DBB8E` = primary pill (submit/verify), red `#EF4444` = destructive rows, gray `#E8E8E8` = disabled. Convert px→pt at the 3x scale.
6. **For below-fold buttons, never trust tree y when a keyboard may be up** — scan for the green pill's rendered position.
7. **A swipe producing 0 changed pixels = a scroll blocker**, not a reason to retry repeatedly. Report as tooling friction (§: treat as blocker).
8. **Use the DEV autofill + Select All override for repeated signups**, and the `qa-logout` deep link for clean session teardown.
9. **Batch-size self-check:** bounded attempts, then BLOCK with a clear reason (E04). Don't hammer shared staging or force non-inducible conditions.
10. **Record lessons to repo memory at the end** so the next session inherits the patterns above.

## (c) Instrumentation / fixture work that removes the friction

1. **BP-53 exposure (highest leverage):** add `accessible accessibilityRole="button" accessibilityLabel` to `login-back-button`, the Profile utility rows (`profile-logout`, `profile-settings`, …), the OTP resend link, the Sell Options Sheet options (`sell-option-list-one-item`, `sell-option-bulk-upload`), and confirm the ItemCreate fields/publish button are AX-exposed.
2. **QA dev toggle for the `send-phone-otp` rate limit** (mirror the S03/S04 `qa_reset_error_simulation` toggle) so E04 is inducible on demand without hammering shared staging.
3. **"Create fresh unique test user" dev button on the signup form** (auto-unique email/phone) — removes the per-case Select All override and enables faster Group-E-style runs.
4. **Fix the OTP screen's rate-limit message** (`PhoneVerificationScreen.handleResendCode` catch → use `OTPRateLimitError.retryAfterSeconds` with the friendly "Too many attempts. Please try again in {N} seconds." copy, mirroring `usePhoneVerification.sendCode`).
5. **Confirm/restore scrollability of ItemCreate for automation** (the screen wouldn't scroll via the toolset swipe), so E05's form fill + publish gate is reachable.
6. **Doc drift updates to the AUTH guide:** OTP is a single auto-formatted field (not "6-box"); E02 incomplete-code behavior (disabled button, not an alert) and wrong-code copy (environment-dependent); E04's rate-limit message location; E05's Sell Options Sheet step ("List One Item" before the create form).
7. **Optional:** expose the OTP resend countdown text in the AX tree (so E03's "Resend in Ns" is assertable without color forensics).

---

*Generated 2026-08-17 · Companion to `report.md` in the same directory. Verdict roll-up: 8 PASS / 0 FAIL / 2 BLOCKED / 1 SKIPPED.*
