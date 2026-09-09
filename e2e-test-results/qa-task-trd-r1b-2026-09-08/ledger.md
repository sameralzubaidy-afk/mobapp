# QA Task TRD-R1b — Ledger (DB read-backs / fixtures / config)

Run folder: `e2e-test-results/qa-task-trd-r1b-2026-09-08/` · HEAD `62238ea4` · Staging `drntwgporzabmxdqykrp`

## Part 1a — iOS real-UI flow + dispute (trade `1ba3745c`)
| Step | DB fact | Value |
|---|---|---|
| Offer created (iOS, Remote Control Car $25, 8 SP) | trade `1ba3745c` pending, sp 8, cash $17.00, fee 149, tax 175, disclaimer_acknowledged true, offer_expires +48h | confirmed |
| Seller accept (iOS) | status `in_progress`, PI `pi_3UDYVy4…`, auto_complete_at 2026-09-11 (72h), auth expiry +7d | confirmed |
| Real-UI dispute (no_show) | dispute_status `reported`, dispute_reason `no_show`, **disputed_at SET 23:37:06** | confirmed |
| Fast-clock + RPC | `auto_complete_at = now()+5s` → `rpc_process_auto_complete(100)` @23:38:28 → `auto_completed_count: 0` | P1 fix PASS (iOS) |
| Post-RPC state | trade in_progress, item `available` (not sold), **0 seller_payouts** | confirmed |
| Cleanup (admin Resolve→Refund) | status `cancelled`, dispute_status `resolved`/`resolved_buyer`, resolved_by `1a546991`, `disputed_at` cleared, stripe_refund_id `cancelled_pi_3UDYVy4…`, item relisted, 0 payout, 1 admin_audit_logs row | confirmed |
| SP restore | test-buyer wallet available 482, reserved 0 | confirmed |

## Part 1b — UX 5c cap modal
| Step | DB fact | Value |
|---|---|---|
| 3 pending offers (ef-repro) | RC Car `bb544703` (exp 23:54:49, OLDEST), Skateboard `39c0d0e3` (23:54:59), Soccer `58b34f46` (23:55:06) | ordering confirmed by offer_expires_at |
| 4th offer attempt (UI) | blocked (cap 3) → cap modal shown (no trade created) | confirmed |
| Cancel My Oldest Offer | **RC Car `bb544703` CANCELLED** 23:56:32, reason "Buyer cancelled oldest offer to free a slot for a new offer"; Skateboard+Soccer stayed pending (3→2) | CORRECT oldest cancelled |
| Direct EF re-submit (Roald Dahl) | trade `7662e9a2` pending created (slot free, EF count correct) | confirmed |
| Cleanup | `qa:reset-offer-fixtures` cancelled `39c0d0e3`/`58b34f46`/`7662e9a2`, listings reset | confirmed |

## Part 2 — Group J (persona test-seller-2, user `a1234567-…0002`)
| Step | DB fact | Value |
|---|---|---|
| Pre-state | test-seller-2 count 0 / flag NULL; **test-seller count 6 + flag 2026-08-30** (untouched) | confirmed |
| 3 fixture trades | `7478ebab`/`364d5b51`/`c3f04bc0` in_progress (buyer test-buyer, seller test-seller-2, cash) | r41 fixture |
| J01 cancel (T3 `c3f04bc0`, "Can't do pickup") | trade cancelled 23:46:40; **counter 0→1**, flag NULL | Level 1 |
| J02 cancel (T2 `364d5b51`, "Item no longer available") | trade cancelled; **counter 1→2**, flag NULL | Level 2 |
| J03 cancel (T1 `7478ebab`, "Can't do pickup") | trade cancelled; **counter 2→3** + **admin_review_flagged_at SET 23:48:06** | Level 3 + flag |
| UI (both) | generic "Trade Cancelled / Your trade has been cancelled…" notification (no Level alert — deprecated TFV2-023) | doc-drift confirmed |
| Cleanup | r41 reset deleted 3 trades+items; **test-seller-2 restored count 0 / flag NULL** | confirmed |

## Config / residue
- No `admin_config` writes this round. `pending_sp_release_days`=3 + `sp_pending_days`=3 (FIX-Task-7 state held), `max_pending_offers_per_seller`=3, `pickup_window_hours`=72.
- Residue left: RC Car `bb544703` cancelled (evidence of correct cancel-oldest — harmless); test-buyer's pre-existing cancelled/completed history + drafts untouched. test-seller's `$12 requires_action` payout + completed trades from the FIX-Task-7 Android reverify remain (prior-round intentional artifacts, unchanged).
