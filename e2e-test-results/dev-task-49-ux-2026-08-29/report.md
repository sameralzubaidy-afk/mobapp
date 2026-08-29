# Dev Task 49 — UX Enhancement Implementation — Report

**Date:** 2026-08-29
**Agent:** Kids P2P App Builder (implementation + verification)
**Scope:** 3 optional UX ideas flagged in QA Task 5 — all UI/copy/layout only (no schema or business-logic changes).
**Canonical docs:** QA Task 5 report `e2e-test-results/qa-task5-trd-f-k-2026-08-29/report.md`; Dev Task 48 fix report (coordination for the basket CTA).
**Verification targets:** iOS Simulator iPhone 17 Pro Max (UDID `3F3293A3-…`, app "Pass It Up!") via mobile-mcp; admin portal `http://localhost:3001` via Playwright/browser; staging Supabase `drntwgporzabmxdqykrp`.
**Evidence:** `e2e-test-results/dev-task-49-ux-2026-08-29/screenshots/` (4 files).

---

## Item 1 — Trade Basket CTA: padded bottom-sheet style (QA 4.4 / Dev Task 48 item 8 coordination)

### Coordination with Dev Task 48
Dev Task 48 (P3) already moved the "Make offer" CTA (`bundle-cta-button`) out of the ScrollView into a **fixed bar** (`position:absolute; bottom:120`) so it no longer slides under the pill nav — that minimum mis-tap fix was already landed. Dev Task 49 went beyond it (the requested restyle), so no duplication.

### What changed — `p2p-kids-marketplace/src/screens/cart/CartScreen.tsx`
1. **`bundleCtaBar` restyled as a padded bottom-sheet card:**
   - `position:absolute; bottom:164; left:16; right:16`
   - white card (`#FFFFFF`), `borderRadius:20`, `padding: theme.spacing.sm` (8pt), and `...theme.shadows.level2` ("modals, bottom sheets" elevation token).
   - This gives the CTA an unambiguous visual separation from the pill tab bar on every device size — the white floating sheet + drop shadow reads as a distinct surface, not a tab-bar extension.
2. **`bundleCta`** (the green action row inside the sheet) — `paddingVertical/horizontal: theme.spacing.md` so it fills the sheet's padded interior.
3. **`scrollContent.paddingBottom: 200 → 244`** so the last list rows fully scroll above the raised sheet.
4. **Overlap fix (user-reported "CTAs overlap"):** raised the sheet to `bottom:164`, which exposed in-flow content below it. The "More from this seller" banner (`cart-more-from-seller-banner`, "View / ✕") and the **Clear Basket** button were the last ScrollView children, so they landed at the CTA's height and poked out below the sheet into the CTA/pill gap (verified on-device: red "Clear Basket" text over the sheet's bottom edge). Both were **moved above the Summary card** so the Summary (which ends above the CTA) is now the last scroll element → nothing can render in the CTA/pill gap.

### Verification
- On-device (with 3× $20 items in basket, before the cart was cleared by a QA cleanup): the white sheet renders with visible left/right/bottom padding around the green CTA, and the CTA sits clearly above the pill (button `y 714–783`, pill `y 848` — gap grew 5× from the Dev Task 48 state). Evidence: `dt49-basket-cta-v2.png`.
- The banner/Clear-Basket reposition is code-verified: typecheck PASS, lint PASS (0 errors), `CartScreen.test.tsx` **10/10 PASS** (incl. `bundle-cta-button` render test).
- **Note:** a with-items re-screenshot of the *final* layout is pending cart repopulation — the shared-staging `cart_items` for test-buyer was cleared by a prior QA cleanup (verified via DB: 0 rows). Re-run `npm run seed:staging` (or re-add items) to capture it; the sheet rendering itself was already captured with items present.

---

## Item 2 — Admin Portal: overlay z-index above the sidebar (option b)

### Approach chosen: **Option (b) — raise modal/detail-panel z-index above the sidebar**
Rationale: the admin shell already establishes `Sidebar = z-30`, `TopNavbar = z-20`, and the majority of full-screen overlays already use `z-50`; the only overlays missing an explicit high z-index were the two on `/monitoring` (they rendered at `z-auto` → **below** the fixed `z-30` sidebar → the sidebar intercepted clicks in narrow viewports). Option (a) (auto-collapse) would require a global state bridge across ~25 pages — far more disruptive. Raising the two offenders to the existing `z-50` convention is the least-disruption fit and guarantees an overlay can never render behind an interactive sidebar element.

### What changed
- `p2p-kids-admin/src/app/monitoring/page.tsx` — both the **Trade details modal** and the **Add Note modal** (`monitor-note-modal`): added `z-50` (+ explanatory comments).
- `p2p-kids-admin/src/components/layout/Sidebar.tsx` — added a documented z-index convention comment (`TopNavbar z-20 / Sidebar z-30 / overlays z-50+ / CommandPalette z-[1000]`) so future overlays follow it and this bug class cannot regress.

### Verification (in-browser, logged-in admin)
- Opened the **Add Note modal** on `/monitoring`: `computed z-index = 50` (fixed), sidebar `z-index = 30`.
- `document.elementFromPoint(120, 300)` — a point **over the sidebar region** — returned the modal's **submit button** (`btn-monitor-note-submit`) and `sidebarCoveredByModal = true`. Before the fix, that point resolved to the sidebar `aside`, which is why clicks were intercepted.
- Evidence: `dt49-admin-monitor-modal.png`.

---

## Item 3 — Seller timeline: explicit SP-release date (QA H03)

### What changed — `p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx`
The seller's completed-trade "Swap Points Pending" card now shows an explicit release date alongside the countdown, and the countdown itself is derived from the **same** timestamp that drives the date — a single source of truth:

- New: derive `pendingReleaseAt` from **`trades.pending_sp_release_at`** (the canonical release timestamp set by the completion trigger to `completed_at + pending_sp_release_days`).
  - Fallback for legacy rows where `pending_sp_release_at IS NULL`: `completed_at + spReleaseDays` (the identical trigger formula — no second source of truth).
- New: `pendingReleaseDays` (countdown) is computed from that timestamp, not from the config value alone; `pendingReleaseDateLabel` formats it as `"Sep 1"` (en-US short month + day).
- New copy (pending branch): `"18 SP releasing in 3 days — added to your pending wallet. Releases Sep 1."`

### Verification — on-device + DB match
- **On-device (as test-seller, trade `b829ac8b`):** card shows **"18 SP releasing in 3 days — added to your pending wallet. Releases Sep 1."** with the `View Wallet` button. Evidence: `dt49-sp-release.png`.
- **DB (read-only, staging):** trade `b829ac8b` → `sp_earned_at_completion = 18`, `sp_released_at = NULL`, `pending_sp_release_at = 2026-09-01 14:10:21 UTC`, `completed_at = 2026-08-29 14:10:21`. Displayed **"Sep 1" = 2026-09-01** ✓ and the countdown **"3 days" = ceil(2.9 days)** ✓ — the date exactly matches the DB release timestamp.
- Notes: this is the QA H03 trade; the guide's stale "2 days" copy (config-driven) is now correctly superseded by the actual DB timestamp. `TradeSuccessScreen` shows the same seller copy but is driven by route params — left unchanged (timeline is the named surface; flagged as an optional follow-up).

---

## Tier 0 / Regression gates

| Gate | Command | Result |
|---|---|---|
| Mobile typecheck | `cd p2p-kids-marketplace && yarn typecheck` | **PASS** |
| Mobile lint (changed files) | `npx eslint src/screens/cart/CartScreen.tsx src/screens/trade/TradeTimelineScreen.tsx` | **PASS** (0 errors; 3 pre-existing warnings) |
| Mobile unit tests | `yarn jest src/screens/cart/__tests__/CartScreen.test.tsx` | **PASS** (10/10) |
| Admin lint (changed files) | `npx next lint --file src/app/monitoring/page.tsx --file src/components/layout/Sidebar.tsx` | **PASS** |
| Admin typecheck | `npm run typecheck` | **PASS** |
| Admin build | `npm run build` | **PASS** |

## Files changed
| File | Change |
|---|---|
| `p2p-kids-marketplace/src/screens/cart/CartScreen.tsx` | CTA → padded bottom-sheet card (`bottom:164`, white, rounded, shadow); banner + Clear Basket moved above the Summary (no content in CTA/pill gap); scroll bottom padding 244 |
| `p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx` | SP-release countdown + explicit date derived from `pending_sp_release_at`; "Releases Sep 1" copy |
| `p2p-kids-admin/src/app/monitoring/page.tsx` | Both modals `z-50` (above sidebar `z-30`) |
| `p2p-kids-admin/src/components/layout/Sidebar.tsx` | Documented z-index convention |

## Known gaps / follow-ups
- With-items final screenshot of the basket's *final* layout pending cart repopulation (QA `seed:staging`).
- `TradeSuccessScreen` seller SP copy still uses route-param `spPendingReleaseDays` (no explicit date) — optional consistency follow-up.
- Admin dev server needed a restart mid-run (stale `_next/static` 404 state — same known dev-env quirk as prior sessions).
