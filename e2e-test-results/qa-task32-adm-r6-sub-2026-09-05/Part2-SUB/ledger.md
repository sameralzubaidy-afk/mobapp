# QA Task 32 Part 2 (SUB round 1 + ADM re-verify + M03/M04) — Ledger — 2026-09-05

Run folder: `e2e-test-results/qa-task32-adm-r6-sub-2026-09-05/Part2-SUB/` · Device: iPhone 17 Pro Max sim (3F3293A3) · Admin `:3001` shared session · Staging `drntwgporzabmxdqykrp`

## Per-case ledger

| TC-ID (guide) | Verdict | Evidence / top finding |
|---|---|---|
| Waitlist User column (ADM E05 note) | ✅ PASS | /waitlist shows real names; 3 "Unknown user" = orphan rows w/ no profile (correct fallback). DB 9 rows. |
| ADM-TC-P02 | ✅ PASS (PARTIAL→PASS) | Badge-icon upload end-to-end (200 public URL + row img + DB icon_url). DT116 fix verified. |
| ADM-TC-R03 | ✅ PASS (PARTIAL→PASS) | Edu section publish 204 + is_published + mobile Help shows section (fresh + pull-to-refresh). Fixture cleaned. |
| ADM-TC-M03 | ✅ PASS (PARTIAL→PASS) | Cancel active→grace_period (+mobile Grace), Reactivate grace→active (+mobile Active), Extend Trial +7d on disposable row. Guide Cancel→'cancelled' = DOC-DRIFT. |
| ADM-TC-M04 | ✅ PASS (PARTIAL→PASS) | Reactivate confirm copy exact; mobile Active reflected. |
| SUB-TC-A05 | ✅ PASS | Free JoinKidsClub leg on-device; active/grace Manage legs evidenced (disposable + D01 cross-ref). |
| SUB-TC-I06 | 📄 DOC-DRIFT | Free SP Wallet = normal 0-SP wallet; no inactive lock/subscribe CTA (source-confirmed). Guide stale. |
| SUB-TC-N03 | ✅ PASS | JoinKidsClub navigable; other aliases deep-link only (source-confirmed). |
| SUB-TC-D05, F01/F03–F08, G01/G04–G11, H01–H04/H06/H07, K02, M01/M06/M07, N04–N06 | ⏭️ DEFERRED (30) | Explicit per-case reasons in report §6; stay in tracker ACTIVE remaining (30). Not rushed. |

## Fixture state

- Disposable real active sub: user `qa.alice.1788646329130763` (`bb862192`), sub `fbada8e7` ACTIVE (Stripe `sub_1UCRtq4…`, period → 2026-10-05). **Retained** for Batch-3 continuation (D05 + lifecycle reuse); BP-70 cleanup at continuation end.
- Disposable trial row `cd4b766b` trial_end 09-14 (+7d Extend leg; low-impact e2e-isolated row).
- Badge `3ac79591` icon set (P02 residue, no remove affordance) — flag dev.
- R03 section deleted; education_sections = 4; waitlist 9; config untouched (no reverts needed).

## Roll-up
7 PASS / 0 FAIL / 1 DOC-DRIFT / 30 deferred. Tracker: ADM PASS 143 / PARTIAL 12; SUB PASS 47 / DRIFT 1 / ACTIVE Remaining 30.
