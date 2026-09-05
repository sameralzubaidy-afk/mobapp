# QA Task 31-M R3 — Ledger (2026-09-05)

Guide: `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`. Run folder `qa-task31m-r3-adm-fg-dispute-q-2026-09-05/`.

## Verdicts
| TC-ID | Verdict (was) | Notes |
|---|---|---|
| ADM-TC-C12 | ✅ PASS (🟡 PARTIAL) | DT112 7-arg RPC fix live: Toys → 1077 = DB, seller test-seller@ → 273 = DB; header discloses page window. |
| ADM-TC-L07 | ✅ PASS (🟡 PARTIAL) | DT112 SP-gate fix live: frozen wallet → SP input ABSENT on Make Offer + frozen notices. Wallet restored active/490. |
| ADM-TC-F03 | ✅ PASS (PASS admin-only) | changed-value timing+fees propagate: buyer_fee_active_member_cents 149→199 → mobile offer fee $1.49→$1.99 → reverted. |
| ADM-TC-F05 | ✅ PASS (PASS admin-only) | pickup_window_hours 72→48 → live in-progress trade auto_complete_at +48h → mobile "auto-completes in 48h". Reverted. |
| ADM-TC-F06 | ✅ PASS (PASS admin-only) | guardrail HARD-BLOCK with live fixture present (168h attempt → no write). |
| ADM-TC-F08 | ✅ PASS (PASS admin-only) | R1 active-member-tier fee reflection on-device; first-trade-tier leg fixture-gated (R41 session needed). |
| ADM-TC-I03 | ✅ PASS (PASS admin-only) | resolve→complete: DB completed/resolved_seller/actor + payout; BOTH parties' mobile timelines reflect. |
| ADM-TC-I04 | ✅ PASS (PASS admin-only) | resolve→refund: DB cancelled/resolved_buyer/actor; BOTH timelines Cancelled + raw `dispute_resolved_refund` (finding). |
| ADM-TC-X06 | ✅ PASS (PASS admin-only) | under-review via /action-center + DB + mobile dispute banner; under_review reset now works (DEV-TASK-108). |
| ADM-TC-Q01 | ✅ PASS (PASS, not fixture-driven) | genuine: 3 live reported reviews staged; reason filters spam→5/false_info→6; 16 of 16 queue. |
| ADM-TC-Q02 | ✅ PASS (PASS, QA31-T commit) | re-confirmed: hide → DB hidden + mobile profile 8→7. |
| ADM-TC-Q03 | ✅ PASS (PASS, QA31-T commit) | re-confirmed: keep → DB reviewed/reports deleted + mobile restored. |
| ADM-TC-Q04 | ✅ PASS (PASS, not fixture-driven) | genuine: status Pending Review → 13 incl. all 3 fixtures; Hidden badge. |
| ADM-TC-Q05 | ✅ PASS (PASS, not fixture-driven) | genuine: sort oldest vs newest reorders (e6f5bc83 vs 35dd2539). |
| ADM-TC-Q06 | ✅ PASS (PASS, not fixture-driven) | genuine: search finds fixture (1 of 16); no-match state. |

**Roll-up: 15 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

## ADM tracker before → after
- Before: PASS 130 · PARTIAL 25 · OPEN 1 · SKIPPED 1 · Remaining 3
- After:  PASS 132 · PARTIAL 23 · OPEN 1 · SKIPPED 1 · Remaining 3
- PARTIAL pool shrank by **2** (C12, L07). All F/I/Q/X rows remain PASS but now carry genuine mobile-leg/live-trade evidence (Source = this run).

## Config / fixture state (DB-verified at cleanup)
- Baseline restored: pickup 72 · offer 48 · auto_complete 72 · payout_buffer 2 · buyer_fee_active 149 · buyer_fee_first_trade 149 · transaction_fee_subscriber 149 · charge_one_fee_per_bundle true.
- test-buyer wallet active / 490.
- 0 residue: in-progress-trade fixtures (96b79ce6, 3db5b917), dispute rows, review fixtures (19d64f8b, a483651f, 35dd2539) + trades + reports + items + seller_payouts.
- Audit rows from the scoped round-trips are expected (update_trade_timing_settings ×3, update_config ×2, sp_wallet_status_change ×2, admin dispute/resolve + review hide/keep actions, all actor 1a546991).

## Key DB anchors this run
- test-buyer `49243010-f458-4744-add1-a6c84ab95f1f` · test-seller `14be337c-aad6-403f-bab2-ba1a7d80b666`
- Admin actor `1a546991-5361-4b4e-b44b-eee9bf730757` (samer@samer.com)
- Accept-SP item for L07/F03-F08 offer surface: `185546da-68cb-4148-afeb-22d8d8796ce1` ($25, test-seller, available — left available)
- Fixture trades: `96b79ce6` (I03/X06, deleted) · `3db5b917` (I04, deleted)
- Fixture reviews: `19d64f8b` spam · `a483651f` offensive · `35dd2539` false_info (all deleted)
