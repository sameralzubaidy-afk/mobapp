# Ledger — QA Task TRD-R1-FIX7 (Android) — DB read-backs 2026-09-08

Read-only DB checks on staging `drntwgporzabmxdqykrp`. Server-side P1 fix confirmed deployed BEFORE execution:
- Migration `dev_task_7_dispute_pause_auto_complete` applied (supabase_migrations version `20260908223234`).
- `rpc_process_auto_complete` body contains `COALESCE(t.dispute_status,'none') NOT IN ('reported','under_review')`.
- `rpc_request_trade_extension` / `rpc_apply_trade_extension` contain `v_trade.dispute_status NOT IN ('none','resolved')`.
- Trigger `trg_sync_disputed_at_from_status` + fn `fn_sync_disputed_at_from_status` live.
- Edge Functions redeployed: `open-dispute` v17 (stamps `disputed_at`), `complete-trade`/`resolve-dispute`/`process-auto-complete` (FIX-Task-7 markers present).

## Fixture E02 leg — trade 8b467792 (then cleaned)
- Post `qa:r41-dispute open` (real EF): `status=in_progress`, `dispute_status=reported`, `disputed_at=2026-09-08 22:55:49.908+00` (SET), `dispute_reason='Item was not as described in the listing.'`, `trade_events.trade_disputed` logged (actor buyer `49243010…`).
- Fast-clock `auto_complete_at=now()+5s`; `rpc_process_auto_complete(100)`: run1 22:56:13 → `auto_completed_count:0`; run2 22:56:17 (window elapsed) → `auto_completed_count:0`.
- End state: `status=in_progress` (auto_completed_at NULL, completed_at NULL); item `89f25d87` `available`/`sold_at NULL`; `seller_payouts` count = **0**.
- Dispute reset to `none`; fixture trade + item deleted via `qa:r41-in-progress-trade reset` (cleanup).

## Real-UI E02 leg — trade 9299d761 (T-real)
- Built: `qa:ef-repro` buyer `create-trade-offer` (item `f5bac12c`, $15 cash) → seller `transactions-update` accept → `in_progress`, PI `pi_3UDY4G4I6kCJlvXo0UpOIIyI`, `auto_complete_at` +72h, VISA 4242.
- Real UI Report a Problem → no_show → Submit (open-dispute EF): `dispute_status=reported`, `dispute_reason='no_show'`, `disputed_at=2026-09-08 23:07:37.259+00` (SET).
- Fast-clock `auto_complete_at=now()+5s`; `rpc_process_auto_complete(100)`: 23:08:02 → 0; 23:08:05 → 0. End state: `in_progress` (auto_completed_at/completed_at NULL); item `f5bac12c` `available`/not sold; `seller_payouts` count = **0**.

## E05 admin resolve → Complete (9299d761)
- After portal "Resolve → Complete": `status=completed` (completed_at 23:12:47), `dispute_status=resolved`, `dispute_resolution='resolved_seller'`, `dispute_resolved_at=23:12:45`, `dispute_resolved_by=1a546991-5361-4b4e-b44b-eee9bf730757`, `disputed_at=NULL` (cleared).
- `seller_payouts`: row `b9e3eae4-0c1e-4eb1-aa02-0b6e4134c37b` (trade 9299d761, user test-seller `14be337c…`, `status=requires_action`, gross 1200 / net 1200 / fee 0, created 23:12:47).
- `admin_audit_logs`: actor `1a546991…`, action_type `dispute_resolved`, entity_type `trade`, entity_id `9299d761…`, payload `{"action":"resolve_complete","resolution":"resolved_seller"}`.

## E06 admin resolve → Refund (0e33f356)
- Built: `qa:ef-repro` buyer `create-trade-offer` (item `c7d38657` Skateboard, $22 cash) → seller accept → `in_progress`, PI `pi_3UDY9C4I6kCJlvXo0h9FjC3E`.
- Dispute via real EF: `dispute_status=reported`, `disputed_at=2026-09-08 23:10:08.697+00`.
- After portal "Resolve → Refund": `status=cancelled`, `dispute_status=resolved`, `dispute_resolution='resolved_buyer'`, `dispute_resolved_by=1a546991…`, `disputed_at=NULL`, `stripe_refund_id='cancelled_pi_3UDY9C…'` (authorization cancelled), completed_at NULL.
- `seller_payouts` count = **0**; item `c7d38657` relisted `available`; no `trade_refunds` row (uncaptured-PI path → authorization cancel, Stripe status `succeeded` in audit payload).
- `admin_audit_logs`: actor `1a546991…`, action `dispute_resolved`, payload `{"action":"resolve_refund","resolution":"resolved_buyer","stripe_refund_id":"cancelled_pi_…","stripe_refund_status":"succeeded"}`.

## Item-3 config
- `admin_config`: `pending_sp_release_days='3'` (feature_flags) AND `sp_pending_days='3'` (swap_points) — both active. Legacy key reconciled 2 → 3.
- Client `getSPReleaseDays()` source: reads `['pending_sp_release_days','sp_pending_days']` first; fallback 3.

## Cleanup / residue
- Fixture trade `8b467792` + item deleted. Real artifacts left: `9299d761` completed (+ payout `b9e3eae4` $12 requires_action, item `f5bac12c` sold); `0e33f356` cancelled (Skateboard relisted). No config writes.
