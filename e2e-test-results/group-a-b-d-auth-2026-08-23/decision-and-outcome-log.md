# Groups A + B + D — Decision-and-Outcome Log (execution trace with reasoning)

**Purpose:** A full decision-and-outcome log of the Group A+B+D QA run (AUTH-TC-A01–A08 signup, B01–B12 login & session restore, D01–D03 logout — 23 cases), for an AI agent to mine for:
- **(a) what slows execution** (bottlenecks),
- **(b) what patterns an agent should adopt proactively**,
- **(c) what instrumentation/fixture work removes the friction.**

Each entry records: **Action** → **Reasoning** → **Tool calls that mattered** → **Outcome / friction signal**.

Run: 2026-08-23 · iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-…`, screen 440×956 pt, 3× pixels) · Expo RN dev build + Metro (`com.sameralzubaidi.p2pmarketplace`, HEAD `f421923c`) · QA Test Agent (execution-only) · Backend staging `drntwgporzabmxdqykrp` · Guide `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (canonical).

---

## 0. Pre-flight (context gathering) — before any test execution

| # | Action | Reasoning | Tool calls that mattered | Outcome / friction |
|---|---|---|---|---|
| 0.1 | Read the operating playbook `.github/instructions/QA-Test-Agent.instructions.md` (§4–§9) in full. | Playbook mandates reading before the first run and following it every run. | `read_file` (400+ lines) | Established: §5.1 locate-then-tap, §5.2 keyboard/focus, §5.4 dialog-type verification, §5.7 load-time, §5.8 clean-state, §5.10 field-clearing, §5.11 session checks, §5.13 DEV-autofill, §5.19 Rule 1/6, §5.23 script-only shell policy, §5.24/5.26 checkpoints + persona batching. |
| 0.2 | Read repo memory: `qa-test-accounts.md`, `locator-conventions.md`, `simulator-keyboard-suppression.md`, plus the `phase17-auth-ab-facts.md` (the prior run of exactly these groups). | Memory holds standing personas, verified device facts, and — crucially — the **Phase-17 facts** for these exact groups (AX staleness, dialog pixel-scan coords, copy nuances). Highest-leverage pre-read. | `memory view` ×4 | Pre-loaded: B08/B09 fixtures (`qa-deleted`/`qa-no-profile`), password per fixture, dialog pixel-scan technique (green `#5DBB8E` / gray `#E8E8E8`), "Signup Failed OK is gray" deviation to re-verify, `login-back-button`/`profile-logout` AX gaps, Home avatar at (400,58). |
| 0.3 | Read the canonical guide's Test Case Index + Pre-conditions + Accounts + Groups A/B/D sections; grepped `^## /^### ` headers. | TC-IDs are reused across guides; must execute from the named guide and pull exact Steps/Expected/Assert per case. | `grep_search`, `read_file` | Confirmed 23 case definitions; noted the task prompt's instructions (D01/D02 cross-ref Group P; B09 fail-fast rule; throwaway emails for A04/A05/A06). |
| 0.4 | Checked prior-run evidence for D01/D02 cross-reference (Group P run `group-p-full-run-19-cases-2026-08-23`), and the prior Group B/D run `phase22…` report. | Task said D01/D02 were effectively exercised in the Group P run — verify that evidence + confirm the UI hasn't changed (same build). | `grep_search` on group-p report, `list_dir`, `read_file` (phase22 report) | Group P P17 covers both Profile logout AND Settings sign-out on the same build; Profile/Settings sources unchanged since (verified via `git show` of the only auth-relevant commit `28413696`, which touched stat chips/ResetPassword/SP-calculator only). Justified cross-referencing D02 instead of re-driving. |
| 0.5 | Read auth-screen sources: `SignupScreen`, `LoginScreen`, `LandingScreen`, `ProfileScreen`, `DateOfBirthPicker`, `testUsers`, `AppNavigator` (RootNavigator routing), `educationAnalyticsService` (`shouldShowOnboarding`), flow-registry FLOW-01. | Pre-build the full locator + behavior map (testIDs, dev-autofill mechanics, DOB picker structure, login-routing-by-onboarding logic). **Key proactive pattern.** | `grep_search`, `read_file` (parallel) | Mapped: `signup-*`/`login-*`/`landing-*` testIDs; DEV autofill fills name/email/phone/DOB/password/confirm with `uniqueContact`; DOB = 3 TextInputs DD/MM/YYYY (auto-advance); routing keys off `onboarding_completed_at`/`onboarding_skipped_at` (not legacy `onboarding_completed`); `shouldShowOnboarding` returns true when both are null. |
| 0.6 | Activated the mobile-mcp tool categories (gated behind `activate_*` calls). | Device/interaction/screen tools are disabled by default; must activate before use. | `activate_mobile_device_fleet_management`, `activate_screen_interaction_tools`, `activate_mobile_screen_info_queries`, `activate_app_management_tools`, `activate_mobile_device_interaction_controls`, `activate_screen_capture_tools`, `activate_crash_report_management` | All needed tools available. |
| 0.7 | Checked device + installed apps + screen size; took a screenshot of current state; OCR'd it. | Confirm simulator present, app installed, current app state, screen dims for pixel math. | `mobile_list_available_devices`, `mobile_list_apps`, `mobile_get_screen_size`, `mobile_take_screenshot`, `npm run qa:ocr` | iPhone 17 Pro Max online; app installed; **440×956 pt** (→ screenshots 1320×2868 px, ÷3 for point coords); app sitting on a clean Landing. |
| 0.8 | **Read-only DB precondition verification** for all data-dependent cases: personas, B08/B09 fixtures. | §5.15/Phase-23 highest-leverage rule: never assume documented persona state is accurate — verify before device time. | `mcp_supabase_execute_sql` (read-only) | Confirmed: `qa-deleted` has `deleted_at` (B08 ready); `qa-no-profile` exists in `auth.users` with NO profile row (B09 ready); `test-buyer` has `onboarding_skipped_at` set → routes Home; `test-free` `onboarding_completed_at` set → Home. Also confirmed `shouldShowOnboarding` keys off the V2 fields. **Predicted the routing outcomes correctly before execution.** |

**Pre-flight verdict:** source-first + memory + read-only DB prep eliminated nearly all mid-run discovery and correctly predicted 3 of 4 execution outcomes before any device time. The DB check caught that the legacy `onboarding_completed` column was `false` for test-buyer while the *routing-relevant* `onboarding_skipped_at` was set — without it, B01 might have been misjudged.

---

## 1. Setup + clean-state + Group A warm-up (A01)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 1.1 | Created the run's evidence dirs under `e2e-test-results/group-a-b-d-auth-2026-08-23/screenshots/`. | Standard deliverable surface (pre-approved, no approval needed). | `create_directory` | Clean layout. |
| 1.2 | Saved current-state screenshot + OCR'd it. | Baseline evidence + confirm Landing. | `mobile_save_screenshot`, `npm run qa:ocr` | Clean Landing confirmed ("Get Started" / "Log In"). |
| 1.3 | A01: Landing → `landing-signup-button` (220,653) → Create Account; **swiped up 300px to reveal the DEV autofill row**; tapped `dev-fill-test-user-1` (Alice). | §5.13: use DEV autofill as the default base for fresh signups — fills all fields with fresh unique email/phone in one tap. Fields below the fold need a swipe first. | click → swipe → list → click | Form autofilled: email `qa.alice.…`, phone `+1202…`, DOB 15/01/2000 (18+), matching passwords. **Verified each field value in the tree** (§5.2). |
| 1.4 | A01: scroll to bottom, tap `signup-submit-button`. | Need the submit; it's below the fold. | swipe → list → click | **First submit-friction signal:** tree put submit at y≈709 but taps there were unreliable with the keyboard up. |
| 1.5 | **Key pattern:** screenshot + green-pixel-scan (`qa:badge-scan` for `#5DBB8E`) to locate the submit pill's *rendered* position, then tap. | Below-fold AX coords are logical (content) positions, not rendered positions when the keyboard compresses layout — §5.19 Rule 1 / Phase-22 finding. | `mobile_save_screenshot`, `npm run qa:badge-scan`, click | Navigated to **Verify Your Phone** (~1–2s). A01 PASS (subtitle shows `+12025554948259`). |
| 1.6 | A01: DEV-bypass dialog appeared ("Code Sent (DEV Bypass)" with OK). Dismissed via `otp-dev-bypass-dialog-ok-button` (AX-exposed). | Empirical dialog check: it's an in-app GlobalAlertProvider (buttons surface in tree). | list → click | Dismissed. A01's assertion (routed to Verify Phone with the phone) is satisfied — **did not complete OTP** so the account stays an incomplete-onboarding fixture for B01 leg 2. |
| 1.7 | `p2pkidsmarketplace://qa-logout` to return to Landing. | §5.16: qa-logout deep link is the fast reliable teardown; also preserves the just-created A01 account for later reuse. | `xcrun simctl openurl` | Clean Landing. |

**Warm-up verdict:** DEV autofill + green-pixel-scan of the submit + qa-logout were the three techniques that made A01 fast and clean. The §5.13 pattern (autofill base → verify fields → override only what's unique) is the single biggest signup-case time-saver.

---

## 2. Group A — validation / gates / dialogs (A02–A06)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 2.1 | **A02:** fresh form → typed invalid values (name `A`, email `abc`, phone `12345`, password `abc`), re-listing after each field. | §5.2 per-field verification; the form's fill order was chosen to minimize focus-stealing (typed phone before DOB since the number-pad covers DOB). | click → type → list (per field) | Values landed correctly. |
| 2.2 | **Corruption incident (the session's one §5.2 violation trigger):** after typing password `abc`, dismissed keyboard and tapped the *tree-reported* submit at (220,735) while the keyboard was still up → the tap landed **inside the password field**, appending a char (•••→••••). | Tree y for the submit was logical, not rendered, because the keyboard was up; the tap hit the password row. | list (revealed 4 dots) → screenshot + OCR | **Friction (HIGH, self-inflicted):** corrupted field. Per §5.2, do NOT repair — terminate + relaunch + restart the case. |
| 2.3 | Terminate → relaunch → navigate back to Create Account → **re-enter A02 invalid values**, this time **dismissing the keyboard first** (swipe/Return), re-deriving the submit via green-pixel-scan, then tapping. | §5.19 Rule 1 (re-measure before post-typing dismiss taps) — the exact lesson from the incident. | terminate → launch → list → fill → swipe-dismiss → screenshot+scan → click | All 5 validation errors surfaced: "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", "Password must be at least 8 characters", "Passwords do not match". Submission blocked. **A02 PASS.** |
| 2.4 | **A03:** from the A02 state, typed `xyz` into Confirm Password (genuine non-empty mismatch vs `abc`) → dismiss keyboard → green-scan submit → tap. | A03 needs a *real* mismatch (A02's empty confirm was weaker evidence). | click confirm → type → swipe-dismiss → screenshot+scan → click | Both errors confirmed: "Passwords do not match" + "Password must be at least 8 characters". **A03 PASS.** |
| 2.5 | **A04:** relaunch (clean form) → autofill Alice → **long-press DOB year → Select All → retype `2015`** (under-18). | §5.10 field-clearing before relaunch; override only the DOB year. | long-press → list (edit menu) → click Select All → type `2015` → list | DOB = 15/01/2015. Dismiss keyboard → green-scan submit → tap → **age-gate dialog** "Sorry, you must be 18 years old to register." with OK (`age-gate-dialog-ok-button` AX-exposed). **A04 PASS** (form preserved after dismiss). |
| 2.6 | **A05:** long-press email → Select All → retype `test-buyer@kidsmarketplace.test` (duplicate); fix DOB year back to `2000` (Select All → type) so the age gate doesn't fire first. | Task said A05 mutates signup state — use an existing registered email (test-buyer's), not a throwaway; and DOB must be 18+ or the age gate pre-empts the duplicate check. | long-press → Select All → type (email) → long-press → Select All → type (DOB year) → dismiss → green-scan → click | **"Signup Failed"** dialog "This email is already registered. Please log in instead." — exact copy. **A05 PASS.** **Bonus re-verify:** the OK button is now **green** (36.5% green / 0.04% gray) — the Phase-17 "gray OK" deviation is **RESOLVED**. Also logged dev LogBox `Signup error: {"name":"AuthError"…` (Item-1-class finding #4). |
| 2.7 | **A06 part 1 (valid code):** long-press email → Select All → retype fresh throwaway `qa.a06.validref.<ts>@`; scroll to referral field → type `cdafac02` (verified valid in DB); dismiss keyboard → green-scan → tap. | DB-read confirmed `cdafac02` exists in `profiles.referral_code`; referral is 8-char. | `mcp_supabase_execute_sql` (read-only), fill, submit | **Verify Your Phone** → valid code accepted, signup proceeds. Dismissed DEV dialog, qa-logout. **A06-part-1 PASS.** |
| 2.8 | **A06 part 2 (invalid code):** autofill Alice (fresh unique email), type `ZZZZZZZZ` into referral; dismiss → green-scan → tap. | Invalid 8-char alnum code should trigger the Fix it/Continue anyway prompt. | fill → submit | **"Invalid Referral Code"** dialog "The referral code you entered is invalid. Would you like to fix it or continue without a code?" with **Fix it** + **Continue anyway** (both AX-exposed) → tapped Continue anyway → **Verify Your Phone** (code cleared, signup completed without it). **A06 PASS both parts.** |

**Group A friction:** the one corrupted-field incident (2.2) was self-inflicted and cost a terminate+relaunch+redo (~4–5 min); after applying §5.19 Rule 1 it never recurred. The green-pixel-scan became the *standard* submit step. Locators for signup fields are all AX-exposed — no BP-53 gaps on this screen.

---

## 3. Group B — logged-out cases first (B02/B03/B07/B10/B11/B12/B08/B09)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 3.1 | **B02 (invalid creds):** Landing → `landing-login-button` → Login → type test-free email + wrong password, re-list after each field (iOS "Passwords" autofill bar shifts layout — §5.2), dismiss keyboard, tap Log In. | §5.26: batch logged-out cases before any login; B02 needs no persona. | click/type/list per field, dismiss, click | **"Login Failed" / "Invalid login credentials"** dialog (green OK, AX-exposed). **B02 PASS.** **Copy drift noted:** guide says "Invalid email or password." — app says "Invalid login credentials" (doc-level finding #2). |
| 3.2 | **B03 (Forgot Password entry):** from Login, tap `login-forgot-password-link` → Forgot Password screen; **did NOT send a real reset** (entry-only per case). | Case explicitly says verify the entry screen, don't submit a real request unless a documented safe path exists. | click → list → screenshot | Forgot Password screen (email field, Send Reset Link, Back to Login). Tapped Back to Login. **B03 PASS.** |
| 3.3 | **B07 (empty + invalid email validation):** relaunched (clean form) → tap Log In with empty fields → both "Email is required" + "Password is required"; then type `not-an-email` + a password → tap Log In → "Email is invalid". | Fresh state avoids clearing the B02 values; inline validation should block submission with no request. | terminate → launch → click/type → dismiss → click → list | Both parts confirmed; stays on Login, no dialog fired (no request). **B07 PASS.** |
| 3.4 | **B10 (back button):** on Login, tap the back arrow. **`login-back-button` NOT in AX tree** (known gap) → tap derived pt(35,107) per Phase-22 fact. | §5.1 flag + use the previously-verified coordinate (first tap at (35,170) missed; Phase-22 verified (35,107)). | click (35,170) → list (still Login) → click (35,107) → list | Returned to Landing, no session. **B10 PASS.** **Friction:** 2 taps (one miss) because the control isn't AX-exposed — an instrumentation gap. |
| 3.5 | **B11 (Login footer Sign Up):** `login-signup-link` → Create Account. | Footer-link nav. | click → list | Create Account screen. **B11 PASS.** |
| 3.6 | **B12 (Create Account footer Log In):** scrolled form down → `signup-login-link` → Login. | Footer below the fold. (First tap at the stale tree y missed — re-scrolled and re-derived.) | swipe → list → click → list | Login screen. **B12 PASS.** |
| 3.7 | **B08 (ACCOUNT_DELETED):** replace email with `qa-deleted@kidsmarketplace.test` + fixture password (`TestDeleted123!`) via long-press → Select All → retype; dismiss → submit. | Standing fixture (verified in DB, §0.8); app keys off `profiles.deleted_at`. | fill → submit | **"Login Failed" / "Your account has been deleted. Please contact admin-support@kidsmarketplace.app."** **B08 PASS.** |
| 3.8 | **B09 (PROFILE_NOT_FOUND):** replace email with `qa-no-profile@` + fixture password (`TestNoProfile123!`); dismiss → submit. | Standing fixture (auth user, no profile row — §0.8 verified). | fill → submit | **"Login Failed" / "Profile not found. Please contact support."** — BUT the AX tree returned **stale content** (only the LogBox banner `Login error: AuthError: User profile not found` surfaced). **Friction:** per §5.9, screenshot is the source of truth → OCR confirmed the dialog; green OK located by pixel-scan. **B09 PASS.** |
| 3.9 | Cleared the B09 dialog, logged out via qa-logout for a clean B01. | Session teardown between persona-dependent groups. | `xcrun simctl openurl` | Clean Landing. |

**Group B logged-out friction:** B07/B10/B12 each involved either a relaunch for clean state or a missed-tap on a non-exposed control. The recurring cost driver is **clearing fields between cases** (long-press→Select All→retype) and **relaunching for clean forms** — the §5.10 field-clearing technique worked but is a multi-step dance per field.

---

## 4. Group B — login + session (B01, B04, B05, B06)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 4.1 | **B01 leg 1 (test-buyer → Home):** relaunch → Login → `test-buyer@` + `TestBuyer123!` → Log In. | Standing persona; verify routing-to-Home by onboarding status. | fill → submit | **Home tabs** (Norwalk Central header, action tiles, tab bar). ~1–2s. **PASS.** |
| 4.2 | **B01 leg 2 (incomplete onboarding → carousel):** qa-logout → Login → the A01 throwaway (`qa.alice.…@`, password `TestPass123` — the autofill fixture password, confirmed from `testUsers.ts`) → Log In. | Reuses the incomplete-onboarding account created in A01 (never phone-verified / onboarded) — cheaper than a new signup. | fill → submit | **Onboarding carousel step 1/5** ("Onboarding, step 1 of 5, Welcome to a safe neighborhood marketplace") — NOT Home. **B01 PASS.** Confirmed the routing intent (guide's "Welcome / carousel" phrasing aligns with the carousel). |
| 4.3 | **B04 (session restore):** with test-buyer logged in, terminate → relaunch → poll. | Kill/relaunch should restore straight to Home. | terminate → launch → list | **Home** immediately after bundle download — no credential re-entry. **§5.11:** AsyncStorage manifest contains `sb-drntwgporzabmxdqykrp-auth-token` (verified via `get_app_container` + grep). **B04 PASS.** |
| 4.4 | **B05 (resume):** press HOME (background) → `mobile_launch_app` (foreground) → poll. | Background/foreground should return to the same screen with no blocking spinner. | `mobile_press_button` (HOME) → list (springboard) → launch → list | Same Home screen, no full-screen spinner. **B05 PASS.** |
| 4.5 | **B06 (cold launch):** terminate → launch → poll for Home. | Cold start must not hang on the spinner (>12s guard in AppNavigator). | terminate → launch → list (bundle download) → list (Home) | Home reached well under 12s (bundle download ~5–10s is the dev-build env artifact). **B06 PASS.** |

**Group B logged-in friction:** minimal. The expensive part was the *relaunches* (bundle download each time) and the persona-switch logins (each a full fill). B04/B05/B06 all share the same logged-in state so they batched naturally with zero extra logins.

---

## 5. Group D — logout (D01 confirmed, D02 cross-referenced, D03 confirmed)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 5.1 | **D01 (Profile logout):** test-buyer on Home → tap header avatar (`header-profile-btn` at 400,94) → Profile. | Reach Profile via the header avatar (documented). | click → list | Profile rendered; stat chips (Listings/Trades/SP Balance) AX-exposed (the Q+S Fix-3 locators verified again). |
| 5.2 | **Locator gap:** Profile utility rows (`profile-logout` etc.) NOT in AX tree. Scroll the Profile to reach them. | §5.1 flag + derive. | swipe → list (**tree went stale** — returned Reviews content twice) | **Friction:** AX staleness on Profile (known §5.9 issue). Screenshot + OCR = truth. OCR showed the utility rows: App Settings / Admin Dashboard / Help & Support / **Logout**. |
| 5.3 | Pixel-scan for the red Logout row (`#EF4444`) → found at ~pt(220,300); tapped it. | Non-exposed red row is uniquely locatable by color. | `mobile_save_screenshot`, `npm run qa:badge-scan` (multiple narrowed bands), click | **"Logout" / "Are you sure you want to logout?"** GlobalAlertProvider confirm (`global-alert-button-0/1` — instrumentable, not native). Captured evidence. |
| 5.4 | Tapped Logout (`global-alert-button-1`) → **Landing**. | Confirm signs out. | click → list | Landing, unauthenticated. **§5.11:** `sb-*auth-token` gone from AsyncStorage. **D01 PASS.** D03 satisfied by this same post-logout state (Get Started / Log In, no authenticated content) — **D03 PASS**. |
| 5.5 | **D02 (Settings sign-out):** cross-referenced Group P P17 (Settings → DANGER ZONE → `settings-sign-out-button` → confirm → Landing) instead of re-driving. | Task explicitly said to cross-reference D01/D02 from the Group P run if the UI hasn't changed; verified (via `git show` of `28413696` + file mtimes) that Profile/Settings are unchanged since P17 on the same build. | `grep_search` (P17 trace), `ls` (P17 evidence), `git show` | **D02 PASS (cross-referenced).** Recorded honestly in the report as cross-referenced, not re-driven. |
| 5.6 | Final: saved `99-final-clean-landing.png`; verified app left logged out at Landing. | Clean end state. | `mobile_save_screenshot`, list | Clean Landing. |

**Group D friction:** the Profile AX-tree staleness + non-exposed utility rows cost several extra screenshot/scan/poll cycles just to locate the Logout row. The dialog itself was instrumentable (no pixel-scan needed once triggered).

---

## 6. A07/A08 — legal WebViews (the one forced-relaunch of the run)

| # | Action | Reasoning | Tool calls | Outcome / friction |
|---|---|---|---|---|
| 6.1 | **A07 (Create Account Terms/Privacy):** scrolled to the footer, tapped `signup-terms-of-service-link` → Terms WebView → edge-swipe back → `signup-privacy-policy-link` → Privacy WebView. | WebView content must be asserted by screenshot/OCR (§5.5 — tree explodes to 200KB+). | click → `mobile_list_elements_on_screen` (237KB tree — unusable, as predicted) → `mobile_save_screenshot` + OCR | Terms opened ("Google Cloud Marketplace Terms of Service"); back preserved the form; Privacy opened ("Walmart Global Marketplace Seller Privacy Notice"). **A07 PASS.** |
| 6.2 | **Friction (the run's one forced relaunch):** after returning from Terms and tapping Privacy, a **LogBox console-error overlay** (`[phoneService] send-phone-otp invoke error: FunctionsHttpError…` — a *stale* error from the earlier A06 DEV-bypass OTP send) covered the Privacy page. | §5.19 Rule 6: bounded dismiss attempts (2 re-lists, LogBox footer not in AX tree) → stop hunting, terminate + relaunch. It was a stale dev console.error, not an app defect. | list (only banner text) → OCR (Dismiss/Minimize present but not in tree) → terminate → launch | Relaunched clean → re-drove Privacy link → opened correctly. **A07 PASS (re-driven).** |
| 6.3 | **A08 (Landing footer legal links):** from Landing, tapped `landing-terms-link` → Terms WebView → back → `landing-privacy-policy-link` → Privacy WebView. | Straightforward; same §5.5 assertion-by-OCR approach. | click → screenshot+OCR → edge-swipe → click → screenshot+OCR | Both opened without crash. **A08 PASS.** |

**A07/A08 friction:** the LogBox overlay was entirely avoidable — it was a leftover dev console.error from the earlier DEV-bypass OTP auto-send. It cost a terminate + relaunch + re-drive (~3–4 min). This is the SAME class as findings #4 (raw console.error leak) — fixing the console.error noise would remove this class of mid-run interruption entirely.

---

## 7. Cross-cutting patterns (the synthesis an agent should extract)

### (a) What slows execution (bottlenecks), ranked

1. **Signup-form entry + field clearing** (~30% of wall-clock). Every fresh-signup or field-replacement case requires: scroll → tap field → type → re-list-verify (per field, because autofill bars/keyboard shift layout) → dismiss keyboard → green-pixel-scan the submit → tap. Clearing a field (long-press → Select All → retype) is a 4-step dance. The DEV autofill helps for *fresh* forms but every unique-field override still costs steps.
2. **Relaunches for clean state / bundle downloads** (~15%). Each terminate→launch re-downloads the dev bundle (~5–10s). Triggered by: corrupted fields (§5.2), the LogBox overlay (6.2), and the B07 "clean form" choice. These are environment artifacts but dominate the "perceived slow" moments.
3. **AX-tree staleness + non-exposed controls** (~15%). Profile utility rows and `login-back-button` are not AX-exposed → every use needs screenshot/OCR/pixel-scan fallback. Profile AX staleness (B09, D01) forces screenshot-as-truth re-verification.
4. **The one corrupted-field incident (A02)** was a single ~4–5 min hit but highlighted a recurring hazard: below-fold buttons report *logical* y while the keyboard is up.
5. **WebView screens** (A07/A08) are fast to assert by OCR but the tree is unusable (237KB) — a per-screen polling non-event but worth knowing.

### (b) What patterns an agent should adopt proactively

1. **Source-first + memory-first + read-only-DB pre-flight** (§0.2/0.5/0.8): the DB precondition check + prior-run facts predicted outcomes before device time and removed discovery. **Do this before every group.**
2. **§5.13 DEV-autofill as the default signup base** — one tap fills everything; override only unique fields. Validated as the single biggest signup time-saver.
3. **Green-pixel-scan the primary button before every below-fold submit** (§5.19 Rule 1 generalized): dismiss keyboard → screenshot → scan `#5DBB8E` → tap rendered position. Prevented every recurrence after the one incident.
4. **Persona-batch and reuse standing fixtures** (§5.26): logged-out cases first, then one login for the logged-in session cases, then logout — ~10 logins total for 23 cases; reused the A01 throwaway as the B01 leg-2 fixture instead of a new signup.
5. **§5.9 screenshot-as-truth on AX staleness** — when the tree is stale twice, switch fully to screenshot+OCR rather than re-polling.
6. **Empirical dialog-type verification every time** (§5.4): every dialog in this run was in-app GlobalAlertProvider (AX-exposed) — but this must be *re-checked* each run, never assumed.
7. **qa-logout deep link for teardown** (§5.16) — fast, no UI hunting, preserves fixtures.
8. **Cross-reference unchanged prior-run evidence** (D02) instead of re-driving when the task allows and the UI is verified unchanged — with an honest cross-referenced note in the report.

### (c) What instrumentation/fixture work removes the friction

1. **BP-53 exposure for the two known locator gaps** (highest-value, repeatedly flagged): `login-back-button` (LoginScreen) and the Profile utility rows (`profile-logout`, `profile-settings`, `profile-help-support`, `profile-admin-dashboard`) — add `accessible` + `accessibilityRole="button"` + label. Removes the pixel-scan/derived-tap work in B10 and D01 and the missed-tap risk.
2. **Kill the raw `console.error` LogBox class** (finding #4, now confirmed in 3 places: `SignupScreen`, `LoginScreen` no-profile branch, `phoneService.ts:67`) — route to `errorReporter`/Sentry or `LogBox.ignoreLogs`. This removes the A07 forced-relaunch (6.2) and the B09 banner noise, both mid-run interruptions this run.
3. **Fixture notes (already-good, keep):** standing B08/B09 fixtures work end-to-end; `qa-deleted` keys off `profiles.deleted_at` (not `account_status` — doc drift already noted in registry). DEV autofill `uniqueContact` mode is excellent. A DEV "clear all fields" affordance on the signup/login forms would remove the multi-step Select-All dance between cases.
4. **Doc drift to fix (cheap):** B02 expected copy ("Invalid login credentials" vs "Invalid email or password."); A02 weak-password "one rule at a time" wording; OTP "single field not 6-box"; B09's PROFILE_NOT_FOUND fixture path — all already captured in the report for the next dev pass.
5. **Optional device-time saver:** a pre-baked "session-restore fixture" (a logged-in persona whose relaunch lands on Home) is unnecessary — test-buyer already serves this — but a documented `bash` helper to pre-fill/clear login fields would cut the biggest remaining per-case cost.

---

## 8. Run-level numbers

- **Cases:** 23/23 PASS (A 8, B 12, D 3); 0 FAIL / 0 BLOCKED / 0 SKIPPED (D02 cross-referenced, not skipped).
- **Login/logout cycles:** ~10. **Relaunches:** 5 (4 clean-form/state + 1 LogBox-forced). **Wall-clock:** ~13:23 → 14:57 (~94 min).
- **Corrupted-field incidents:** 1 (A02, self-inflicted, recovered per §5.2). **Forced relaunch from LogBox:** 1 (A07). **AX-staleness events:** 2 (B09, D01). **Locator-gap fallbacks (pixel/OCR):** B10 back arrow, D01 Logout row.
- **Findings carried forward:** 3 (raw-console-error LogBox class; B02 copy drift; the 2 BP-53 locator gaps) + 2 design-doc gaps (destructive-CTA color; Phase-17 deviations now RESOLVED).

**Suggested to Improve Agent Rules:** none — the §5.19 Rule 1 (dismiss → re-derive → tap), §5.13 DEV-autofill, and §5.9 screenshot-as-truth disciplines worked as designed; the bottlenecks above are instrumentation/fixture gaps, not playbook gaps.
