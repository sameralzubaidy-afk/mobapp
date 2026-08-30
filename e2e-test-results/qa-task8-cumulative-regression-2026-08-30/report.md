# QA Task 8 — Cumulative Regression: Dev Tasks 56a/56b/57/58 Combined

- **Date:** 2026-08-30
- **Run folder:** `e2e-test-results/qa-task8-cumulative-regression-2026-08-30/`
- **Surface:** iOS mobile app (`Pass It Up!`, `com.sameralzubaidi.p2pmarketplace`, iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) + Admin portal (`localhost:3001`)
- **Backend:** Supabase staging `drntwgporzabmxdqykrp`
- **Method:** Real on-device/browser interaction (no scripted automation), disposable fixtures, DB read-backs closing every money/SP assertion (R11/R24). Dev Task 51 QA toolkit (`qa-login-as`, `qa-dev-toggle`).
- **Personas:** test-buyer (`49243010…`), test-seller (`14be337c…`, wallet FROZEN — benign), test-buyer-3 (`a1234567…`).

---

## Roll-up verdict

| # | Flow | Verdict | Key assertion |
|---|---|---|---|
| 1 | Happy-path trade (SP + cash → accept → complete → SP release/payout/CTA) | ✅ **PASS** | payout created (net $6.93, NOT zeroed), SP earning +6 to pending, completion CTA shown |
| 2 | Trade cancellation (SP restore) | ✅ **PASS** | trade cancelled, `earn_refund +1` restores wallet 0→1, item back to available |
| 3 | Dispute + admin resolve to Complete | ✅ **PASS** | payout NOT zeroed (net $19.70), dispute_status=resolved, resolved_seller |
| 4 | Admin SP adjustment (ledger + audit) | ✅ **PASS** | `earn_admin_grant +5` / `admin_deduct −5`, audit `sp_adjustment` logged, idempotency key, wallet restored to 0/0/0 |
| 5 | Tax offer + subscription checkout | ✅ **PASS** (tax leg) · ⚠️ **FLAG** (real checkout leg) | trade tax 140¢ @ 6.99% == UI $1.40; deployed EF fail-closes CONFIG_UNAVAILABLE / INVALID_PRICE_ID; real session blocked by config |

**Roll-up P/F/B/S: 5 / 0 / 0 / 0** (with 1 flagged sub-leg requiring a dev/owner config action).

---

## Flow 1 — Happy-path trade (SP + cash) — ✅ PASS

- **Fixture:** "Soccer Ball & Goal Set" `c5393d5a-0424-4b4b-b925-e4d911c90560` ($12, Accept-SP, seller=test-seller).
- **Steps:** buyer offer 3 SP + $9.00 cash (tax $0.84 @ 6.99%, fee $1.49) → liability disclaimer accepted → seller "Review Offer" (+6 SP, net payout shown $9.00) → Accept → buyer "I Got It" → TradeSuccess.
- **DB read-backs (all closed):**
  - Trade `3a7d3c2e-0df2-4e62-b190-895f48aad18b`: `pending → in_progress → completed`; `completed_at` set; `stripe_payment_intent_id` present.
  - Item `c5393d5a`: `status=sold`.
  - Buyer wallet: `available 4→1` (`spend_purchase −3`), `reserved_sp 10→13→10` (reservation released at completion); lifetime_spent 54.
  - Seller wallet: `earn_reward +6` at completion (pending 185→191) = $12 × 0.25 × subscriber multiplier 2; matches review-screen "6 SP releasing in 2 days".
  - `seller_payouts` `24206c97`: gross **720** (= 900 cash − 180 seller fee), platform_fee 0, payout_fee 27, **net 693** (`$6.93`), `status=pending`, `payout_release_at` = completed + 2 days (2026-09-01). **NOT zeroed.**
  - UI TradeSuccess: "You saved $3.00 using SP! You have 1 SP available." + completion CTAs (Keep Shopping / Rate Seller / View Trade Details / View My Trades / Back to Home).
- **Evidence:** screenshots `04`, `05`, `06`, `07`.

## Flow 2 — Trade cancellation (SP restore) — ✅ PASS

- **Fixture:** "Puzzle Set — 4 Pack" `dd8fc177-92c1-4ee4-9159-c32eb3bbb152` ($18, Accept-SP).
- **Steps:** buyer offer 1 SP + $17.00 cash (tax $1.26) → CancellationReasonModal ("Changed mind") → Confirm.
- **DB read-backs:**
  - Trade `0018cc2c-ec83-400f-a504-90febbd436a2`: `cancelled`.
  - sp_ledger: `spend_purchase −1` (1→0) then `earn_refund +1` (0→1, "SP refunded for cancelled offer") — full SP-refund chain.
  - Buyer wallet restored to baseline `available 1`, `reserved_sp 10`, `pending 0`.
  - Item `dd8fc177`: back to `available`.
  - UI: "Trade Cancelled — Any Swap Points have been refunded to your wallet."
- **Evidence:** screenshots `18`, `27`.

## Flow 3 — Dispute + admin resolve to Complete — ✅ PASS

- **Fixture:** "QA Dev Fixture Item" `83c8823b-0089-4602-afe6-183997f1aa1d` ($25, cash-only, tax-free).
- **Steps:** buyer cash offer → seller accept → buyer "Report an Issue" (`issue-reason-not_as_described`) → admin `/trades/disputes` → "Resolve → Complete".
- **DB read-backs:**
  - Trade `748f3116-e69a-41be-8c71-0ac700a98176`: `status=completed`, `dispute_status=resolved`, `dispute_resolution=resolved_seller`, `dispute_resolved_at` set, `payout_status=pending`.
  - `seller_payouts` `aa01bcba`: gross **2000** (= 2500 − 500 seller fee), platform_fee 0, payout_fee 30, **net 1970 (`$19.70`)** — **NOT zeroed** after admin resolve-to-complete.
  - Item `83c8823b`: `status=sold`.
  - Buyer wallet unchanged (cash-only, 0 SP).
- **Evidence:** screenshot `29` + admin disputes row (resolved, "Updated ✓").

## Flow 4 — Admin SP adjustment (ledger + audit) — ✅ PASS

- **Persona:** test-buyer-3 (`a1234567-0000-0000-0000-000000000004`, wallet `b5fdd708`), baseline `0/0/0` active.
- **Steps:** admin `/sp-wallet` → load wallet → Manual SP Adjustment **+5** → verify → restore **−5** (R28).
- **DB read-backs:**
  - Credit: wallet `0→5`; sp_ledger `earn_admin_grant +5` (0→5, desc=reason, admin_note captured, idempotency_key `admin_adj_…_202608301435`); admin_audit_logs `sp_adjustment` {amount, user_id, ledger_id, balance_before, balance_after}.
  - Restore: wallet `5→0`; sp_ledger `admin_deduct −5`. Final state `0/0/0` (baseline restored).
  - UI: "✅ SP adjusted. New balance: 5 SP" → "0 SP".
- **Evidence:** admin `/sp-wallet` interactions captured in run log.

## Flow 5 — Tax offer + subscription checkout — ✅ PASS (tax leg) / ⚠️ FLAG (checkout leg)

- **Tax fixture:** "QA Canned Cancelled-Trade Item" `0dca235c-815b-43d7-8ffc-a8de0bffecb8` ($20, General Tangible Goods → CT 6.99%).
- **Steps:** pure-cash offer (0 SP) → UI "Sales Tax $1.40", Total $22.89 → trade created → verified → cancelled (cleanup).
- **DB read-backs:**
  - Trade `018fdef8-470c-4452-8767-03fbfb7ecdf9`: `tax_amount_cents=140`, `tax_rate_applied=0.0699` — **UI $1.40 == DB 140¢** (server calc $20 × 6.99% = $1.398 → $1.40).
  - Trade then `cancelled` (fixture restored to available).
- **Subscription-checkout leg (fail-closed verification):**
  - All `subscription_tiers.stripe_price_id` are **NULL** on staging (Kids Club+ `c8a1a3d1` price 499¢ has no price id).
  - Deployed `create-checkout-session` (DT-58): allowlist = active tiers with non-null `stripe_price_id` → **empty** → any checkout returns **CONFIG_UNAVAILABLE** (500); a rogue `price_id` → **INVALID_PRICE_ID** (400). Also confirmed DT-58 removal of the invalid `automatic_payment_methods` param and server-derived `trial_days`.
  - App "Join on the web" (test-buyer-3, free tier) opens a WebView to the local subscription host → "Safari can't open the page … localhost" (env: web checkout host not reachable from the simulator).
  - **FLAG (needs dev/owner action):** a real checkout session cannot be created until a `stripe_price_id` is set on the Kids Club+ tier (per DT-58 precedent). The INVALID_PRICE_ID E2E leg also needs a configured (then reverted) price. Neither is a product defect — it is a staging-config gap.
- **Evidence:** screenshots `30`, `31` + deployed EF source read.

---

## Cleanup & zero-residue — ✅ VERIFIED

- All 4 session trades resolved (2 completed, 2 cancelled); **no pending/in_progress** remains.
- Cancelled-flow items restored to `available`; completed-flow items `sold` (intended outcomes).
- Wallets at baseline: test-buyer `4/10/0` (restored via admin +3), test-buyer-3 `0/0/0`, test-seller `1816/0/191` (frozen; pending includes the +6 Flow-1 earning — intended).
- No `cart_items` residue. `payment_card` dev toggle disarmed (`value=none`).

---

## Interaction-effect statement

The 5 flows were executed **sequentially** on the same staging environment; each flow's money/SP assertions were closed via independent DB read-backs before moving on. Flow-1 (completed) and Flow-3 (completed) left two sold items and two pending seller payouts — these are the intended validated outcomes of those flows, not residue. The Flow-2/Flow-5 trades were cancelled to restore their fixtures. The admin SP adjustments in Flow-4 and cleanup were scoped to test-buyer-3 and test-buyer and reverted to baseline (R28). No schema, code, or config was modified by QA.

## Findings (non-blocking, for triage)

1. **Admin actor identity not recorded** on money-affecting admin actions: `sp_ledger.admin_id` is NULL, `admin_audit_logs.actor_id` is NULL (Flow 4), and `trades.dispute_resolved_by` is NULL (Flow 3). The dispute "Resolve → Complete" also writes **no** `admin_audit_logs` row. For an audit-sensitive platform this is a traceability gap. → recommend capturing the acting admin's user id (and logging dispute resolutions).
2. **Seller Review Offer "Net Cash Payout" is gross cash, not net:** the seller saw "Net Cash Payout $9.00" on Review Offer, but the actual net is $6.93 (seller fee $1.80 + payout fee $0.27). The label is misleading (fees not disclosed on the review screen). → recommend showing the seller fee and true net on the review screen.
3. **`items.sold_at` is NULL** while `items.status='sold'` (Flows 1 & 3). Minor data hygiene — sold_at should be populated when the item is marked sold.
4. **Ledger description mismatch:** `sp_ledger` `earn_reward` row for Flow 1 says "Trade completion: 3 SP platform earning" but the credited amount is **+6 SP** (stale/hardcoded template — the numeric amount is authoritative and correct).
5. **Fixture-data gap:** the "Cash-Only Item" fixtures (`ba6345ce`, `ba615695`) have `node_id=NULL`, so the node-scoped `search_listings` RPC excludes them (invisible in Discover/search). Not an app bug — a stale fixture; recommend setting their `node_id` or retiring them.
6. **AX-exposure gaps (tooling):** the CancellationReasonModal's elements are inconsistently exposed (empty tree on first open → pixel/OCR navigation required); the seller "Offer Accepted!" OK button is not AX-exposed; the DisclaimerModal checkbox is intermittently absent from the tree. testIDs exist but aren't consistently surfaced (same class as the earlier GlobalAlertProvider exposure bug).
7. **`subscription_tiers.stripe_price_id` all NULL** — blocks real subscription checkout sessions on staging (see Flow 5 flag).

## Environment / process notes

- CT taxable-goods rate is **6.99%** (the plan's "6.35%" was not the applied rate — read from DB, not hardcoded).
- Simulator deep-links must use `xcrun simctl openurl` (mobile-mcp `open_url` rejects custom schemes).
- Simulator target: iPhone 17 Pro Max UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`.

## Separate note (legacy automated suite reliability)

Per the task's "Separate Note": the legacy Maestro/Detox suites are **not** the recommended regression path for these flows — the DT-56b/57/58 money paths are best verified via DB read-backs (as done here), because the scripted suites assert on DOM/AX presence and cannot close money/SP invariants. Recommend the `run-suite.sh` path be treated as a smoke layer only, with money flows covered by this QA-task methodology.
