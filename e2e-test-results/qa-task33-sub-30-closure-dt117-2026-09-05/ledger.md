# QA Task 33 — Ledger (per-case verdicts)

Run folder: `e2e-test-results/qa-task33-sub-30-closure-dt117-2026-09-05/` · Date 2026-09-05 · Device iPhone 17 Pro Max sim

## Verdict roll-up

**12 PASS · 2 PARTIAL · 0 FAIL · 0 BLOCKED-on-run** (plus 2 source-confirmed + 1 N04 PASS inside Batch 3; fixture-gated cases recorded as Remaining-with-reason)

## Per-case / per-item ledger

| TC / Item | Surface | Verdict | Top finding / evidence |
|---|---|---|---|
| DT117 item 7 (= SUB I06) | mobile | ✅ PASS | free-user SP Wallet upsell card renders + navigates JoinKidsClub; I06 DOC-DRIFT resolved → PASS |
| DT117 item 6 | admin | ✅ PASS | BadgeEditor Remove Icon appears + works (DB/storage/audit); upload path also now works (P02 defect resolved) |
| DT117 item 8 | admin | ✅ PASS | grace row human label + ⓘ actor/date detail; Reactivate clears stale reason |
| ADM M03/M04 audit re-verify | admin | ✅ PASS | Cancel/Reactivate/Extend-Trial each write real `admin_audit_logs` row w/ actor 1a546991; mobile Active reflection |
| SUB D05 | mobile | ✅ PASS + MED finding | in-app reactivate works E2E (Active + new Stripe sub); sp_wallets stuck grace_period |
| SUB F01 | mobile | ✅ PASS | hero 3 figures + Withdraw Now (inflated seller_balance note) |
| SUB F02 | mobile | ✅ reconfirm | method card + Add Another Method |
| SUB F03 | mobile | ✅ PASS (note) | history rows render (pending only in data) |
| SUB F04 | mobile | ✅ PASS (note) | earnings + net/fee rows |
| SUB F08 | mobile | 🟡 PARTIAL | Load More blocked (scroll friction + no testID); 25-payout precondition ✓ |
| SUB G07 | mobile | ✅ PASS | Edit Details alert exact copy |
| SUB G08 | mobile | ✅ PASS (nuance) | Cannot Delete Primary Method (only-method is primary) |
| SUB G10 | mobile | 🟡 PARTIAL | same as F08 |
| SUB H02 | mobile | ✅ PASS | WithdrawModal summary + fee math correct; no withdrawal created |
| SUB N04 | mobile | ✅ PASS | ContinueKidsClub active variant |
| SUB N05 | mobile | ✅ source-confirmed | loading branch renders spinner + "Loading..." |
| SUB N06 | mobile | 🔴 not run (fixture) | no ≤7-day-trial mobile persona |
| SUB K02 | mobile | 🟡 (empty=E02; error leg not drivable) | needs forced fetch failure |
| SUB M01 | mobile | ✅ source-confirmed | transient loading spinner |
| SUB M06 | mobile | ✅ AX-verified | pm-back-button present |
| SUB M07 | mobile | 🟡 PARTIAL | attach branch driven (PASS); detach not driven |
| F05, F06, F07, G01, G04, G05, G06, G09, G11, H01, H03, H04, H06, H07 | mobile/admin | 🔴 Remaining (fixture-gated) | see tracker notes; need dev QA payout fixture (method-state + balance-state + fresh payout) |

## Owner notes from this run (embedded)
1. **Withdraw payouts E2E (positive + negative) NOT tested this round — explicit.** Only the WithdrawModal summary (H02) was opened + cancelled. H03 confirm-success, H01 no-balance, H04 no-method, H06 min-withdrawal, H07 config-0 were NOT driven (need a controlled-balance/method fixture; confirming on the inflated $15,603 balance would mint a bogus transfer). Committed follow-up.
2. **FIX RECORD — Load More overlaps the floating nav bar** (owner-confirmed, `SUB-F01-hero.png`): Load More renders in the tab-pill band (~y848–904), occluded by the nav bar with no pill-clear inset → F08/G10 root cause. Fix: pill-height content inset + testID.
3. **FIX RECORD — WithdrawModal "Payout Fee:" must say it's the payment-method/Stripe processor fee, not a platform fee** (owner-confirmed, `SUB-H02-withdraw-modal.png`): label is bare "Payout Fee:" for Stripe's $0.25 + 0.25%. Fix: name the method + clarify "not charged by Pass It Up" (concrete rewrite in report.md).
4. **UX ENHANCEMENT RECORD — ContinueKidsClub "already active" state is a blank dead-end** (owner-confirmed, `SUB-N04-continue-active.png`): one centered line + a lone Go Back, no header/benefits/Manage link. Idea: "you're all set" landing with benefits recap + Manage Kids Club+ deep link + proper header. (See report owner-notes #4.)

## Tracker change (R52)
SUB: PASS 47→56 · PARTIAL 2→4 · DOC-DRIFT 1→0 · Remaining ACTIVE 30→20. Flips to Completed: D05/F01/F03/F04/G07/G08/H02/N04 PASS; F08/G10 PARTIAL; I06 DOC-DRIFT→PASS. A05 pruned from Remaining (R57 duplicate of existing PASS). ADM unchanged (M03/M04 already PASS; re-verified live).

## App state left behind
- Disposable `bb862192` (qa.alice.1788646329130763) left ACTIVE (sub sub_1UCSzT4, card pm_1UCRto4, wallet grace_period) — retained as D05-finding repro fixture; BP-70 delete deferred until dev investigates (flag).
- Trial row `e0d1766e` extended +7d (ends 9/14) — M03 audit residue.
- Badge 510cd0b9 icon uploaded→removed (back to icon-less, clean); audit rows legitimate.
- Admin audit rows bdf30c52 / 5a328de9 / 0b0eae02 (actor 1a546991).
- Simulator logged out (Landing).
