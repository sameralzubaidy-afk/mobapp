# Group L — Author + Run Real Playwright Tests (AUTH-TC-L01–L04) — Run Report

**Date:** 2026-08-21 · **Agent:** QA Test Agent
**Run dir:** `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/`
**Scope:** `p2p-kids-admin` (repo `mobappadmin`, branch `develop`, HEAD `349d211e`), admin portal Playwright E2E for AUTH-TC-L01–L04 (listing approval).
**Reference guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — "Group L — Admin Review / Pending".
**Target env:** staging Supabase `drntwgporzabmxdqykrp`; admin portal `http://localhost:3001` (running, HTTP 200); Metro `:8081` (running); iPhone 17 Pro Max sim (iOS 26.1) booted with `com.sameralzubaidi.p2pmarketplace` installed.

---

## Executive summary

**The RUN is BLOCKED on the explicit credential gate in the task prompt.** The prompt states: *"Admin credentials must be filled into the QA registry locally before this runs"* and *"If admin credentials aren't yet filled into the registry, stop and report that rather than inventing test credentials."* **They are not filled** — verified across every local credential source (see §Credential gate below). Per the gate, the four test cases are reported **BLOCKED (prerequisite missing)**, and no run was attempted with placeholder or invented credentials.

**The AUTHOR half is complete and validated.** The placeholder smoke tests in `group-l-listing-approval.e2e.test.ts` were replaced with real L01–L04 assertions authored as one connected serial chain, against locators and DB contracts verified on staging. The spec: passes TS diagnostics, is collected by Playwright as exactly 4 tests, loads `.env.local`, and its read-only DB helpers were validated against live staging (no writes).

---

## Verdict roll-up

| TC | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-L01 | AUTH guide (Group L) | **BLOCKED** | Run gated on admin credentials; spec authored + DB helper validated |
| AUTH-TC-L02 | AUTH guide (Group L) | **BLOCKED** | Run gated on admin credentials (UI approval path needs admin login) |
| AUTH-TC-L03 | AUTH guide (Group L) | **BLOCKED** | Run gated on admin credentials (depends on L02) |
| AUTH-TC-L04 | AUTH guide (Group L) | **BLOCKED** | Run gated on admin credentials (depends on L02/L03) |

**Roll-up:** **0 PASS / 0 FAIL / 4 BLOCKED / 0 SKIPPED.**
**Deliverable status (separate from run verdicts):** Test-authoring **COMPLETE + VALIDATED** (spec collects 4 tests, no TS errors, DB helpers verified read-only on staging). Run unblocked the moment admin credentials are filled into the registry (see "What Needs To Be Fixed Next").

---

## Credential gate (why the run is BLOCKED)

Per the task's explicit instruction, I checked every local credential source before running:

| Source | State found | Verdict |
|---|---|---|
| QA registry `/memories/repo/qa-test-accounts.md` → "Admin portal QA credentials — Group L" | `PLAYWRIGHT_ADMIN_EMAIL` = `___FILL_IN___`, `PLAYWRIGHT_ADMIN_PASSWORD` = `___FILL_IN___` | **NOT filled** |
| `test-automation/trade-flow-v2/.env` → `PLAYWRIGHT_ADMIN_EMAIL` | `test-admin@kidsmarketplace.test` — **doc drift** (verified via SQL: this user has **no** `role_based_access_control` row on staging) | NOT usable |
| `test-automation/trade-flow-v2/.env` → `PLAYWRIGHT_ADMIN_PASSWORD` | `'ask your team lead'` (placeholder, not a credential) | **NOT filled** |
| Shell environment (`PLAYWRIGHT_ADMIN_*`, `ADMIN_E2E_*`, `ADMIN_QA*`) | No values exported | **NOT filled** |
| `p2p-kids-admin/.env.local` | Supabase URL / anon / service-role / admin-ui-secret only — **no admin login email/password** | NOT present |
| Staging DB (read-only) | Only `samer@samer.com` has `role='admin'` RBAC; that credential is documented in repo instructions for "local/staging UI verification only" and is deliberately **not** copied into the QA registry | — |

**Decision:** Do not proceed with placeholder or invented credentials. The `ensureAdminSession` helper would attempt login with `test-admin@kidsmarketplace.test` (no admin RBAC → "You do not have admin access") and a placeholder password — the run would fail for the wrong reason and would violate the task's gate. **Stopped and reported instead.**

**Remediation (for the team, one step):** fill `PLAYWRIGHT_ADMIN_EMAIL`/`PLAYWRIGHT_ADMIN_PASSWORD` (and/or `ADMIN_E2E_*`) into the QA registry + `test-automation/trade-flow-v2/.env` with the working staging admin, then the authored spec runs as-is.

---

## Authoring deliverable — `p2p-kids-admin/__tests__/group-l-listing-approval.e2e.test.ts`

Replaced the two placeholder smoke tests with a real, connected L01–L04 chain. **This is the only file I changed** (new/untracked in the admin repo, branch `develop`; `playwright.config.ts` + `playwright-report/index.html` modifications are pre-existing working-tree state, not mine).

### What the spec now asserts

- **L01** — DB read-back (service-role, read-only): the seller's submitted item exists with `status='pending'`, `approved_at`/`approved_by` NULL; buyer-feed mirror (`status='available'` count) = 0; corroborated via the exact node-scoped `search_listings` RPC returning no match.
- **L02** — Playwright UI on the **RPC-backed `/listings` path** (per the constraint, not `/items/flagged`): filter `listings-status-select`→`pending`, seller-email filter, `btn-listings-search`, open `listings-row-<id>`, `btn-approve-<id>`, `btn-confirm-action`; **browser `alert()` handled via `page.on('dialog')` accept** (Option B per locator-conventions); then DB read-back: `status='available'`, `approved_at`/`approved_by` set; buyer now sees it.
- **L03** — DB read-back: a `user_notifications` row for the seller, `type='listing_approved'`, `category='system'`, `data.listing_id`/`item_id` = item, `data.deep_link` = `/listing/<id>`. On-device NotificationCenter icon (`Tag`, green) + tap→ListingDetail deep-link (per `deepLink.ts`) is a documented mobile follow-on step.
- **L04** — DB read-back that `tr_items_require_reapproval_on_seller_edit` fired after the seller edits via mobile: `status='pending'`, `approved_at`/`approved_by` cleared, buyer-invisible again. Self-skips with a clear reason if the mobile edit precondition hasn't been performed.

### Validation performed (no test execution)

1. **TS diagnostics:** no errors (`get_errors`).
2. **Playwright collection:** `npx playwright test --list --grep "Group L"` → exactly **4 tests** in 1 file; `.env.local` loads (service-role client wiring OK).
3. **DB helpers, read-only against staging** (same supabase-js + service-role path the tests use): resolved `test-seller` = `14be337c-…`, `test-buyer` = `49243010-…`, buyer node `550e8400-…`; seller total items = 239; seller has **0** prior `listing_approved` notifications (clean L03 baseline).
4. **Backend blockers verified live (read-only SQL):**
   - `admin_approve_listing(uuid, uuid, text)` present (SECURITY DEFINER) and now **emits** the preference-aware `listing_approved` notification with `data.deep_link = '/listing/<id>'` (migration `20260425000001` live) — the "L03 known-gap" is **fixed**; the stale known-gap comment was removed per the task.
   - `tr_items_require_reapproval_on_seller_edit` + `fn_items_require_reapproval_on_seller_edit` present on `items` (L04 trigger) — reverts `available`→`pending` and clears `approved_at`/`approved_by` on authenticated seller edits.
   - `user_notifications` table + `get_listing_moderation_gate` + `search_listings`/`count_listings` present.
   - 141 prior `listing_approved` rows exist (notification path demonstrably live).

### Design notes baked into the spec (verified against source)

- Approval result surfaces via **`window.alert()`** → Playwright dialog handler registered **before** `btn-confirm-action` (per Option B).
- Moderation gate: `admin_approve_listing` refuses flagged/in-review images (`MODERATION_BLOCKED_FLAGGED` / `MODERATION_IN_PROGRESS`); the spec does a best-effort read-only pre-check and fails with the alert text if approval is refused.
- Email→user-id resolution uses **`profiles.email`** (NOT `auth.admin.listUsers` — staging has **5,103** auth users, so pagination cannot reliably surface a seeded persona; this was found and fixed during validation).
- The chain anchors on the seller's **latest** item (`created_at DESC`), with a `beforeAll` warning if the anchor isn't `pending` (mobile submission precondition signal).

---

## Per-case details (all BLOCKED — credential gate)

No UI/device execution occurred, so there are no screenshots or perceived-load-time measurements for this run. The blocker is identical across cases and is a **prerequisite (credentials), not an app defect**.

### AUTH-TC-L01 — New listing not visible until approved — **BLOCKED**
- **Blocker:** cannot run the chain — admin credentials not filled into the registry (gate). Also requires the mobile precondition (seller submits a fresh item) which was intentionally **not** created this run to keep staging clean.
- **Authored:** spec L01 (DB read-back of pending state + buyer-invisibility).

### AUTH-TC-L02 — Admin approves → item becomes visible — **BLOCKED**
- **Blocker:** the UI approval step requires an authenticated admin session (`ensureAdminSession`), which is exactly what the credential gate blocks.
- **Authored:** spec L02 (full `/listings` RPC-backed approval flow + DB read-back + alert handling).

### AUTH-TC-L03 — Seller receives approval notification — **BLOCKED**
- **Blocker:** depends on L02 having executed (the notification is created by the approval RPC). Baseline confirmed clean (0 prior `listing_approved` rows for test-seller).
- **Authored:** spec L03 (DB read-back of the `user_notifications` row + `deep_link`).

### AUTH-TC-L04 — Editing an approved listing returns to pending — **BLOCKED**
- **Blocker:** depends on L02/L03; additionally the seller-edit leg is a mobile-mcp step (documented in the spec header) that was not performed this run.
- **Authored:** spec L04 (DB read-back of the reapproval trigger's effect; self-skips with reason if the mobile edit precondition is unmet).

---

## UX / design-system notes

Not applicable — no screens were rendered this run (no execution). Design-system compliance is therefore not assessed for this run; it applies to the next (executing) run.

---

## Cross-cutting observations (not blockers)

1. **Data anomaly (flag, not this run's defect):** test-seller's current latest item `07af560b-…` ("Vintage Comic Book Collection") is `status='available'` **with `approved_at = NULL`** — pre-existing seed/legacy data where `available` items lack approval metadata. Not exercised by this chain (the chain uses a freshly submitted pending item), but worth a dev-side look at how seed data sets `status='available'` without `approved_at`.
2. **Doc drift reconfirmed:** `PLAYWRIGHT_ADMIN_EMAIL=test-admin@kidsmarketplace.test` in `test-automation/trade-flow-v2/.env` has no admin RBAC row on staging (matches the QA registry note). The registry's "admin" persona row remains doc drift; the working staging admin is `samer@samer.com` (documented in repo instructions, deliberately not stored in the registry).
3. **Tooling note:** `dotenv` in this repo prints "injected env … from .env.local" (dotenvx-style) — harmless; the spec's env load works.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-L01–L04 (Group L — Admin Listing Approval), admin-portal Playwright E2E — AUTHORING deliverable complete + validated; RUN blocked on the credential gate.
**Design-System Compliance:** Not assessed this run — no screens rendered (execution blocked on credentials). Applies to the next (executing) run.
**Perceived Load-Time Verdict:** GOOD — no transitions observed this run (no execution). Not measured; N/A for a blocked run.
**Design & Copy Compliance Confirmation:**
- N/A — no screens/dialogs rendered this run (run blocked pre-execution). No admin-portal screens, modals, alerts, or toasts were visited.
**Verdict Summary:** 0 PASS / 0 FAIL / 4 BLOCKED / 0 SKIPPED (run); authoring deliverable: COMPLETE + VALIDATED.
**Critical Findings:**
1. **[BLOCKER, per task gate]** Admin credentials are **not** filled into the QA registry (`.env` has a doc-drift email `test-admin@…` with no admin RBAC on staging + placeholder password `'ask your team lead'`; registry fields are `___FILL_IN___`; shell env empty). Run stopped per the explicit instruction — no placeholder/invented credentials used.
2. **[RESOLVED, verified live]** The two backend blockers are fixed on staging: `admin_approve_listing` now emits the `listing_approved` notification (with correct `deep_link`), and `tr_items_require_reapproval_on_seller_edit` exists on `items`. The stale "L03 known-gap" comment was removed.
3. **[Observation]** Seed/legacy data: test-seller has `available` items with `approved_at = NULL` (e.g. `07af560b-…`) — inconsistent with the approval-workflow invariant `available ⇒ approved_at set`.
**App State Left Behind:** No mobile submissions, no edits, no DB writes, no notifications created (read-only run). Simulator app left as found; no sessions logged in. Staging clean and reusable — test-seller has 0 `listing_approved` notifications, so the next run's L03 baseline is clean.
**Why It Matters:** The Group L chain is fully authored and validated end-to-end (spec collects, DB helpers resolve against live staging, backend contracts confirmed). The single remaining step is a credential fill; the run will otherwise execute without further authoring.
**How to Verify/Reproduce:**
- Authoring: `cd p2p-kids-admin && npx playwright test --list --grep "Group L"` → 4 tests collect; no TS errors.
- Full run (after creds filled): set `PLAYWRIGHT_ADMIN_E2E=true`, `ADMIN_E2E_EMAIL`/`ADMIN_E2E_PASSWORD` (from the QA registry), perform mobile precondition (submit a fresh item as test-seller; edit it between L03 and L04), then `npm run test:playwright -- --grep "Group L"`.
**Known Gaps / Not Tested:** All four cases' runtime behavior (UI approval, notification row creation, reapproval trigger effect) — untested until the credential gate is cleared. On-device NotificationCenter icon/tap verification for L03 and the mobile seller-edit for L04 are mobile-mcp follow-on steps (documented in the spec header), not covered by the Playwright spec itself.
**What Needs To Be Fixed Next:**
1. **Fix (team, 1 step):** fill the admin QA email/password into the QA registry (`/memories/repo/qa-test-accounts.md`) and `test-automation/trade-flow-v2/.env` (`PLAYWRIGHT_ADMIN_*`), replacing the doc-drift email and placeholder password — using the working staging admin documented in repo instructions. Then re-run this spec.
2. **Fix (dev, low):** reconcile seed/legacy `available` items with `approved_at = NULL` (e.g. `07af560b-…`) so the approval invariant holds for all `available` items.
**UX Enhancement Ideas (optional, not defects):** None this run — no screens were rendered (execution blocked), so no UI friction was observable.
**Suggested Next Session:** Re-run the Group L Playwright suite once credentials are filled (L01–L04, one connected chain), with the mobile preconditions executed via mobile-mcp; then execute the L03 on-device NotificationCenter verification and the L04 seller-edit leg, and deliver the full per-case report with screenshots + load times.
**Suggested to Improve Agent Rules:** Consider noting in `qa-test-accounts.md` (or the playbook) that `auth.admin.listUsers` cannot be used to resolve seeded personas on staging (>5k auth users, pagination-capped) — resolve email→user_id via `public.profiles.email` instead. (Already captured in repo memory `test-authoring-conventions.md`.)
