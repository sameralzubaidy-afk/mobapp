# Group O — Discovery: Node Scoping & SP Visibility (AUTH-TC-O01–O05)

**Run date:** 2026-08-22 (12:00–12:20 local)
**Device:** iPhone 17 Pro Max simulator (UDID `3F3293A3-…`), iOS 26.1, Debug build + Metro (`:8081`)
**Admin web:** `p2p-kids-admin` dev server `:3001` (PID 60316) — Playwright leg
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group O)
**Agent:** QA Test Agent (execution-only — no code changed)

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-O01 | AUTH guide | **PASS** | Default Discover node-scoped (71 node items vs 1215 global) |
| AUTH-TC-O02 | AUTH guide | **PASS** | ZIP+radius filter scopes to nearby nodes (86 near 06850/15mi); radius pref remembered |
| AUTH-TC-O03 | AUTH guide | **PASS** | Inactive ZIP → waitlist dialog + both options work (auto-enroll side effect flagged) |
| AUTH-TC-O04 | AUTH guide | **PASS** | Subscriber: SP filter+badges, no CTA; Free: SP results + upgrade CTA → Kids Club+ |
| AUTH-TC-O05 | AUTH guide | **PASS** | Admin 15/10/25 reflects on mobile (default 15, bounds 10/25, clamps); restored |

**Roll-up: 5 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

---

## Per-case detail

### AUTH-TC-O01 · Results scoped to user's node — PASS

**Trace (abridged):** Login test-buyer → Home header "Norwalk Central" (node confirmed) → Discover tab → tree shows `discover-results-count` = **"71 results · near CT"**, `discover-show-all-nodes-toggle` OFF, no ZIP applied. Corroboration: toggled Show All Nodes ON → **"1215 results · all nodes"** → toggled OFF → back to 71.

**Assert result:** ✅ PASS. Default discovery is node-scoped (71 vs 1215 global). Node identity confirmed on-device (Norwalk Central header).

**Screenshots:** `screenshots/O01-discover-default-node-scoped.png`

**UX — Structural/affordance:** Result-count line is clear and the Show All Nodes toggle is a discoverable affordance with on/off state text. OK.
**UX — Wording/copy:** "near CT" (state label) is fine for the parent audience; "71 results" plain. OK.
**UX — Design-system compliance:** Count uses neutral text on white; toggle/SP chips per passitup tokens (verified visually + AX). Minor (pre-existing, see Phase 24 audit): result count `#4D4D4D` vs documented `#6B6B6B` — **DEV-005** (pre-existing, not this run's regression). No new deviations on the Discover default surface.

**Locator gaps:** `discover-show-all-nodes-toggle` exposes as `Switch` (OK). None new for O01.
**Friction:** Discover grid tree is large; count reads from AX reliably. None blocking.

---

### AUTH-TC-O02 · Location ZIP + radius filter — PASS

**Trace:** Discover → Filters (`discover-filter-button`) → ZIP prefilled `06850`, radius default **10 mi** (bounds 5/25 pre-O05) → adjusted radius to **15** via `+` button (10→15, 5 taps) → Apply (sticky green pill, pixel-scanned) → modal closes → **"86 results · near 06850, 15 mi"** (was 71 node-only; radius 15 adds nearby nodes e.g. Greenwich). Remount (Home→Discover) → Filters → radius still **15 miles** (remembered preference persisted).

**Assert result:** ✅ PASS.
1. Results scope to nearby nodes within the chosen radius — 86 results · near 06850, 15 mi.
2. Radius preference remembered on next load — 15 miles after remount.

**Screenshots:** `O02-filters-modal-open.png`, `O02-radius-15-zip-06850.png`, `O02-applied-zip-06850-r15.png`.

**UX — Structural/affordance:** Radius slider is compact with − / + arrows + track; live summary text ("ZIP 06850 will apply when you tap Apply Filters") is helpful. Apply is a sticky 56px green pill (good affordance).
**UX — Wording/copy:** Slider header "Search Radius" + "X miles" value; min/max labels "5 mi"/"25 mi". Clear. OK.
**UX — Design-system compliance:** Radius slider value text green `#5DBB8E`, track `#E0E0E0`, filled track green — matches passitup. Arrow buttons `#F0F0F0` with green glyphs — consistent. No deviation found on the Filters sheet (pre-existing sort-dropdown/Apply-color notes from Phase 24 were not re-encountered on this sheet; the sheet's Apply uses `#5DBB8E`).

**Locator gaps (flagged):** RadiusSlider `−`/`+` Pressables and track have **no testID / accessibilityRole** (BP-53) — not in AX tree; derived positions via green-glyph pixel scan. `filter-modal-apply` has `testID` but no `accessible`/`accessibilityRole` → absent from AX tree (pixel-scanned). Modal `Close`/`Reset` header controls also not AX-exposed. **Recommended follow-up:** add `accessible` + `accessibilityRole="button"` (+ labels) to RadiusSlider arrows/track and `filter-modal-apply`.
**Friction:** A static tap on the slider track does **not** change the value (PanResponder only fires `onMove`/`onRelease` with a drag — a tap grants but never moves). Used the `+`/`−` buttons instead (each = ±1 mile, deterministic).

---

### AUTH-TC-O03 · Inactive ZIP in filter → waitlist prompt — PASS (with finding)

**Trace:** Filters → replaced ZIP with `99999` (long-press → Select All → type) → Apply → **waitlist dialog**: title **"Not Available in Your Area"**, body **"We're not live in ZIP code 99999 yet. Added you to the waitlist for ZIP 99999. In the meantime, you can browse all available items."** → tapped **See All Results** → dialog closed, location filter cleared (Discover back to 71 near CT) → re-applied 99999 → dialog again → tapped **Back to Filters** → Filters modal reopened (applied state preserved).

**Assert result:** ✅ PASS.
1. Waitlist prompt appears for inactive ZIP (99999, no active node).
2. Both options work: **Back to Filters** (reopens modal) and **See All Results** (clears location filter → all/node-default results).

**Screenshots:** `O03-waitlist-dialog.png`, `O03-zip-99999-keyboard.png`, `O03-see-all-results-applied.png`.

**Findings (2):**
- **[CRITICAL — shared-persona state change + product concern]** Applying an inactive ZIP in the Discover **Filters auto-enrolls the signed-in user in `zip_waitlist`** (`handleApplyZipCode` → `upsertZipWaitlist`, message confirms "Added you to the waitlist for ZIP 99999"). Discover's waitlist detection is "any `zip_waitlist` row" → **test-buyer is now waitlisted** → their Discover default flipped to global-browse (1215 results, Show All Nodes toggle hidden) on subsequent loads. A parent filtering by a far-away ZIP is silently subscribed to waitlist notifications AND their discovery scope changes. **Dev decision needed** (see What Needs To Be Fixed Next).
- **Doc drift:** guide's expected copy "We can add you to the waitlist." (offering) vs actual "Added you to the waitlist for ZIP 99999." (auto-enrolled).

**UX — Structural/affordance:** Dialog is a centered modal card, two clear buttons in a row (secondary outline + primary green). Dismissible via either CTA. OK.
**UX — Wording/copy:** Body is clear but verbose; auto-enrollment is stated plainly. Could soften: "We've added you to the waitlist for ZIP 99999 — we'll notify you when we launch there. In the meantime, you can browse all available items." (current copy is acceptable).
**UX — Design-system compliance:** Card `#FFFFFF`, radius 24, primary button green `#5DBB8E`, secondary outline `#C9C9C9`/`#6B6B6B` — matches passitup modal/button tokens. **No deviations.**

**Locator gaps (flagged):** Dialog buttons have `testID` (`inactive-zip-back-to-filters` / `inactive-zip-see-all-results`) but no `accessible`/`accessibilityRole` → not in AX tree (pixel-scanned green primary + secondary bounds). **Recommended follow-up:** add `accessible` + `accessibilityRole="button"` + labels to both dialog buttons.

---

### AUTH-TC-O04 · Subscriber vs free SP visibility — PASS

**Trace:**
- **test-buyer (Kids Club+ subscriber):** SP toggle ON (`discover-sp-toggle`) → label "Accepts Swap Points filter enabled", `discover-filter-button` "1 active", **54 results**, active chip "Accepts SP ✕", cards carry **"Accepts SP"** badges. **No upgrade CTA** (tree grep for `sp-upgrade`/`upgrade` = absent).
- **test-free (free tier):** logged out (qa-logout) → logged in → Discover → SP toggle ON → **54 results** with "Accepts SP" badges **AND upgrade CTA** — "🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!" + **Upgrade Now** button → tapped → navigated to **Kids Club+ (JoinKidsClub)** ("Get more out of every trade", benefits, "Join on the web").

**Assert result:** ✅ PASS.
1. Subscriber: SP-eligible items prioritized (54), SP filter enabled + SP context (badges/chip), no CTA.
2. Free: SP-eligible items still visible (54, SP badges) **with** upgrade CTA (Group M Fix 4 pattern) → CTA navigates to Kids Club+ (consistency confirmed).

**Screenshots:** `O04-testbuyer-subscriber-sp-filter.png`, `O04-testfree-upgrade-cta.png`.

**UX — Structural/affordance:** Upgrade CTA banner sits directly under the controls row; clear "Upgrade Now" button. Discoverable. OK.
**UX — Wording/copy:** "Subscribe to Kids Club+ to accept Swap Points and unlock more features!" is plain, benefit-led, parent-appropriate. OK.
**UX — Design-system compliance:** Upgrade banner uses `#FEF3C7` (SP100) bg, `#7A5A2A` text, green `#5DBB8E` button — matches ItemCreate's SP-upgrade prompt (consistent pattern). SP badges gold `#F59E0B`/`#FEF3C7`. **No deviations.**

**Locator gaps:** None new — `discover-sp-toggle`, `discover-sp-upgrade-cta`, `discover-sp-upgrade-button` are AX-exposed (Fix 3 from Group M).

---

### AUTH-TC-O05 · Admin radius defaults/bounds reflect in Discover — PASS (combined chain)

**Admin leg (Playwright):** script `group-o-admin-radius.cjs` logged in as admin (`test-admin`), opened `/settings/nodes`, captured before-state, saved **default=15 / min=10 / max=25**, confirmed success banner + values, screenshotted. Before: `{default:10, max_assignment:100, distance_warning:50, min:5, max:25}`; After: `{default:15, min:10, max:25}`. **Restored** to original (10/5/25) after mobile verification.

**Mobile leg (test-buyer):** logged in → Discover → Filters:
- **Default radius = 15 miles** on first open after the admin change (configured default; coincides with the saved preference 15 from O02).
- **Bounds updated: 10 mi (min) / 25 mi (max)** (previously 5/25).
- **Min clamp:** `−` to 10 → further `−` stays **10**.
- **Max clamp:** `+` 10→25 → further `+` stays **25**.
- **Remembered preference honors new bounds:** remount Discover → Filters → radius **25** (saved during clamp test) persists within [10,25].

**Assert result:** ✅ PASS.
1. Discover opens with configured default radius (15).
2. Radius control cannot go below min (10) or above max (25).
3. Results + remembered radius preference honor the new bounds on next load.

**Screenshots (both surfaces, per Evidence §5.20):** Admin: `ADMIN-O05-nodes-before.png`, `ADMIN-O05-nodes-filled.png`, `ADMIN-O05-nodes-saved-confirmation.png`, `ADMIN-O05-nodes-restored.png`. Mobile: `O05-mobile-radius-15-bounds-10-25.png`, `O05-mobile-radius-clamped-10-25.png`.

**Constraint check:** test-buyer's actual assigned node = **Norwalk Central** (confirmed via Home header + node-scoped default 71 in O01). The admin radius settings are **global** `admin_config` keys (not per-node) — the case's "for test-buyer's node" is a simplification; test-buyer is the subject whose Discover reflects them.

**UX — Structural/affordance:** Radius control bounds visibly relabel (10/25), arrows disable at the extremes (opacity feedback). Good.
**UX — Wording/copy:** n/a (no new copy).
**UX — Design-system compliance:** Same RadiusSlider tokens as O02 (green fill/thumb, gray track). No deviations.

**Findings:**
- **Minor (admin):** `/settings/nodes` "LAST UPDATED" labels still show 2025 dates after a successful save (meta not refreshed post-save; value fields + success banner correct). DEV follow-up: refresh `last-updated-*` meta after save.
- **Locator gap (admin, doc drift):** `locator-coverage-tracker.md` lists `node-settings-*-input`/`btn-save-node-settings` testIds but the current `/settings/nodes` page has **none** on inputs or the Save button (plain HTML). Playwright located fields by `<label>` text. **Recommended follow-up:** add `data-testid`s per the tracker's naming, or correct the tracker.

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Landing → Login (tap Log In) | <1s | no |
| Login submit → Home (test-buyer / test-free / 2nd test-buyer) | ~1–2s each | no |
| Home → Discover tab | ~1–2s (first paint) | no |
| Filters modal open | <1s | no |
| Apply filter → results update (O02) | ~2s | no |
| Inactive ZIP Apply → waitlist dialog | ~1–2s (incl. 300ms modal-close delay) | no |
| Upgrade Now → Kids Club+ | ~1–2s | no |

No transition ≥ 3s observed this run.

---

## Cross-cutting UX findings

- Auto-waitlist enrollment on inactive-ZIP filter (see O03) — the most consequential behavioral finding.
- Radius slider / Apply / dialog buttons / modal Close/Reset are non-instrumentable (AX) — recurring BP-53 pattern on the Discover filter surface.

## Cross-cutting design-system compliance

- Discover + Filters sheet + inactive-ZIP dialog + Kids Club+ upgrade banner all match passitup tokens (primary `#5DBB8E`, SP gold `#F59E0B`/`#FEF3C7`, neutral tiers). Pre-existing minor: result-count `#4D4D4D` vs `#6B6B6B` (Phase 24 note, unchanged).
