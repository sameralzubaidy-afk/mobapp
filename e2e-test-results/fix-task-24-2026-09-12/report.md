# FIX-Task-24 — Payment-status mirror + expiry tax leak + photo seed + docs + UX

**Date:** 2026-09-12 · **Source:** QA Task — P2 remainder / Group L / O-1 C07 (`e2e-test-results/qa-p2-remainder-groupL-2026-09-12/`, findings F1–F10) · **Amazon liability-disclaimer: excluded per brief.**
**Staging project:** `drntwgporzabmxdqykrp` · **HEAD at start:** `da131a69` (FIX-Task-23)
**Evidence:** `screenshots/android-picker-6-seeded-photos.png`, `screenshots/android-bulk-dev-fixture-reasons.png`

---

## Roll-up

| # | Sev | Item | Outcome |
|---|---|---|---|
| 1 | MED | `payments.status` is a derived projection | ✅ **FIXED** — renamed `derived_state` + commented; readers re-pointed; applied + verified on staging |
| 2 | MED | Offer-expiry leaks permanently-stuck tax | ✅ **FIXED** — RPC now voids tax itself; recipe → EF; 52 stuck rows backfilled to 0 |
| 3 | MED (env) | Photo seed passed while the picker showed 1 image | ✅ **FIXED** — `DCIM/Camera` + real fixture set + presence-based guard; picker now lists **6** (on-device verified) |
| 4 | LOW | QA/seed harnesses leak tax on cancel | ✅ **FIXED** — 3 scripts void tax; documented counts printed |
| 5 | LOW | 4 guide reconciliations | ✅ **DONE** — O-3 C05 / O-3 C06 / O-2 C04 / O-06 + the flat-50% class sweep (O02) |
| 6 | LOW (dev) | LogBox overlay eats taps | ✅ **FIXED** — handled-path `console.warn` downgrades + opt-in `EXPO_PUBLIC_QA_QUIET_LOGBOX` |
| 7 | UX | Bulk SP warning clipped mid-sentence | ✅ **IMPLEMENTED** — two complete clauses |
| 8 | UX | Dev fixtures grey out silently | ✅ **IMPLEMENTED + on-device verified** — inline reason line + `accessibilityState`/hint |
| 9 | UX | "Refunded on" local-time ambiguity | ✅ **IMPLEMENTED** — shared UTC-explicit `formatDbTimestamp` + unit tests |

---

## 1 — `payments.status` → `payments.derived_state` (MED)

**Root cause (QA F1).** `trg_payments_sync_from_trade → fn_payments_sync_from_trade()` maps
`trades.status='in_progress'` ⇒ `payments.status='captured'` **and stamps `captured_at`** — while the
real Stripe PI is still an uncaptured authorization hold. QA read that and nearly filed a HIGH
"early capture" defect; it also made O-2 C02/C05's "PI in `requires_capture`" limb un-DB-checkable.

**Fix.** Column **renamed to `derived_state`** with a loud `COMMENT ON COLUMN`; a Stripe-sourced
`stripe_status` column was deliberately NOT added (it would need a new sync path across 5 Edge
Functions + a webhook, and could itself go stale).

**Dependency audit before renaming** (every reader/writer, by grep):
`fn_payments_sync_from_trade` (writer), `rpc_record_payment_refund` (r+w), `admin_health_summary`
(reads `p.status='failed'`), `admin_payments_view`, `idx_payments_status`, and the two admin-portal
files. **Not affected:** `trade-refund/index.ts` (explicit column list), `r4_dispute_cost_accounting`
(`total_charged_cents` only), `rpc_sync_payment_refund_webhook` (`payments%ROWTYPE`, never `.status`).

**Files:** `supabase/migrations/20260912000009_fix_task_24_payments_derived_state.sql`;
`p2p-kids-admin/src/app/api/admin/payments/route.ts`; `p2p-kids-admin/src/app/payments/page.tsx`
(`DERIVED_STATE_COLORS`, `derived_state` field, header **"Derived state"**, plus an on-surface note
that the pill is our ledger's projection, not the processor's status).

**Applied + verified on staging** (one atomic `apply_migration` + the health-RPC re-point):

| Check | Result |
|---|---|
| `payments` columns | `derived_state` only (no `status`) |
| `admin_payments_view` columns | `derived_state` only |
| Indexes | `idx_payments_derived_state` present; `idx_payments_status` gone |
| `admin_health_summary()` | returns all **6** indicators, right order (`payments,email_delivery,nodes_active,failed_payouts,uptime,gmv_7d`) |
| Data preserved | 892 payment rows; 4 `captured` |
| Column COMMENT / constraint | comment text present; `payments_derived_state_check` |
| Trigger end-to-end | a trade UPDATE wrote `derived_state='cancelled'` |

> ⚠️ **Self-caught defect during application (worth recording).** The `admin_health_summary` re-point
> used `replace(def, 'p.status', 'p.derived_state')` — which **also matched the substring inside
> `sp.status`** (seller_payouts). The live call caught it immediately: `42703 column sp.derived_state
> does not exist`. Fixed with a corrective guarded patch that asserts BOTH predicates
> (`p.derived_state = 'failed'` **and** `sp.status = 'failed'`) before writing, and refuses otherwise.
> **Lesson: anchor a body-patch token to its full expression, and always invoke the object afterwards.**

## 2 — Offer-expiry could strand tax at `quoted` forever (MED)

**Root cause (QA F2).** `rpc_process_expired_offers()` only did the DB status change; the tax void
**and** the Stripe PI cancel live only in the `process-expired-offers` Edge Function. Driving the bare
RPC — *the documented fast-clock recipe* — therefore cancelled the trade but left
`tax_status='quoted'` with `voided_at` NULL **permanently**, because the cron only re-processes trades
still in `pending`.

**Fix (owner decision: self-contained RPC).** The RPC now voids the tax record itself, guarded to the
voidable statuses so the EF-first path stays a clean no-op, wrapped so a tax-leg failure can never
abort the sweep, and reports `tax_voided_count`. `rpc_void_tax_for_trade` itself was **not** modified
(12+ callers) — see the handoff's "Further considerations".

**Recipe corrected in the same change** (the PI cancel still requires the EF):
- QA playbook **R14** now POSTs the EF (+ a ready-to-paste `curl`).
- The 4 canonical guide recipes (R03 · B05d · the fast-track block · O2-C07) + the expiry state-model
  reconcili note.

**Applied + verified on staging by REAL invocation** on a disposable fixture (`5ceeaa0e…`, tagged
`fixture:FIX-Task-24-expiry-tax`, since deleted):

```
rpc_process_expired_offers(100) → {"success":true,"expired_offers_processed":1,"tax_voided_count":1, ...}
read-back (separate statement): status='cancelled' · cancellation_reason='Offer expired'
  · cancelled_at set · tax_status='voided' · voided_at set · refunded_tax_cents=0
  · payments.derived_state='cancelled'
```

**Backfill — residue was 52 rows, not the 28 reported:**

| cancellation_reason | rows | Σ tax |
|---|---:|---:|
| `buyer_cancelled` (harness) | 38 | $59.14 |
| `Offer expired` | 8 | $12.25 |
| *null* | 4 | $5.60 |
| `offer_expired_competing` | 1 | $1.75 |
| `QA cleanup (K04 slot free)` | 1 | $0.84 |

All 52 voided through `rpc_void_tax_for_trade` (the sanctioned lifecycle RPC). Post-check:
**`remaining_stuck_rows = 0`**; 12 `quoted` records remain, all on genuinely in-flight offers.
Script: `cleanup-fix-task-24-stuck-tax.sql` (3 separately-runnable steps + a rollback note).

## 3 — Android photo seed (MED, environment)

**Root cause (QA F3).** Two independent defects: (a) files were pushed to `/sdcard/Pictures/QA`,
a bucket the system picker does not index reliably (24 MediaStore rows, **1** visible thumbnail);
(b) the success guard was "the row count must increase" — a **false negative** on any already-seeded
machine. It also silently fell back to `assets/` (app icons), so the "photos" weren't photos.

**Fix.** Default target is now **`/sdcard/DCIM/Camera`**; the repo ships a real
**`assets/qa-media/`** set (6 distinct PNGs, 92 KB total, regenerable via
`node scripts/qa/generate-qa-media.mjs` — dependency-free PNG writer); the fallback now requires
`--allow-fallback`; the guard asserts **presence** (every pushed file has a MediaStore row **and**
exists on the device at the pushed path) and **prints which assets were already registered**.
Also fixed: `adb push <dir> <dest>/` nests the directory — the script now expands and pushes files flat.

**Verified.**
- `--count`, run 1, run 2 all exit 0; run 2 reports `already registered: 6` — the exact false negative
  is gone.
- **On-device:** the system photo picker lists **all 6** seeded fixtures (was 1) —
  `screenshots/android-picker-6-seeded-photos.png`. This unblocks the 2+ photo legs (e.g. O-1 C07's
  2-item breadth) that were capped at one image.

## 4 — Harness cleanup leaks (LOW)

`scripts/qa/reset-offer-fixtures.mjs`, `scripts/cleanup-test-trades.ts`, `scripts/seed-staging-data.ts`
(B08) now void the tax record for trades they cancel/own, printing
`voided · no tax record · already voided · failed`. Expected results are `noop` (no tax record) —
a real void means earlier residue, which is exactly what item 3's backfill removed. Canonical logic
stays in the DB RPC (which also zeroes stale refund fields, DT71).

## 5 — Guide reconciliations (LOW)

Canonical guide `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`, each with
a `🔄 Reconciled 2026-09-12 (FIX-Task-24…)` note:

- **O-3 C05** — reformulated: **unreachable as written** (`open-dispute` rejects non-`in_progress`),
  re-pointed at the admin refund path. Verdict stays DOC-DRIFT.
- **O-3 C06** — the refund path has **no** `action:'idempotent'` (that key exists only on
  `rpc_mark_tax_collected`); documented the real 3-layer guard (RPC component cap with
  `details.remaining_cents`, `resolve-dispute` `ALREADY_RESOLVED`, Stripe `charge_already_refunded`).
- **O-2 C04** — per-category SP cap (not flat 50%) **and** `cash_amount_cents` excludes the fee
  (fee = `buyer_transaction_fee_cents`; composite = `payments.total_charged_cents`), with live evidence.
- **O-06** — the Sales Tax row **does** append the rate ("Sales Tax (6.99%)"); only the jurisdiction
  is hidden.
- **Class sweep (same session):** **O02** carried the same stale "(max 50%)" → corrected too.

No verdict flips. TRD totals unchanged: **267 PASS / 35 PARTIAL / 1 OPEN / 6 DOC-DRIFT / 3 SKIPPED /
16 Remaining = 328 ✓**. Tracker (`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`) updated
in place with a round note — **not regenerated** (FIX-Task-22 process finding).

## 6 — LogBox overlay ate taps (LOW, dev-only)

- **Root-cause downgrades:** the two call sites that actually fired on handled paths —
  `[getRecommendations] RPC error/Error` (`discovery.ts`) and
  `[subscription] Error getting transaction fee` / `getTransactionFee failed` (`subscription.ts`) —
  are now `console.warn` (precedent: `cartService`, `trade`, `chat`). No unit test asserted
  `console.error` there.
- **Escape hatch:** `EXPO_PUBLIC_QA_QUIET_LOGBOX=true` → `LogBox.ignoreAllLogs()` in `__DEV__` only
  (`App.tsx`), registered in `.env.local.example` + `docs/ENVIRONMENT-VARIABLES.md`. Trade-off is
  deliberate and documented: on-device LogBox text is then unavailable — read Metro/:8081 or
  `adb logcat`.
- The banner was **reproduced on-device** during this session (it covers the tab-bar band) —
  `screenshots/android-bulk-dev-fixture-reasons.png`.

## 7–9 — UX

- **7** `BulkSPSummaryCard.tsx`: the clipped sentence is now two complete clauses
  ("…to add it to SP totals." / "Cash Only items are never counted.") so any wrap/clip cuts a whole
  sentence. Existing `getByText(/Enable/)` assertion still passes.
- **8** `BulkListingCreateScreen.tsx`: the four `__DEV__` fixtures now carry
  `accessibilityState={{disabled}}` + `accessibilityHint`, and an inline line names **why** each
  disabled shortcut is off. **Verified on-device** — the line renders exactly as intended
  (`screenshots/android-bulk-dev-fixture-reasons.png`).
- **9** New `src/utils/dbTimestamp.ts` (`formatDbTimestamp` / `formatDbDate`, UTC getters — never
  `toLocale*`) applied to the buyer refund card's **"Refunded on"**, which previously rendered the
  device's local day (`2026-09-12T01:46Z` read as "Sep 11, 2026" in UTC−4 → the false date mismatch).
  **Deadlines (auto-complete / pickup windows) deliberately keep LOCAL time** — the user acts by their
  own clock; this audit stamp is the one that must match the DB. 7 unit tests, incl. the exact
  near-miss case and a non-UTC-offset input.

---

## Tier 0 (regression)

| Gate | Command | Result |
|---|---|---|
| Mobile typecheck | `npx tsc --noEmit` | **PASS** (exit 0) |
| Mobile lint (scoped, changed files) | `npx eslint <changed>` | **PASS** — 0 errors (only pre-existing `no-console`/`react-hooks` warnings) |
| Mobile lint (repo-wide) | `npm run lint` | 79 errors / 572 warnings — **all pre-existing** (76 = `scripts/*.ts` + `__tests__/integration/*` absent from `tsconfig.eslint.json`, proved by linting an *untouched* script; 3 = pre-existing unused-imports in untouched test files) |
| Mobile tests | `npx jest --silent` | **PASS — 321 suites / 3781 tests, 0 failed** (baseline 320/3774 → +1 suite/+7 tests = this change) |
| Admin typecheck | `npx tsc --noEmit` | **PASS** (exit 0) |
| Admin lint | `npm run lint` | **PASS** (warnings only) |
| Admin tests | `npm test` (vitest) | 10 **pre-existing** failures / 597 pass — all brand-drift (`design-tokens`, `admin-ui-theme`, `Sidebar` expect "Kids Admin"); only my 2 files are modified in that nested repo |
| SQL — item 1 | `apply_migration` + live verification | **PASS** (table/view/index/constraint/comment + health RPC's 6 indicators + data preserved) |
| SQL — item 2 | `apply_migration` + real invocation + read-back + backfill | **PASS** (`tax_voided_count:1`; `tax_status='voided'`; `remaining_stuck_rows=0`) |

> ⚠️ **Prettier hazard (self-caught).** `npx prettier --write` on the changed list rewrote
> `TradeTimelineScreen.tsx` wholesale (**1149 added / 1139 deleted**) and churned
> `seed-staging-data.ts` + `subscription.ts`. Reverted via `git checkout --` and re-applied the three
> logical edits surgically; final diff is proportionate (`git diff --numstat` checked).

## Environment blocker (not an app defect, not caused by this change)

The emulator's dev-client session **could not reach Supabase**, so authenticated flows (and therefore
the end-to-end Bulk Upload photo leg) were undrivable:

```
[AUTH] ⚠️ Initialization taking too long, forcing loading to false
[AUTH] ❌ Failed to initialize auth: [TypeError: requestPromise.catch is not a function (it is undefined)]
[AUTH] … CHANNEL_ERROR · 'Error loading user badges: TypeError: Network request failed'
```

No auth code was touched by this task. The device-side half of item 3 (the actual blocker) **was**
verified directly, as was item 8's rendering.

## Known gaps / not done yet

- **Item 6's `EXPO_PUBLIC_QA_QUIET_LOGBOX` is source-verified only** — exercising it needs a Metro
  restart with the flag set (the user had two Metro sessions running; not disturbed).
- **Item 9 applied to the refund card only.** The other trade-timeline audit stamps
  (`sp_released_at`, `myReview.created_at`) still use local `toLocaleDateString` — same class, not
  touched (scope containment). Deadlines are intentionally excluded.
- **`admin_health_summary` in the DB was re-pointed by a guarded patch** rather than by the explicit
  body that lives in migration `20260912000009`. The end state is semantically identical (same single
  predicate changed) and was verified by live invocation; flagged for review.
- The 24 legacy MediaStore rows under `/storage/emulated/0/Pictures/QA` (old app icons) are still on
  the emulator — harmless (the picker ignores that bucket) and safe to delete.
- Item 3's **2+ photo bulk session** end-to-end leg is still unverified (blocked by the network
  blocker above) — the device half is proven; the app half needs one authenticated run.
