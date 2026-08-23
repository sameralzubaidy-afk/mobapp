# Group O Final Closure — On-Device Re-Verify O03 + O01 Sanity

**Run date:** 2026-08-22 (13:33–13:45 local)
**Device:** iPhone 17 Pro Max simulator (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1, Debug build + Metro (`:8081`)
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group O)
**Fix under test:** commit `47a20dfb` — "ZIP Waitlist: Require Explicit Opt-In + Decouple from Discovery Scope" (mobile app HEAD on `main`, working tree clean; Metro served the fixed bundle after app relaunch)
**Agent:** QA Test Agent (execution-only — no code changed)
**DB preconditions (read-only, before device work):** `test-buyer` (user `49243010-f458-4744-add1-a6c84ab95f1f`) node-assigned to Norwalk Central (`550e8400-e29b-41d4-a716-446655440001`, ZIP 06850), `account_status=active`; **`zip_waitlist` = 0 rows** (clean baseline per Addendum 113/114 cleanup + registry).

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-O01 | AUTH guide | **PASS** | Default Discover node-scoped (71 near CT ↔ 1215 all nodes ↔ 71) — no regression from the fix; persona clean |
| AUTH-TC-O03 | AUTH guide | **PASS** | Inactive-ZIP now requires explicit Yes/No opt-in; **No** creates no row; **Yes** creates a row but never flips the user's own scope (decouple verified) |

**Roll-up: 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

> **Group O is now fully closed** (pending the separate Item 3 locator-gap/admin-cleanup fix if still outstanding — see "Item 3 status" below; only the inactive-ZIP-dialog AX portion rode in with the O03 fix).

---

## Per-case detail

### AUTH-TC-O01 · Results scoped to user's node — PASS (sanity, Item 2)

**Trace (abridged):** Login test-buyer → Home header "Norwalk Central" (node confirmed) → Discover tab → `discover-results-count` = **"71 results · near CT"**, `discover-show-all-nodes-toggle` OFF (visible), no ZIP applied → corroboration: toggled Show All Nodes ON → **"1215 results · all nodes"** → OFF → **"71 results · near CT"**.

**Assert result:** ✅ PASS. Default discovery is node-scoped (71 vs 1215 global), identical to the 2026-08-22 O01 baseline and the Phase 24/25 F06 runs. The ZIP-waitlist decouple fix did not regress the node-scoped default, and the earlier data cleanup left `test-buyer` with a clean 0-waitlist state.

**Screenshots:** `O01-discover-default-node-scoped.png`.

**UX — Structural/affordance:** Result-count line clear; Show All Nodes toggle is a visible, working affordance with on/off state text. OK.
**UX — Wording/copy:** "71 results · near CT" plain and parent-appropriate. OK.
**UX — Design-system compliance:** Count neutral text on white; toggle per passitup tokens. Pre-existing minor (Phase 24 note, unchanged): result-count `#4D4D4D` vs documented `#6B6B6B`. No new deviations.

**Locator gaps:** None new.
**Friction:** None blocking.

---

### AUTH-TC-O03 · Inactive ZIP in filter → explicit waitlist opt-in (no auto-enrollment; own scope unchanged) — PASS (Item 1, critical re-verify)

**Guide-required steps vs on-device result (all 7):**

| # | Guide step | On-device result | Verdict |
|---|---|---|---|
| 1 | Discover starts node-scoped (count shows node/state, Show All Nodes toggle visible) | **"71 results · near CT"**, toggle visible OFF | ✅ |
| 2 | Filters → enter inactive ZIP `99999` → Apply | ZIP field cleared via long-press → Select All → typed `99999`; Apply (sticky green pill, pixel-scanned — not AX-exposed) | ✅ |
| 3 | Dialog **asks** Yes/No, no auto-enroll copy | Consent step: title **"Not Available in Your Area"**, body **"We're not live in ZIP 99999 yet. Would you like us to let you know when we launch here?"**, buttons **"Yes, Add Me to the Waitlist"** / **"No, Thanks"**. No "Added you to the waitlist…" copy anywhere | ✅ |
| 4 | Tap **No, Thanks** → no row created; outcome step offers Back to Filters / See All Results | Outcome message **"No problem — you can still browse everything on Pass It Up."** + **Back to Filters** / **See All Results** buttons. **DB read-back: `zip_waitlist` for test-buyer = 0 rows** | ✅ |
| 5 | (Regression) Return to Discover → scope unchanged (node-scoped, toggle visible) | After **See All Results** → Discover **"71 results · near CT"**, toggle visible OFF | ✅ |
| 6 | Re-apply same inactive ZIP → tap **Yes** → confirmation step | Consent step again → tap **Yes, Add Me to the Waitlist** → outcome **"You're on the waitlist for ZIP 99999. We'll let you know when we launch here. In the meantime, you can browse all available items."** **DB read-back: exactly 1 row** (`5b67f3ed-5170-48f0-a139-d8f4b8729641`, requested_zip `99999`, status `pending`, created 2026-08-22 17:42:33Z — i.e. only at the explicit Yes tap) | ✅ |
| 7 | (Regression) Return to Discover → scope **still** node-scoped (toggle visible) even after opting in | After **See All Results** → Discover **"71 results · near CT"**, toggle visible OFF. **Remount check (Home → Discover) with the new row present:** still node-scoped, toggle visible; toggle still fully functional (71 ↔ 1215 ↔ 71) | ✅ |

**Assert result:** ✅ PASS — all 7 steps. The two prior CRITICAL findings from the 2026-08-22 run are resolved on-device:
1. **No auto-enroll.** Applying an inactive ZIP no longer silently upserts `zip_waitlist`; a row is created only on explicit **Yes** (DB-proven: 0 rows after No, 1 row after Yes).
2. **Scope decouple.** A `zip_waitlist` row for an *explored* ZIP (99999) no longer flips the user's own Discover default to global-browse — `checkWaitlistStatus` keys only on the user's own home ZIP (06850). Scope stayed node-scoped even after opting in, including across a remount with the row present.

**Screenshots:** `O03-filters-modal-open.png`, `O03-zip-field-longpress.png`, `O03-zip-99999-keyboard.png`, `O03-zip-99999-nokeyboard-clean.png`, `O03-consent-dialog-yes-no.png`, `O03-after-no-scope-unchanged.png`, `O03-yes-confirmation-step.png`, `O03-after-yes-scope-still-node-scoped.png`, `O03-remount-after-yes.png`, `O03-final-restored-node-scoped.png`.

**UX — Structural/affordance:** Two-step dialog is clean and self-explanatory — consent first (stacked full-width buttons), then outcome (two navigation buttons in a row). Clear primary (green) vs secondary (outline) hierarchy at each step; one primary per dialog. Outcome step preserves both navigation options (Back to Filters / See All Results). OK.
**UX — Wording/copy:** Consent copy is a genuine question ("Would you like us to let you know when we launch here?") — consent-first, parent-appropriate, no misleading auto-enrollment language. Outcome messages are distinct per path (declined / enrolled / sign-in-required / failure) and plain. Minor suggestion (non-blocking): the enrolled confirmation "We'll let you know when we launch here" could add the ZIP context already present earlier in the sentence — current copy already includes "for ZIP 99999", so no change needed. OK.
**UX — Design-system compliance:** Dialog card `#FFFFFF`, radius 24, padding 24/22; title 24/32/700 `#1A1A1A`; body 16/24 `#6B6B6B`; primary button `#5DBB8E` (verified via pixel scan — 77% green in the primary band), secondary outline `#C9C9C9` border / `#6B6B6B` text; 52px touch targets. Scrim `rgba(26,26,26,0.35)`. **No deviations found.**

**Locator gaps (resolved vs outstanding):**
- **RESOLVED by the O03 fix:** all 4 dialog buttons (`inactive-zip-waitlist-yes`, `inactive-zip-waitlist-no`, `inactive-zip-back-to-filters`, `inactive-zip-see-all-results`) now carry `accessible` + `accessibilityRole="button"` + labels and **do surface in the mobile-mcp AX tree** (verified on-device — a change from the prior run where they were absent). The prior report's recommendation for these four is addressed.
- **Still outstanding (Item 3):** `filter-modal-apply` (Apply footer) still not AX-exposed (pixel-scanned this run) and RadiusSlider `−`/`+`/track still bare Pressables (no AX props) — see Item 3.

**Friction vs operating rules:**
- Keyboard occlusion on the Filters sheet: with the keyboard up the sticky Apply footer is occluded/not in the AX tree; resolved via the standing Cmd+K software-keyboard suppression (§5.2/§5.23), then pixel-scanned the green Apply pill in the clean full-height layout. One stray keyboard tap (attempting Return) dropped a digit (99999→9999); completed the value by re-tapping the field and typing one `9` (sanitizer guarantees 5-digit-only) after the keyboard was suppressed — noted as a keyboard-interaction friction, not an app defect.
- Tree coordinates for the keyboard-occluded footer are logical not rendered (§5.2) — handled with pixel-scan.

---

## Item 3 — Status check on the parallel locator-gap / admin-cleanup fix

**Prompt scope:** RadiusSlider/filter-apply/inactive-ZIP-dialog AX exposure, admin `/settings/nodes` testIDs, stale "last updated" meta. **Verdict: STILL OUTSTANDING (partial).** Verified via git history + source + on-device this run:

| Sub-item | Status | Evidence |
|---|---|---|
| Inactive-ZIP dialog AX exposure (4 buttons) | ✅ **LANDED** (in `47a20dfb`) | On-device this run: buttons surface in AX tree; `git show 47a20dfb` adds `accessible`/`role`/`label` to all 4 |
| `filter-modal-apply` AX exposure | ❌ NOT landed | On-device this run: Apply footer absent from AX tree (pixel-scanned); no commit touches `SearchFilterModal.tsx` since Group M-era `34b5a662` |
| RadiusSlider `−`/`+`/track AX exposure | ❌ NOT landed | `src/components/RadiusSlider.tsx`: bare `Pressable`s with no testID/`accessible`/`role`/`label`; not in AX tree on-device |
| Admin `/settings/nodes` input/Save testIDs | ❌ NOT landed (doc-drift gap persists) | Admin repo `mobappadmin` HEAD = `56cf3c6e` (Group L-era, no nodes testID commit). Page has only `last-updated-*` labels + `node-settings-config-link`; Save button is a plain `<button>` with **no** `data-testid`; tracker-documented `node-settings-*-input`/`btn-save-node-settings` still absent |
| Admin stale "last updated" meta after save | ❌ NOT landed | `handleSave` in `settings/nodes/page.tsx` does not re-fetch `meta` post-save (`setMeta` only in initial load) — labels stay stale after a successful save |

**Conclusion:** only the inactive-ZIP-dialog AX portion of the parallel fix rode in with the O03 commit. The rest (filter-apply, RadiusSlider, admin nodes testIDs + last-updated meta refresh) is **still outstanding** — treat as a separate follow-up task, not done.

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Cold relaunch → Landing (bundle download from Metro) | ~5–8s | env artifact (dev-build cold start — not app behavior) |
| Landing → Login | <1s | no |
| Login submit → Home | ~2–3s | no |
| Home → Discover | ~1–2s | no |
| Discover → Filters modal open | <1s | no |
| Apply (inactive ZIP) → consent dialog | ~1–2s | no |
| Consent → outcome (No / Yes) | <1s | no |
| Outcome → Discover (See All Results) | ~1–2s | no |
| Remount Discover (Home → Discover) | ~1–2s | no |

No non-environment transition ≥ 3s observed.

---

## Cross-cutting UX findings

- **Positive (behavioral fix verified):** inactive-ZIP filter is now consent-first and does not mutate the persona or its discovery scope. The two-step dialog (consent → outcome) is a clear, human-friendly interaction.
- **Minor (pre-existing, cosmetic):** Discover result-count line can briefly show the page-size fallback ("20 results · near CT") before `count_listings` resolves to the node total (71) — re-confirmed on remount; DB arbitration (`71` available items in Norwalk Central) confirms this is display-lag, not a data change.
- **Minor (pre-existing):** Apply button label shows "Show 1215 Results" while an inactive ZIP (99999) is drafted — suggests applying will surface all items, though applying actually opens the consent dialog. Not a blocker; worth a copy/affordance review (the count shown is the all-nodes fallback, not the node-scoped 71).

## Cross-cutting design-system compliance

- Consent + outcome dialogs: white card radius 24, one green `#5DBB8E` primary pill, secondary outline `#C9C9C9`/`#6B6B6B`, 52px targets, 24/16 type scale — **compliant** (passitup tokens), verified via source + pixel scan.
- Discover default surface: node-scoped count + Show All Nodes toggle — compliant (pre-existing `#4D4D4D` vs `#6B6B6B` count-text note unchanged).

## Recommended follow-ups (separate tasks — NOT applied in-run)

1. **Item 3 rest (still outstanding):** add AX to `filter-modal-apply` + RadiusSlider `−`/`+`/track (BP-53); add `node-settings-*-input`/`btn-save-node-settings` testIDs on admin `/settings/nodes` (or correct the tracker); refresh `last-updated-*` meta after save on `/settings/nodes`.
2. **Persona cleanup:** delete the `zip_waitlist` row (`5b67f3ed-5170-48f0-a139-d8f4b8729641`, test-buyer + 99999) to restore the registry's clean 0-row baseline for future O03 re-runs (the decouple means it does not affect scope, but the registry documents clean = 0 rows; dev-team task, e.g. `delete from public.zip_waitlist where id='5b67f3ed-…'`).
3. (Optional) Consider making the Apply-button live count show the node-scoped count rather than the all-nodes fallback when a drafted inactive ZIP is present.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-O01 + AUTH-TC-O03 (Group O final closure — on-device re-verify of the ZIP-waitlist opt-in/decouple fix `47a20dfb`)
**Design-System Compliance:** PASS — consent + outcome dialogs and Discover default surface match passitup tokens (white card radius 24, primary green `#5DBB8E`, secondary outline `#C9C9C9`/`#6B6B6B`, 52px targets, one primary per dialog). Pre-existing minor (unchanged): Discover result-count `#4D4D4D` vs documented `#6B6B6B`.
**Perceived Load-Time Verdict:** GOOD — no non-environment transition ≥ 3s (the one ~5–8s item is dev-build cold-start bundle download from Metro, an environment artifact).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Inactive-ZIP consent dialog: consent-first wording, clear primary/secondary hierarchy, plain parent-appropriate copy ("Would you like us to let you know when we launch here?"), matches design-system modal/button tokens.
- CONFIRMED — Inactive-ZIP outcome dialog: per-path messages (declined / enrolled / sign-in / failure) are clear; Back to Filters / See All Results navigation preserved; matches design-system tokens.
- CONFIRMED — Discover default surface: node-scoped count line + Show All Nodes toggle, compliant (pre-existing count-color note only).
- CONFIRMED — Filters sheet (visited): ZIP input + sticky Apply footer — colors/layout compliant; Apply still not AX-exposed (locator gap, not a design-system deviation).
**Verdict Summary:** 2 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:** (1) None blocking — O03's two prior CRITICAL issues (silent auto-enroll + scope flip on explored ZIP) are **resolved and verified on-device** (0 rows after No, 1 row only after explicit Yes, scope node-scoped throughout incl. remount). (2) Item 3's separate locator-gap/admin-cleanup fix remains mostly outstanding (only the inactive-ZIP dialog AX portion landed with the O03 fix) — see Item 3 status.
**App State Left Behind:** test-buyer logged in on Discover (node-scoped). A `zip_waitlist` row was intentionally created (explicit opt-in, ZIP 99999, pending, id `5b67f3ed-…`) — recommend dev-team cleanup to restore the 0-row registry baseline (does not affect scope due to the decouple).
**Why It Matters:** This run proves the waitlist fix works in the real app, not just in unit tests: parents filtering by a far-away ZIP are now asked before being subscribed, and exploring/opting into another ZIP no longer hijacks their own discovery scope. Group O is fully closed pending the separate Item 3 cleanup fix.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/group-o-closeout-o03-o01-2026-08-22/screenshots/` (13 PNGs: consent dialog, No outcome, Yes outcome, scope-unchanged after No/Yes, remount, final restored). Reproduce: login test-buyer → Discover → Filters → ZIP 99999 → Apply → consent dialog → No (DB: 0 rows) / Yes (DB: 1 row) → Discover scope stays "71 results · near CT" with Show All Nodes toggle visible.
**Known Gaps / Not Tested:** Admin-web leg out of scope for this agent (Playwright path); Item 3 admin portions verified via source only (not executed). The "already-waitlisted repeat visit" branch (consent skipped → straight to confirmed) was not exercised (persona was clean at start).
