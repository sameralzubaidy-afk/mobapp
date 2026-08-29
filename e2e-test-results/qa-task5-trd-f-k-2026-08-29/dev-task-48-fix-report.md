# Dev Task 48 — QA Task 5 Fix Batch + Perf — Fix Report

**Date:** 2026-08-29 · **Executor:** Kids P2P App Builder agent
**Backend:** Staging Supabase `drntwgporzabmxdqykrp` · Admin portal `http://localhost:3001`
**Method:** every fix re-verified with a real invocation + DB read-back (Task 47 lesson). All verification used disposable fixtures, cleaned up afterward. No `git push`.

---

## Environment reset (required before any J-series re-test)
- ✅ `profiles.test-seller@kidsmarketplace.test`: `post_acceptance_cancellation_count` 3 → **0**, `admin_review_flagged_at` → **NULL** (was 2026-08-29 14:03).

---

## 1. User-reported performance delays (Priority — measured first)

### Root cause
- **Not a DB bottleneck at current volume.** Measured with EXPLAIN ANALYZE against staging's real high-volume persona (`rewardsfirsttradebob`, 469 trades; 757 trades / 1,945 items total): all Trades-screen query shapes are < 20 ms (active 0.16 ms, completed-count 19.4 ms, history 0.18 ms). The `idx_trades_status`/`idx_trades_status_created_seller_marked`/`idx_trades_buyer_id`/`idx_trades_seller_id` indexes already exist on the live DB.
- **The bottleneck is query COUNT / network round-trips on-device.** `TradeListScreen` fires **~15–17 Supabase round-trips per focus** (re-fires on every tab focus) — and `attachListingDataToOffers` is called up to 5× per focus, each issuing its own `items` + `item_images` query against heavily overlapping listingId sets (redundant re-fetch ×4–5). `DiscoverScreen` fires **~10 round-trips on mount** with `search_listings`+`count_listings`+`item_images` and `get_top_categories_by_state` firing **twice** (focus effect + debounced effect / loadInitialData).
- **QA method gap confirmed:** QA Task 5 used low-volume accounts (test-buyer/test-free/test-seller, single-digit trades, ~60–70 listings), so no load-time issue reproduced. The owner's real account is exactly where the redundant re-fetches + unbounded active-trades query surface.

### Fixes applied
| File | Change |
|---|---|
| `supabase/migrations/20260830000007_dev_task_48_trades_scale_indexes.sql` | New composite `idx_trades_buyer_status (buyer_id,status)` + `idx_trades_seller_status (seller_id,status)` — scale-proofing for the OR+status filter / count at 10k+ history (applied to staging) |
| `src/screens/trade/TradeListScreen.tsx` | 30s-TTL `listingPreviewCache` backs `attachListingDataToOffers` → the 4–5 redundant items/item_images re-fetches collapse to ~2; added `.limit(100)` safety cap to the previously-unbounded active-trades query |
| `src/screens/home/DiscoverScreen.tsx` | `initialSearchRef` guard drops the duplicate initial `performSearch`; removed the duplicate `loadTrending()` from `loadInitialData` |

### Verification evidence
- **Before:** ~15–17 queries/focus (Trades), ~10 queries/mount (Discover); unbounded active-trades query; 8–10 items/item_images queries per focus from redundant attaches.
- **After:** ~8–9 queries/focus (Trades — attach fetches collapse to cache hits after the first), ~6–7 queries/mount (Discover — one search, one trending). DB EXPLAIN confirms completed-count resolves via the OR-filter; composite indexes keep it flat as history grows.
- **Tier 0:** mobile `yarn typecheck` PASS, `eslint` 0 errors on all 5 changed files (8 pre-existing unused-import/var lint errors in `TradeListScreen` cleaned to satisfy the gate; no logic changed). Unit suites pass: TradeList 89, Discover, ChatScreen, deepLink 56.
- **Not measured on-device (honest gap):** ms-to-first-render/interactive requires a runtime profiler (Metro MCP) that was not available in this session; the numbers above are DB-level EXPLAIN + query-count reduction, which is what the redundancy analysis supports.

---

## 2. (P1) Admin Dispute Resolve-Complete zeroes payout

### Root cause
`p2p-kids-admin/src/app/api/admin/trades/dispute-action/route.ts` (`resolve_complete`) and the legacy `supabase/functions/resolve-dispute/index.ts` wrote `status='completed'` directly — never computing `payout_amount_cents`, never creating the `seller_payouts` row, never marking the item sold. The payout trigger then dispatched `initiate-payout`, which coerced NULL→0 and marked the trade **paid with $0**.

### Fix
- **Admin route** (`dispute-action/route.ts`): resolve_complete now writes only the dispute overlay columns, then **delegates to `complete_trade_v2(p_trade_id, buyer_id)`** — the canonical completion money path (computes `payout_amount_cents = GREATEST(0, cash − seller_fee)`, creates `seller_payouts`, marks item sold). No duplicated math.
- **Legacy EF** (`resolve-dispute/index.ts`): same delegation after the dispute overlay update.
- **`initiate-payout/index.ts` (approved defense-in-depth):** early guard returns `PAYOUT_AMOUNT_MISSING` (409) and sets `requires_action` when `payout_amount_cents` is NULL — a NULL amount can no longer be silently marked paid with $0 (or used to create a $0 payout row).
- Deployed via CLI `--use-api`: resolve-dispute v17, initiate-payout v26 (BP-66 verified).

### Verification (disposable dispute trade)
- Fresh `in_progress` trade (cash $20.00, seller fee $4.00) → admin resolve_complete → **DB read-back**: `payout_amount_cents = 1600` (non-null, exact expected), `seller_payouts` row created (gross 1600, net 1571, idempotency key `trade:<id>:seller:<seller>`), item `sold`, dispute `resolved/resolved_seller`.
- `initiate-payout` → `{payout_status:'pending', scheduled_for: release date}` — the R3 buffer correctly defers the **real $16**, no $0 processing.

---

## 3. (P2) Quick-Reply Chip Silent Failure (I05)

### Root cause
`ChatScreen.handleSend` takes no text parameter and reads `inputText` from state; the chip wiring called `setTimeout(() => handleSend(), 100)`, whose stale closure captured empty `inputText` → the guard early-returned → nothing persisted (QA: 2 taps = 0 rows).

### Fix (`src/screens/messaging/ChatScreen.tsx`)
`handleSend(text?: string)` uses `(text ?? inputText).trim()`; chips now call `void handleSend(message)` directly (no delayed stale closure); the send-button `onPress` is wrapped so the GestureResponderEvent isn't passed as `text`.

### Verification (on-device, simulator)
Fresh in_progress trade → tapped **"Available today"** + **"Available tomorrow"** chips → **DB read-back: 2 new `messages` rows** with the correct content (`"Hey! I'm available to meet today…"`, `"Hi! I can meet tomorrow…"`). Before the fix this produced 0 rows.

---

## 4. (P2) Missing `acknowledge_trade_disclaimer` RPC (I06)

### Root cause
Migration `307_liability_disclaimer_tracking.sql` was **recorded as applied but its DDL never ran on staging** (BP-47 drift): no `trades.disclaimer_*` columns and no `acknowledge_trade_disclaimer`/`create_trade_with_disclaimer_v2` functions. The client's best-effort `rpc(...)` failed silently at 3 call sites.

### Fix
New idempotent migration `20260830000005_dev_task_48_restore_disclaimer_tracking.sql` (re-applies the canonical 307 content) applied to staging.

### Verification (disposable pending offer)
Buyer JWT → `rpc('acknowledge_trade_disclaimer', …)` → **DB read-back**: `trades.disclaimer_acknowledged = true`, `disclaimer_policy_id` set, `disclaimer_acknowledged_at` set, and `policy_acceptances` row exists (user, policy `4f41639e…`, version 1.0).

---

## 5. (P2) Tax Ledger Not Updated on Partial Refund (K08)

### Root cause
Migration `20260724000001` (tax refund/reconciliation) was only **partially applied** on staging: enum values + columns + summary/export RPCs landed, but **`rpc_record_stripe_refund` (BLOCK 4) did not**. The deployed `rpc_record_payment_refund` calls it inside a swallowed `BEGIN…EXCEPTION WHEN OTHERS` block, so every tax-component refund raised "function does not exist", was swallowed, and committed to Stripe/payments/trade_refunds while `tax_records` stayed `collected`/0 (exact K08 symptom).

### Fix
New idempotent migration `20260830000006_dev_task_48_restore_tax_refund_rpc.sql` — creates the canonical `rpc_record_stripe_refund` (verbatim from BLOCK 4) on staging. No code change needed in `trade-refund` (the plumbing already existed; the missing function was the whole gap).

### Verification (disposable completed trade, tax collected)
`rpc_record_payment_refund(trade, 're_d48test_1', 0, 0, 154, …)` → `tax_result {success:true, action:'refund_recorded', refund_tax_result:{refunded_total:154, remaining_cents:0}}` → **DB read-back**: `tax_records.tax_status = 'refunded'`, `refunded_tax_cents = 154`, `refunded_at` + `refund_status='succeeded'` set, `trade_refunds` line item with `refund_tax_cents=154`.

---

## 6. (P2) K10 Bundle Stale-Client Insert Failure

### Root cause (pinned with evidence)
- **No deploy drift:** deployed `create-trade-offer` v58 was byte-identical to the repo (`supabase functions download` → `diff` = 0 lines); the fee-strip/recompute block (`cashPortion = cash − clientFee`, server fee on item 0 only) **is live**.
- **Repro #1 (fees on all 3 items, sp=0): SUCCEEDED** — server correctly zeroed fees on items 2–N (DB: exactly 1 trade carries fee 149, others 0). So the "fees-on-all" premise is already enforced.
- **Repro #2 (sp_amount on all 3 items):** the remaining break-the-insert vector — `resolveSpRedemption` checks entitlement + per-item cap but **not wallet balance**; the per-item `fn_reserve_sp_on_offer` AFTER INSERT trigger raises `Insufficient available SP` → EF maps every DB error to `TRADE_INSERT_ERROR`, and with moderate SP the batch commits **partial** (2 created, 1 failed).

### Fix (`supabase/functions/create-trade-offer/index.ts`)
Added a server-side **SP availability pre-check** in the batch path (sum of requested `sp_amount` vs `sp_wallets.available_balance`), returning a clean structured `SP_INSUFFICIENT` (409) with human copy before any insert — a stale/outdated/malicious client can no longer break the insert or create a partial bundle. Deployed via CLI `--use-api` → v59.

### Verification (disposable 3-item bundle)
- Stale fees-on-all, sp=0 → HTTP 200, 3 trades, fee on item 0 only (DB confirmed).
- Stale sp=2-on-all (6 > 4 available) → **HTTP 409 `SP_INSUFFICIENT`** ("You don't have enough Swap Points for this bundle. You have 4 SP available."), **0 trades created**.

---

## 7. (P2) Offer-Reminder Deep-Link Gap (G04)

### Root cause
`offer_reminder_6h` / `offer_reminder_1h` were absent from `deepLink.TYPE_TO_ROUTE_MAP`, so tapping those notifications did nothing. Additionally, the in-app `send-offer-reminders` `user_notifications` data payload carried only `event_type` (no `type`/`event`), which `parseNotificationDeepLink` reads.

### Fix
- `src/services/deepLink.ts`: added both types → `{ route:'ReviewOffer', action:'navigate' }`; extended the ReviewOffer enrichment branch (was only `trade_request`) to set `tradeId` for both reminder types; added an `event_type` fallback in the parser.
- `supabase/functions/send-offer-reminders/index.ts`: in-app payload now includes `type: notif.event_type` (mirrors the push path). Deployed via CLI `--use-api` → v21.

### Verification (on-device, simulator, as test-seller)
Generated a real 6h reminder (`rpc_send_offer_reminders` on a disposable pending offer), created the in-app notification, tapped it → **navigated to the "Review Offer" screen** (title, "5h 58m left" countdown, item, Accept/Decline). Before the fix this did nothing.

---

## 8. (P3) Basket CTA / Tab-Bar Overlap

### Root cause
The "Make offer" CTA (`bundle-cta-button`) was the last in-flow `ScrollView` child at y 845–914, sliding under the floating tab bar (y 868–905) → taps near the CTA bottom hit a tab. `paddingBottom` alone can't lift an in-flow last child above the pill at rest.

### Fix (`src/screens/cart/CartScreen.tsx`)
Moved the CTA out of the ScrollView into a **fixed bar** (`position:'absolute', bottom:120, left:24, right:24`) — the same clearance `BulkPublishBar` uses — and bumped scroll-content bottom padding to 200 so the last list items clear it.

### Verification (on-device, simulator)
CTA now renders at y 766–835 — **fully above the tab bar (848–905)**. Tapping near the CTA's bottom edge (y=830) fired the CTA → navigated to **Checkout** (not a tab press).

---

## Deploys (all via CLI `--use-api`, versions verified)
| Function | Version | Purpose |
|---|---|---|
| `resolve-dispute` | v17 | resolve-complete → `complete_trade_v2` |
| `initiate-payout` | v26 | NULL-amount defensive guard |
| `create-trade-offer` | v59 | batch SP-availability pre-check (K10) |
| `send-offer-reminders` | v21 | in-app payload `type` (G04) |

## Migrations applied (MCP)
- `dev_task_48_restore_disclaimer_tracking` (item 4)
- `dev_task_48_restore_tax_refund_rpc` (item 5)
- `dev_task_48_trades_scale_indexes` (item 1)

## Cleanup
All disposable fixtures deleted (trades, messages, payments, trade_refunds, tax_records, seller_payouts, notification, K10 repro trades); items restored to `available`; test-buyer SP wallet back to 4 available / 10 reserved (unchanged from pre-task); `charge_one_fee_per_bundle` confirmed TRUE.

## Not fixable / flagged
- **Item 1 on-device ms-to-render** not measured (needs a runtime profiler not available this session) — DB EXPLAIN + query-count numbers provided instead; recommend a follow-up run with Metro MCP / React DevTools to capture ms-to-interactive.
- **`initiate-payout` guard** is defense-in-depth beyond the 8 items (approved); the real fix is item 2's delegation.
- **Client-side disclaimer call sites** still swallow RPC failures (item 4's fix is deployment); recommend logging those failures so future deploy gaps are visible.
