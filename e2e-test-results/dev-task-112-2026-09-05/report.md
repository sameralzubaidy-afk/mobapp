# Dev Task 112 — Consolidated Fixes + UX Enhancements (QA Task 31T-v2 follow-up)

Date: 2026-09-05 · Staging project: `drntwgporzabmxdqykrp` · Owner-approved all fixes/UX + all SQL.

One line per item (deliverable):

1. **Restore 7-arg `admin_search_listings_v2`** — migration `supabase/migrations/20260905000001_dev_task_112_restore_admin_search_listings_v2.sql` DROPs the 5-arg form and re-CREATEs the 7-arg signature (p_category/p_seller_email) on the DT97 body (admin_has_role guard + grants re-applied). APPLIED to staging + live-verified end-to-end as an admin JWT: Toys(active) total 1038 (was 9), test-seller@ 274 (was 20), uncategorized 716. UI unchanged (legacy fallback now defensive/dead).
2. **Frozen-wallet SP offer gate (mobile)** — `TradeOfferScreen.tsx` hides the "ADD SP OFFER" input when `wallet_state` is not spendable and shows a frozen/suspended explanation (item 8 auto-collapse bundled). On-device verified (test-buyer wallet frozen): offer screen shows NO `sp-amount-input` + frozen notice. Unit test added. Evidence: `mobile-tradeoffer-frozen-wallet-no-sp-input.png`.
3. **`hasFlag()` double-dash bug** — `scripts/qa/lib/r41-common.mjs` `hasFlag` now strips a leading `--` (fixes all 8 fixture scripts: --dry-run/--force/--keep/--remove/--with-auto-complete). Live-verified: `qa:r41-in-progress-trade create --dry-run` created 0 rows; `create --with-auto-complete` set `auto_complete_at` from config; non-dry-run still writes.
4. **`qa:r41-review reset` ordering** — `r41-reported-review-fixture.mjs` `cmdReset` now deletes the completed trade BEFORE the item (mirrors r41-in-progress-trade). Live-verified create→reset leaves zero residue. Orphaned item `0253b2cb-2293-4d7f-be88-2ce44a723c63` ("QA Reported Review Fixture") deleted directly (verified 0 refs first).
5. **Paused in `/listings` status filter** — added `'paused'` to `ListingSearch.tsx` filter union + dropdown + badge case. Live-verified: Paused filter → `Results (20 on this page) of 439 matching` (439 = DB `status='paused'` count).
6. **N6 NULL-node residual — DOCUMENTED (no backfill, owner decision)** — see N6 decision note below. "QA T31 Disc Node" (`aeffbaa5-8d82-4b52-b812-8bd02e4eb019`) `status`/`is_active` mismatch fixed live: `status active → inactive` to match `is_active=false`.
7. **Grace-config save records editor** — `/subscriptions/manage/page.tsx` grace handlers now resolve the admin (`supabase.auth.getUser()`) and send `user_id`. Live-verified: saving grace_period_days set `admin_config.updated_by = 1a546991-…` (was null); value restored to 30.
8. (bundled with 2) — ADD SP OFFER section auto-collapses on a frozen wallet (input hidden + explanation, no dead control).
9. **`/listings` Results header page-scope label** — when any filter is active the header reads `Results (N on this page) of TOTAL matching` (/audit style). Live-verified with Paused filter (see item 5).
10. **"Notify me if re-listed" — DESCOPED** (owner: future idea, implement only if time allows; not required).

## N6 decision note (item 6 documentation)

Finding (from `e2e-test-results/qa-task31t-dt111-adm-2026-09-04/`): rows whose actor HAS a node but `node_id` is NULL — 358 items, 341 sp_ledger, 35 sp_wallets, 20 trades (+20 payments), 15 sp_batches, 2 cart_items, 1 seller_balance. Whole-table NULL coverage: trades 20/826, payments 20/826, items 1605/1969, sp_wallets 5053/5167, sp_ledger 362/1075, sp_batches 16/73, cart_items 2/24, seller_balance 2/26; seller_payouts 0, trade_refunds 0.

**Decision (owner, 2026-09-05): DOCUMENT-ONLY — no retroactive backfill.** These rows predate the actor's node assignment (the 20 trades are all pre-N6, Jan–Jul 2026) and several columns carry event-time snapshot semantics (listing node = seller node at publish; trade/payment/ledger derive from their related trade). A blanket backfill would rewrite history. "Every record resolves to one node" is not a current invariant for pre-N6 records. If that invariant becomes required later, it needs a product decision on snapshot-vs-current semantics before any backfill.

Residual cleanup performed: "QA T31 Disc Node" `aeffbaa5` aligned to `status='inactive'`/`is_active=false` (consistent with deactivated intent; 0 members).

## App state left behind (staging)
- None from this task: test-buyer wallet restored to `active` (490); fixture trades/reviews reset; orphan deleted; disc node aligned; grace config restored to baseline 30 / [60,30,7,1] with editor attributed.
