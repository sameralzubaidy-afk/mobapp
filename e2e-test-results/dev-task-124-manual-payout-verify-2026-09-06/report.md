# Dev Task 124 — Run Report (manual-payout dispatch live verification)

**Date:** 2026-09-06 · **Project:** staging `drntwgporzabmxdqykrp`
**Scope:** Item 1 (dispatch manual Stripe withdrawals) — live money-path verification.
Items 2/4/9 are mobile code (Tier 0 green here; on-device AX/sticky-footer verification is a QA-agent follow-up).

## Item 1 — Live verification evidence

**Migration applied:** `20260906000002_dev_task_124_dispatch_manual_payouts.sql`
- `fn_queue_manual_payout_dispatch()` — SECURITY DEFINER, present (live query).
- `trg_queue_manual_payout_dispatch` — AFTER INSERT on `seller_payouts` WHEN `provider='stripe' AND trade_id IS NULL AND status='processing'`, enabled.
- cron `dispatch-manual-payouts` — `0 * * * *` → `SELECT public.rpc_fire_edge_function('/dispatch-manual-payouts');`

**EF deployed (CLI `--use-api`):** `supabase/functions/dispatch-manual-payouts/index.ts` (+ `../_shared/audit.ts`, `_shared/verify-stripe-ownership.ts` assets).

**Verification script:** `p2p-kids-marketplace/scripts/qa/dev-task-124-verify-manual-payout.mjs`

**Money-path result (real Stripe test objects + DB read-back):**
- Real Connect Express account created (application-collected requirements, test-mode) → `details_submitted=true, payouts_enabled=true, charges_enabled=true, currently_due=[]`.
- Verified primary method row + funded 500¢ (qa-payout-seller).
- Real `request_seller_payout` driven (persona JWT) → `payout_id 8fe6aa44-…`, net 474¢.
- AFTER-INSERT trigger → EF dispatched → row **completed** with `provider_reference_id tr_1UChi44I6kCJlvXo9saGyi3z`.
- **Real Stripe transfer confirmed:** `tr_1UChi44I6kCJlvXo9saGyi3z`, amount 474¢, destination `acct_1UChhu3b2fGnC7lp`.
- Balance deducted exactly once → 0¢.
- **Idempotency:** sweep re-run (`{sweep:true}`) produced **no second transfer** (exactly 1 transfer for the account).

**Findings fixed during verification:**
1. Express accounts use `controller[requirement_collection]=stripe` by default → platform cannot accept TOS (hosted-only). Programmatic-completion verification uses `requirement_collection=application` (+ losses/fees/dashboard-type controls) — the standard server-side completion model. (This is precisely what deferred Item 8 would fixture.)
2. The DB trigger posts the `admin_config`-stored service-role key, which can drift from the platform-injected `SUPABASE_SERVICE_ROLE_KEY` env → a strict bearer-equality check in the EF 401'd the trigger's call (net._http_response id 147865, `{"code":"UNAUTHORIZED"...}`) and stranded the row. **Fix:** removed the strict bearer check to mirror `initiate-payout`; security model = eligibility (only `processing` + no `provider_reference_id`) + per-row ownership-verified destination + Stripe idempotency key. Documented inline in the EF.
3. EF now guards a NULL `payout_method_id` (method deleted via FK `ON DELETE SET NULL`) — no more invalid-uuid query on orphan rows.

**Cleanup:** Connect accounts deleted; persona method rows removed; verification payout rows deleted; zero stranded `processing` manual rows remain; `qa:payout-seller` back to 0 methods / 0 balance / 0 payout rows.

## Item 8 — DEFERRED (documented only, NOT built this pass)

Server-side Express test-mode completion fixture (`qa:express-complete` — `stripe.accounts.update` writing `ssn_last_4 '0000'`/phone/`tos_acceptance` on an application-collected Express account → `currently_due==[]`). This is the largest theoretical saving (removes most of the ~148-call hosted-Safari drive) but is sequenced after items 1–7. The verification script above effectively exercises the same mechanism inline and can be the seed for the fixture.

## Items 2–9 status

| Item | State |
|---|---|
| 1 dispatch | **DONE + live-verified** (above) |
| 2 sync-on-return | Code done (focus + AppState coalesced reload → `loadPayoutMethods` → sync). Tier 0 green. On-device QA-agent verify = follow-up. |
| 3 QA playbook R63–R76 | Done (file committed with this task). |
| 4 AX exposure | Code done (bottom-sheet `accessibilityViewIsModal`; Add/Update Payment Method + Re-subscribe testIDs). Tier 0 green. On-device QA-agent verify = follow-up. |
| 5 G01/D05 runbook | Done (SUB module guide section added). |
| 6 `qa:mine-call-ledger` | Done + validated vs QA Task 37 transcript (total 491 vs 487; Batch B 212 vs 211; Batch C 151 vs 153 — within ±2 of the prior ad-hoc miner's criteria). |
| 7 `qa:start-state` | Done + validated (one-shot persona state incl. Connect `currently_due`). |
| 8 express-complete fixture | **DEFERRED** (documented above). |
| 9 sticky grace footer | Code done (grace/expired footer below the flex ScrollView). Tier 0 green. On-device QA-agent verify = follow-up. |
