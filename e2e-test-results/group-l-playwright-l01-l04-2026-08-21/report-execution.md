# Group L — AUTH-TC-L01–L04 REAL Playwright Run — Execution Report (2026-08-21)

**Date:** 2026-08-21 · **Agent:** QA Test Agent (execution + authoring validation)
**Run dir:** `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/`
**Scope:** `p2p-kids-admin` (repo `mobappadmin`, branch `develop`), admin-portal Playwright E2E for AUTH-TC-L01–L04 (listing approval) + mobile legs via mobile-mcp on the iOS simulator.
**Reference guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — "Group L — Admin Review / Pending".
**Target env:** staging Supabase `drntwgporzabmxdqykrp`; admin portal `http://localhost:3001` (HTTP 200); Metro `:8081` (HTTP 200); iPhone 17 Pro Max (iOS 26.1) booted, app installed.
**Spec:** `p2p-kids-admin/__tests__/group-l-listing-approval.e2e.test.ts` — real AUTH-TC-L01–L04 assertions authored as one connected serial chain (anchored on the seller's latest item).

> This report supersedes the earlier BLOCKED report in this folder (authoring-only; credential gate). The credential gate is now **CLEARED** (admin QA creds filled locally; `test-admin@kidsmarketplace.test` has admin RBAC on staging), and the run EXECUTED end-to-end.

---

## Executive summary

All four cases **PASS**. The chain ran as a connected flow anchored on the seller's fresh pending item **`cc81e86c`** ("QA L Group Chain Item 0821", price 15 → 25 via the L04 edit). Two spec bugs were found and fixed during execution (see "Spec fixes applied during the run"): (1) `ensureAdminSession` raced the client-side auth redirect (login skipped → L02 timed out on the login page); (2) L02's post-approval badge assertion conflicted with the `pending`-filtered queue and an auto-refresh race. After both fixes, L01–L03 passed in one clean run, the mobile L04 edit leg was executed, and L04 passed.

**Roll-up: 4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

| TC | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-L01 | AUTH guide (Group L) | **PASS** | Fresh pending item exists, `approved_at`/`approved_by` NULL, buyer-invisible (status-available count 0 + `search_listings` RPC no match) |
| AUTH-TC-L02 | AUTH guide (Group L) | **PASS** | Admin approved via the RPC-backed `/listings` UI (alert "Listing approved! Seller is eligible for Starter Pack reward."); DB: `available`, `approved_at`/`approved_by` set; buyer sees it in node feed |
| AUTH-TC-L03 | AUTH guide (Group L) | **PASS** | `user_notifications` row `type=listing_approved`, `category=system`, `data.deep_link=/listing/<id>`; on-device: NotificationCenter shows it (green `Tag` icon), tap → Item Detail for the correct item |
| AUTH-TC-L04 | AUTH guide (Group L) | **PASS** | Seller edit (price 15→25) fired `tr_items_require_reapproval_on_seller_edit`: status→`pending`, `approved_at`/`approved_by` cleared, buyer-invisible until re-approved |

---

## Spec fixes applied during the run (authoring deliverable)

Both fixes are in the spec under test (the QA deliverable), not app code:

1. **`ensureAdminSession` auth-redirect race (P0 for the run).** The admin app guards pages **client-side** (`ProtectedLayout`/`AdminShell` → `supabase.auth.getUser()` → `router.push('/auth/login')`). `page.goto('/listings')` resolves before that async redirect fires, so the old `if (page.url().includes('/auth/login'))` check saw `/listings` and silently skipped login → L02 later timed out waiting for `listings-status-select` on the login page. **Fix:** `page.waitForURL('**/auth/login**', {timeout})` to wait for the redirect decision; after login, `page.waitForURL(url => !path.startsWith('/auth/login'))`; final `page.goto('/listings')` + wait for the status select. Also replaced `waitForLoadState('networkidle')` (can hang on Next.js dev HMR).
2. **L02 post-approval badge assertion vs. the `pending` filter + auto-refresh race.** The queue auto-refreshes after approval (`setTimeout(handleSearch, 100)`) but stays filtered to `pending`, so the approved item leaves that set (badge never shows "Available" there). **Fix:** switch the filter to `active` (Available) and poll-and-re-search until the row shows "Available" — tolerating the delayed stale auto-refresh overwriting results with an empty set.

---

## Per-case details

### AUTH-TC-L01 — New listing not visible until approved — **PASS** (456ms / 1.3s in runs)
- **Setup/mobile leg:** logged in as `test-seller` (fixture `TestSeller123!`, not echoed); created a fresh item via `create-item` deep link + dev fixtures (`dev-add-test-photo`, `dev-set-category` → Books), title "QA L Group Chain Item 0821", condition New, price 15 → submitted (phone-verification gate completed via DEV bypass `123456`; **test-seller `phone_verified_at` was NULL on staging** — registry "phone verified" was doc drift, now verified at 16:55Z). Item `cc81e86c` created as `pending`.
- **Assert (spec):** item exists `status=pending`, `approved_at`/`approved_by` NULL; buyer-visible (`status=available`) count 0; node-scoped `search_listings` RPC returns no match. **All met.**
- **Evidence:** `screenshots/25-item-submitted-pending.png`, `screenshots/26-submit-success-modal.png`.

### AUTH-TC-L02 — Admin approves → item becomes visible — **PASS** (5.4s / 6.8s)
- **Playwright UI (RPC-backed `/listings`, per the task constraint):** filter `pending` + seller email → search → `listings-row-<id>` → modal → `btn-approve-<id>` → `btn-confirm-action`; `window.alert()` handled via `page.on('dialog')` accept → **"Listing approved! Seller is eligible for Starter Pack reward."** Moderation gate pre-check: `{"status":"disabled",...}` (gate OFF on staging). Then filter `active` + re-search → row shows **Available**.
- **Assert (spec):** DB `status=available`, `approved_at`/`approved_by` set (approved_by = admin `e861a7a0-…`); buyer-visible count 1; `search_listings` now returns the item. **All met.**
- **Evidence:** `screenshots/` (portal flow), DB read-back printed in run; test-results artifacts.

### AUTH-TC-L03 — Seller receives approval notification — **PASS** (120ms / 141ms)
- **Assert (spec, DB):** a `user_notifications` row for the seller, `type=listing_approved`, `category=system`, `data.listing_id`/`item_id` = item, `data.deep_link` = `/listing/cc81e86c-…`, `data.type=listing_approved`. **Met.**
- **On-device (mobile-mcp):** NotificationCenter shows **"Listing Approved"** / "Your listing "QA L Group Chain Item 0821" was approved and is now live." with the **green `Tag` icon** (pixel `#5DBB8E` at the icon center; source `NotificationCenterScreen.tsx` `listing_approved: { Icon: Tag, ...COLORS.green }`). Tapping it deep-linked to **Item Detail** for the correct item (`item-detail-title` = "QA L Group Chain Item 0821", `$25.00`) — per `deepLink.ts` `listing_approved → ListingDetail`. **Verified.**
- **Evidence:** `screenshots/43-notification-center.png`, `screenshots/48-notification-center-clean.png`, `screenshots/49-item-detail-from-notification.png`.

### AUTH-TC-L04 — Editing an approved listing returns to pending — **PASS** (361ms)
- **Mobile leg:** as `test-seller`, opened MyListings → the item's edit (pencil) → EditListing → changed price **15 → 20** → Save ("Changes Saved" modal). **DB verified:** `status=pending`, `approved_at`/`approved_by` NULL, price 20, buyer-visible count 0 → `tr_items_require_reapproval_on_seller_edit` fired.
- **Assert (spec):** item `status=pending`, `approved_at`/`approved_by` NULL, buyer-invisible again. **Met.**
- **Note:** after this pass, a later L02 re-validation re-approved the item (available). For the L04 re-check, the item was edited again (20 → 25) → reverted to `pending` → L04 **PASSED** (361ms). Final DB state: `cc81e86c` available, price 25.
- **Evidence:** `screenshots/36-edit-saved-modal.png`, `screenshots/40-price-25.png`.

---

## Perceived load-time table (simulator / Playwright, wall-clock, ±polling-interval precision — not a formal profile)

| Screen / transition | Elapsed | Flagged |
|---|---|---|
| Landing → Login → Home (seller session) | < 2s | — |
| ItemCreate submit → "Thanks for submitting!" | ~2s | — |
| L01 (DB read-back) | 456ms–1.3s | — |
| L02 (browser login + approve + queue) | 5.4–6.8s | — |
| L03 (DB read-back) | 120–141ms | — |
| L04 (DB read-back) | 361ms | — |
| NotificationCenter tap → Item Detail | ~1–2s | — |

No transition ≥ 3s (L02's 5.4–6.8s includes browser boot + admin login + multi-step UI, not a single screen render). **Perceived Load-Time Verdict: GOOD.**

---

## UX / design-system notes (per §6.4)

Screens visited: Login (admin), `/listings` (admin), MyListings, ItemCreate, EditListing, NotificationCenter, Item Detail, phone-verification modal, submit-success modal, "Changes Saved" modal.

- **Design-system compliance:** The mobile screens reviewed (NotificationCenter, Item Detail, success modals) use the documented palette (`#5DBB8E` primary, semantic green Tag icon, `#F0F0F0` filled inputs, `#1A1A1A`/`#6B6B6B` text tiers). No deviations observed on the mobile surfaces reviewed. The admin portal is a separate design system (not covered by `design-system-passitup.md`).
- **Copy clarity:** Notification copy is parent-friendly ("Your listing … was approved and is now live."). Submit/approval flows are clear. No rewrites needed.
- **Structural:** all flows have clear back/close affordances and visible success states ("Thanks for submitting!", "Changes Saved").

---

## Friction & tooling findings

1. **ItemCreate/EditListing AX-tree gaps (locator gap):** `ConditionSelector` rows, dev-fixture dynamic labels, and EditListing title/price inputs/Save button are not surfaced (or carry static labels) in the iOS AX tree. Worked around via OCR + pixel analysis (§5.9). Recommend adding `accessible`/testIDs to these controls.
2. **OTP digit entry is flaky under bulk typing** (drops chars); digit-by-digit + manual Verify is the reliable recipe (already documented in repo memory).
3. **LogBox overlay** ("TypeError: Network request failed" console error — from the phone-OTP Edge Function failure + an EditListing image network error) is session-scoped dev noise, not dismissible via the header controls at 3 attempts; cleared via app relaunch (§5.8 applies only to fatal overlays — this was non-fatal console error LogBox).
4. **Admin `/listings` queue auto-refresh race** after approval (stale `pending` filter clobbers results) — handled in-spec with poll-and-re-search; recommend the admin page clear the status filter or refresh to the approved item's new bucket post-approval (dev-side enhancement, not a defect).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-L01–L04 (Group L — Admin Listing Approval) — real Playwright E2E + mobile legs, run end-to-end on staging.
**Design-System Compliance:** PASS — mobile surfaces reviewed (NotificationCenter, Item Detail, success/phone modals) match `design-system-passitup.md` (primary green `#5DBB8E`, semantic colors, filled inputs); no deviations found. Admin portal is a separate design system (not assessed against passitup).
**Perceived Load-Time Verdict:** GOOD — no single transition ≥ 3s; L02's 5.4–6.8s includes browser boot + admin login + multi-step UI. Labeled per §5.7.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — NotificationCenter: "Listing Approved" title + clear parent-friendly body copy, green `Tag` icon per spec.
- CONFIRMED — Item Detail (deep-link landing): title/price/condition/category/seller info render correctly.
- CONFIRMED — Submit-success modal ("Thanks for submitting!") + "Changes Saved" modal: clear, single primary CTA each.
- CONFIRMED — Phone-verification modal: clear step copy, DEV-bypass helper surfaced appropriately.
**Verdict Summary:** 4 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.
**Critical Findings:**
1. **[RESOLVED in-run, spec fix]** `ensureAdminSession` raced the client-side auth redirect → login skipped → L02 failed on the login page. Fixed with `waitForURL` on the redirect decision. (The app's auth guard is client-side; the spec must wait for it.)
2. **[RESOLVED in-run, spec fix]** L02 post-approval badge assertion was incompatible with the `pending`-filtered queue + auto-refresh race. Fixed with filter→`active` + poll-and-re-search.
3. **[INFO, verified]** The two backend blockers named in the task are confirmed fixed on staging: `admin_approve_listing` emits the `listing_approved` notification with correct `deep_link`, and `tr_items_require_reapproval_on_seller_edit` reverts edited listings to pending and clears approval metadata.
4. **[Observation, pre-existing]** Seed/legacy `available` items with `approved_at = NULL` (e.g. `07af560b-…`) violate the approval-workflow invariant — dev-side cleanup candidate (not this run's defect).
**App State Left Behind:** `cc81e86c` (available, price 25) and `f5bac12c` (available, price 15) — both "QA L Group Chain Item 0821" (test-seller). 4 `listing_approved` notifications created for test-seller. **test-seller's `phone_verified_at` is now SET** (was NULL at run start; verified via DEV bypass during item submission — this is a real, persistent state change on the shared persona; the registry's "phone verified: yes" note is now accurate). Simulator app left logged in as test-seller on Item Detail. Admin portal sessions: the Playwright browser context is ephemeral.
**Why It Matters:** The Group L approval chain is now fully verified end-to-end against live staging: pending items are buyer-invisible until admin approval; approval makes them visible and notifies the seller (correct type, category, deep link, icon, and tap-through); editing an approved listing re-enters review. This closes the Group L QA gap and validates the two backend notification/reapproval fixes live.
**How to Verify/Reproduce:**
- Spec: `cd p2p-kids-admin && PLAYWRIGHT_ADMIN_E2E=true npx playwright test --grep "L0[1-3]" --reporter=list` (needs a pending seller item); L04: `--grep "editing the approved listing"` (needs the seller edit done). Credentials from `.env.local` (git-ignored).
- Evidence: `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/screenshots/*.png` + `execution-trace-l01-mobile-prep.md`.
**Known Gaps / Not Tested:** On-device push notification delivery (in-app NotificationCenter verified; real push not exercised). Re-approval of a flagged/in-review item (`MODERATION_BLOCKED_FLAGGED` path — gate disabled on staging). The L03 "tap" was done on the in-app notification (deep link mapping verified); push-tap behavior not covered.
**What Needs To Be Fixed Next:**
1. **Fix (dev, low):** seed/legacy `available` items with `approved_at = NULL` — set approval metadata so the approval invariant holds for all `available` items.
2. **Fix (dev, low):** add `accessible` + dynamic labels/testIDs to `ConditionSelector` rows, EditListing title/price/Save controls, and dev-fixture labels so future mobile runs are not pixel/OCR-dependent.
3. **Fix (dev, low):** after admin approval, `/listings` auto-refresh runs with the stale status filter and can clobber results — consider refreshing to the approved item's new status bucket (or clearing the filter) on post-approval refresh.
**UX Enhancement Ideas (optional, not defects):**
- On EditListing, the price decimal-keypad field showed a dev LogBox "TypeError: Network request failed" from a background image/network call — consider suppressing non-actionable network errors in dev builds to avoid confusing overlay noise during long forms.
- On `/listings` (admin), after approving, the row briefly stays in the pending-filtered list before the refresh — consider an optimistic status flip in the row for immediate feedback.
**Suggested Next Session:** Execute the remaining on-device push-notification verification (if a push harness is available) and re-verify L01–L04 after the two dev-side fixes (approval-metadata seed invariant + locator instrumentation) to confirm the chain stays green.
**Suggested to Improve Agent Rules:** When a dev-build LogBox (non-fatal console-error overlay) blocks on-device verification, prefer terminate + relaunch (session persists) over repeated header-tap dismiss attempts — the LogBox header controls were not reliably discoverable via tree/pixel in this run.
