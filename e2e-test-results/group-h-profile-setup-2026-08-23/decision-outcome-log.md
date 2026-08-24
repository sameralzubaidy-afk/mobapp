# Decision-and-Outcome Log — Group H (Profile Setup & Onboarding)

**Run:** `e2e-test-results/group-h-profile-setup-2026-08-23/`
**Date:** 2026-08-23 (23:07–23:29 local, ~22 min)
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group H)
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-…`), Expo RN dev build + Metro, staging `drntwgporzabmxdqykrp`
**Verdict roll-up:** 4 PASS / 0 FAIL / 3 BLOCKED / 0 SKIPPED (H01 PASS with avatar-preview sub-assertion toolset-limited)

This log is the **action → reasoning → tool-call → outcome** trace of the executing agent, written to be fed to an AI agent for process analysis. It focuses on the decisions that shaped the run (batching, pivot points, fallbacks) and the friction that consumed wall-clock, not on re-listing every assertion. Derivations are in §4 (what slows execution), §5 (proactive patterns), §6 (instrumentation/fixture work).

---

## 1. Execution trace

### 1.1 Pre-flight (read-only, no device time spent blindly)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 1 | Read operating playbook + repo memory (`qa-test-accounts`, `locator-conventions`, `simulator-keyboard-suppression`, `manual-testing-guide-canons`, `qa-test-agent`) | §4 of playbook mandates canonical sources + memory before any device work | `read_file` (playbook §4–§9), `memory view` ×5 | Full rulebook loaded: §5.1 re-derive-on-miss, §5.2 keyboard discipline, §5.9 screenshot-as-truth, §6.1 bounded attempts |
| 2 | Grep the canonical guide for `AUTH-TC-H0[1-7]`, read each case body (Setup/Steps/Expected Result) + the verification-checklist mapping | TC-IDs are reused across guides; must execute from the named guide | `grep_search` ×2, `read_file` (guide lines 900–1035, 2400–2460) | Group H cases understood; H04/H05 look suspicious (Welcome/FeatureHighlights vs. live carousel) |
| 3 | Source-pre-read (generalized pre-read rule): `AppNavigator` routing, `OnboardingScreen`/`OnboardingCarousel`, `WelcomeScreen`, `FeatureHighlightsScreen`, `ProfileSetupScreen` (submit/waitlist/avatar), `educationAnalyticsService.shouldShowOnboarding` | Must understand the flow before blind UI navigation; H04/H05 reachability + H06/H07 gating depend on the actual navigation graph | `grep_search` + `read_file` on `p2p-kids-marketplace/src/navigation/*`, `src/screens/onboarding/*`, `src/screens/profile/ProfileSetupScreen.tsx`, `src/services/educationAnalyticsService.ts` | **Key finding:** nothing navigates to `Welcome`/`FeatureHighlights` (orphaned); live onboarding = 5-slide `OnboardingScreen` carousel gated by `shouldShowOnboarding` (both `onboarding_completed_at` AND `onboarding_skipped_at` NULL). H04/H05 predicted BLOCKED (spec drift). Also spotted a **source oddity**: `WelcomeScreen` headline `<Text>` contains literal `accessible accessibilityRole="button"...` props-as-text |
| 4 | DB precondition checks (read-only) | §4: verify documented state before device time — H03 needs the avatar-failure toggle; H01 needs an active node for ZIP 06850 | `mcp_supabase_execute_sql` (admin_config toggle; nodes by ZIP; profiles columns) | `qa_avatar_upload_failure = none` → **H03 predicted BLOCKED** (needs dev arm). Norwalk Central active for 06850. Profiles has `onboarding_completed_at`/`onboarding_skipped_at` (H07 assertable) |
| 5 | Device/state checks: simulator booted, app installed ("Pass It Up!"), Metro up | §5.8 clean-state + tool readiness | `mobile_list_available_devices`, `mobile_list_apps`, `fetch_webpage(localhost:8081/status)` | All green; Landing clean (no LogBox) |
| 6 | **Batching plan** (not in guide): H02→H01 on one Profile Setup form (user A), then H06a/H07 on the skip path; H01 again on user B → H06b/H07 on the Get-Started path; H03/H04/H05 as targeted checks | §5.26 persona-batching (minimize login cycles) + §5.28 form-baseline batching (mutate only the delta field) | — | 2 fresh signups cover 4 cases; 1 relaunch escape doubles as H06a setup (see 1.3) |

### 1.2 Signup baseline (×2) — the well-oiled path

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 7 | Landing → Get Started → Signup; scroll down to reveal DEV autofill row | DEV autofill (`dev-fill-test-user-*`) generates a fresh unique email+phone per tap (§5.13) — removes the Select-All-override dance | `mobile_click_on_screen_at_coordinates`, `mobile_swipe_on_screen`, `mobile_list_elements_on_screen` | Reached signup; dev-fill buttons AX-exposed |
| 8 | Tap `dev-fill-test-user-1` (Alice, user A) / `-2` (Bob, user B) → verify every field in the tree → tap `signup-submit-button` | §5.2 per-field verification before submit; tap submit only with keyboard down | `mobile_click_*`, `mobile_list_elements_on_screen` | Form filled (email/phone/dob/passwords) with fresh unique contacts; submit → PhoneVerification (~2s) |
| 9 | Dismiss DEV-bypass dialog (`otp-dev-bypass-dialog-ok-button`), tap `dev-verify-otp-123456` (Use & Verify), tap success `Continue` | §5.19 Rule 2: use the one-tap verify (fills 123456 + verifies) — the reliable recipe from prior runs | `mobile_click_on_screen_at_coordinates` ×3 | Phone verified → Profile Setup |
| 10 | **Checkpoint:** after signup-submit, the AX tree still showed the Signup screen while the screenshot showed PhoneVerification | §5.9 AX-tree staleness — screenshot is the source of truth; never trust a stale tree | `mobile_save_screenshot`, `npm run qa:ocr` | Confirmed the screen had advanced; re-listed and got the fresh tree. 1 wasted poll, no wrong action |

### 1.3 H02 + H01 on one Profile Setup form (user A) — the native-picker wall

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 11 | H02: enter name "A" + ZIP "123" → tap `complete-setup-button` | H02's Assert = both validation errors, submit blocked | typed into `profile-setup-display-name-input` + `zip-code-input`, Cmd+K before the submit tap (§5.19 Rule 1 hard gate) | Both errors rendered (`display-name-error`, `zip-code-error`) with exact copy; blocked. **PASS** |
| 12 | H01 on the same form: clear name via long-press → Select All → retype "H01 Test Parent"; clear ZIP → retype 06850 | §5.10 field-clearing (avoid relaunch) + §5.28 form batching | `mobile_long_press_*`, `mobile_click_*` (Select All), `mobile_type_keys` | Name + ZIP updated; `city-state-display` = "📍 Norwalk, CT" ✓ |
| 13 | Tap `avatar-upload-button` → native photo picker opens | H01 needs an avatar; picker is native (separate window) | `mobile_click_on_screen_at_coordinates` (220,215) | PHPicker rendered ("Photos/Collections"); not in AX tree (only clock) |
| 14 | Tap the first photo tile (estimated (73,300)pt from OCR band analysis) | Picker grid not AX-exposed; used OCR band + 3x scale to derive the top-left tile | `mobile_click_*`, `npm run qa:ocr` region slices | Photo selected → advanced to native **crop/confirm editor** ("Cancel"/"Choose") |
| 15 | **The wall:** 5 taps on Cancel/Choose (re-derived positions each time) + 1 swipe-down — all no-ops; screen unchanged | §5.1 "one miss, full re-derive" — each attempt used a fresh OCR-measured band, not nearby guesses; §6.1 bounded attempts (2–3) then pivot | `mobile_click_*` ×5, `mobile_swipe_on_screen`, `npm run qa:ocr` with region slicing/binary-search | Crop editor (native full-screen window) rejects toolset taps AND swipes — **same class as the documented CategorySelectModal limitation**. Concluded the window is not toolset-drivable |
| 16 | Terminate + relaunch to escape the stuck native crop editor | §5.19 Rule 6 (stuck overlay → terminate+relaunch, don't keep hunting) | `mobile_terminate_app`, `mobile_launch_app` | Relaunch restored the session and landed on the **onboarding carousel** (unexpected but usable — user A's profile was never submitted, so onboarding shows) |
| 17 | **Replan on the spot:** use the carousel landing for H06a (Skip) + H07 on user A; do H01 on a fresh user B later | Don't waste the state; the carousel is exactly what H06/H07 need | — | Saved a full signup cycle |

### 1.4 H06a + H07 (skip path, user A)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 18 | Tap `skip-button` on the carousel | H06a: Skip → Home | `mobile_click_*` | Home loaded **with the PersistentTabBar mounted immediately** — the Phase 24 "no tab bar after Skip until relaunch" bug is FIXED. **PASS** |
| 19 | DB verify `onboarding_skipped_at` set | §5.11 DB-over-UI for persistence | `mcp_supabase_execute_sql` | `onboarding_skipped_at=23:22:40`, `profile_completed=false` (expected — profile never submitted) |
| 20 | Terminate + relaunch → verify straight to Home (no carousel) | H07's assertion | `mobile_terminate_app`, `mobile_launch_app`, `mobile_list_elements_on_screen` | Straight to Home, no `Onboarding, step…` elements. **PASS** |

### 1.5 H01 + H06b + H07 (Get-Started path, user B)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 21 | `qa-logout` deep link → Landing | §5.16 prefer qa-logout over Profile UI logout | `run_in_terminal` (`xcrun simctl openurl`) | Clean logout → Landing |
| 22 | Fresh signup user B (Bob autofill) → phone verify → Profile Setup | Reuse the §1.2 baseline | — | At Profile Setup |
| 23 | H01 (user B): name "H01 Test Parent B" + ZIP 06850 → "📍 Norwalk, CT" → `complete-setup-button` | **Deliberately skipped the avatar** — the native crop editor was proven undrivable (1.3); re-attempting wastes cycles + risks another relaunch | `mobile_type_keys`, `npm run qa:ocr` verify, `mobile_click_*` | "Your profile has been created!" success → OK → onboarding carousel. **PASS** (avatar sub-assertion documented as toolset-limited) |
| 24 | H06b: swipe carousel 1→5, tap `onboarding-get-started-button` on slide 5 | H06b: Get Started on last slide → Home | `mobile_swipe_on_screen` ×4 (+1 re-advance after a bounce-back), `mobile_list_elements_on_screen` per slide | Home with header chip **"Norwalk Central"**. **PASS**. Noted slide-3 title typo "Pionts" |
| 25 | DB verify user B: profile_completed, onboarding_completed_at, node=Norwalk Central | §5.11 DB-over-UI | `mcp_supabase_execute_sql` (fixed column name `name` after a 42703 error) | Full row confirmed (name/zip/node/onboarding_completed_at); 1 error+retry cycle for the column name |
| 26 | Terminate + relaunch → straight to Home (no carousel) | H07 (complete path) | `mobile_terminate_app`, `mobile_launch_app` | Straight to Home. **PASS** |
| 27 | `qa-logout` → Landing | clean end state | `run_in_terminal` | Logged out |

### 1.6 H04/H05 + H03 (targeted checks)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 28 | `xcrun simctl openurl booted "p2pkidsmarketplace://welcome"` from clean Landing | H04's screen is in the unauth stack — a deep link tests reachability (§5.8: clean state verified first) | `run_in_terminal`, `mobile_list_elements_on_screen`, `mobile_save_screenshot`, `npm run qa:ocr` | **Navigated** to WelcomeScreen — and it **renders the corrupted headline** (`accessible accessibilityRole="button"...` as literal text). Confirmed defect + orphaned-route evidence |
| 29 | `xcrun simctl openurl booted "p2pkidsmarketplace://feature-highlights"` from clean Landing | H05's screen reachability | `run_in_terminal`, `mobile_list_elements_on_screen`, `mobile_save_screenshot` | **Navigated** — 4 slides (Discover Items/Earn Money/Safe Trading/Build Reputation) render correctly, but it's an orphaned route (no real flow reaches it) |
| 30 | Read-only DB: `qa_avatar_upload_failure` | H03's toggle state (already checked pre-flight; re-confirmed) | `mcp_supabase_execute_sql` | `none` → H03 BLOCKED (dev must arm), not self-armed per convention |
| 31 | Terminate app (clean end state) + write report/evidence/memory | §8 report + handoff; durable findings | `mobile_terminate_app`, `create_file` (report), `memory` (qa-test-accounts update) | Report + 23 evidence screenshots archived; memory updated |

---

## 2. Bottlenecks & challenges (ranked by wall-clock cost)

1. **Native photo-picker crop editor is toolset-undrivable (the single biggest time sink, ~6–8 min).** `expo-image-picker` with `allowsEditing` presents a full-screen native crop/confirm window ("Cancel"/"Choose"). It is not in the AX tree (only the clock surfaces) and **rejects every synthesized tap and swipe** (5 taps at OCR-measured positions + 1 swipe-down, screen byte-identical). This is the same class as the documented `CategorySelectModal`/Sell-sheet limitation (Phase 22/23), which should have been predicted earlier. It forced a terminate+relaunch escape and left the H01 avatar-preview sub-assertion unverifiable.
2. **OCR position-finding for native-window buttons is slow and flaky.** Locating the crop screen's buttons required 8+ `qa:ocr` region-slice calls (band maps, binary-search y, left/right splits) because the OCR script emits text lines but **no coordinates** and small-region OCR intermittently missed text that larger bands caught. High cycle cost for zero progress (the buttons weren't tappable anyway).
3. **Simulator keyboard re-shows on every field focus.** Cmd+K suppressed it but it returned on each new focus — so Cmd+K had to be re-applied before every submit/tap on a below-fold control (§5.19 Rule 1 hard gate). Consistent with the F/G report; the "persists across focus" claim in memory is confirmed doc drift. Adds ~3–4 extra terminal round-trips per form.
4. **Dev-bundle re-download on every app relaunch (~5–10s each).** Each `terminate+launch` paid a "Downloading N%" wait. Three relaunches this run (escape, H07×2) ≈ 20–30s of pure environment cost. Environment artifact, but it makes relaunches expensive enough to avoid.
5. **AX-tree staleness after the signup-submit transition** — the tree showed the previous Signup screen while the real screen was PhoneVerification. Cost 1 poll + a screenshot/OCR verification. Known pattern (§5.9), handled correctly.
6. **Carousel swipe bounce-back** — one 300px swipe from slide 4 snapped back to slide 2 (partial-drag interpretation), requiring a re-advance (1 extra swipe + 1 re-list). Minor but avoidable.
7. **1 SQL column-name error** — guessed `p.display_name`, actual `p.name` (42703). One error + retry; cheap but shows DB schema should be pre-read for any profile query.

## 3. Reasoning patterns observed (what the agent did right / should keep doing)

1. **Batching as the primary lever.** §5.26/§5.28 batching: 2 signups instead of 5, one Profile Setup form for H02→H01, and the stuck-native-picker relaunch repurposed as H06a's setup state. Every avoided signup/relaunch saved ~30–60s and a keyboard-dance.
2. **Fail-fast + pivot, not stubborn retries.** On the crop editor: 5 bounded, fully-re-derived attempts (never nearby guesses, per §5.1) then a clean pivot (terminate+relaunch) and a **replan** that reused the resulting state for H06a. The §6.1 "bounded attempts, then pivot" rule worked.
3. **Screenshot as source of truth when the tree lies.** Both the stale tree (signup→phoneverify) and the native window (clock-only tree) were resolved by screenshot/OCR instead of trusting the tree.
4. **DB-over-UI for persistence.** H06a/H06b/H01 assertions closed with read-only SQL (flags, node, profile row), not just UI observation.
5. **Predicting BLOCKED from source before device time.** H04/H05 (orphaned routes) and H03 (toggle unarmed) were flagged pre-flight from source + DB, then confirmed cheaply — no wasted full flows.
6. **Documenting toolset-limitations as findings, not app failures.** The crop editor + avatar sub-assertion were reported as toolset-limited with evidence + a fixture recommendation, not as an app defect.

## 4. (a) What slows execution

- Native full-screen modals that the toolset can't drive (crop editor, CategorySelectModal, Sell sheet): each is a dead end requiring a relaunch escape. **Biggest multiplier.**
- Any native-window button location task that relies on OCR text bands (no coordinates emitted by the OCR tool).
- Keyboard re-presentation on each field focus → per-submit Cmd+K round-trips (terminal ↔ device).
- Relaunches (dev-bundle re-download 5–10s each) as the default "reset".
- Stale AX trees after transitions → one verification round-trip per occurrence.
- Guessing DB column names instead of pre-reading the schema.

## 5. (b) What patterns an agent should adopt proactively

1. **Pre-scan for native-full-screen-modal involvement before a flow.** If a case touches an image picker / category picker / bottom sheet (any `presentationStyle=fullScreen` or `launchImageLibraryAsync`), expect the native window to be undrivable; plan a fixture-based bypass up front rather than discovering it mid-flow.
2. **Maintain a "cost table" for reset operations** (signup ≈ 45–60s, relaunch ≈ 10–15s, field-clear ≈ 5–10s, Cmd+K ≈ 3–5s) and always pick the cheapest reset that satisfies the case — this is what §5.28/§5.29/§5.10 optimize.
3. **Repurpose unexpected state** instead of discarding it (the relaunch-onto-carousel → H06a).
4. **Use OCR band-slicing only to confirm a native window's structure, not to fight for taps** — if a native window resists 2–3 re-derived taps, pivot immediately (§6.1) rather than burning cycles on finer OCR.
5. **Verify keyboard state via OCR/screenshot before every below-fold tap** (hard gate), and batch all typing for a form before the first Cmd+K when possible.
6. **Pre-read the DB schema** for any profile/persona query (column names like `name` vs `display_name`) to avoid 42703 retries.
7. **Do the source+DB BLOCKED-prediction pass first** — it turned 2 of the 3 BLOCKED cases into cheap confirmations instead of full attempted flows.

## 6. (c) What instrumentation / fixture work removes the friction

1. **`__DEV__` avatar fixture on ProfileSetup** (highest value). Mirror `dev-add-test-photo`/`dev-set-category`: a button that injects a bundled image into `localImageUri` (skipping the native picker). Unblocks the H01 avatar-preview sub-assertion and any future avatar case, and removes the run's single biggest dead-end.
2. **Arm `qa_avatar_upload_failure` toggle for H03** (dev-team write to admin_config) — already exists, just needs arming to unblock H03.
3. **Fix the Welcome headline** — remove the literal `accessible accessibilityRole="button" accessibilityLabel="Welcome get started button"` string from the `<Text>` (a latent render defect on an orphaned route).
4. **Fix the carousel typo** "How You Earn PIPs ( Pass It Up Pionts)" → "(Pass It Up Points)".
5. **Decision on orphaned routes** — wire Welcome/FeatureHighlights into a flow or delete; update guide H04/H05 to point at the live 5-slide carousel (spec drift).
6. **Enhance `qa:ocr` to emit per-line bounding boxes** (Vision returns them) — would collapse the 8-call native-window location task into one, and make any future native-button scan cheap.
7. **Make the carousel pagination dots accessible** (`accessible={false}` container) if tree-assertable dots are wanted; otherwise accept screenshot evidence.
8. **Lower-cost relaunch in dev** (e.g., Metro bundle cache / skip re-download) — environment-level, would cut ~10s off every relaunch.

---

## 7. Summary of what the run proved

- The live onboarding surface (Profile Setup capture + validation, carousel Skip/Get-Started, relaunch persistence, node assignment) is correct and fast (<3s per transition).
- Phase 24's no-tab-bar-after-Skip bug is fixed.
- Two copy/render defects surfaced (Welcome headline pollution on a dead route; carousel "Pionts" typo).
- H01's avatar-preview assertion is the only unverifiable piece — purely a toolset gap, now with a concrete fixture fix.
- H03/H04/H05 remain blocked for environment/spec reasons, each with a concrete unblock action.
