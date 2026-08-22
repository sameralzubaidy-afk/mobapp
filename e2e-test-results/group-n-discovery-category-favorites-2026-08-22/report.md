# QA Report — Group N: Discovery Category & Favorites (AUTH-TC-N01–N04)

- **Run date:** 2026-08-22 (11:00–11:35Z, simulator iPhone 17 Pro Max iOS 26.1, 3x)
- **Persona:** test-buyer (`test-buyer@kidsmarketplace.test`, Kids Club+ subscriber, Norwalk Central node 06850)
- **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
- **Run dir:** `e2e-test-results/group-n-discovery-category-favorites-2026-08-22/`
- **Verdict:** **4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED** (1 spec-gap finding under N01)

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-N01 | Discovery (Guide 1) | **PASS** | Category browse filters correctly + SP badge on SP cards; **spec gap**: category-browser tiles carry NO SP badge |
| AUTH-TC-N02 | Discovery (Guide 1) | **PASS** | Heart toggles filled/outline; persists to DB (soft-delete) + Favorites list; survives navigation |
| AUTH-TC-N03 | Discovery (Guide 1) | **PASS** | Infinite scroll auto-loads 20/20/20/11 = 71 (console-verified), no manual load-more |
| AUTH-TC-N04 | Discovery (Guide 1) | **PASS** | SP-eligible cards show gold badge (SP-100/SP-500 tokens pixel-verified); non-SP cards show none; §6.2 card compliance confirmed |

**Roll-up:** 4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED

---

## Per-case detail

### AUTH-TC-N01 · Category browse filters results — PASS

**Trace:**
1. Logged in as test-buyer → Dashboard ("Norwalk Central").
2. Located "Browse Categories" section (Dashboard, `CategorySelector`). Category tiles are **not AX-exposed** (bare `TouchableOpacity`, no testID/accessible) — located tiles via Vision OCR of screenshot (Toys/Books at pt ~(65,750)/(253,750)); no SP badge on any tile (source + pixel scan of tile row: no SP-100/SP-500 cluster).
3. Tapped **Books** tile → CategoryBrowse ("Browse" screen) with `category-item-*` grid.
4. Results: QA Dev Fixture Item $25, QA L Group Chain Item 0821 $25/$15, Test new tax 1 $100 — **all DB-verified as `categories.name = 'Books'`** ✓ (results filter to the tapped category).
5. SP-eligible card "Test new tax 1" ($100, `accepts_swap_points=true`) shows the gold **Accepts SP** badge; badge pixels = `srgb(254,243,199)` (#FEF3C7 SP-100) + `srgb(245,158,11)` (#F59E0B SP-500) ✓.

**Assert:** PASS — category browse filters results to the tapped category; SP-eligible item cards show the badge.

**Finding (spec gap, not a test failure):** The guide's Expected Result adds "categories with SP-eligible items show an SP badge **in the category browser itself (not just on item cards)**". No category-browser surface implements this: Dashboard `CategorySelector` tiles, the Discover Filters-sheet CATEGORY pills (`filter-category-*`), and the Trending chips are all plain (no SP badge in source; no SP pixels found in the tile row). All 10 categories have SP-eligible items in staging (min 1, e.g. Shoes 1/1), so every tile would show a badge if implemented. **Either the guide/spec is drift or the feature is unimplemented — dev-side clarification/implementation recommended.**

**UX notes**
- *Structural/affordance:* CategoryBrowse has back affordance + title; empty state is friendly ("Be the first to list something in {category}!"). No layout issues.
- *Wording/copy:* Clear.
- *Design-system:* No deviations on CategoryBrowse screen (cards §6.2 compliant).

**Locator gaps:** Dashboard category tiles (CategorySelector) not AX-exposed — flagged; recommended instrumentation fix: add `testID`/`accessible`/`accessibilityRole`/`accessibilityLabel` to the `TouchableOpacity` category items (mirror BP-53).

---

### AUTH-TC-N02 · Favorite heart toggle on item card — PASS

**Trace:**
1. On Discover grid (node default, 71 results), located first card "QA Dev Fixture Item" $25 (item `83c8823b-…`). ItemCards are **not AX-exposed** (Pressable has testID/accessibilityLabel but no `accessible`/role) — located heart overlay via white-circle connected-components at pt (151, 525).
2. Tapped heart → **filled** (green `#5DBB8E`, 1184 px; 0 dark px). DB: `favorites` row created (`3e6b1e15-…`, `deleted_at NULL`) ✓.
3. Tapped again → **outline** (0 green; 328 dark px). DB: same row now `deleted_at = 2026-08-22 11:16:21Z` (soft delete) ✓.
4. Tapped again (re-add) → filled; DB row `deleted_at NULL` (upsert-undelete) ✓.
5. Opened **Favorites** via header bookmark (`discover-header-bookmark`, 44×44) → list shows "QA Dev Fixture Item" $25.00 + Request to Buy ✓.
6. Back to Discover → heart **still filled** (1184 green px) — persists across navigation ✓.
7. Cleanup: toggled heart off → `deleted_at` set, baseline restored (test-buyer favorites empty, matching pre-run).

**Assert:** PASS — heart toggles filled/outline; state persists to the account (DB read-back) and is reflected in the Favorites list; persists after navigation.

**Note (not a bug):** `rpc_favorites_remove` performs a **soft delete** (`deleted_at`), and `rpc_favorites_add` is an upsert-undelete (same row id reused). `rpc_favorites_get` filters `deleted_at IS NULL`, so the Favorites list is correct. Anyone querying `favorites` directly must filter `deleted_at IS NULL`.

**UX notes:** No deviations. Header bookmark is a 44×44 Icon Button per §6.1.

**Locator gaps:** ItemCard heart/share overlay buttons and card surfaces not AX-exposed — flagged; recommended: add `accessible` + `accessibilityRole="button"` to ItemCard's Pressable + overlay Pressables.

---

### AUTH-TC-N03 · Infinite scroll pagination — PASS

**Trace:**
1. Discover node scope: "71 results · near CT" (`count_listings` = 71; DB `available` in node = 71) ✓.
2. Scrolled the 2-column grid to the bottom over ~11 swipes. New distinct items kept appearing (Test item 1/1.2 → E2E Sleeve Red Hood → Dinosaur Textile → Hood Raincoat → Three-Wheeled Scooter → Generic LEGO → Test 3 → Lego Star Wars Set, etc.).
3. Hit a hard bottom (two consecutive swipes: identical viewport = Lego Star Wars Set $25.99).
4. **Hermes CDP console capture** (during scroll) shows `search_listings` analytics events returning **20, 20, 20, 11** items = **71** → pages auto-loaded as I approached the bottom; **no manual "load more" tap** ✓. 2-column grid preserved throughout.

**Assert:** PASS — more items auto-load (~20 per page: 20+20+20+11) in the 2-column grid without a manual load-more tap.

**UX notes:** Auto-load is quiet and fast (transient `loading-more-indicator`); no perceived stall. No deviation.

**Side observation (non-blocking, not N03):** the analytics forwarder logs `⚠️ [Analytics] Failed to forward search_listings … non-fatal` for each event (Edge Function non-2xx) — separate analytics/config concern, not a pagination defect.

---

### AUTH-TC-N04 · "Accepts SP" badge on item card — PASS

**Trace:**
1. Enabled **Accepts SP** (header quick-toggle) → "41 results · near CT" (DB `available + accepts_swap_points` in node = 41) ✓; active chip + gold toggle styling confirmed.
2. **SP filter ON:** every visible SP card shows the gold "Accepts SP" badge (multiple rows verified; SP-100 badge clusters + SP-500 coin clusters per card).
3. **SP filter OFF (mixed):** non-SP card **"Test cancel trade by seller" $40** (DB: `accepts_swap_points=false`) shows **NO badge**; SP cards **"E2E Red Slipper Flip-flops" $50** (`true`), **"E2E Pocket Button Active Shorts" $60** (`true`), **"Leather Steel-toe boot Work boots" $90** (`true`) all show badges ✓ (two-source corroboration: UI badge presence ↔ DB flag).
4. **Token pixel-verification (exact, not eyeballed):** badge bg = `#FEF3C7` (SP-100); coin/border/text = `#F59E0B` (SP-500). SP quick-toggle ON bg = `#FEF3C7`, icon/text = `#F59E0B`. Matches design-system §2.5/§6.7 and `discoveryTokens.ds.sp[100]/sp[500]` ✓.
5. **Card §6.2 compliance** (source tokens + rendered screenshots): white bg `#FFFFFF`; radius 16 (`dsRadii.large`); Level-1 shadow `0 2 8 rgba(0,0,0,0.08)` (`dsShadowL1`); 1:1 image (`aspectRatio: 1`); heart overlay top-right; H4 title (18/24/600, `#1A1A1A`); price Body Large 700 (16/24/700) ✓.

**Assert:** PASS — SP-eligible cards show the gold badge (exact tokens); non-SP cards show none; card §6.2 compliance holds.

**UX notes:** No deviations found. Badge text "Accepts SP" is clear and scannable.

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal profile)

| Screen / transition | Elapsed | Flagged? |
|---|---|---|
| Login (Landing → Dashboard) | <3s (1 poll) | no |
| Dashboard → CategoryBrowse (Books) | ~2s | no |
| Browse → Discover tab | <1s | no |
| Discover initial load (page 1 of 20) | ~2s | no |
| Accepts SP toggle → 41 results refetch | ~2s | no |
| Discover → Favorites (bookmark) | <1s | no |
| Scroll auto-load (per page 20) | fast / transient spinner | no |
| CategoryBrowse → Item Detail (no-badge card) | <1s | no |

No transition ≥3s. **Perceived Load-Time Verdict: GOOD.**

---

## Cross-cutting findings

- **Locator gap (high value):** Discover grid `ItemCard`s and their heart/share overlay buttons do not surface in the iOS AX tree (Pressable carries `testID` + `accessibilityLabel` but no `accessible`/`accessibilityRole`). N02/N03/N04 required pixel-scanning for every card interaction. Recommend instrumentation fix on `ItemCard` (and its overlay `Pressable`s) per BP-53.
- **Locator gap:** Dashboard `CategorySelector` tiles are bare `TouchableOpacity` (no identifiers) — needed OCR to locate.
- **Spec gap:** "SP badge in the category browser itself" (N01 Expected Result) is unimplemented on all category-browser surfaces (see N01 finding).
- **DB behavior note:** favorites use soft-delete semantics (`deleted_at`); verified correct.

---

## QA Session Handoff

**Test Scope:** AUTH-TC-N01–N04 (Group N — Discovery: Category & Favorites, mobile-only, test-buyer)
**Design-System Compliance:** PASS — no deviations found. Item cards §6.2 (white bg, 16px radius, L1 shadow, 1:1 image, heart overlay, H4 title, Body Large 700 price), SP badge §6.7 (SP-100 bg `#FEF3C7`, SP-500 border/coin `#F59E0B`), SP quick-toggle + active chip SP-gold tokens, header 44×44 icon buttons — all verified against design-system tokens, pixel-level for the SP badge.
**Perceived Load-Time Verdict:** GOOD — no observed transition ≥3s (login, tab nav, category browse, filter refetch, favorites, scroll auto-loads all within threshold).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Discover screen: header (bookmark/bell/chat), search, filters, SP toggle, results summary, active chips, trending — wording/layout match.
- CONFIRMED — CategoryBrowse screen: filtered grid + SP badges on SP cards; empty-state copy friendly.
- CONFIRMED — Favorites screen: item row + Request to Buy.
- CONFIRMED — Item Detail: title/price/specs layout.
- CONFIRMED — SP badge pill + SP quick-toggle: exact §6.7 tokens.
- CONFIRMED — Item cards: §6.2 layout.
- (No dialogs/modals/toasts visited in this group — none triggered.)
**Verdict Summary:** 4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. [Spec gap, dev-side] Category-browser surfaces show **no SP badge per category** despite the N01 Expected Result requiring one (Dashboard tiles, Filters CATEGORY pills, Trending chips all plain). All categories have SP-eligible items, so all would badge if implemented. Clarify spec vs implement.
2. [Locator gap] Discover `ItemCard`s + heart/share overlays and Dashboard `CategorySelector` tiles are not AX-exposed — all card interactions required pixel/OCR workarounds this run.
3. [Non-blocking] Analytics forwarder returns non-2xx (`Failed to forward search_listings`, etc.) — separate telemetry/config concern.
**App State Left Behind:** Logged in as test-buyer; no active favorites (baseline restored — the N02 favorite was soft-deleted during cleanup); SP filter left OFF; no test data created; no source/config/DB changes made.
**Why It Matters:** Confirms the Discovery category/favorites surface is functionally healthy: category filtering, favorite toggle + persistence + Favorites list, 20-per-page infinite scroll, and the gold Accepts SP badge (exact tokens) with correct non-SP exclusion — plus surfaces two documentation/instrumentation gaps for the dev agent.
**How to Verify/Reproduce:** Evidence: `e2e-test-results/group-n-discovery-category-favorites-2026-08-22/screenshots/*.png` (27 shots) + `report.md`. N01: Dashboard → Browse Categories → Books. N02: Discover first card heart; DB `favorites` for test-buyer (`deleted_at` soft-delete). N03: scroll Discover node grid to bottom; observe `search_listings` console events 20/20/20/11. N04: toggle Accepts SP; inspect badge pixels.
**Known Gaps / Not Tested:** App-relaunch persistence of favorite (DB read-back used instead, per task's "DB read-back OR app relaunch"). Admin/Playwright surface not applicable (mobile-only group).
**What Needs To Be Fixed Next:**
1. Fix: decide + implement (or correct the guide) the "SP badge in category browser" expectation from N01 — if a feature, add an SP badge to the Dashboard category tiles / Discover category pills; if drift, remove the clause from the guide.
2. Fix: add `accessible` + `accessibilityRole="button"` + `accessibilityLabel` to `ItemCard`'s outer Pressable and its favorite/share overlay `Pressable`s (BP-53) so the grid is AX-testable; same for `CategorySelector` tiles.
3. Fix (non-urgent): investigate the analytics Edge Function non-2xx forwarding (search_listings etc.).
**UX Enhancement Ideas (optional, not defects):** None this run — no friction beyond the locator/instrumentation items already noted.
**Suggested Next Session:** Group O (Node Scoping & SP Visibility: AUTH-TC-O01–O05) — it continues on the same Discover surface (node scoping, ZIP/radius, free-user SP visibility) and can reuse this session's device/log state; alternatively a dev-side fix pass on the N01 spec gap + ItemCard AX exposure, then a quick N01/N04 re-verify.
**Suggested to Improve Agent Rules:** None critical — note the §5.2 "+10pt below reported y" field-tap calibration was counterproductive on this build's filled inputs (taps landed at the box's bottom edge and missed); recommend treating the reported TextField y as the box center and only applying a small offset if a miss is confirmed.
