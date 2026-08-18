# Phase 17 — AUTH Groups A + B — QA Test Agent Report

**Date:** 2026-08-16
**Device:** iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1 · **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`, dev build + Metro) · **Backend:** staging `drntwgporzabmxdqykrp`
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Scope:** Group A — Signup (Email/Password) AUTH-TC-A01–A08 · Group B — Login & Session Restore AUTH-TC-B01–B09 (iOS mobile surface only; admin-web assertions out of scope per §2).

**Evidence:** `e2e-test-results/phase17-auth-groups-ab-2026-08-16/evidence/`

---

## Roll-up

| | Count |
|---|---|
| PASS | 15 |
| FAIL | 0 |
| BLOCKED | 2 (B08, B09) |
| SKIPPED | 0 |

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-A01 | AUTH | PASS | Signup → Verify Your Phone showing phone number (screenshot-confirmed) |
| AUTH-TC-A02 | AUTH | PASS | All inline validation errors render; submission blocked |
| AUTH-TC-A03 | AUTH | PASS | "Passwords do not match" renders; weak-pw error (evidenced in A02, same path) |
| AUTH-TC-A04 | AUTH | PASS | Under-18 DOB → "Sorry, you must be 18 years old to register." dialog, blocked |
| AUTH-TC-A05 | AUTH | PASS | Duplicate email → "This email is already registered. Please log in instead." |
| AUTH-TC-A06 | AUTH | PASS | Valid ref `buyerref` accepted → proceeds; invalid ref → Fix it/Continue anyway dialog → proceeds |
| AUTH-TC-A07 | AUTH | PASS | Signup Terms/Privacy open WebView; form state preserved on return |
| AUTH-TC-A08 | AUTH | PASS | Landing footer Terms/Privacy open WebView; edge-swipe back works |
| AUTH-TC-B01 | AUTH | PASS (nuance) | test-buyer→Home tabs; incomplete user→Verify Your Phone (onboarding flow), NOT Home |
| AUTH-TC-B02 | AUTH | PASS | Wrong creds → "Invalid email or password." dialog, stays on Login |
| AUTH-TC-B03 | AUTH | PASS | Forgot Password entry → Forgot Password screen (no reset sent) |
| AUTH-TC-B04 | AUTH | PASS | Kill/relaunch → session restored to Home, no re-login |
| AUTH-TC-B05 | AUTH | PASS | Background/foreground → same screen, no blocking spinner |
| AUTH-TC-B06 | AUTH | PASS | Cold launch logged-in → Home in ~5–10s (dev bundle), no spinner hang |
| AUTH-TC-B07 | AUTH | PASS | Empty fields → "Email is required"/"Password is required"; bad email → "Email is invalid" |
| AUTH-TC-B08 | AUTH | BLOCKED | Needs admin-portal soft-delete staging (admin out of scope) |
| AUTH-TC-B09 | AUTH | BLOCKED | Needs auth-user-without-profile (no SQL writes in execution-only run) |

---

## Perceived load-time table

Each measurement is labeled per §5.7: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

| Screen/Transition | Trigger | Elapsed | Flag ≥3s? |
|---|---|---|---|
| Landing → Terms WebView (A08) | tap `landing-terms-link` | <2s (rendered at first poll) | — |
| Landing → Privacy WebView (A08) | tap `landing-privacy-policy-link` | <2s | — |
| Signup → Terms/Privacy WebView (A07) | tap signup links | <2s | — |
| Landing → Create Account (all A-cases) | tap `landing-signup-button` | <2s | — |
| Signup submit → Verify Your Phone (A01) | tap `signup-submit-button` | ~1–2s | — |
| Login submit → Home (B01-half1, test-buyer) | tap `login-submit-button` | ~1–2s | — |
| Landing → Login | tap `landing-login-button` | <2s | — |
| Cold launch (app kill→relaunch, logged-in) → Home | `mobile_launch_app` | ~5–10s (dev-build bundle load + session restore; incl. tool poll latency) | ⚠️ dev-build cold start (environment artifact, not app behavior) |
| Cold launch (app kill→relaunch) → Landing (logged-out) | `mobile_launch_app` | ~5–10s (dev-build bundle load) | ⚠️ dev-build cold start (environment artifact) |

No interactive in-app transition exceeded 3s. The only >3s items are dev-build cold-start bundle loads (environment artifact per §5.7 — the "Downloading X%" splash + Metro bundle transfer), not app-rendering slowness.

---

## Per-case execution traces

### AUTH-TC-A01 · Successful signup — **PASS**
1. Clean launch → Landing (verified, no LogBox overlay — §5.8 clean state).
2. Get Started → Create Account. Header "Create Account" / subtitle "Join the Kids P2P Marketplace".
3. Filled DOB first (01/01/1990), then name "QA Parent", email `qa17a01c@kidsmarketplace.test` (throwaway), phone `5551234000`, password/confirm `TestPass123!` (both verified 12 bullets in tree).
4. Submitted → **Verify Your Phone** screen showing `555 123 4000` (screenshot A01-03 confirmed; AX tree returned a stale form snapshot — see Friction).
5. **Assert:** header/subheading present; no validation errors; navigates to Verify Your Phone with the entered phone number → met.
- **UX §6.2 structural:** clear header, back arrow, form scroll works. **§6.3 wording:** subtitle actual copy is "Join the Kids P2P Marketplace" — guide expected "Join the P2P Kids Marketplace community" (copy mismatch to flag; see below). **§6.4 design-system:** form uses filled inputs, 16px spacing, 52pt pill submit (green). No deviations on the form. Verify Your Phone screen primary action reviewed from screenshot — see design note below.
- **Locator gaps:** none on instrumented fields. AX-tree staleness on PhoneVerification (see Friction).
- **Friction vs §5:** The AX element-tree returned a stale cached snapshot of the Signup form (with a residual "Passwords do not match") while screenshots showed Verify Your Phone; an initial screenshot was ambiguous (same phone number as the prior A06 screen), so A01 was **redone cleanly** with strict password/confirm verification before submitting (definitive evidence: A01-03). This re-run is a trace-faithful account of the confirmed happy path.

### AUTH-TC-A02 · Field validation — **PASS**
1. Fresh form → name `A`, email `abc`, phone `12345`, password `abc`, confirm `abc` → submit.
2. Inline errors captured (tree + screenshot): "Name must be at least 2 characters", "Please enter a valid email address", "Please enter a valid phone number (10+ digits)", "Please enter your date of birth" (empty DOB), "Password must be at least 8 characters". Submission blocked (stayed on form).
- **Assert:** inline red errors under relevant fields + blocked submission → met. Note: `validatePassword` returns the **first** failing rule only (single message), so "one uppercase/lowercase/number" errors appear only for passwords passing earlier rules — guide's "at least 8 characters, one uppercase, one lowercase, one number" reads as a set but the app shows one at a time (copy nuance).
- **UX §6.4:** error text color/size consistent with design tokens; no deviation observed.

### AUTH-TC-A03 · Password mismatch + weak — **PASS**
1. Fresh form → password `Passw0rd1`, confirm `Different1` → submit → "Passwords do not match" under Confirm (screenshot A03-01), submission blocked.
2. Weak-password portion (`abc`) already evidenced in A02 (identical code path: "Password must be at least 8 characters" + blocked) — cross-referenced.
- **Assert:** mismatch error + weak-password error + blocked → met.

### AUTH-TC-A04 · Under-18 DOB — **PASS**
1. Fresh form, DOB-first 01/01/2015 (under-18), all other fields valid → submit → in-app branded modal "Sorry" / "Sorry, you must be 18 years old to register." (screenshot A04-01). Signup blocked; dismissed via OK.
- **Dialog-type (empirical §5.4):** the age-gate renders in the GlobalAlertProvider **native RN Modal** (separate window — button NOT in the mobile-mcp AX tree). OK button located by green-pixel scan at pt (219,735). The guide's implicit "native Alert" assumption is doc drift (same as Group S findings).
- **Assert:** error appears + blocked → met.
- **UX §6.4 (dialog):** dialog uses white card, primary-green pill OK (#5DBB8E) — compliant. No deviations found.

### AUTH-TC-A05 · Duplicate email — **PASS**
1. Fresh form, valid fields, email `test-buyer@kidsmarketplace.test` (existing persona) → submit → "Signup Failed" dialog: "This email is already registered. Please log in instead." (screenshots A05-01/02). No new account created; dismissed.
- **Assert:** message + no account → met.
- **Dialog-type (empirical):** rendered via `ui/Modal` native modal (button not in AX tree). **Design finding (§6.4):** the dialog's primary OK button renders **light gray #E8E8E8 (neutral.300 — the Button `disabled` style)** instead of primary green #5DBB8E (source: `Button.tsx` primary=`colors.primary[500]`, disabled=`neutral[300]`; screenshot pixel-scan shows gray). **Deviation — flag.**

### AUTH-TC-A06 · Optional referral code — **PASS**
1. **Valid:** fresh form, referral `buyerref` (seeded test-buyer code) → submit → no invalid dialog, proceeded to Verify Your Phone (screenshot A06-01).
2. **Invalid:** fresh form, referral `ZZZZZZZZ` → submit → "Invalid Referral Code" dialog "The referral code you entered is invalid. Would you like to fix it or continue without a code?" with **Fix it** / **Continue anyway** (screenshot A06-02). Tapped **Continue anyway** (green primary, pt 220,736) → proceeded to Verify Your Phone without a code (screenshot A06-03).
- **Assert:** valid accepted; invalid shows Fix it/Continue anyway; Continue anyway completes → met.
- **UX §6.4 (dialog):** white card, "Fix it" cancel-outline + "Continue anyway" primary green — compliant (max-one-primary).

### AUTH-TC-A07 · Signup Terms & Privacy links — **PASS**
1. Create Account → typed partial email `partial@test.com` → scrolled to legal line → tapped `signup-terms-of-service-link` → Terms WebView rendered (screenshot) → iOS edge-swipe back → tapped `signup-privacy-policy-link` → Privacy WebView rendered → edge-swipe back → **email field still preserved** ("partial@test.com").
- **Assert:** both open content without crash; form state preserved → met. WebView asserted by visible content per §5.5.
- **UX §6.2:** no in-app close control on the legal WebViews (guide-documented); iOS edge-swipe back is the only way back — acceptable but could note a close affordance gap.

### AUTH-TC-A08 · Landing footer legal links — **PASS**
1. Landing → tapped `landing-terms-link` → Terms WebView → edge-swipe back → tapped `landing-privacy-policy-link` → Privacy WebView → edge-swipe back.
- **Assert:** both open without crash → met.

### AUTH-TC-B01 · Login routes by onboarding status — **PASS (with nuance)**
1. **Half 1 (completed):** Login as `test-buyer` (TestBuyer123!) → **Home tabs** (Local Market dashboard — composer bar, action tiles, tab bar). Login transition ~1–2s.
2. **Half 2 (incomplete):** Logged out (Profile → Logout → confirm dialog → Landing), then logged in as `qa17a01c` (A01-created, not phone-verified) → routed to **Verify Your Phone** (onboarding flow), NOT Home (screenshot B01-06).
- **Assert:** completed → Home ✓; incomplete → onboarding flow (not Home) ✓.
- **Nuance (documented, not a failure):** the guide's literal expectation "incomplete user lands on the onboarding stack (Welcome / carousel)" does not match the app's actual behavior for a **not-phone-verified** user — the app sends them to **Phone Verification** first (which is part of the auth/onboarding flow). The routing-by-onboarding-status distinction is verified (incomplete ≠ Home). Whether a fully-onboarded-but-carousel-incomplete user lands on the carousel is a distinct sub-case not reachable with the current registry (no "onboarding-complete-but-carousel-unseen" persona; see B01 Known Gap in handoff).

### AUTH-TC-B02 · Invalid credentials — **PASS**
1. Login: email `test-free@kidsmarketplace.test` + wrong password → submit → "Login Failed" dialog "Invalid email or password." (screenshot B02-01); stays on Login; OK (green primary, pt 219,520) dismissed.
- **Assert:** error + stays → met.

### AUTH-TC-B03 · Forgot Password link — **PASS**
1. Login → tapped `login-forgot-password-link` → Forgot Password screen rendered (screenshot B03-01). Per guide, no real reset submitted (verify entry only).
- **Assert:** entry screen appears → met.

### AUTH-TC-B04 · Session restore after kill/relaunch — **PASS**
1. test-buyer logged in on Home → terminate → relaunch → **Home tabs restored directly** (no re-entering credentials) (tree verified).
- **Assert:** restored straight into Home → met.

### AUTH-TC-B05 · App resume refreshes silently — **PASS**
1. test-buyer on Home → press HOME (background) → relaunch (foreground) → **returned to Home/Local Market**, no full-screen loading spinner (screenshot B05-01).
- **Assert:** same screen, no blocking spinner → met.

### AUTH-TC-B06 · Cold launch does not hang on spinner — **PASS**
1. test-buyer logged in → terminate → relaunch → Home rendered within ~5–10s (dev-build bundle load dominates); no indefinite spinner (the RootNavigator 12s force-render guard is present in source).
- **Assert:** renders authenticated app within ~12s, never hangs → met for the achievable portion.
- **Gap:** the "slow/briefly interrupted network" sub-condition was **not inducible** in this environment (no Network Link Conditioner available); verified under normal network only.

### AUTH-TC-B07 · Empty-field + invalid-email login validation — **PASS**
1. Login, fields empty → submit → "Email is required" + "Password is required" (screenshot B07-02); stays on Login.
2. Email `not-an-email`, empty password → submit → "Email is invalid" (+ "Password is required") (screenshot B07-03); stays on Login. (First attempt corrupted email field via iOS password-autofill bar; redone cleanly per §5.2.)
- **Assert:** exact copy + no login request + stays on Login → met.

### AUTH-TC-B08 · ACCOUNT_DELETED login branch — **BLOCKED**
- Could not stage the required state in an execution-only run. Staging `account_status = deleted` requires either the **admin portal** `/users → Delete User (Soft)` (admin web is **out of scope** for this agent — Playwright path) or a SQL/service-role write (prohibited). No standing persona with this state in the registry.
- **What would be needed:** dev team stages one test account with `account_status = deleted` (via admin portal or seed), then re-run: login as that user → expect "Login Failed" dialog "Your account has been deleted. Please contact admin-support@kidsmarketplace.app." (code path verified in `LoginScreen.tsx` `case 'ACCOUNT_DELETED'`).

### AUTH-TC-B09 · PROFILE_NOT_FOUND login branch — **BLOCKED**
- Requires an account that authenticates (exists in `auth.users`) but has **no profile record**. Constructing it needs deleting a profile or creating an auth user without a profile — SQL/backend writes, prohibited in an execution-only run; no documented persona. Registry gap (same posture as Group S S03/S04).
- **What would be needed:** dev team creates a test auth-user without a profile (or removes one), then re-run: login as that user → expect "Login Failed" dialog "Profile not found. Please contact support." (code path verified in `LoginScreen.tsx` `case 'PROFILE_NOT_FOUND'`).

---

## Cross-cutting UX findings

### Structural / affordance (§6.2)
- No navigation dead-ends on the auth screens visited; back arrows present on Create Account/Login; edge-swipe back works on legal WebViews.
- Legal WebViews (Terms/Privacy) have **no in-app close control** — only iOS edge-swipe back (guide-documented in Dependencies; acceptable but a minor affordance note).
- **AX-tree staleness (HIGH friction, tooling):** `mobile_list_elements_on_screen` repeatedly returned a stale cached tree of a previous screen (Signup form / Home / Item Detail) while the actual screen (PhoneVerification, Profile) was different — screenshots were the reliable channel. This cost significant execution time and forced screenshot-only navigation. **Tooling/instrumentation follow-up, not an app bug.**

### Wording / copy clarity (§6.3)
- **Copy mismatch (A01):** guide expected the Create Account subheading "Join the P2P Kids Marketplace community"; the app renders **"Join the Kids P2P Marketplace"**. Recommend updating the guide (or confirming intended brand copy).
- **Password rule copy (A02/A03):** guide lists separate rule errors ("one uppercase letter", "one lowercase letter", "one number"); the app shows **one** rule error at a time (first failing). Copy is clear but the guide's phrasing should reflect single-error display.
- Login screen copy ("Welcome Back!" / "Log in to continue trading and earning Swap Points") is clear and parent-appropriate. Validation messages ("Email is required", "Password is required", "Email is invalid") are plain and unambiguous.
- Referral dialog copy ("Would you like to fix it or continue without a code?" with Fix it / Continue anyway) is clear and actionable.

### Design-system compliance (§6.4)
- **DEVIATION (MED): "Signup Failed" dialog primary OK button renders light-gray #E8E8E8 (the Button `disabled` style, `neutral[300]`) instead of the documented primary green #5DBB8E** — observed on A05 (screenshot pixel-scan). The Login Failed dialog's OK button, by contrast, rendered green (#5DBB8E) — an inconsistency between the two error dialogs. Recommend checking why `ui/Modal`'s `Button variant="primary"` picked up the disabled/gray style on SignupScreen.
- Age-gate dialog (A04), Invalid-Referral dialog (A06), Login Failed dialog (B02): white card, correct primary/outline pill styling, max-one-primary — compliant.
- Auth screens: filled inputs, 16px inter-field spacing, 52pt pill CTAs (green primary), neutral text hierarchy, page padding consistent — no other deviations found on the screens visited.

---

## Locator-gap findings
- **GlobalAlertProvider / `ui/Modal` native-modal dialogs:** buttons render in a separate native window and do **not** surface in the mobile-mcp AX tree (age-gate, invalid-referral, Signup Failed, Login Failed, Logout-confirm). Not an instrumentation bug per se (native-modal content is out of the main AX snapshot) — the **operating technique** is: dismiss via green/gray pixel-scan of the screenshot. Recorded in session/repo memory for future runs.
- **Profile entry on Home (avatar top-right):** no accessibility identifier in the AX tree (an Image cluster); reached Profile by tapping the header avatar (coordinate-derived). Recommend adding an accessible label/testID to the avatar (e.g. `home-profile-avatar-button`).
- **Logout button (`profile-logout`):** has testID but the AX tree was stale (returned Home), so it was located via red-text pixel-scan. Functionally fine once reached.

---

## Friction vs. operating rules (§9)
- **Stale AX tree (HIGH):** repeated stale snapshots (Signup form, Home, Item Detail) during PhoneVerification/Profile navigation — screenshots became the primary navigation evidence; several re-lists were wasted.
- **Keyboard/focus misdirection (HIGH):** field focus sometimes failed to switch on tap (iOS password-autofill bar + KeyboardAvoidingView shifts) — caused 3 field corruptions (A04×2, B07×1) handled per §5.2 (terminate + relaunch + restart). Mitigations that worked: DOB-first fill order and per-field re-list verification before submit.
- **Software keyboard:** per-boot reset to shown; Cmd+K toggle suppressed it (verified), but iOS password-autofill bar still appears on secure fields.
- **Dialog dismissal by pixel-scan:** no in-tree locator for native-modal buttons; green (#5DBB8E) or gray (#E8E8E8) band scans required per dialog.

---

## Batch-size self-check (new rule) — result
Assessed partway and at the end. **All 17 cases were completed** (15 executed with full three-layer rigor, 2 BLOCKED with documented setup gaps). No case was silently compressed. However, the actual execution was far heavier than the "simple form-based screens" brief suggested: the form-fill + stale-tree + keyboard-focus friction roughly doubled per-case cost, especially in Group A. Recommendation for **future batches of this size**: split into two phases (e.g., Group A alone, then Group B) to keep per-run quality headroom, or allocate additional budget for the documented friction. No mid-batch stop was needed; rigor was maintained to the end.

---

## App State Left Behind
- Logged out at **Landing** (final state).
- Per-run throwaway accounts created (all incomplete — reached Phone Verification, none completed): `qa06a@kidsmarketplace.test` (A06 valid-ref), `qa06b@kidsmarketplace.test` (A06 invalid-ref continue-anyway), `qa17a01c@kidsmarketplace.test` (A01). These are per-run fixtures (registry rule: new-user created via UI signup); no standing persona state changed.
- `test-buyer` logged in/out during B01–B06; **no credentials changed** — left in documented fixture state.
- A04/A05/A02/A03/B07 test inputs used throwaway/no-account emails (`a04parent@test.com`, etc.) — none persisted as accounts (validation/age-gate/dup paths never created users).
- No data written to staging beyond the three throwaway signup auth rows above (expected per-run artifacts).

---

## QA Session Handoff

**Test Scope:** AUTH-TC-A01–A08 (Group A — Signup) + AUTH-TC-B01–B09 (Group B — Login & Session Restore)
**Design-System Compliance:** PARTIAL — one deviation: "Signup Failed" dialog OK button renders light-gray #E8E8E8 (disabled-style) instead of primary green #5DBB8E (A05); all other screens/dialogs reviewed compliant.
**Perceived Load-Time Verdict:** GOOD — no interactive in-app transition exceeded 3s (signup→phone-verify ~1–2s; login→Home ~1–2s; legal WebViews <2s). The only ≥3s items are dev-build cold-start bundle loads (~5–10s "Downloading%" splash) — environment artifacts, not app behavior (per §5.7).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing: wording + layout match design system.
- CONFIRMED — Create Account: form layout, filled inputs, 16px spacing, green 52pt submit; validation error styling (only deviation: subheading copy differs from guide — see Critical Findings #3).
- CONFIRMED — Verify Your Phone: layout reviewed from screenshot, compliant.
- CONFIRMED — Login: layout, copy, validation, pill CTAs compliant.
- CONFIRMED — Forgot Password: entry screen compliant.
- CONFIRMED — Home/Dashboard (test-buyer): layout + tab bar compliant.
- CONFIRMED — Profile: layout + Logout red-text affordance compliant.
- CONFIRMED — Age-gate dialog (A04): white card + green primary OK — compliant.
- CONFIRMED — Invalid-Referral dialog (A06): Fix it (outline) / Continue anyway (green primary) — compliant.
- CONFIRMED — Login Failed dialog (B02): green primary OK — compliant.
- CONFIRMED — Logout confirm dialog: Cancel (outline) + Logout (red destructive) — compliant.
- DEVIATION — Signup Failed dialog (A05): primary OK button renders gray #E8E8E8 instead of primary green #5DBB8E.
**Verdict Summary:** 15 PASS / 0 FAIL / 2 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. (BLOCKED) B08 ACCOUNT_DELETED + B09 PROFILE_NOT_FOUND require backend-staged account states that an execution-only run cannot construct (admin portal out of scope; no SQL writes). Both code branches are verified present in `LoginScreen.tsx`; need dev-staged fixtures to execute.
2. (MED, design) "Signup Failed" dialog OK button renders gray (disabled-style) vs green — inconsistent with the Login Failed dialog; verify why `ui/Modal` primary picked up the disabled style.
3. (LOW, spec/copy) Create Account subheading renders "Join the Kids P2P Marketplace" vs guide's "Join the P2P Kids Marketplace community"; password rule errors show one-at-a-time vs guide's four-line phrasing — update the guide.
4. (LOW, tooling) mobile-mcp AX tree returns stale snapshots on PhoneVerification/Profile — screenshots are the reliable evidence channel; consider an instrumentation/refresh fix.
5. (LOW, UX) Legal WebViews have no in-app close affordance (edge-swipe only) — guide-documented, minor.
**App State Left Behind:** Logged out at Landing. 3 throwaway incomplete accounts created (qa06a/qa06b/qa17a01c). test-buyer unchanged. (Full detail in report.)
**Why It Matters:** This run proves the full email/password signup path (validation, age gate, duplicate/referral handling, legal links) and the login/session lifecycle (routing by onboarding status, invalid-credential handling, session persistence, cold-start resilience) work end-to-end on the iOS surface against staging — with one visual defect and two backend-fixture gaps surfaced.
**How to Verify/Reproduce:** Evidence at `e2e-test-results/phase17-auth-groups-ab-2026-08-16/evidence/` (per-case screenshots named A01-01…B07-03). Re-check the gray "Signup Failed" OK button: sign up with an existing email (e.g. test-buyer) → observe the dialog button color. Re-check B01-half2: login as qa17a01c → Observe Phone Verification routing.
**Known Gaps / Not Tested:** B08/B09 (backend fixtures needed). B01-half2 literal "Welcome/carousel" screen for a completed-onboarding-but-carousel-unseen user (no such persona documented — registry gap). B06 slow-network sub-condition (no link conditioner). Phone-verification completion was not exercised past the entry screen (A01 stops at Verify Your Phone; DEV bypass 123456 exists but wasn't needed for A01's assertion).
**What Needs To Be Fixed Next:**
1. Stage B08/B09 fixtures (dev team): a soft-deleted test account (`account_status = deleted`) and an auth-user-without-profile; then QA executes the two login-branch cases.
2. Fix: "Signup Failed" dialog primary button renders gray — verify the `ui/Modal`/`Button` styling path on SignupScreen so primary renders #5DBB8E (consistent with the Login Failed dialog).
3. Update the AUTH guide copy for Create Account subheading + single-error password rules.
4. Instrument the Home header avatar with an accessible label/testID (locator gap) and confirm the mobile-mcp AX-tree staleness is a tooling limitation (not actionable in-app).
**Suggested Next Session:** Execute AUTH-TC-B08/B09 once the two backend fixtures are staged, plus AUTH-TC-B10 (back button returns to previous screen — Login back arrow, not run this phase) and the Group B forgot-password completion path if desired.
**Suggested to Improve Agent Rules:** Codify the "AX-tree staleness on certain screens → screenshot is the source of truth after any navigation" rule, and add the native-modal dialog dismissal technique (green/gray pixel-scan with screenshot scale = 3× points) to the playbook's §5.4 as a first-class operating technique rather than an ad-hoc fallback.
