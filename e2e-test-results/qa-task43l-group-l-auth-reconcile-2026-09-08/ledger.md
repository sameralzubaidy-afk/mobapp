# QA Task 43L — Ledger — Group L + Full AUTH Closure & Reconciliation — 2026-09-08

**Platform:** Android Medium_Phone_API_36.1 + real admin :3001 · **Mobile HEAD:** `08cd458c` (FIX-Task-5 committed, clean) · Guide: AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md

## Verdict roll-up
**Part 1:** 6 ✅ PASS (L01–L04 + J10 typed-OTP leg) · 0 🔴 FAIL · 0 🚫 BLOCKED · 2 ⏭️ deferred-explicit (S08, S11-Case2 — corrected reason).
**Part 2:** AUTH Android reconciliation = **99/138 rows Android-verified** · 9 excluded (5 REMOVED + 4 config-pending) · **30 rows with no Android verdict** (real remaining Android set; all have iOS-era/platform-agnostic PASS on record).

| TC-ID | Verdict | Platform | Evidence / notes |
|---|---|---|---|
| AUTH-TC-L01 | ✅ PASS | Android | buyer search 0 results while pending + seller My Listings PENDING/Awaiting approval; DB pending |
| AUTH-TC-L02 | ✅ PASS | Android + admin | real admin :3001 approve (`73670a8f`) → native "Listing approved" alert → DB available/approved_at → buyer search "1 result" + seller Active 26 |
| AUTH-TC-L03 | ✅ PASS | Android | listing_approved notification `1ecb29ce` (deep_link /listing/73670a8f) → bell badge → tap → Item Detail; read_at set; +10 SP starter pack |
| AUTH-TC-L04 | ✅ PASS | Android | edit price 20→25 → Save → pending (approved_at NULL, $25) → buyer search 0 results again |
| AUTH-TC-J10 (completion leg, typed OTP) | ✅ PASS | Android | FIX-Task-5 committed; gate prefill +15551234004 (not placeholder) → Send Code fires → typed 123456 → single verify → publish resumes → 1 item `356c46b5`; phone_verified_at set; test-free restored |
| AUTH-TC-S08 | ⏭️ NOT RUN (deferred, corrected) | — | harness EXISTS/live (source-verified); not "newly unblocked"; Android fragment-delivery + shared-persona reset = dedicated session |
| AUTH-TC-S11-Case2 | ⏭️ NOT RUN (deferred, corrected) | — | same dependency as S08 (Case1+3 already Android PASS 43c) |

## Part 2 — Android-verified count roll-up per group (Android verdicts on file)
A 8/8 · B 12/12 · C 3 PASS (+4 BLOCKED-excluded) · D 3/3 · E 3/5 · F 3/6 · G 0/6 · H 5/7 (incl. H06 PARTIAL) · I 0/3 (REMOVED) · J 13/15 (J05 PARTIAL; J14/J15 excluded) · K 6/6 · L 4/4 (this round) · M 10/10 · N 3/4 (N01 excluded) · O 4/5 (O05 excluded) · P 1/19 · Q 7/7 · S 10/11 (S08 deferred)
**Sum: 99 Android-verified + 9 excluded = 108 accounted; 30 no-Android-verdict** (E04, E05-as-row, F02–F04, G01–G06, P01/P02/P03/P05–P19, S08).

## Discrepancies (D1–D7) — see report §3 for full text
D1 43g "near-closure" vs 30-row no-Android-verdict set · D2 stale "harness absent" reason (harness live since 08-16) · D3 tracker §1 (127/2) vs section header (128/1) · D4 43c 27/10 claim vs 29/9 enumerated · D5 43b B01 ledger-PARTIAL vs report-PASS · D6 C03 tracker OPEN vs 43e on-device PASS · D7 J10 43g-PARTIAL → 43h → 43L typed-OTP PASS.
