# QA Combined Verification — Tab-Bar Fix (Committed) + Discover/Waitlist Visual Confirmations

- **Run date:** 2026-08-18 (afternoon EDT)
- **Agent:** QA Test Agent (execution-only)
- **Device:** iPhone 17 Pro Max simulator (iOS 26.1), id `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`
- **App build:** dev build "Pass It Up!" (`com.sameralzubaidi.p2pmarketplace`) via Metro (port 8081)
- **Guide source:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (canonical)
- **Repo:** `p2p-kids-marketplace/` (mobapp), branch `main`, HEAD `4339c5e3`
- **Evidence dir:** `e2e-test-results/combined-verification-2026-08-18/evidence/`

---

## 1. TAB-BAR-AFTER-SKIP (CRITICAL) — CONFIRMED PASS (both paths)

### 1a. Independent git verification (done FIRST, not trusting the dev report)

| Check | Result |
|---|---|
| `git log --oneline` | Fix commit **`1b12086f`** present on `main`: "fix(mobile): wire Onboarding initialParams so PersistentTabBar mounts immediately after Skip/Get Started (no relaunch)" |
| HEAD is later than fix | Yes — HEAD `4339c5e3` ("test results and fixes … wave 1") is a descendant of `1b12086f` |
| Working tree clean for fix files | Yes — `git status --short` shows only `../.github/instructions/QA-Test-Agent.instructions.md` and `../p2p-kids-admin` (submodule) modified; **no uncommitted change to the mobile fix** |
| Fix present in current source | `AppNavigator.tsx` → `initialParams={{ onOnboardingFinished: () => setShouldShowOnboardingCarousel(false) }}`; `OnboardingScreen.tsx` `navigateToHome()` calls `route?.params?.onOnboardingFinished?.()`; **both** `handleSkip` and `handleComplete` route through `navigateToHome()` |
| Regression test exists | `src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx` asserts all 5 tabs mount without relaunch for Skip + Get Started |

**Verdict: the fix IS committed (commit `1b12086f`, on `main`, HEAD descendant, working tree clean, wiring present in source). Independently verified.**

### 1b. On-device: Skip path (AUTH-TC-H06 / EDU-004)

Fresh signup (dev-autofill Alice, unique contact `qa.alice.17870882212636458@kidsmarketplace.test`) → phone verify (OTP 123456 dev bypass) → Complete Your Profile (name "QA Tab Test 1", ZIP `06850` → "📍 Norwalk, CT") → onboarding carousel → tap **Skip** (`skip-button`).

**Immediately after tapping Skip, WITHOUT relaunch, the AX tree contained all 5 tab bar items:**
- `tab-home` (Home) — pt(16,866)
- `tab-discover` (Discover) — pt(102,866)
- `tab-sell` (Sell FAB) — pt(192,846)
- `tab-trades` (Trades) — pt(252,866)
- `tab-trade-basket` (Trade Basket) — pt(338,866)

Perceived load time (Skip tap → tabs present): **<2s** (labeled: simulator, wall-clock, ±polling-interval precision — not a formal performance profile).

### 1c. On-device: Get Started path (AUTH-TC-H06 / EDU-004)

Fresh signup (dev-autofill Bob, unique contact `qa.bob.17870885182481385@kidsmarketplace.test`) → phone verify → Complete Your Profile (name "QA Get Started 2", ZIP `06850` → Norwalk) → carousel → swiped to slide 5 (Safety First) → tap **Get Started** (`onboarding-get-started-button`).

**Immediately after tapping Get Started, WITHOUT relaunch, the AX tree contained all 5 tab bar items** (`tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-trade-basket`). Home screen rendered (composer bar, header). Perceived load time: **<2s**.

**No regression observed** — Home rendered correctly with the floating tab bar on both paths.

**→ Item 1: PASS (critical, both Skip and Get Started; no relaunch).** See evidence `A1-06`, `A1-11`.

---

## 2. DISCOVER RESULTS GRID — BOTTOM INSET — PASS (quick confirmation)

- **Note:** `test-buyer` currently has `node_id = NULL` on staging (seed's node-assignment fix not re-run) → Show All Nodes toggle does NOT render for test-buyer (verified via read-only SQL). Used fresh active-node account **QA Get Started 2** (Norwalk, node `…440001`) instead, which satisfies F06's active-node-user precondition.
- Toggle renders **Off** by default ("Show All Nodes off", count "66 results · near CT"); toggled **On** → "1205 results · all nodes".
- **Single-result search with Show All Nodes on** (F06 evidence scenario):
  - "Vintage Comic Book" → "1 result · all nodes". Card **title at pt 797–814, price at pt 824–842**; tab bar pill starts at ~pt 846. **Price fully visible above the tab bar — not occluded.**
  - "Test push notification anatutics" (other-node item) → "1 result · all nodes". **Other Node badge renders at pt y700–716** (verified by pixel analysis: "Other Node" text), ~130pt above the tab bar — **not occluded**.
- Source confirms the fix: `DiscoverScreen.tsx` `listContent` → `paddingBottom: componentSize.tabBarHeight + spacing.md` with comment "Bottom inset for the floating tab bar: without it the last row's lower content (badge/price) renders behind the tab bar in short result sets (e.g. single-item search with Show All Nodes on)".

**→ Item 2: PASS — the tab bar does not occlude the last row's badge/price in short result sets.** Evidence `A23-09`, `A23-12`, `A23-13`, `A23-14` (badge + tab-bar crop).

---

## 3. OTHER NODE BADGE — ACCESSIBILITY — PASS (quick confirmation)

- Badge component (`src/components/molecules/ItemCard/index.tsx`) has `testID={…-other-node-badge}` + `accessible` + `accessibilityRole="text"` + `accessibilityLabel="Other Node"`.
- On-device, with Show All Nodes on (1205-result set), the badge surfaces in the AX tree as **`search-result-<id>-other-node-badge`** with label **"Other Node"** (3 instances observed). Also confirmed in the single-result other-node search (`search-result-a26beba0-…-other-node-badge`).
- **→ Item 3: PASS — the badge surfaces correctly in the accessibility tree with `accessibilityLabel="Other Node"`.** No pixel-scanning needed to discover the badge in the AX tree.

---

## 4. WAITLIST MODAL BUTTONS — ACCESSIBILITY — PASS (quick confirmation)

Fresh signup (dev-autofill Charlie, unique contact `qa.charlie.17870887710762597@kidsmarketplace.test`) → phone verify → Complete Your Profile with inactive ZIP **`07999`** ("📍 Whippany, NJ") → submit.

- **"We're Coming Soon!" modal** (fallback node "Little Falls Central"): both buttons surface in the AX tree with identifiers:
  - `waitlist-continue-trading` ("Continue Trading") — pt(42,533)
  - `waitlist-join-button` ("Join Waitlist") — pt(227,533)
- Tapped Join Waitlist → **"Waitlist Confirmed" modal**: its button surfaces as **`waitlist-confirmed-got-it`** ("Got it") — pt(42,543).
- Tapped Got it → proceeds into onboarding carousel (waitlisted user keeps global-browse fallback; per AUTH-TC-F03/F04).

**→ Item 4: PASS — "Join Waitlist"/"Continue Trading" and "Waitlist Confirmed" dialog buttons all surface in the AX tree (locator-instrumentable), removing the need for pixel-scanning.** Evidence `A4-02`, `A4-03`.

---

## Batch summary

| Verification item | Verdict | Top finding |
|---|---|---|
| 1. Tab bar after Skip (critical) | **PASS** | Fix committed (`1b12086f`), 5 tabs mount immediately, no relaunch |
| 1. Tab bar after Get Started | **PASS** | Same — 5 tabs mount immediately, no relaunch |
| 2. Discover grid bottom inset | **PASS** | Price/badge of last row fully above tab bar in short result sets |
| 3. Other Node badge AX | **PASS** | `search-result-<id>-other-node-badge` / label "Other Node" surfaces |
| 4. Waitlist modal buttons AX | **PASS** | `waitlist-continue-trading`, `waitlist-join-button`, `waitlist-confirmed-got-it` all surface |

**Roll-up: 5 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

### Perceived load-time table (all labeled: simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen | Transition | Elapsed |
|---|---|---|
| Home (Skip path) | Skip tap → 5 tabs in tree | <2s |
| Home (Get Started path) | Get Started tap → 5 tabs in tree | <2s |
| Discover (Show All Nodes on) | Toggle tap → count 66→1205 | ~1s |
| Discover (search) | Query → "1 result · all nodes" | ~1s |

No ≥3s transitions flagged.

---

## 📋 QA Session Handoff

**Test Scope:** Combined verification: (1) Tab-bar-after-Skip/GetStarted — critical, (2) Discover grid bottom inset, (3) Other Node badge accessibility, (4) Waitlist modal button accessibility. Source guide: `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (AUTH-TC-H06/EDU-004, F02/F03/F04, F06, ACC-04).

**Design-System Compliance:** PARTIAL — no app-level design deviations found on the surfaces visited (tab bar, Home, Discover grid, onboarding carousel, waitlist modals all use the documented palette: primary green `#5DBB8E`, white surfaces, orange `#FF8C42` Sell FAB which is the app's intentional design). One DEV-environment artifact noted (not an app defect): a dev LogBox "Console Error" banner surfaced from the `phoneService.send-phone-otp` edge-function non-2xx (expected in dev; SMS provider unavailable) — non-blocking, cleared on relaunch.

**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal UX threshold (<3s); no transitions flagged (see load-time table).

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Landing screen: wording and layout match design-system requirements.
- CONFIRMED — Onboarding carousel (5 slides, Skip / Get Started): controls exposed with correct labels; layout matches design system.
- CONFIRMED — Home dashboard with PersistentTabBar: 5 tabs with labels; floating pill; FAB orange by design.
- CONFIRMED — Discover screen (search, Show All Nodes toggle, results grid): toggle state labels ("Show All Nodes off/on"), count line with "all nodes" suffix, Other Node badge; layout correct.
- CONFIRMED — "We're Coming Soon!" waitlist modal: two-button layout (Continue Trading secondary / Join Waitlist primary), copy clear ("We're not quite active in 07999 yet … connected you with traders in Little Falls Central").
- CONFIRMED — "Waitlist Confirmed" modal: single Got it CTA, copy clear.
- CONFIRMED — Logout confirm dialog (GlobalAlertProvider): Cancel/Logout two-button layout.
- NOTE (not a deviation) — Complete Setup button (`complete-setup-button`) and the Profile utility rows (Settings/Logout) do not surface as distinct elements in the AX tree (locator gap, pre-existing; see Critical Findings #3).

**Verdict Summary:** 5 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED

**Critical Findings:**
1. **(None blocking) — No app defects found.** The critical tab-bar fix is committed and verified on-device for BOTH Skip and Get Started without relaunch.
2. **(Setup gap, dev-side) — `test-buyer` is node-less on staging** (`profiles.node_id` NULL, zip NULL; verified via read-only SQL). The seed node-assignment fix (2026-08-18) has not been re-run, so `test-buyer` cannot exercise F06's Show-All-Nodes toggle (it renders only for active-node users). Worked around with the fresh active-node account "QA Get Started 2". **Fix:** dev team re-run `npm run seed:staging` so `test-buyer` gets a node assigned (restores the F06 persona).
3. **(Locator gap, pre-existing, not introduced this run) — ProfileScreen utility rows (App Settings, Logout) and the ProfileSetup Complete Setup button do not surface as distinct AX-tree elements** — must be reached by pixel-scan (Logout red text; Complete Setup green pill). Recommend `accessible`/`accessibilityRole`/`accessibilityLabel` on the `profile-logout` row and `complete-setup-button` (BP-53) as a separate dev task.
4. **(Dev-noise) — `send-phone-otp` edge function returns non-2xx in dev** (SMS provider unavailable) → dev LogBox banner + console.error. Expected in dev; the OTP dev-bypass handles it. Not an app-behavior failure.

**App State Left Behind:** 3 fresh throwaway accounts created (all staging): "QA Tab Test 1" (`qa.alice.…@kidsmarketplace.test`, Skip path, node 001 Norwalk, onboarding skipped), "QA Get Started 2" (`qa.bob.…@kidsmarketplace.test`, Get Started path, node 001 Norwalk, onboarding completed), "QA Waitlist 3" (`qa.charlie.…@kidsmarketplace.test`, ZIP 07999, waitlisted → fallback node 002 "Little Falls Central", onboarding skipped). No real user data touched. **App is currently logged in as QA Get Started 2 on the Discover screen (Show All Nodes on, "Test push notification anatutics" single result).** `test-buyer` was logged out via the `qa-logout` deep link (clean). No cleanup strictly required (throwaway accounts), but a staging re-seed would refresh the F06 persona.

**Why It Matters:** This run independently proves the previously-committed-but-lost tab-bar fix is now genuinely committed AND working on-device (both onboarding exits), closes the "tab bar hidden until relaunch" regression risk, and confirms the three lower-priority a11y/inset fixes (Discover bottom inset, Other Node badge AX, waitlist modal AX) are live in the committed build.

**How to Verify/Reproduce:** Evidence in `e2e-test-results/combined-verification-2026-08-18/evidence/`:
- Item 1: `A1-05` (carousel before Skip), `A1-06` (Home + 5 tabs after Skip, no relaunch), `A1-10` (slide 5 Get Started), `A1-11` (Home + 5 tabs after Get Started, no relaunch). `git log --oneline -20` shows `1b12086f`; `git show 1b12086f --stat`.
- Item 2: `A23-09`/`A23-12` (single-result grid; price pt 824–842 vs tab bar pt 846), `A23-13`/`A23-14` (Other Node badge at pt y700–716 above tab bar).
- Item 3: AX tree dumps showing `search-result-<id>-other-node-badge` label "Other Node".
- Item 4: `A4-02` (waitlist modal with `waitlist-continue-trading`/`waitlist-join-button` in tree), `A4-03` (Waitlist Confirmed with `waitlist-confirmed-got-it`).

**Known Gaps / Not Tested:**
- `test-buyer`'s F06 path (Show All Nodes toggle as test-buyer) — BLOCKED by node-less seed state (dev re-seed required); exercised with an equivalent active-node account instead.
- Android — out of scope (per QA agent §2).
- Admin portal — out of scope (Playwright path).

**What Needs To Be Fixed Next:**
1. **Fix: re-run `npm run seed:staging`** (dev team) so `test-buyer` gets `node_id` assigned — restores the documented F06 persona (currently node-less, hiding the Show All Nodes toggle).
2. **Fix: add `accessible` + `accessibilityRole` + `accessibilityLabel` to `profile-logout` row (ProfileScreen) and `complete-setup-button` (ProfileSetupScreen)** so they surface in the AX tree instead of requiring pixel-scanning (BP-53 exposure, pre-existing).
3. **Fix (optional, hygiene):** suppress/soften the `send-phone-otp` console.error in dev (dev-bypass path) to avoid the LogBox banner mid-flow — dev-only noise, not user-facing.

**UX Enhancement Ideas (optional, not defects):**
- On the Discover screen, the single-result card's price sat within ~4–20pt of the tab-bar pill top (visible but tight). Consider a slightly larger bottom inset (e.g. `tabBarHeight + lg/xl`) so short result sets have breathing room above the floating pill.
- On the onboarding carousel, Get Started on the final slide is right-aligned while Skip is left-aligned on every slide — consistent, but the final slide could also show a subtle progress hint (e.g. "5 of 5") to reinforce completion; nothing is wrong currently.

**Suggested Next Session:** Re-run the AUTH-TC-H06 + F06 pair after the dev team re-seeds staging (so `test-buyer` exercises the toggle natively), plus a regression pass of the Profile logout path once the `profile-logout` locator is added.

**Suggested to Improve Agent Rules:** Add a note to §5.9 (AX-tree staleness): the Discover results grid's item coordinates in the AX tree can be stale/logical (a badge reported at pt(28,852) rendered at pt(190,702)); treat the pixel-scan of the screenshot as authoritative for grid-card sub-elements, and prefer reporting the rendered pixel position over the tree coordinate when they disagree.
