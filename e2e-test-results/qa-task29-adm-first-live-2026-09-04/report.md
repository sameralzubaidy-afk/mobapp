# QA Task 29 — ADM's First Full Real Execution Round

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task29-adm-first-live-2026-09-04/`
**Verdict:** **~88 of 160 ADM cases executed live** (72 PASS / 8 PARTIAL / 7 OPEN / 1 pre-existing SKIP / ~72 remaining). This is ADM's first real PASS count — the largest previously-untouched guide now has a genuine verdict base. **Group F (restored page) + Group A + the individually-corrected cases all PASS live**, with three genuine first-run discoveries (one MED-HIGH config behavior, one MED payout-list 401, one M subscription-list default).

---

## 0. Session recon (R29 busy check + environment)

- **R29 busy check:** no maestro/run-suite/playwright/mobilecli in flight; simulator `3F3293A3` booted; admin portal `:3001` + Metro `:8081` up. Shared admin browser page logged in as `samer`.
- **Login:** `samer@samer.com` / `samer` (guide's old `test-admin` account row is stale; the live admin is samer). `x-admin-secret` noted for API calls.
- **Precondition met:** admin portal browser session + DB read-back both enabled.

## 1. Priority results

### Group A (Auth & Dashboard) — 6/6 PASS
A01 login → dashboard; A02 non-admin RBAC rejection ("You do not have admin access"); A03 layout order (intro → health strip → Action Center → KPI cards, no nav-duplicating home cards); A04 direct-route → login redirect; A05 expired-token single redirect (no loop); A06 KPI card styling (white/16px r/Level-1 shadow/16px pad/24px values) — **label 12px vs documented 14px** (verify against admin design tokens).

### Group F (Global Config — restored page) — highest-value round
- **F01–F04, F05, F07–F10 PASS.** The Dev Task 91-restored `/settings/trade-timing` renders all 10 sections (Offer Expiry / Offer Limits / Auto-Complete / Pickup & Payout / Buyer Cancel Requests / Swap Points / Transaction Fees / Seller & Buyer Platform Fees / Tiered Buyer Fee R1 / Legacy read-only) with per-field "LAST UPDATED · BY SAMER@SAMER.COM". Single-source verified: a trade-timing save reflects identically on `/config` FEES/TRADE/FEATURE FLAGS with matching editor, and writes `admin_audit_log.update_trade_timing_settings` (actor non-null = R35 ✓).
- **F05:** N1 keys editable; a REAL live round-trip proven (`payout_buffer_days` 2→5→2, DB-verified both directions); `fn_admin_config_int` helper returns 72/2/7-default.
- **F06:** the 172h guardrail **HARD-BLOCK** verified client-side (exact copy on both fields) AND server-side (P0001 from the DB trigger).
- **F09** stays on `/analytics` only (confirmed — NOT duplicated on the trade-timing page). **F10** legacy keys are read-only disabled inputs.

### Individually-corrected cases — all hold live
- **J01:** all four tax sub-pages render with cross-links; **bare `/tax` = 404** (fix holds).
- **Q02/Q03:** Hide + Approve confirm copy EXACTLY match the corrected guide text (captured live, dismissed without mutating).
- **L06:** dashboard `sp-economy-summary` 4 tiles present; `card-sp-wallet` gone.
- **W01:** sidebar exactly 7 labeled groups (OVERVIEW/TRADE OPERATIONS/USERS & TRUST/MONETIZATION/CATALOG/PLATFORM CONFIG/ANALYTICS), Action Center pinned under OVERVIEW.

### Clean-pool sweep (representative)
B (users list/drawer/analytics/sort), C (listings + flagged queue), D (categories), G (policies), H (trade list + detail money breakdown DB-verified: $45 + $0.99 fee + $0 tax = $45.99 = 4500+99+0 cents), N (referrals), O (ID-badge queue 24 pending = AC count), P (badges), Q (reviews), V (monitoring + cron), W (sidebar nav), X (Action Center cards + severity + badges + dashboard embed + cancel insights), Z (health strip 6 indicators + deep-links), N2 (financial audit), Regression (R01/R02/R05).

## 2. GENUINE FIRST-RUN FINDINGS (worth their own follow-up)

1. **[MED-HIGH, F06/F03] R2 server-side guardrail is ORDER-DEPENDENT** — `upsert_admin_config_setting` is called per-key in a sequential non-transactional loop, and the `fn_validate_trade_timing_config` BEFORE-UPDATE trigger validates each key against the **currently-stored** paired value. From offer=48/pickup=72, a single Save raising offer→100 AND lowering pickup→67 (valid 167h) FAILS: the offer write is validated against stale stored pickup=72 (172h) before pickup=67 lands. Workaround = two saves. The guide's F06 step-3 one-batch expectation does NOT hold. Recommend: wrap the multi-key save in a single transaction / deferred constraint, or validate the batch's intended final state server-side.
2. **[MED, K02/K03/Z05] Seller Payouts list data 401s** — `/payouts/earnings` shell renders but `fetch('/api/admin/payouts')` returns 401 "No valid authentication provided" (2×, `loadPayouts` page.tsx:64), while sibling admin APIs (users, action-center) work in the same logged-in session using the same `verifyAdminAuth` helper. K02 data-leg, K03 (retry), and Z05 (Failed Payouts deep-link) are all blocked on this. Dev: check why `/api/admin/payouts` rejects the browser session (header-vs-session auth mismatch?).
3. **[LOW-MED, M02] /subscriptions defaults to a per-user view** — the page shows "Provide ?user_id=... to view subscriptions → No subscriptions found" rather than an all-subscriptions list. Verify the intended default (a list would need a different default query).

## 3. Tooling blockers / environment (recorded, not app defects)
- **`prompt()` not supported** by the embedded browser driver → B03 (suspend), B06 (reset), B07 (unsuspend) admin actions that use native `prompt()` for a reason cannot have their commit legs driven through this channel (buttons + UI verified; the guide's own Dependencies note anticipates prompt handling that this driver can't do). Recommend a prompt-capable driver path for those, or (UX) replacing native `prompt()` with an in-app reason modal.
- **Controlled React number-input state sync is flaky on the settings pages** when multiple ordered/dependent fields are edited before Save (DOM updates but React state doesn't) — single-field edits + the "fill dependent 'must be < X' fields before their parent" ordering work; a full single-field value round-trip (payout 2→5→2) persisted and DB-verified.
- Config changes were all scoped and reverted (timing keys back to 48/72/24/2/2 baseline; no residue).

## 4. Config / fixture state left behind
- All trade-timing keys reverted to baseline (offer 48, pickup 72, notif1 24, notif2 2, payout 2) — DB-verified. `admin_audit_log` has the expected `update_trade_timing_settings` rows (from the round-trips) — normal.
- DT-99 throwaway (`qa.dt99.l2success`, 3df0629c) still active — no accidental suspend.
- No categories/users/moderation state changed. Admin session left logged in as samer.
- Reviewer rows untouched (Q02/Q03 confirms dismissed without committing).

## 5. Perceived load-time
All page transitions rendered well within <3s (typical 1–3s for the heavier analytics/config pages; the /monitoring/cron page had one ~4s slow-load on first hit, then fast — environment, not a defect). No formal profile.

## 6. Where to go next
- Ledger: `ledger-FULL-160.md` (all 160, per-case) · Screenshots: `screenshots/` · Tracker: `QA-TESTCASE-STATUS-2026-09-03.md` updated.
- Suggested next batches: (1) a **dedicated disposable-fixture moderation round** to close C03–C10 + X05 (flagged approve/reject/delete/pause/request-edits) and the **MSG G05/G08/G09 bonus** (moderation toggles) in one session; (2) the **prompt()-driven user actions** (B03/B06/B07) via a prompt-capable path; (3) Y-group command palette (⌘K) as a keyboard-feature round.
