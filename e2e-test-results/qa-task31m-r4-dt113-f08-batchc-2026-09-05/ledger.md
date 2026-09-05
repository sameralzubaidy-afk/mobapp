# Ledger — QA Task 31-M Round 4 (2026-09-05)

Folder: `e2e-test-results/qa-task31m-r4-dt113-f08-batchc-2026-09-05/`

## Verdicts
| Ref | Case / item | Verdict | Evidence / notes |
|---|---|---|---|
| Batch A-1 | DT113 friendly copy (I04 both parties) | PASS | buyer "No payment was taken." / seller "…by our support team."; no raw code |
| Batch A-2 | DT113 realtime live trade timeline | PASS | open timeline updated in-place after DB dispute open + resolve (no relaunch) |
| Batch A-3 | DT113 seller fee = stored not config | PASS | trade 01121468 stored 600 → −$6.00 stable under config 10→20; reverted |
| Batch A-5 | DT113 buyer closing-summary card | PASS | timeline-dispute-closed-summary shown (uncaptured refund) |
| Batch A-6 | DT113 admin header window disclosure | CONFIRMED | /users,/reviews exact "(N on this page) of M"; /payments,/trades window-disclosing (DB-exact) |
| Batch A-7 | DT113 countdown pill no "left" | PASS | "Confirm pickup — auto-completes in 71h 27m" |
| Batch B-1 | F08 first-trade fee through completion | PASS | trade 27f04815 completed fee 149; fee_state first_trade_completed |
| Batch B-2 | F08 second-offer reversion | PASS | trade 37141792 fee 324 (subsequent schedule) |
| Batch B-3 | F08 reset | PASS | 0 residue (persona + 2 items + 2 trades) |
| Batch C | ADM-TC-L04 wallet credit/debit | PASS | mobile 490→515→490 live reflection; residual CLOSED |
| Batch C | ADM-TC-C03 approve flagged | PASS | 0c1b5be8 available + mobile buyer-visibility |
| Batch C | ADM-TC-C04 reject w/ reason | PASS | 04662c2c rejected + reason stored; guard verified |

## Fixtures created / consumed
- `qa:r41-in-progress-trade create --with-auto-complete` → trade `fceeeab1` + item `1be69805` (Batch A) → resolved→refund → reset 0.
- `qa:r41-first-trade create` → persona …014 + item `89a6573a` (dev-staged) + item `f75713e0` (created for leg 2) + trades `27f04815`, `37141792` → reset 0.
- Moderation: DT104 flagged fixtures `0c1b5be8` (→available), `04662c2c` (→rejected) consumed by C03/C04.

## Config round-trips (all DB-verified reverted to baseline)
- `platform_fee_seller_percentage` 10 → 20 → 10 (A3). Baseline: 10.
- Buyer fees 149/149, subsequent 199/5/499, pickup 72, offer 48, auto 72 unchanged.

## Wallet / SP
- test-buyer wallet active / 490 (L04 +25 → 515 → −25 → 490; sp_ledger earn_admin_grant + admin_deduct rows, admin_id 1a546991).

## Tracker updates (QA-TESTCASE-STATUS-2026-09-03.md)
Notes/Source refreshed → this run folder: ADM-TC-L04, F08, I04, I03, X06, F05, F03, C03, C04. No PASS/PARTIAL count flips. ADM roll-up unchanged: PASS 132 / PARTIAL 23 / OPEN 1 / SKIPPED 1 / Remaining 3.
