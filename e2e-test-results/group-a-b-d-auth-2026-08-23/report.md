# QA Task — Groups A + B + D: Signup, Login & Session Restore, Logout (23 Cases)

**Run date:** 2026-08-23 · **Agent:** QA Test Agent (execution-only) · **Device:** iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1, screen 440×956 pt (3× pixels) · **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`, dev build + Metro, HEAD `f421923c`) · **Backend:** staging `drntwgporzabmxdqykrp`
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (canonical)
**Execution order (persona-batched, §5.26):** Group A (all 8 signup) → Group B (login/session: B02/B03/B07/B10/B11/B12/B08/B09 first as logged-out cases, then B01 login, then B04/B05/B06 logged-in) → Group D (logout). **Login/logout cycles:** ~10. **Wall-clock:** ~13:23 → 14:57 (~94 min incl. 4 relaunches for clean forms + 1 LogBox-forced relaunch).

---

## Result roll-up

| Group | PASS | FAIL | BLOCKED | SKIPPED |
|---|---|---|---|---|
| A — Signup | 8 | 0 | 0 | 0 |
| B — Login & Session | 12 | 0 | 0 | 0 |
| D — Logout | 3 | 0 | 0 | 0 |
| **Total** | **23** | **0** | **0** | **0** |

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-A01 | AUTH | ✅ PASS | Valid signup → Verify Your Phone with entered phone (+12025554948259). Header/subtitle confirmed ("Create Account" / "Join the Kids P2P Marketplace"). |
| AUTH-TC-A02 | AUTH | ✅ PASS | Inline errors: "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", "Password must be at least 8 characters", "Passwords do not match" — submission blocked. (One rule at a time per Phase-17 note.) |
| AUTH-TC-A03 | AUTH | ✅ PASS | Mismatch (abc vs xyz) → "Passwords do not match"; weak `abc` → "Password must be at least 8 characters"; blocked. |
| AUTH-TC-A04 | AUTH | ✅ PASS | DOB 15/01/2015 (under-18) → age-gate dialog "Sorry, you must be 18 years old to register."; signup blocked, form preserved. |
| AUTH-TC-A05 | AUTH | ✅ PASS | Duplicate email (test-buyer) → "Signup Failed" / "This email is already registered. Please log in instead."; no account created. **Phase-17 gray-OK deviation RESOLVED** (green now). |
| AUTH-TC-A06 | AUTH | ✅ PASS | Valid ref `cdafac02` → signup proceeds to Verify Phone. Invalid `ZZZZZZZZ` → "Invalid Referral Code" prompt with Fix it / Continue anyway; Continue anyway → signup completes without code. |
| AUTH-TC-A07 | AUTH | ✅ PASS | Terms + Privacy links on Create Account each open full-screen WebView content without crash; back preserves form. (LogBox overlay from stale phoneService console.error forced one relaunch — tooling, not app.) |
| AUTH-TC-A08 | AUTH | ✅ PASS | Landing footer Terms + Privacy links each open WebView content without crash. |
| AUTH-TC-B01 | AUTH | ✅ PASS | test-buyer → Home tabs (Norwalk Central header). Incomplete-onboarding user (A01 throwaway) → onboarding carousel (step 1/5) not Home. |
| AUTH-TC-B02 | AUTH | ✅ PASS | Wrong password → "Login Failed" / "Invalid login credentials" (guide says "Invalid email or password." — wording drift); stays on Login. Green OK (Phase-17 Login-dialog deviation resolved). |
| AUTH-TC-B03 | AUTH | ✅ PASS | Forgot Password link → Forgot Password entry screen (email field + Send Reset Link + Back to Login). No real reset sent (entry-only per case). |
| AUTH-TC-B04 | AUTH | ✅ PASS | Kill + relaunch → session restored straight to Home, no re-entry. §5.11: `sb-drntwgporzabmxdqykrp-auth-token` present in AsyncStorage. |
| AUTH-TC-B05 | AUTH | ✅ PASS | Background (Home) + foreground → same Home, no full-screen spinner. |
| AUTH-TC-B06 | AUTH | ✅ PASS | Cold launch → Home within ~2 polls (bundle download ~5–10s is the env artifact; app itself renders well under 12s). |
| AUTH-TC-B07 | AUTH | ✅ PASS | Empty → "Email is required" + "Password is required", no request. `not-an-email` + any password → "Email is invalid"; stays on Login. |
| AUTH-TC-B08 | AUTH | ✅ PASS | `qa-deleted` fixture login → "Login Failed" / "Your account has been deleted. Please contact admin-support@kidsmarketplace.app." (ACCOUNT_DELETED). Not signed in. |
| AUTH-TC-B09 | AUTH | ✅ PASS | `qa-no-profile` fixture login → "Login Failed" / "Profile not found. Please contact support." (PROFILE_NOT_FOUND). Not signed in. (Dev LogBox banner "Login error: AuthError: User profile not found" = console.error, Item-1 class.) |
| AUTH-TC-B10 | AUTH | ✅ PASS | Login back arrow → Landing, no session. (`login-back-button` still NOT AX-exposed — tap at pt(35,107), known gap.) |
| AUTH-TC-B11 | AUTH | ✅ PASS | Login footer Sign Up → Create Account. |
| AUTH-TC-B12 | AUTH | ✅ PASS | Create Account footer Log In → Login. |
| AUTH-TC-D01 | AUTH | ✅ PASS | Profile → Logout row (red, pixel-scan) → GlobalAlertProvider confirm ("Are you sure you want to logout?" Cancel/Logout) → Logout → Landing. §5.11: `sb-*auth-token` cleared. |
| AUTH-TC-D02 | AUTH | ✅ PASS | Cross-referenced from Group P run P17 (Settings → DANGER ZONE → Sign Out → confirm → Landing) on the same build `f421923c`; Profile/Settings sources unchanged since. Not re-driven per task instruction. |
| AUTH-TC-D03 | AUTH | ✅ PASS | Post-logout Landing shows Get Started / Log In, no authenticated content; AsyncStorage session cleared (§5.11). |

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | ≥3s? |
|---|---|---|
| Landing → Create Account / Login | <1s | no |
| Signup submit → Verify Your Phone (valid + referral cases) | ~1–2s | no |
| Invalid signup submit → inline errors | <1s | no |
| Age-gate / Signup-Failed / invalid-referral dialogs | <1s | no |
| Terms/Privacy WebView open (from either screen) | ~1–2s | no |
| Login submit → Home (test-buyer) | ~1–2s | no |
| Login Failed / account-deleted / no-profile dialogs | ~1–2s | no |
| Kill → relaunch → Home (session restore) | ~5–10s | ⚠️ dev-build bundle download (environment artifact, not app transition) |
| Logout confirm → Landing | <1s | no |

No in-flow transition exceeded 3s. **Perceived Load-Time Verdict: GOOD** (the only ≥3s observation is the dev-build cold-start bundle download — an environment artifact, not a screen transition).

---

## Per-case execution notes (highlights)

### Group A
- **A01/A06 (valid):** used the DEV autofill (§5.13) as the base (auto-generates a unique `qa.alice.*@kidsmarketplace.test` email + `+1202…` phone), verified all fields landed correctly in the AX tree, submitted → **Verify Your Phone** with the entered phone. This also seeded an **incomplete-onboarding fixture** reused for B01 leg 2.
- **A02/A03:** filled invalid values with per-field verification (§5.2); dismissed the keyboard before every submit tap (§5.19 Rule 1) — one early tap landed in the password field while the keyboard was up (tree y was logical not rendered), corrupting it; terminated + relaunched rather than repairing (§5.2), then re-drove. This is the same below-fold-coordinate discipline from the playbook.
- **A04:** overrode the autofilled DOB year 2000 → 2015 (long-press → Select All → retype, §5.10) → age-gate dialog with the exact expected copy.
- **A05:** overrode email to `test-buyer@` → Signup Failed dialog with exact duplicate-email copy. **Color check:** the OK button now renders **green** (36.5% green band, 0.04% gray) — the Phase-17 "Signup Failed OK is gray #E8E8E8" deviation is **RESOLVED** on this build. LogBox also logged `Signup error: {"name":"AuthError"...` (dev-only console.error — Item-1 class finding).
- **A06:** valid `cdafac02` (verified in DB) accepted → Verify Phone. Invalid `ZZZZZZZZ` → **Invalid Referral Code** prompt with Fix it / Continue anyway (both AX-exposed) → Continue anyway → Verify Phone (code cleared).
- **A07/A08:** Terms + Privacy both open full-screen WebView (tree explodes to 237KB — §5.5; asserted by OCR of visible policy content, "Google Cloud Marketplace Terms of Service" / "Walmart Global Marketplace Seller Privacy Notice"). Return via iOS edge-swipe back. **A07 friction:** a stale `[phoneService] send-phone-otp invoke error` LogBox (from the earlier A06 signup's DEV-bypass OTP send) surfaced over the Privacy page; per §5.19 Rule 6, terminated + relaunched and re-drove cleanly (bounded dismiss attempts first).

### Group B
- **B01:** test-buyer (`TestBuyer123!` fixture) → **Home tabs** (Norwalk Central header). Then A01 throwaway (signed up, never phone-verified, onboarding incomplete) → **onboarding carousel step 1/5** ("Onboarding, step 1 of 5, Welcome to a safe neighborhood marketplace") — NOT Home. Both legs match the routing intent (guide's "Welcome / carousel" phrasing aligns with the carousel; the Phase-17 "routes to Verify Your Phone" nuance applies to phone-unverified-but-onboarded accounts).
- **B02/B08/B09:** each produced the styled **Login Failed** GlobalAlertProvider dialog with the exact expected copy. B09's AX tree went stale (only the LogBox banner surfaced) — screenshot + OCR confirmed the dialog ("Profile not found. Please contact support."); green OK located by pixel scan.
- **B04:** AsyncStorage manifest confirmed `sb-drntwgporzabmxdqykrp-auth-token` after relaunch (§5.11).
- **B07:** empty → both required errors; malformed email → "Email is invalid"; no request fired (stayed on Login, no dialog).
- **B10:** `login-back-button` is NOT in the AX tree (known BP-53 gap) — tapped the derived arrow at pt(35,107) → Landing.

### Group D
- **D01:** Profile utility rows are NOT AX-exposed (known gap) — the red Logout row was located by pixel scan (red #EF4444 band, ~pt(220,300)) after scrolling. Confirm dialog = **GlobalAlertProvider** ("Logout" / "Are you sure you want to logout?", `global-alert-button-0/1` — instrumentable, not native Alert.alert) → Logout → Landing. §5.11: session token cleared.
- **D02:** cross-referenced Group P P17 (same build; Settings → DANGER ZONE → `settings-sign-out-button` → confirm → Landing) per the task instruction not to re-drive an unchanged path.
- **D03:** verified directly — post-logout Landing shows only Get Started / Log In, no header/tabs/avatar, no session key.

---

## Cross-cutting UX findings

1. **[LOW] Wording drift vs. guide (2 cases):** B02 app copy is "Invalid login credentials" (guide: "Invalid email or password."); A02/A03 weak-password errors show one rule at a time (guide lists all four — already noted in Phase 17). Both are app-vs-doc nuances, not defects.
2. **[TOOLING] AX-tree staleness recurred** (Profile after scroll, B09 after dialog, D01) — screenshots/OCR were the reliable source of truth (§5.9). Not an app defect.
3. **[TOOLING] Keyboard-up below-fold coordinates remain logical, not rendered** — the one corrupted-field incident (A02) was caused by a submit tap at a logical y while the keyboard was up; recovered via relaunch (§5.2). No repeat after applying §5.19 Rule 1 (dismiss keyboard → re-derive → tap).
4. **[DEV] Raw `console.error` leak class (from the prior Item 1 finding) reappeared in 3 places this run:** `SignupScreen` ("Signup error: …AuthError"), `LoginScreen` ("Login error: AuthError: User profile not found"), and `phoneService` ("[phoneService] send-phone-otp invoke error"). All are dev-only LogBox banners (never production), redundant with the styled dialogs. Recommend the same fix as Item 1: route to Sentry via `errorReporter` / gate with `LogBox.ignoreLogs`.
5. **DEV autofill (A01/A06) works well** — the `{ uniqueContact: true }` mode generates fresh email/phone per tap, making repeated-signup cases fast and safe (§5.13 validated).

---

## Cross-cutting design-system compliance (vs. `docx/design-system-passitup.md`)

- **No deviations found** on the screens/dialogs visited: Landing, Create Account (signup), Login, Forgot Password entry, Home tabs, Profile, and every dialog (age-gate, Signup Failed, invalid-referral, Login Failed ×3 variants, Logout confirm, DEV-bypass OTP, Reset-Email success/DEV). Primary green `#5DBB8E` CTAs, white modal surfaces, filled inputs, max-one-primary per dialog, 52px buttons (≥44 targets), text tiers `#1A1A1A/#6B6B6B/#999999`.
- **Resolved deviations from Phase 17 (re-verified green):** Signup Failed OK button is now **green** (was gray #E8E8E8); Login Failed OK is green (was already green).
- **Design doc gap (unchanged, from Group P):** the Logout/Sign Out confirm primary CTA renders **error-red #E85D75** (destructive styling) — the design doc defines no destructive-button variant. Not a regression; flagged as a doc gap.

---

## Locator-gap findings

- `login-back-button` (LoginScreen) — not in AX tree (testID only, no accessible/role/label). Tapped via derived coordinate pt(35,107). Recommend BP-53 exposure.
- Profile utility rows (`profile-logout`, `profile-settings`, `profile-help-support`, `profile-admin-dashboard`) — not in AX tree. Logout located via red pixel scan. Recommend BP-53 exposure (as already recommended in prior runs).
- Note: `signup-back-button` was reachable via nav (not needed this run for a gap).

---

## QA Session Handoff

**Test Scope:** AUTH-TC-A01–A08 (Group A signup), AUTH-TC-B01–B12 (Group B login/session), AUTH-TC-D01–D03 (Group D logout) from `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (23 cases).
**Design-System Compliance:** PASS — no deviations found against design-system-passitup.md on any screen or dialog visited (Landing, Create Account, Login, Forgot Password, Home, Profile, plus the age-gate / Signup-Failed / invalid-referral / Login-Failed / Logout-confirm / DEV-bypass dialogs). Two Phase-17 deviations confirmed RESOLVED (gray→green OK buttons). One pre-existing design-doc gap noted: destructive confirm CTA (Logout) uses error-red, no documented destructive variant.
**Perceived Load-Time Verdict:** GOOD — all in-flow transitions rendered <3s (Landing↔auth screens, signup→Verify Phone ~1–2s, login→Home ~1–2s, all dialogs <1–2s, logout→Landing <1s). The only ≥3s observation is the dev-build cold-start bundle download (~5–10s), an environment artifact, not an app transition.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing: wording/layout match design-system (Get Started / Log In, footer legal line).
- CONFIRMED — Create Account: header/subtitle ("Create Account" / "Join the Kids P2P Marketplace"), inline error styling (red, correct), green submit.
- CONFIRMED — Login: "Welcome Back!" / "Log in to continue trading and earning Swap Points", inline errors, green submit.
- CONFIRMED — Forgot Password entry: clear instructions + green Send Reset Link + secondary Back to Login.
- CONFIRMED — Verify Your Phone (via signup): shows entered phone; single auto-formatted OTP field (design-system single-field, guide's "6-box" is doc drift).
- CONFIRMED — Home tabs (test-buyer): Norwalk Central header, action tiles, tab bar.
- CONFIRMED — Profile: stat chips (Listings/Trades/SP Balance), Reviews, utility rows.
- CONFIRMED — Age-gate, Signup-Failed, invalid-referral, Login-Failed, Logout-confirm, DEV-bypass dialogs: in-app GlobalAlertProvider, one primary CTA, white surface, correct semantic tokens (green primary; error-red for destructive Logout).
- DEVIATION (doc gap, pre-existing) — Logout confirm primary CTA is error-red #E85D75 (no destructive-button variant defined in the design doc).
- DEVIATION (dev-only, not app UI) — raw `console.error` LogBox banners appear under the styled dialogs on signup-failed, login-error (no-profile), and phoneService send-otp errors; never in production (same class as the prior Item 1 finding).
**Verdict Summary:** 23 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. [LOW/DEV] The raw-console-error class (from the prior Q+S Item 1 finding) reappears in SignupScreen, LoginScreen (no-profile branch), and phoneService — dev-only LogBox banners redundant with styled dialogs. Recommend the same Sentry/`LogBox.ignoreLogs` treatment.
2. [LOW] B02 copy drift: app "Invalid login credentials" vs guide "Invalid email or password." (doc-level).
3. [LOW] AX-tree staleness + the below-fold keyboard coordinate hazard remain the dominant tooling frictions (not app defects); §5.19 Rule 1 (dismiss → re-derive → tap) fully prevented recurrence after one incident.
**App State Left Behind:** App left **logged out at Landing** (clean). Standing personas untouched (test-buyer/test-free/test-seller passwords unchanged). Throwaway accounts created via UI signup (all password `TestPass123`, none completed phone verification, none reused): `qa.alice.17875084849482890@` (A01 — used for B01 incomplete-onboarding leg), `qa.alice.17875090556132327@` (A04), `qa.alice.17875094296118084@` (A06 part 2), `qa.a06.validref.1787510073@` (A06 valid-ref). `qa-deleted` / `qa-no-profile` fixtures read-only (login attempts only, no state change). Referral `cdafac02` read-only (no referral row created — the valid-code signup was not completed past phone verification).
**Why It Matters:** Closes Groups A, B, D (23/23) against the canonical guide on the current build — signup (happy + all error branches + legal links), login (happy + credential/account-deleted/no-profile branches + session restore/resume/cold launch + validation + navigation), and logout (Profile confirm + post-logout Landing). Also confirms two Phase-17 design deviations are now fixed (gray→green OK buttons) and re-validates the standing B08/B09 fixtures end-to-end.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/group-a-b-d-auth-2026-08-23/screenshots/` (prefix `A01…A08`, `B01…B12`, `D01…D03`, `99-final-clean-landing.png`). Each case reproduces per the guide's Setup/Steps; standing fixtures `qa-deleted@` (B08) and `qa-no-profile@` (B09) are pre-provisioned by `seed:staging`.
**Known Gaps / Not Tested:** AUTH-TC-D02 not re-driven on-device this run — cross-referenced from Group P P17 on the same build (UI unchanged); the Settings sign-out path itself was exercised and passed there. B03's actual reset-email send intentionally not executed (entry-screen-only per the case; a real send requires the SMTP sender or the reset-link harness). A06's valid-code referral *completion* (post-verification referral row creation) not exercised — signup stops at phone verification; referral application verified only up to acceptance.
**What Needs To Be Fixed Next:**
1. Fix (app, Low): apply the Item-1-style fix to the remaining raw `console.error` calls that surface as dev LogBox banners — `SignupScreen` ("Signup error:"), `LoginScreen` (no-profile "Login error:" branch), `phoneService.ts:67` ("[phoneService] send-phone-otp invoke error") — route to `errorReporter` / gate with `LogBox.ignoreLogs`.
2. Fix (instrumentation, Low): expose `login-back-button` and the Profile utility rows (`profile-logout`, `profile-settings`, …) with `accessible` + `accessibilityRole="button"` + label (BP-53) so future runs don't need pixel-derived taps.
3. Docs: B02 expected copy in the AUTH guide — align "Invalid login credentials" with the app (the guide's "Invalid email or password." is drift).
**UX Enhancement Ideas (optional, not defects):**
- On the Create Account form, the DOB segmented picker and the fields below can sit under the number-pad when it's up — a "scroll focused field above keyboard" behavior or a Next affordance would cut the dismiss-then-tap dance for parents entering DOB (observed repeatedly this run).
- On the Profile screen, the utility rows (App Settings / Admin Dashboard / Help & Support / Logout) are only reachable by scrolling past Reviews; consider moving the utility/logout group above Reviews or into the header menu to reduce scroll distance for the most common post-login actions.
**Suggested Next Session:** Fold the LogBox `console.error` fix (#1) and the two BP-53 locator gaps (#2) into the next dev pass, then a short re-verify (2–3 min per item). Alternatively, pick up Group E (Phone Verification) or Group C (Social Login) as the next canonical batch.
**Suggested to Improve Agent Rules:** none — the §5.19 Rule 1 discipline (dismiss keyboard → re-derive → tap) and §5.9 screenshot-as-truth worked as designed; no rule change warranted this run.
