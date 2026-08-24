# QA Session Report — Group H (Profile Setup & Onboarding)

**Run:** `e2e-test-results/group-h-profile-setup-2026-08-23/`
**Date:** 2026-08-23 (23:07–23:29 local)
**Agent:** QA Test Agent (execution-only)
**Guide (canonical):** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group H)
**Device:** iOS Simulator iPhone 17 Pro Max (iOS 26.1, `3F3293A3-…`) via mobile-mcp; staging `drntwgporzabmxdqykrp`
**Execution order:** batched per §5.26/§5.28 — Profile Setup surface first (H02→H01 on one account), then carousel (H06a/H07 on the skip path, H06b/H07 on the Get-Started path), then H03 (DB-toggle check) and H04/H05 (route reachability).

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-H02 | AUTH guide, Group H | ✅ PASS | 1-char name + 3-digit ZIP → both errors "Display name must be at least 2 characters" / "Zip code must be 5 digits"; submission blocked |
| AUTH-TC-H01 | AUTH guide, Group H | ✅ PASS* | Name + ZIP `06850` → "📍 Norwalk, CT"; profile created (DB: name, zip, node=Norwalk Central, profile_completed); advances to onboarding. *Avatar preview sub-assertion NOT verified on-device — native photo-picker crop screen is toolset-undrivable (see findings) |
| AUTH-TC-H06 | AUTH guide, Group H | ✅ PASS | Skip → Home (`onboarding_skipped_at` set, tab bar mounts immediately); Get Started on slide 5 → Home (`onboarding_completed_at` set) |
| AUTH-TC-H07 | AUTH guide, Group H | ✅ PASS | After Skip AND after Get Started, relaunch → straight Home (no carousel), both DB flags respected |
| AUTH-TC-H03 | AUTH guide, Group H | ⛔ BLOCKED | `qa_avatar_upload_failure` toggle = `none` on staging — needs dev-team arm to induce the upload-failure path |
| AUTH-TC-H04 | AUTH guide, Group H | ⛔ BLOCKED | Welcome screen is an orphaned/dead route (not in the live flow); **plus a confirmed defect: headline renders literal accessibility-prop junk text** |
| AUTH-TC-H05 | AUTH guide, Group H | ⛔ BLOCKED | Feature Highlights 4-slide screen is an orphaned/dead route (content correct via deep link, but not reachable by any real user) |

**Roll-up: 4 PASS / 0 FAIL / 3 BLOCKED / 0 SKIPPED**

\* H01 is PASS for the case's core assertions (name+ZIP capture, ZIP→city/state resolution, profile creation, node assignment, advance) with the single avatar-preview sub-assertion flagged as not verifiable on-device due to a toolset limitation (native photo-picker crop editor is undrivable — same class as the documented CategorySelectModal issue). A `dev` avatar fixture (mirroring `dev-add-test-photo`) is recommended as a follow-up.

---

## Perceived load-time table (simulator wall-clock, ±polling interval)

All in-app transitions rendered within the ideal UX threshold (<3s); nothing flagged as app-side.

| Screen → transition | Elapsed | Notes |
|---|---|---|
| Landing → Create Account (Get Started) | <2s | first poll |
| Create Account → Phone Verification (signup submit) | ~2s | DEV-bypass dialog appeared |
| Phone Verify → Profile Setup (Use & Verify → Continue) | <2s | — |
| Profile Setup submit → Success alert | ~1–2s | — |
| Success OK → Onboarding carousel | <2s | RootNavigator gate → carousel |
| Carousel Skip → Home | <2s | tab bar mounted on first poll (Phase 24 bug fixed) |
| Carousel Get Started → Home | <2s | — |
| App relaunch (skip path) → Home | ~4–5s | **includes dev-bundle re-download (~5–10s on cold start — environment artifact, not app routing)**; after bundle load, went straight to Home |
| App relaunch (complete path) → Home | ~4–5s | same environment-artifact caveat |

**Perceived Load-Time Verdict: GOOD** — no in-app transition reached the 3s flag threshold; relaunch times are dominated by the dev-build bundle download, a documented environment artifact.

---

## Per-case details

### AUTH-TC-H02 — Profile Setup validation errors — PASS
- Fresh user A (Alice autofill, unique contact `qa.alice.17875266480161531@kidsmarketplace.test`, phone `+12025558017764`) → phone verify (DEV bypass `123456` via Use & Verify) → Profile Setup.
- Entered display name **"A"** (1 char) + ZIP **"123"** (3 digits) → tapped `complete-setup-button`.
- Both inline errors rendered with testIDs: `display-name-error` = **"Display name must be at least 2 characters"** and `zip-code-error` = **"Zip code must be 5 digits"**; stayed on Profile Setup (submission blocked). Exact match to the guide's Expected Result.
- Evidence: `04-h02-validation-errors.png`, `03-h02-profile-setup-invalid.png`.

### AUTH-TC-H01 — Profile Setup: avatar + name + ZIP — PASS (avatar sub-assertion toolset-limited)
- Same form (form-state batching, §5.28): cleared the invalid values via long-press → Select All → retype.
- Entered display name **"H01 Test Parent B"** + ZIP **`06850`** → **`city-state-display` = "📍 Norwalk, CT"** appeared beneath the field (H01's ZIP-resolution assertion + F05 lookup).
- Attempted the avatar step first on user A: tapped `avatar-upload-button` → native photo picker opened → tapped the first photo tile → advanced to the native **crop/confirm editor** ("Cancel / Choose"). **The crop editor rejected every toolset interaction** (3 derived taps on Choose, 2 on Cancel, 1 swipe-down — none registered; screen unchanged). Native full-screen window not in the AX tree (only the clock surfaces). **Same class as the documented CategorySelectModal limitation (Phase 22/23).** Escaped via terminate+relaunch.
- Completed the profile on user B without an avatar: `Complete Setup` → **Success alert "Your profile has been created!"** (in-app `GlobalAlertProvider`, `global-alert-button-0`) → OK → advanced to the **onboarding carousel**.
- DB (`qa.bob.17875274353311948@kidsmarketplace.test`): `profile_completed=true`, `name="H01 Test Parent B"`, `zip_code="06850"`, `node_id` = Norwalk Central (`550e8400-…0001`), `avatar_url=NULL` (no avatar selected), no waitlist row.
- Evidence: `05-h01-photo-picker.png`, `06-h01-photo-picked.png` (crop editor with Cancel/Choose), `09…12-h01-*.png` (undrivable attempts), `15-h01-profile-filled.png`, `16-h01-profile-created.png`.

### AUTH-TC-H06 — Onboarding carousel: Next / Skip / Get Started — PASS
- **Skip variant (user A):** on the carousel, tapped `skip-button` → **Home** (full Home screen + PersistentTabBar mounted immediately — the Phase 24 "no tab bar after Skip until relaunch" bug is **FIXED**). DB: `onboarding_skipped_at=2026-08-23 23:22:40`, `onboarding_completed_at=NULL`.
- **Get Started variant (user B):** after H01's profile creation, the carousel appeared; swiped through all 5 slides (verified each step via AX tree: 1 "Welcome to a safe, neighborhood marketplace" → 2 "What are Pass It Up Points?" → 3 "How You Earn PIPs" → 4 "How You Spend SP" → 5 "Safety First"); on slide 5 the **`onboarding-get-started-button`** appeared → tapped → **Home** with header chip **"Norwalk Central"**. DB: `onboarding_completed_at=2026-08-23 23:26:54`, `onboarding_skipped_at=NULL`.
- Evidence: `13-h06a-skip-home.png`, `17-h06b-carousel-check.png`, `18-h06b-slide5-get-started.png`, `19-h06b-get-started-home.png`.
- **Note (progress dots):** the dots container (`onboarding-pagination-dots`) is `accessible={false}` in source, so the active-dot state isn't individually assertable via the AX tree; slide advancement was verified step-by-step and the dots render (source + screenshots). Not counted as a failure.

### AUTH-TC-H07 — Onboarding completion routes to Home — PASS
- **Skip path (user A):** terminate + relaunch → **straight to Home** (no carousel). DB `onboarding_skipped_at` set.
- **Complete path (user B):** terminate + relaunch → **straight to Home** (no carousel), header chip "Norwalk Central". DB `onboarding_completed_at` set.
- Both relaunch landings verified on the AX tree (Home header/composer/tab bar present, no `Onboarding, step…` elements).
- Evidence: `14-h07a-relaunch-straight-home.png`, `20-h07b-relaunch-straight-home.png`.

### AUTH-TC-H03 — Avatar upload failure does not block — BLOCKED
- Read-only DB check of the `qa_avatar_upload_failure` admin_config toggle: **value = `none`** (disarmed since 2026-08-18). Per the standing convention (registry `qa-test-accounts.md`), the QA agent must NOT self-arm (the write touches shared staging config). The dev team must arm `qa_avatar_upload_failure = 'upload_failure'` for H03 to run.
- Source-verified non-blocking path unchanged: `ProfileSetupScreen.handleSubmit` → on `uploadProfileAvatar` error → `Alert.alert('Warning', 'Profile will be created without avatar. You can add it later.')` then continues creating the profile without `avatar_url`.

### AUTH-TC-H04 — Welcome screen → Get Started — BLOCKED (orphaned route) + DEFECT
- Source analysis: `Welcome` route is registered in the unauth stack, but **nothing in the live flow navigates to it** (only the orphaned `FeatureHighlightsScreen` links to it). The real onboarding is the single 5-slide carousel (`OnboardingScreen`), which `replace('Home')` — Welcome is bypassed. Confirmed live: the H01/H06 flow went Signup→ProfileSetup→carousel→Home with no Welcome screen.
- Reachability probe on this build: `p2pkidsmarketplace://welcome` from the clean Landing **does** navigate to `WelcomeScreen` (it renders) — but no real user reaches it.
- **DEFECT (confirmed on-device):** the `welcome-headline` renders literal junk text — `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button" Welcome to a safe, neighborhood marketplace built exclusively for local families.` (OCR + AX tree both show the accessibility-prop text inline in the headline). Root cause: those props were pasted as literal text inside the `<Text>` in `WelcomeScreen.tsx`. The intended H04 copy ("safe, neighborhood marketplace") is present but polluted.
- Evidence: `21-h04-welcome-corrupted-headline.png`.

### AUTH-TC-H05 — Feature Highlights carousel — BLOCKED (orphaned route)
- Source analysis: `FeatureHighlights` route registered in the unauth stack but **nothing navigates to it** (dead route).
- Reachability probe: `p2pkidsmarketplace://feature-highlights` from clean Landing **does** navigate and renders the full 4-slide screen (🔍 Discover Items / 💰 Earn Money / 🤝 Safe Trading / ⭐ Build Reputation, each with title+description+emoji, `next-button` on slides 0–2 and `get-started-button-3` on slide 3) — H05's content assertions would pass IF reachable. But no real user can reach it; the live onboarding carousel (H06) covers the same education content in 5 slides.
- Evidence: `22-h05-feature-highlights.png`.

---

## UX review (three layers)

### Structural / affordance
- Profile Setup, phone-verification, success alert, and the onboarding carousel all navigated cleanly with clear affordances (Skip on every carousel slide, Get Started on the last, OK on alerts). No overlap/truncation observed on the live screens.
- The two orphaned screens (Welcome/FeatureHighlights) render fine structurally but are unreachable in the real flow.

### Wording / copy clarity
- Profile Setup copy is parent-friendly ("Tell us a bit about yourself and we'll connect you to your local community", "We'll assign you to your nearest community node"). Success "Your profile has been created!" is clear. Validation errors are specific and actionable. ✅
- Carousel education copy is plain and appropriate for parents/guardians (SP explanation, safety rules). ✅
- **DEVIATION (typo):** onboarding carousel slide 3 title renders **"How You Earn PIPs ( Pass It Up Pionts)"** — "Pionts" is a typo for "Points" (visible in the AX tree and OCR). Concrete rewrite: **"How You Earn PIPs (Pass It Up Points)"** (also remove the stray space before the open paren).
- **DEVIATION (Welcome, orphaned):** headline polluted with `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"` literal text — the headline should be only **"Welcome to a safe, neighborhood marketplace built exclusively for local families."** (dead route, but broken if ever surfaced).

### Design-system compliance (vs `docx/design-system-passitup.md`)
- **Profile Setup**: filled inputs (`#F0F0F0`), single primary-green `Complete Setup` pill, helper-text tiers, 20–24px page padding — **No deviations found.**
- **Success alert** ("Your profile has been created!"): centered `GlobalAlertProvider` card, single primary OK button — **No deviations found.**
- **Onboarding carousel**: Skip (text) + Get Started (green pill, appears only on last slide — max one primary), progress dots, `#5DBB8E` primary — **No deviations found** (the "Pionts" typo is a copy defect, not a token deviation).
- **Welcome screen (orphaned)**: headline text contains inline raw accessibility markup — a rendering/token-hygiene deviation (dead route).
- **FeatureHighlights (orphaned)**: content + buttons consistent with the design system — **No deviations found**.

---

## Locator-gap findings
- `complete-setup-button` is now **AX-exposed** (was a Phase 23 locator gap — fixed; tap via tree coordinate worked on this build).
- `display-name-error` / `zip-code-error` / `city-state-display` all surface in the AX tree (good).
- **Native photo-picker crop editor** (expo-image-picker `allowsEditing`) is a full-screen native window: not in the AX tree (only the clock surfaces) and **rejects toolset taps/swipes** (5 tap attempts + 1 swipe, all no-ops). This is the same class as the documented CategorySelectModal limitation. Recommendation (dev): add a `dev` avatar fixture on ProfileSetup (mirror `dev-add-test-photo`/`dev-set-category`) so the avatar-selection sub-step becomes toolset-drivable.
- Carousel pagination dots container is `accessible={false}` — active-dot state not tree-assertable (minor, informational).

## Friction vs. operating rules
- **Simulator keyboard:** Cmd+K suppressed the keyboard but it **re-showed on each new field focus** — re-applied before every submit (matches the F/G report; the "stays hidden across focus" claim in `simulator-keyboard-suppression.md` is confirmed doc drift on this build). Updated note for the memory file.
- **Native photo-picker crop editor undrivable:** documented above; required a terminate+relaunch escape (the app relaunched onto the carousel — an unexpected but usable state for H06a).
- **Visual tooling:** `view_image` returned only resource URIs this session (no pixels) — used the approved `npm run qa:ocr` (region-slicing) as the deterministic fallback per §5.9/§5.23.
- **AX-tree staleness:** one instance — after the signup-submit tap, the tree still showed the Signup screen while the screenshot showed PhoneVerification (screenshot used as source of truth per §5.9); resolved on re-list.
- **Dev-bundle re-download on each relaunch** (~5–10s cold) — environment artifact, not app behavior.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-H01–H07 (Group H — Profile Setup & Onboarding)
**Design-System Compliance:** PARTIAL — all live screens (Profile Setup, success alert, onboarding carousel) are compliant; two deviations on the **orphaned** Welcome screen (headline renders literal `accessibility…` markup text) and the carousel slide-3 title typo ("Pionts"). FeatureHighlights (orphaned) content is compliant.
**Perceived Load-Time Verdict:** GOOD — all in-app transitions rendered within the ideal UX threshold (<3s). Relaunch times (~4–5s) are dominated by the dev-build bundle re-download, an environment artifact, not app routing.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Profile Setup screen: filled inputs, single primary `Complete Setup` pill, helper-text tiers, clear parent-friendly copy.
- CONFIRMED — "Your profile has been created!" success alert: centered card, single primary OK.
- CONFIRMED — Onboarding carousel: Skip + Get Started-on-last-slide (max one primary), progress dots, `#5DBB8E` primary.
- DEVIATION — Onboarding carousel slide 3 title: **"How You Earn PIPs ( Pass It Up Pionts)"** — typo "Pionts"; rewrite to "How You Earn PIPs (Pass It Up Points)" and remove the stray space.
- DEVIATION — Welcome screen headline (orphaned route): renders `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button" Welcome to a safe, neighborhood marketplace…` — literal accessibility-markup text in the headline; should be only "Welcome to a safe, neighborhood marketplace built exclusively for local families."
**Verdict Summary:** 4 PASS / 0 FAIL / 3 BLOCKED / 0 SKIPPED (H01 counted PASS with the avatar-preview sub-assertion toolset-limited and explicitly noted)
**Critical Findings:**
1. (P2, latent) Welcome screen headline renders raw accessibility-prop text — the `WelcomeScreen.tsx` `<Text testID="welcome-headline">` has `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"` pasted as literal string content. Confirmed on-device via deep link (AX tree + OCR).
2. (P2, copy) Onboarding carousel slide 3 "How You Earn PIPs ( Pass It Up Pionts)" — "Pionts" typo.
3. (P3, toolset) Native photo-picker crop editor is undrivable by the mobile-mcp toolset (same class as CategorySelectModal) — the H01 avatar-preview sub-assertion couldn't be visually verified; needs a `dev` avatar fixture.
4. (P2, spec drift) H04/H05's standalone Welcome + Feature Highlights screens are orphaned/dead routes — the live onboarding is a single 5-slide carousel (H06/H07 verified). Guide should be updated to point H04/H05 at the carousel (as Phase 23 recommended), and the dead routes either wired in or removed.
5. (Positive) Phase 24's "no tab bar after Skip until relaunch" bug is FIXED — Skip → Home mounts the PersistentTabBar immediately.
**App State Left Behind:**
- Throwaway accounts (per-run, do not reuse as standing personas):
  - `qa.alice.17875266480161531@kidsmarketplace.test` (user `0fcfbcdc-276e-44bb-86c4-4d55a2550a8c`) — phone-verified; profile NOT completed (`profile_completed=false`, `node_id=NULL`, `onboarding_skipped_at` set 23:22:40). Created because the H01 avatar attempt got stuck in the native picker before the profile submit. Left in an incomplete state — cleanup candidate (or leave as an unverified-avatar fixture).
  - `qa.bob.17875274353311948@kidsmarketplace.test` (user `19f20454-63b8-49f2-b0db-fdcbcc740204`) — **full profile**: name "H01 Test Parent B", zip 06850, node Norwalk Central, `profile_completed=true`, `onboarding_completed_at` 23:26:54, `avatar_url=NULL` (no avatar), 0 waitlist rows.
- Simulator app state: app terminated; next launch restores logged-out Landing (both sessions cleared via `qa-logout`).
**Why It Matters:** Group H's live onboarding surface (Profile Setup capture + validation, carousel Skip/Get-Started, and relaunch persistence) is fully verified and correct, including the Phase 24 tab-bar fix. The three BLOCKED cases are all environment/spec-driven (H03 needs the dev-toggle armed; H04/H05 are dead routes) — plus the run surfaced two genuine copy/render defects in onboarding-adjacent screens (carousel typo + Welcome headline pollution) and one toolset limitation (native photo-picker crop editor) that needs a dev fixture to fully close H01.
**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/group-h-profile-setup-2026-08-23/screenshots/` (00–22).
- H01 avatar limitation: Profile Setup → tap avatar → photo picker → select any photo → crop editor "Cancel/Choose" — tap Choose at the measured band; no state change (5 attempts).
- Welcome headline defect: logged-out Landing → `xcrun simctl openurl booted "p2pkidsmarketplace://welcome"` → headline shows the inline accessibility markup.
- Carousel typo: fresh signup → Profile Setup → complete → carousel → slide 3 → title "How You Earn PIPs ( Pass It Up Pionts)".
- H06/H07: signup → profile → carousel → Skip/Get Started → Home; relaunch → straight Home.
**Known Gaps / Not Tested:**
- H03 not executed (toggle unarmed; needs dev-team arm).
- H04/H05's Get-Started transitions not executed (no real flow reaches them; Welcome's `handleGetStarted` is a no-op without a userId and FeatureHighlights' `handleGetStarted` throws without a user).
- H01 avatar-preview visual update not confirmed (toolset-limited).
- Active-dot state of the carousel pagination not individually assertable (container `accessible={false}`); slide advancement verified instead.
**What Needs To Be Fixed Next:**
1. Fix (copy/render): remove the literal `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"` text from the `welcome-headline` `<Text>` in `WelcomeScreen.tsx` so the headline is only the intended copy.
2. Fix (copy): onboarding carousel slide 3 title "How You Earn PIPs ( Pass It Up Pionts)" → "How You Earn PIPs (Pass It Up Points)".
3. Fix (instrumentation, unblocks H01 avatar sub-assertion + future avatar cases): add a `__DEV__` avatar fixture on ProfileSetup (mirror `dev-add-test-photo`/`dev-set-category`) so the avatar-selection path is toolset-drivable without the native picker.
4. Decision (spec): wire the orphaned Welcome/FeatureHighlights screens into a flow OR remove them; update the guide's H04/H05 to point at the live carousel.
5. Cleanup (dev-team): either delete the incomplete `qa.alice.17875266480161531@…` throwaway or keep as a fixture.
**UX Enhancement Ideas (optional, not defects):**
- On the onboarding carousel, a single large swipe occasionally snapped back a slide (partial-drag bounce) — consider making the carousel snap more firmly to the nearest page after any swipe, which would reduce the extra swipes needed to reach slide 5.
- On Profile Setup, the 5-digit ZIP uses the number pad with no dismiss key, and the keyboard re-appears on every field focus — consider a "Done" toolbar accessory or automatic keyboard dismissal after a complete 5-digit ZIP is entered.
**Suggested Next Session:** Group H re-run of H03 after the dev team arms `qa_avatar_upload_failure`, plus a one-case follow-up to visually confirm H01's avatar preview once the `dev` avatar fixture lands.
**Suggested to Improve Agent Rules:** none — the existing §5.1/§6.1 bounded-attempt-then-pivot and §5.19 Rule-6 terminate+relaunch rules handled the undrivable native crop editor cleanly.
