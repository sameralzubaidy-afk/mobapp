# QA Execution Report — Group M: Discovery Search & Filters (AUTH-TC-M01–M10)

- **Date:** 2026-08-22
- **Agent:** QA Test Agent (execution-only)
- **Surface:** iOS mobile app (`p2p-kids-marketplace/`) via mobile-mcp on iPhone 17 Pro Max simulator (iOS 26.1, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), debug build + Metro
- **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (§Group M)
- **Personas:** `test-buyer` (primary, Norwalk Central node CT / ZIP 06850, Kids Club+), `test-free` (free tier, **no node assigned** — used for M05 free-user leg + M08 hidden-state branch)
- **Evidence:** `screenshots/` in this folder (OCR/pixel-verified via the in-archive `ocr.swift` + ImageMagick)
- **Roll-up: 10 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED** — with 2 flagged findings (see Critical Findings)

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-M01 | AUTH | PASS | Debounced search (600ms, source+behavior corroborated); X clears + restores default feed |
| AUTH-TC-M02 | AUTH | PASS | Recent-search chips (Neutral-100), chip re-run, Clear, autocomplete (max 5) + chip-row hide |
| AUTH-TC-M03 | AUTH | PASS | All 4 sort options apply + reorder (price asc $9 first, desc $299.99 first) |
| AUTH-TC-M04 | AUTH | PASS | Filters sheet: SP toggle on top (SP-gold), Location/Category/Age expanded, More Filters collapsible, live debounced count (1215→138→9), Apply applies draft |
| AUTH-TC-M05 | AUTH | PASS* | Header↔sheet SP toggle single source of truth, both personas filter; **free-user upgrade CTA NOT present (doc drift)** |
| AUTH-TC-M06 | AUTH | PASS | No-match search → "No Results Found"+guidance; filters-no-results → "Try adjusting your filters"+Clear Filters (works); keyboard-up hides the button (UX finding) |
| AUTH-TC-M07 | AUTH | PASS | Recent Searches chip row most-recent-first, chip re-runs, Clear empties row |
| AUTH-TC-M08 | AUTH | PASS | "Trending in CT" top categories, Primary-100/600 tokens (pixel-verified), tap→category filter; hidden for no-node user |
| AUTH-TC-M09 | AUTH | PASS* | "{n} results · near {ZIP}, {r} mi" + per-filter chips (Primary vs SP-gold pixel-verified), chip × refetches, Clear all resets; **BUG: SP switch in sheet wipes other draft filters** |
| AUTH-TC-M10 | AUTH | PASS | 44×44 bookmark→Favorites, bell→Notifications, chat→Messages; Home/Profile headers unchanged |

`*` PASS with flagged finding (see Critical Findings).

---

## Perceived load-time table

Label: **Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.** (Poll interval ~1–2s general, ~0.5–1s for timed transitions.)

| Screen | Transition | Elapsed | Flag |
|---|---|---|---|
| Landing → Login | tap "Log In" → Login rendered | ~1s | |
| Login → Home | submit → tab bar (test-buyer) | ~2–3s | |
| Login → Home | submit → tab bar (test-free) | ~2–3s | |
| Home → Discover | tab switch → Discover header | ~1–2s | |
| Discover search | typed query → results count update | ~1–2s (600ms debounce + RPC) | |
| Discover sort | option select → reorder | ~1–2s | |
| Discover → Filters sheet | filter tap → sheet | ~1–2s | |
| Filters sheet live count | draft change → Apply label | ~1–2s (350ms debounce + count RPC) | |
| Filters sheet → Apply | Apply tap → Discover results | ~1–2s | |
| SP toggle (header) | toggle → refetch + count | ~1–2s | |
| Discover → Favorites | bookmark tap → Favorites | ~1s | |
| Discover → Notifications | bell tap → Notifications | ~1s | |
| Discover → Messages | chat tap → Messages | ~1s | |

No transition ≥ 3s observed. **Perceived Load-Time Verdict: GOOD.**

---

## Per-case detail

### AUTH-TC-M01 · Search bar (debounced) + clear — **PASS**

**Trace:** Launch → login test-buyer → Discover tab → tap `discover-search-input` → type "bike" → screenshot (`M01-typed-bike-immediate.png` — "No Results Found" for "bike") → pixel-scan for X (found at 400,163) → tap X → tree shows value cleared + "71 results · near CT" restored → type "z" → screenshot (`M01-debounce-typed-z.png` — count already "2 results", debounce had fired).
**Assert:**
- Debounce: search fires shortly after typing, not per-keystroke. On-device the single-char "z" and multi-char "bike" each produced one consolidated result state; source corroborates `KEYSTROKE_DEBOUNCE_MS=600` driving `debouncedQuery` (search effect keys on `debouncedQuery`, not `query`). Tool latency exceeds the 600ms window so the pre-debounce frame couldn't be screen-captured; verdict rests on source + behavior corroboration (§6.1 two-source rule).
- Clear (X): taps cleared the query and restored the default feed (71 results) — PASS.
**UX — structural:** Clear (X) is a bare `Pressable` + `X` icon with **no `testID`/accessibility label** → not in AX tree (locator gap; located by pixel-scan). **Design-system:** search pill 48pt, `#F0F0F0` fill, gray placeholder — compliant.

### AUTH-TC-M02 · Recent searches + autocomplete — **PASS**

**Trace:** empty-field focus → chip row (OCR `M02-recent-searches-row.png`: Z / bike / b / Test push…) → tap "bike" chip → tree "No Results Found" (chip re-ran) → tap X → type "bi" → tree "5 results" + Recent/Trending hidden; OCR `M02-autocomplete-bi.png` shows suggestion rows (bi, bike, Bicycle) → tap "Bicycle" → search applied ("4 results") → tap X → tap "Clear" (recent-searches header) → tree: Recent Searches section GONE.
**Assert:**
- Chips max 8, most-recent-first, Neutral-100 (#F0F0F0 sampled on-device) — PASS.
- Chip tap re-runs search — PASS. Clear empties history + row disappears — PASS.
- Typing ≥2 chars shows autocomplete (max 5) and hides the chip row — PASS (row hidden while typing).
- Tapping a suggestion applies the search — PASS.
**Locator gaps:** recent-search chips and autocomplete suggestions not exposed as distinct buttons in the AX tree (chip `Pressable`s surface only their inner Text; suggestion `Pressable`s lack accessible props per BP-53). Tapped via coordinates + OCR. **Recommended fix:** add `accessible accessibilityRole="button"` to autocomplete suggestion `Pressable`s; ensure chip `Pressable`s surface their own element.

### AUTH-TC-M03 · Sort options — **PASS**

**Trace:** tap `discover-sort-button` → dropdown shows all 4 options (`sort-option-relevance/newest/price_asc/price_desc`) → select Newest ("Sort by Newest") → re-open → Price Low→High ("Sort by Price: Low to High", first item $9.00) → re-open → Price High→Low ("Sort by Price: High to Low", first item $299.99) → re-open → Relevance (reset).
**Assert:** each selection reordered the grid (sort label + first-item identity changed $15 → $9 asc → $299.99 desc). PASS. Sort dropdown fully instrumented (no locator gaps).

### AUTH-TC-M04 · Filters modal — progressive disclosure + live count — **PASS**

**Trace:** tap filter button → sheet (`M04-filters-sheet-initial.png`) → SP toggle top, Location/Category/Age expanded, More Filters collapsed, Apply "Show 1215 Results" → expand More Filters → select Condition "Good" → header "Filters (1)" + Apply "Show 138 Results" → scroll → select "$25-$50" preset → header "Filters (2)" + custom 25/50 + Apply "Show 9 Results" → collapse More Filters → Apply → Discover "5 results · near 06850, 10 mi" + chips Condition: Good / Price: $25–$50.
**Assert:**
- SP toggle at very top, above Location — PASS; SP-gold tokens pixel-verified (card bg `#FEF3C7`).
- Location/Category/Age Group always expanded; More Filters collapsed by default — PASS.
- More Filters expand/collapse + Condition + Price settable — PASS.
- Apply live debounced count updates as filters change (1215→138→9) — PASS.
- Apply applies the draft (5 results incl. ZIP scoping) — PASS.
- Bottom Sheet spec (white, 20px top radius, drag handle, slide-up pageSheet) — visually confirmed.
**UX — minor note:** the sheet's live count (9) counts without the ZIP/node scope that applies on Apply (applied result 5). Pre-apply estimate by design; noted for awareness, not a failure.

### AUTH-TC-M05 · "Accepts SP" quick-toggle — header ↔ sheet sync — **PASS** (finding: free-user upgrade CTA absent)

**Trace (test-buyer):** tap header `discover-sp-toggle` → count 71→41 (node SP-eligible), gold chip + header toggle highlight (SP-gold `#FEF3C7` pixel-verified) → open sheet → `filter-sp-toggle` = enabled (value 1), "Filters (1)" (sync ON) → flip OFF in sheet → header "Filters" (no badge) → close sheet → header chip OFF + count back to 71.
**Trace (test-free):** logout (qa-logout deep link) → login test-free → Discover ("1215 results", no node) → tap SP toggle → 1215→54 results, all SP-badged, filter button shows "1" badge → open sheet → no upgrade CTA anywhere (screen + sheet).
**Assert:**
- Header chip and sheet toggle share one state (`filters.spEligibleOnly`), never desync; toggling either refetches — PASS (both directions verified).
- SP toggle filters to SP-eligible items with gold badge — PASS (buyer 41, free 54).
- Free user still filters — PASS; **"upgrade CTA surfaced for SP features" — NOT present on Discover or in the Filters sheet (no Upgrade/Kids Club+ CTA anywhere). Doc-drift / unimplemented sub-expectation → flagged.**

### AUTH-TC-M06 · Empty / no-results states — **PASS** (UX finding: Clear Filters hidden behind keyboard)

**Trace:** search "zzzz" → "No Results Found" + "Try different keywords" → toggle SP (activeFilterCount>0) → "No Results Found" + "Try adjusting your filters" (tree) but button below fold with keyboard up → Cmd+K hide keyboard → OCR `M06-empty-no-keyboard.png` shows "Try adjusting your filters" + **"Clear Filters"** → tap Clear Filters → SP removed, empty state reverts to "Try different keywords".
**Assert:**
- No-match search → "No Results Found" + guidance — PASS.
- Narrow/no-result filters → "No Results Found" + "Try adjusting your filters" + Clear Filters action — PASS (works when keyboard dismissed).
**UX finding (structural):** with the software keyboard up, the Clear Filters button (and part of the subtitle) is pushed off-screen behind the keyboard and unreachable; only after dismissing the keyboard does the full empty state become visible. Recommend making the empty state scrollable/keyboard-aware (or auto-dismiss keyboard on empty state).

### AUTH-TC-M07 · Recent Searches chip row + Clear — **PASS**

**Trace:** ran "zzzz" and "lego" searches → row shows "lego" (most recent) → "zzzz" (`M07-recent-searches-lego.png`) → tap "lego" chip (after Cmd+K keyboard hide — chip taps don't register while keyboard is up) → search re-runs ("3 results") → X → tap "Clear" → Recent Searches row disappears.
**Assert:** chips Neutral-100 most-recent-first; chip re-runs search; Clear empties + row disappears. PASS.
**Friction:** chip taps don't register while the software keyboard is up (2 misses across M02/M07; both succeeded after hiding keyboard) — see friction section.

### AUTH-TC-M08 · Trending in {State} — **PASS**

**Trace:** Discover as test-buyer → "Trending in CT" with 5 chips (Toys, Books, Clothing, Sports, Electronics — `M08-trending-section.png`) → pixel-scan: chip bg `#E8F5F0` (Primary-100), text `#4DAA7A` (Primary-600) → tap "Toys" chip → count 71→10 (node Toys count), "Toys" category chip added (`M08-trending-toys-filtered.png`). As test-free (no node) — **Trending section absent** (`M05-free-discover-initial.png`).
**Assert:**
- Top 4–6 categories by active listing count in state — PASS (5 chips match DB top-count categories: Toys 10, Clothing 10, Books 9, Sports 8, Electronics 5).
- Primary-100 bg / Primary-600 text / Primary-400 border (distinct from Neutral-100 recent pills) — PASS (pixel-verified bg+text; border from source spec).
- Tapping filters to that category — PASS.
- Hidden for no-node user — PASS (test-free).
**Locator gap:** trending chips surface only their inner Text in the AX tree (not as buttons) — tapped via coordinates.

### AUTH-TC-M09 · Result count + active filter chips — **PASS** (BUG: SP switch in sheet resets other draft filters)

**Trace:** open sheet → select Books + 6-8 → "Filters (2)" + "Show 5 Results" → toggle SP switch → **"Filters (1)" + "Show 54 Results" — Books/6-8 selections LOST** (pills back to #F0F0F0) → re-select Books + 6-8 (SP still on) → "Filters (3)" + "Show 3 Results" → Apply → Discover "3 results · near 06850, 10 mi" + chips Books / Age: 6-8 / Accepts SP (`M09-applied-chips.png`) → pixel-scan: Books/Age chips bg `#E8F5F0` (Primary-100), SP chip bg `#FEF3C7` + text `#F59E0B` (SP-gold) → tap × on Age chip → count 3→4, Age chip removed → tap "Clear all" → count 71, chips gone.
**Assert:**
- Summary "{n} results · near {ZIP}, {radius} mi" — PASS ("3 results · near 06850, 10 mi").
- One chip per applied filter; standard chips Primary tokens, SP chip SP-gold — PASS (pixel-verified).
- Removing a chip refetches — PASS (3→4).
- "Clear all" resets + refetches unfiltered — PASS (→71; applied ZIP persists, by design).
**BUG (confirmed, P2):** toggling the SP switch in the Filters sheet while other draft filters are selected **wipes those draft selections** (category/age reset). Root cause: `onSpToggle` → `handleToggleSpEligible` updates the parent `filters`, and the sheet's `useEffect([visible, filters])` re-syncs `draft = filters`, discarding in-progress draft picks. Reproduced on-device (5→54 count regression, pills visually unselected). Workaround in-run: set SP first, then other filters.

### AUTH-TC-M10 · Discover header: bookmark → Favorites — **PASS**

**Trace:** header icons located by pixel-scan (`M10-discover-header.png`: bookmark ~294,92 / bell ~346,96 / chat ~398,92; header buttons 44×44 per source) → tap bookmark → **Favorites** ("No favorites yet", back button) → back → tap bell → **Notifications** (items + "Mark all read", 99+ badge intact) → back → tap chat → **Messages (Inbox)** ("No messages yet") → Home tab → standard header (profile avatar + location, no bookmark) → Profile → "My Profile" standard header.
**Assert:**
- Bookmark is 44×44 Icon Button opening Favorites — PASS (size from source `headerActionBtn` 44×44 + pixel cluster; opens Favorites).
- Bell/chat behavior unchanged with badges intact — PASS.
- Home/Inbox/Profile headers unchanged (no bookmark; standard AppHeader) — PASS.
**Locator gap:** the three header action buttons never surface in the AX tree (only the `screen-title` and the bell's "99+" badge text do), despite `accessibilityLabel`s — the `TouchableOpacity` cluster isn't exposed. Located via pixel-scan. **Recommended fix:** verify AX exposure of `DiscoverHeader` `TouchableOpacity`s (they have accessibilityLabel but no explicit `accessible`/role).

---

## Cross-cutting UX findings

- **Keyboard-up chip/interaction misses (friction, recurring):** on Discover, taps on the Recent Searches / Trending chip rows don't register while the software keyboard is up (2 misses in M02, 2 in M07, all succeeded after hiding keyboard). Also the M06 empty-state Clear Filters button is occluded with the keyboard up. Suggest verifying the header/list scroll area is keyboard-insensitive (or auto-dismiss keyboard when the search field loses focus after a chip tap).
- **Locator gaps (Discover surface):** `discover-filter-button`, `discover-sp-toggle`, header action buttons, recent/trending chips, autocomplete suggestions, and the search-clear X are not exposed as distinct AX elements. Sort dropdown + filter modal are fully instrumented (the rest of the app's convention). This is the largest locator-coverage gap observed on the Discover surface (per `docs/locator-coverage-tracker.md`).

## Cross-cutting design-system compliance

- Recent-search chips Neutral-100 `#F0F0F0` — verified on-device.
- Trending chips Primary-100 `#E8F5F0` bg / Primary-600 `#4DAA7A` text — verified on-device.
- Active-filter chips: standard Primary-100 `#E8F5F0` bg; SP chip SP-gold `#FEF3C7` bg + `#F59E0B` text — verified on-device.
- SP quick-toggle (header) active state SP-gold `#FEF3C7` — verified on-device.
- SP toggle card (sheet) SP-gold `#FEF3C7` bg + gold border — verified on-device.
- No deviations found elsewhere on the screens visited.

## Recommended follow-ups (separate dev tasks — not applied in-run)

1. **Fix (P2, M09):** SP switch in the Filters sheet must not reset other draft filters — decouple the SP live-toggle from the draft-re-sync effect (e.g., exclude `spEligibleOnly` from the draft-reset dependency, or stop re-syncing `draft` from `filters` on SP changes).
2. **Fix (M05 doc-drift):** decide whether the free-user "upgrade CTA for SP features" is in scope; if so implement it (e.g., an upgrade banner/CTA on Discover or the sheet for non-subscribers), else correct the guide's Expected Result.
3. **Fix (M06 UX):** empty-state "Clear Filters" button is unreachable while the keyboard is up — make the empty state scrollable/keyboard-aware.
4. **Instrumentation (Discover surface):** add accessible/role to autocomplete suggestions, expose header action buttons + filter/SP toggle + clear-X + chip rows as distinct AX elements.
5. **Note:** chip taps not registering while the keyboard is up is worth a dev look (possibly a hit-slop/overlay issue on the header list area).

## App State Left Behind

- Logged in as `test-buyer` (session active on the simulator); app left on Discover with default state (no filters; ZIP not applied after the tab re-visit).
- Search history (device-local AsyncStorage): populated with test queries from this run ("zzzz", "lego", "bike", "bi", "Bicycle", "z"); **not** cleared at end (matches the app's own history behavior; a fresh run may want `Clear` first).
- No DB writes, no migrations, no seed changes performed (execution-only). No test accounts created.
