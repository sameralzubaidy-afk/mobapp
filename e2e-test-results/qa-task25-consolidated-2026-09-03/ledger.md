# QA Task 25 — Ledger (MSG + SUB guides) — updated 2026-09-03

Full detail: `report.md` in this directory. Verdict keys: PASS / PARTIAL / FAIL / BLOCKED (with reason) / GATED / CONFIRMED / source-confirmed.

## MSG guide (`MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`)

| TC | Prior | This round | Verdict | Notes |
|---|---|---|---|---|
| E02 | BLOCKED (401) | re-run | **PASS** | approve `d148ee0f` live; notif + storage-object deletion verified |
| E03 | BLOCKED (401) | re-run | **PASS** | no-reason guard "Please select a rejection reason"; reject `76592772` with reason+notes; notify |
| E04 | BLOCKED (401) | re-run | **PARTIAL** | details page reachable + correct for `34254b02`; shows "Pending" for fresh `d148ee0f` (finding) |
| E05 | BLOCKED (401) | re-run | **PASS** | template edit + "✓ Saved successfully" + reverted |
| D07 | BLOCKED | re-run | **PASS** | Identity Verified + green pill; public profile Verified in other-view; self-view staleness finding |
| D08 | BLOCKED | re-run | **PASS** | rejection notification w/ reason + admin notes; ID back to upload (resubmit) |
| R04 | BLOCKED | covered | **PASS-already-covered** | full lifecycle (submit→approve/reject→notify) this session |
| G01–G04 | GATED (fixture) | fixtures live | **BLOCKED (app bug)** | Safety Review can't load non-available listings (`getListingById` available-only filter) |
| G06 | GATED | fixture live | **BLOCKED (app bug)** | same root cause |
| G07 | GATED | fixture live | **BLOCKED (app bug)** | same root cause |
| G05 / R03 / G08 | — | excluded | — | product-decision gated (per task) |
| H05 | GATED | fixture live | **PASS** | mark-under-review → `under_review` (trade `943097a5`) |
| H06 | GATED | fixture live | **PASS (Complete leg)** | resolve-complete → trade completed + resolved_seller; Refund leg needs 2nd dispute fixture |

## SUB guide (`MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`)

| TC | Prior | This round | Verdict | Notes |
|---|---|---|---|---|
| C09 | fixture-ready | test-expired | **PASS** | Manage Kids Club+ expired info box + Re-subscribe CTA (deep-link reach only) |
| D03 | fixture-ready | test-expired | **PASS** | Subscription Expired screen + dated copy "ended on July 25, 2026" (DT100 live) |
| E03 | fixture-ready | fixture `95d98ab0` | **FAIL-finding** | red FAILED badge renders; `error_message` never shown (screen gap) |
| E04 | FIXTURE-GATED | fixture `62dfdbf5` | **PASS** | Subscription Status via notification tap (Stripe IDs, period, days-left) |
| L02 | PARTIAL | — | **PASS (cross-ref DT99 QA)** | real failing-renewal grace/freeze transition verified live by DT99 independent QA |
| D06 | FIXTURE-GATED | — | **GATED** | needs dev-staged `notif-sub-event` rows or real cron+push; DT98 output-shape equivalence confirmed |
| D07 | FIXTURE-GATED | — | **GATED** | same |

## DT97 visual pass (Batch 2)

| Item | Verdict | Evidence |
|---|---|---|
| 5-3 ID pending Back-to-Profile secondary-outline | **PASS (on-device)** | white + green outline + green text |
| 5-4 referral rows dim when paused | **PASS (on-device)** | paused banner + `rowDimmed` 0.5 rows vs normal full-intensity; config reverted |
| 5-1 invalid-code "Fix it" primary | source-confirmed | `Fix it` `primary:true` `referral-invalid-fix-it-button` (in installed bundle) |
| 5-2 badge count refresh on celebration dismiss | source-confirmed | `badgeShowcaseRefresh` bump in `handleCelebrationClose` |

## Roll-up
- PASS: 11 (E02,E03,E05,D07,D08,R04,H05,H06,C09,D03,E04-SUB) + 1 cross-ref (L02) + 2 CONFIRMED on-device (5-3,5-4)
- PARTIAL: 1 (MSG E04) · FAIL-finding: 1 (SUB E03) · BLOCKED (app bug): 7 (G01–G04,G06,G07) · GATED: 2 (D06,D07) · source-confirmed not re-driven: 2 (5-1,5-2)
