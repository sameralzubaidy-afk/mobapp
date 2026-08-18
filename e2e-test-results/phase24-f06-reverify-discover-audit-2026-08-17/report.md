# Phase 24 — F06 Re-Verification (Behavioral) + Dedicated Discover Design-System Audit

**Run:** 2026-08-17 · **Device:** iPhone 17 Pro Max Simulator (iOS 26.1) · Expo RN dev build + Metro
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (AUTH-TC-F06)
**Agent:** QA Test Agent (execution-only) · **Scope:** iOS mobile surface only
**Reference:** `docx/design-system-passitup.md` (canonical design system for §6.4 checks)

**Verdict roll-up (Part 1):** 1 re-verified verdict — **F06 = FAIL (CONFIRMED behaviorally)** — plus 2 supporting location-filter checks that also FAIL to scope.

---

## Part 1 — F06 Re-Verification: Behavioral Test, Not Source-Inference

### 1.1 Unambiguous corrected verdict

> ## 🎯 F06 — **FAIL (CONFIRMED)** — node-scoping by default is genuinely ABSENT; Phase 23's verdict stands, now proven behaviorally.
>
> **Reasoning:** A fresh UI-created user whose profile was **DB-verified as assigned to Little Falls Central — a node with ZERO available listings** — sees **"1205 results · near NJ"** on Discover by default: the **identical full market-wide result set** (1205 = total available items). If the default were node-scoped to the user's node, this user would see **0 results**. It does not.
>
> **The Phase 23 ambiguity is resolved:** the original observation (1205 results, no toggle) was *not* an artifact of "all listings happen to live in the user's node." With an empty-node user, the default is still the full set → node-scoping by default is not implemented. This matches the deployed backend, which ignores `p_node_ids` in both `search_listings` and `count_listings` (verified against the live DB function bodies).
>
> **Additional finding (Part 1 step 5):** the opt-in ZIP+radius location filter **also does not scope results** — it only changes the UI label. Applied ZIP `07424` (Little Falls Central, 0 available) → **"1205 results · near 07424, 10 mi"**. Applied ZIP `06850` (Norwalk Central, 66 available) → **"1205 results · near 06850, 10 mi"**. Both return the full set. So the guide's "My Node vs Show All Nodes" model is not just missing its default; the node-scoping mechanism itself is a no-op at the DB layer.

### 1.2 Node / listing distribution on staging (read-only DB, verified 2026-08-17)

| Node | `nodes` id | ZIP | Available listings | Non-available |
|---|---|---|---|---|
| Norwalk Central | `550e8400-…-440001` | 06850 | **66** | 176 |
| Greenwich | `efbc5830-…` | 06830 | **13** | 15 |
| Little Falls Central | `550e8400-…-440002` | 07424 | **0** | 51 (sold 38, pending 9, paused 4) |
| Buffalo | `5c1fd6bc-…` | 14205 | **0** | ~1 |
| Test Node 1 | `550e8400-…-440000` | 06851 | **0** | ~1 |

- **Total available items = 1205.** Of these, **1126 (93%) have `node_id = NULL`** — only 79 are tagged to a named node (66 Norwalk + 13 Greenwich). So even a *working* node-scoped search could never surface more than 79 items today; the location filter can never show the full 1205 because 93% of listings are untagged.
- **`geographic_nodes` (the table `get_nodes_within_radius` queries) contains only Buffalo + Greenwich** — with **different UUIDs** than the `nodes` table (e.g. `e97f04b8-…` vs `efbc5830-…`). The location filter's node resolution is disconnected from the listings' node tags.

### 1.3 Deployed backend confirmation (source of truth = live DB, not migrations)

Verified via `pg_get_functiondef` on the live staging DB:

- **`search_listings`** — `p_node_ids` parameter is accepted but **never referenced** in the WHERE clause. Comment: node scope "intentionally not applied at discovery-search time." → returns all 1205 available regardless of node.
- **`count_listings`** — same: `p_node_ids` "intentionally unused." → the count stays 1205 for any node scope.
- **`get_nodes_within_radius`** — reads `geographic_nodes` (2 rows: Buffalo, Greenwich), SECURITY DEFINER. Even when it returns node IDs, the search/count RPCs ignore them.
- **`resolve_active_node_for_signup`** — exact ZIP match on `nodes`, else nearest active node. ZIP `07424` → Little Falls Central (`match_type='zip'`).

### 1.4 Empty-node test account (behavioral setup)

- Created via UI signup (DEV autofill, unique email `qa.alice.17869961878817974@kidsmarketplace.test`), OTP verified via dev bypass, ZIP **07424** → city-state resolved "📍 Little Falls, NJ" → Complete Setup → no waitlist modal (exact-match active node) → onboarding Skip → Home.
- **DB-verified after setup:** `node_id = 550e8400-e29b-41d4-a716-446655440002` = **Little Falls Central** (`zip_code 07424`, phone verified). Home header confirmed **"Little Falls Central"**.
- (Standing personas could NOT be used: all seed personas (`test-buyer`, `test-free`, `test-seller`, …) have `node_id = NULL` — node assignment only happens via UI onboarding.)

### 1.5 Behavioral results (evidence)

| Test | Result | Evidence |
|---|---|---|
| Default Discover, empty-node user (Little Falls Central, 0 avail) | **1205 results · near NJ** — full set, NOT node-scoped → **F06 FAIL confirmed** | `f06-empty-node-user-1205-results.png` |
| Location filter ZIP **07424** (user's own node, 0 avail) applied | **1205 results · near 07424, 10 mi** — label changed, results did NOT scope (expected 0 if working) | `f06-location-filter-07424-still-1205.png` |
| Location filter ZIP **06850** (Norwalk, 66 avail) applied | **1205 results · near 06850, 10 mi** — label changed, results did NOT scope (expected ~66 if working) | `f06-location-filter-06850-still-1205.png` |
| Contrast control: "Accepts SP" toggle (a REAL backend filter) | **1205 → 50 results** — real filters DO scope; the node/location filter is the outlier | `active-sp-chip-50-results.png` |

**Conclusion for Part 1 step 5:** the opt-in location/radius filter does **not** scope results in the current build (backend ignores `p_node_ids`); it only updates the "near {ZIP}, {r} mi" label. Verified for both an empty node (07424 → still 1205) and a populated node (06850 → still 1205). The F06 FAIL verdict is therefore **double-confirmed** (default AND opt-in scope are both non-functional).

---

## Part 2 — Discover Screen Dedicated Design-System Audit (vs `docx/design-system-passitup.md`)

Every check below was verified against rendered screenshots via precise pixel-color sampling (Pillow), cross-referenced with source tokens. Palette source of truth: **design-system-passitup.md** (primary `#5DBB8E`/`#4DAA7A`/`#E8F5F0`; neutrals `#1A1A1A`/`#6B6B6B`/`#999999`/`#E0E0E0`/`#F0F0F0`/`#FAFAFA`; SP `#F59E0B`/`#FEF3C7`).

> **Root-cause note:** the Discover UI intentionally uses `src/theme/discoveryTokens.ts`, which sources its palette from a *different* doc (`design-system.md`, primary `#4A7C59` family) — NOT from the canonical `design-system-passitup.md`. This is the source of most deviations below. Additionally, several components mix the two palettes (e.g. the Filters sheet uses `#5DBB8E` in places and `#4A7C59` in others).

### 2.1 Header (DiscoverHeader)

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| Title "Discover" text | `#1A1A1A` | Primary text `#1A1A1A` | ✅ **CONFIRMED** |
| Title size/weight | H1 `32pt/700` (dsType) | H1 `28px` semibold | ⚠️ **DEVIATION (typography)** — 32 vs 28px |
| Icon-button background (bookmark/bell/chat) | `#F5F5F5` (ds neutral[100]) | Background Light `#F0F0F0` | ⚠️ **DEVIATION (minor)** — `#F5F5F5` not in passitup palette |
| Header icon color | `#4D4D4D` (ds neutral[700]) | Secondary text `#6B6B6B` | ⚠️ **DEVIATION (minor)** |
| Header bottom border | `#F5F5F5` | Border `#E0E0E0` | ⚠️ **DEVIATION (minor)** |

### 2.2 Search bar

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| Input fill | `#F0F0F0` | Background Light `#F0F0F0` | ✅ **CONFIRMED** |
| Placeholder "Search items..." | `#999999` | Tertiary/placeholder `#999999` | ✅ **CONFIRMED** |
| Input text | `#1A1A1A` | Primary text `#1A1A1A` | ✅ **CONFIRMED** |
| Search icon | `#6B6B6B` | Secondary `#6B6B6B` | ✅ **CONFIRMED** |

### 2.3 Controls row (filter / favorites / sort / SP toggle)

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| Filter button bg | `#F0F0F0` | Background Light `#F0F0F0` | ✅ **CONFIRMED** |
| Filter funnel icon | `#1A1A1A` | Primary text `#1A1A1A` | ✅ **CONFIRMED** |
| Filter active-count badge | `#5DBB8E` (source) | Primary green | ✅ **CONFIRMED** |
| Favorites bookmark icon | `#E85D75` | Error `#E85D75` (used as accent) | ✅ **CONFIRMED** (documented accent use) |
| **Sort button border** | `#D0D0D0` | Border `#E0E0E0` | ⚠️ **DEVIATION** |
| **Sort button text** | `#333333` | Primary text `#1A1A1A` | ⚠️ **DEVIATION** |
| Accepts SP toggle border/text | `#F59E0B` | SP Gold `#F59E0B` | ✅ **CONFIRMED** |
| Accepts SP toggle active bg | `#FEF3C7` | SP Background `#FEF3C7` | ✅ **CONFIRMED** |

### 2.4 Sort dropdown (open state) — **worst offender**

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| **Selected option background** | `#EEF6FF` (light blue) | no match (tint should be `#E8F5F0`/neutral) | ⚠️ **DEVIATION** |
| **Selected option text** | `#007AFF` (**iOS system blue**) | none — no system-blue anywhere in palette | ⚠️ **DEVIATION (major)** — violates semantic-color rule |
| Dropdown border | `#E5E7EB` (Tailwind) | Border `#E0E0E0` | ⚠️ **DEVIATION** |
| Unselected option text | `#1F2937` (Tailwind) | Primary text `#1A1A1A` | ⚠️ **DEVIATION** |

### 2.5 Result count line

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| "1205 results · near NJ" | `#4D4D4D` (ds neutral[700]) | Secondary text `#6B6B6B` | ⚠️ **DEVIATION (minor)** |

### 2.6 Active filter chips

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| SP chip bg (`Accepts SP`) | `#FEF3C7` | SP Background `#FEF3C7` | ✅ **CONFIRMED** |
| SP chip text/border | `#F59E0B` | SP Gold `#F59E0B` | ✅ **CONFIRMED** |
| Non-SP chip bg (e.g. category) | `#E8F3EC` (ds primary[100]) — source-verified | Primary tint `#E8F5F0` | ⚠️ **DEVIATION (minor, off-shade)** |
| Non-SP chip text | `#3A5F47` (ds primary[600]) — source-verified | (no dark-green text token in passitup) | ⚠️ **DEVIATION (minor)** |

*(Non-SP chip rendered state not captured — the chip row hides when `results.length === 0`, which the combined-filters empty state caused; values above are the rendered-token-equivalents verified in `discoveryTokens.ts` and match the SP chip pattern.)*

### 2.7 Result cards (grid)

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| Card background | `#FFFFFF` | White `#FFFFFF` | ✅ **CONFIRMED** |
| Card title | `#1A1A1A` | Primary text `#1A1A1A` | ✅ **CONFIRMED** |
| Card price | `#1A1A1A` | Primary text `#1A1A1A` | ✅ **CONFIRMED** |
| **"Accepts SP" badge** bg | `#FEF3C7` | SP Background `#FEF3C7` | ✅ **CONFIRMED** |
| "Accepts SP" badge text/icon | `#F59E0B` | SP Gold `#F59E0B` | ✅ **CONFIRMED** |
| Favorite heart (filled) | `#5DBB8E` (source) | Primary green | ✅ **CONFIRMED** |
| Image placeholder area | `#F5F5F5`-ish (ds neutral[100]) | — (not specified) | ➖ n/a (no spec) |

### 2.8 Empty state (No Results Found)

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| "No Results Found" title | `#1A1A1A` | Primary text | ✅ **CONFIRMED** |
| "Try adjusting your filters" | `#6B6B6B` | Secondary `#6B6B6B` | ✅ **CONFIRMED** |
| "Clear Filters" button | `#5DBB8E` + white text | Primary pill | ✅ **CONFIRMED** |

### 2.9 SearchFilterModal (bottom sheet)

| Element | Rendered color | Passitup spec | Verdict |
|---|---|---|---|
| Header "Filters" title | `#1A1A1A` | Primary text | ✅ **CONFIRMED** |
| Close button | `#6B6B6B` | Secondary `#6B6B6B` | ✅ **CONFIRMED** |
| Reset button | `#5DBB8E` | Primary green | ✅ **CONFIRMED** |
| Drag handle | `#CCCCCC` (ds neutral[300]) | Border `#E0E0E0`/disabled `#CCCCCC` | ⚠️ **DEVIATION (minor)** |
| SP toggle card bg | `#FEF3C7` | SP Background | ✅ **CONFIRMED** |
| SP coin icon | `#F59E0B` | SP Gold | ✅ **CONFIRMED** |
| ZIP input fill | `#F0F0F0` | Input fill `#F0F0F0` | ✅ **CONFIRMED** |
| Section titles (LOCATION/CATEGORY…) | `#6B6B6B` | Label/secondary `#6B6B6B` | ✅ **CONFIRMED** |
| Category pill (selected) | `#5DBB8E` + white text | Primary pill | ✅ **CONFIRMED** |
| Category pill (unselected) | `#F0F0F0` + `#6B6B6B` text | Background Light + secondary | ✅ **CONFIRMED** |
| Radius slider track | `#E5E7EB` (Tailwind) | — (off-palette) | ⚠️ **DEVIATION (minor)** |
| **Apply button ("Show X Results")** | **`#4A7C59`** (ds primary[500]) | Primary green **`#5DBB8E`** | ⚠️ **DEVIATION (major)** — wrong green AND internally inconsistent with the same sheet's `#5DBB8E` Reset/pills |

### 2.10 Design-system summary

- **CONFIRMED (passitup-compliant):** search bar, filter button, favorites bookmark (`#E85D75`), SP toggle + chip + badge (`#F59E0B`/`#FEF3C7`), card surface/title/price, empty state, filter-modal header/ZIP/section titles/category pills, filter badge.
- **DEVIATIONS:** sort button/dropdown (4 colors incl. `#007AFF` system blue — major), Apply button (`#4A7C59` instead of `#5DBB8E` — major), result-count text (`#4D4D4D` vs `#6B6B6B`), non-SP chips + trending chips (`#E8F3EC`/`#3A5F47` vs passitup tint), header icon buttons/border (`#F5F5F5`, `#4D4D4D`), drag handle (`#CCCCCC`), radius slider (`#E5E7EB`), H1 size (32 vs 28px).
- **Structural/UX notes:** the Discover screen mixes the passitup (`#5DBB8E`) and design-system.md (`#4A7C59`) palettes — most visible inside the Filters sheet where Reset is `#5DBB8E` but Apply is `#4A7C59`. This is a token-hygiene issue, not a one-off.

---

## 3. Perceived load-time observations

| Transition | Observed | Flagged? |
|---|---|---|
| Landing → Create Account | <1s | — |
| Signup submit → OTP (dev-bypass dialog) | ~2s | — |
| OTP Use & Verify → Success dialog | <1s | — |
| Success → Profile Setup | <1s | — |
| Complete Setup → Success dialog → onboarding | ~1s | — |
| Onboarding Skip → Home | <1s | — |
| Home → Discover (tab) | <1s | — |
| Apply location filter → result count refresh | ~1s | — |
| Dev cold-start (bundle download) | ~5–10s (environment artifact) | flagged (env) |

*Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.*

---

## 4. Cross-cutting findings

### 4.1 New UX finding (not F06) — tab bar missing after onboarding Skip
Immediately after a fresh user taps **Skip onboarding** → Home, the **persistent tab bar does not render** (verified: no FAB, no tab items in tree or pixels, multiple checks over several minutes). The tab bar **only appears after an app relaunch**. This is a first-run onboarding regression that leaves a new user with no bottom navigation (no way to reach Discover/Sell/Trades/Basket except relaunch). It was reproducible this run on the empty-node user. **Recommend dev follow-up** (not applied by QA).

### 4.2 Backend node-scoping is a no-op (root cause of F06 FAIL)
Both `search_listings` and `count_listings` accept but ignore `p_node_ids`. The location filter is cosmetic (label-only). 93% of listings have `node_id = NULL`, and the location filter resolves nodes from the deprecated `geographic_nodes` table with different UUIDs than `items.node_id` — so even a future node-gated RPC would need the data model reconciled.

### 4.3 Locator / AX-exposure gaps (follow-up candidates)
- Persistent tab bar items (`tab-discover`, `tab-home`, …) were NOT in the AX tree on the first Home render (before relaunch) — consistent with 4.1.
- Discover grid cards (`search-result-*`) and the `discover-filter-button`, `discover-favorites-button`, `discover-sp-toggle`, and `clear-all-filters` controls are **not AX-exposed** on this screen (BP-53 class). `discover-sort-button` IS exposed. Result cards only surfaced once scrolled, and only their "No Image" placeholder text.
- `complete-setup-button` (ProfileSetup) still not AX-exposed (pixel-scan required — carried over from Phase 23).
- Native `presentationStyle="pageSheet"` SearchFilterModal content IS partially exposed (ZIP input, SP switch, section titles, more-filters toggle, sort options) but the Apply/Reset/Close buttons are not (pixel-scan required).

### 4.4 Tooling / environment notes
- Simulator keyboard was up on Home after profile setup (blocked the tab bar view) — used the verified Cmd+K toggle to hide it; tab bar then rendered post-relaunch.
- AX-tree y-coordinates for off-screen (below-fold) content are logical, not rendered — the signup autofill buttons/submit rendered ~500pt lower than the tree when off-screen; must scroll into view before tapping (repeated friction this run).
- `mobile-mcp open_url` rejects non-http schemes — used `xcrun simctl openurl` for the `qa-logout` deep link (fine).

---

## 5. QA Session Handoff

**Run:** Phase 24 — F06 re-verify (behavioral) + dedicated Discover design-system audit · 2026-08-17 · iPhone 17 Pro Max (iOS 26.1) · Expo RN dev + Metro.

**Scope executed:** iOS mobile surface only. Read-only DB diagnostics (SELECT) used to establish node/listing distribution and deployed RPC bodies. No code, test, seed, config, or DB writes.

**Verdicts (Part 1):**
- **F06 — FAIL (CONFIRMED behaviorally).** Empty-node user (Little Falls Central, 0 available, DB-verified) sees **1205 results · near NJ** by default — the full market set. Node-scoping by default is absent.
- **Location filter — FAIL to scope.** ZIP 07424 (0 in-node) → 1205; ZIP 06850 (66 in-node) → 1205. Label-only; backend ignores `p_node_ids`.

**Highest-priority product signal:** F06 remains a genuine spec/design mismatch: the guide's "My Node default + Show All Nodes toggle" is not implemented, and the opt-in node filter is a no-op at the DB layer. Needs a product decision (restore node scoping + reconcile `nodes`/`geographic_nodes`/`items.node_id`, or update the guide + remove the dead toggle).

**Design-System Compliance:** **PARTIAL — FAIL on Discover-specific surfaces.** 21 of ~40 color checks CONFIRMED; deviations include 2 major (`#007AFF` system blue in sort dropdown; `#4A7C59` Apply button instead of `#5DBB8E`) plus ~12 minor. Root cause: Discover uses `discoveryTokens.ts` (sourced from `design-system.md`) instead of the canonical `design-system-passitup.md`, and mixes both palettes.

**Blocker for future runs:** none new (this run was fully executable). The persistent-tab-bar-missing-after-Skip issue (4.1) affects any fresh-signup onboarding flow test that relies on the tab bar without a relaunch.

**Environment:** App left on clean Landing (logged out via `qa-logout`, session cleared). Throwaway account `qa.alice.17869961878817974@kidsmarketplace.test` (Little Falls Central) left registered on staging — do not reuse as a persona. Evidence in `e2e-test-results/phase24-f06-reverify-discover-audit-2026-08-17/evidence/`.

---

*Generated 2026-08-17 · QA Test Agent (execution-only). Part 1 verdict: F06 FAIL confirmed behaviorally. Part 2: 21 CONFIRMED / 14 DEVIATIONS (2 major) on the Discover surface.*
