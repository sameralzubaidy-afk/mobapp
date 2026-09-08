# QA Task 43e — Ledger (per-case roll-up)

**Run folder:** `e2e-test-results/qa-task43e-fix-task3-verify-auth-cont-2026-09-07/`
**Date:** 2026-09-07 · HEAD `b11c73ff` (FIX-Task-3) · Devices iOS (iPhone 17 Pro Max) + Android (Medium_Phone_API_36.1)

## Per-verdict ledger

| # | Verdict | Guide case / FIX item | Platform | Top finding |
|---|---|---|---|---|
| 1 | ✅ PASS | FIX-3 Item1 (Apple provider pre-check) | iOS | Friendly "Apple Sign-In is temporarily unavailable…" banner + full-width green CTA; NO sheet opened (fresh-bundle discriminating check) |
| 2 | ✅ PASS | FIX-3 Item1 (Apple provider pre-check) | Android | Same — friendly banner, NO Chrome custom tab |
| 3 | ✅ PASS | FIX-3 Item2 (Discover default-state count) | iOS | Filters "Show 81 results" = grid "81 results · near CT" (global number gone) |
| 4 | ✅ PASS | FIX-3 Item2 (Discover default-state count) | Android | Same |
| 5 | ✅ PASS | FIX-3 Item3 (A06 "Continue anyway" centered) | iOS | Green #5DBB8E outline (16.39%), text centered, no regression; signup proceeded |
| 6 | ✅ PASS | FIX-3 Item3 (A06 "Continue anyway" centered) | Android | Green outline (16.08%), centered |
| 7 | ✅ PASS | FIX-3 Item3 (Remove-favorite Cancel centered) | iOS | Green outline (11.79%), Cancel functional, favorite retained then cleaned up |
| 8 | ✅ PASS | FIX-3 Item3 (Remove-favorite Cancel centered) | Android | Green outline (11.69%) |
| 9 | ✅ PASS | FIX-3 Item3 (Settings Sign Out Cancel centered) | iOS | Green outline (11.79%), Cancel kept login |
| 10 | ✅ PASS | FIX-3 Item3 (Settings Sign Out Cancel centered) | Android | Green outline (11.78%) |
| 11 | ✅ PASS | FIX-3 Item4 (outage email-fallback CTA) | iOS | Full-width solid #5DBB8E button, white bold centered (94.11%); toggle disarmed after |
| 12 | ✅ PASS | FIX-3 Item4 (outage email-fallback CTA) | Android | Full-width solid green (94.90%); toggle disarmed after |
| 13 | ✅ PASS | FIX-3 Item5 ("Your area: {zip}" label) | iOS | "Your area: 06850" prefill label present alongside matching count |
| 14 | ✅ PASS | FIX-3 Item5 ("Your area: {zip}" label) | Android | Same |
| 15 | ✅ PASS | FIX-3 Item6 (dev-only Supabase Docs link, staging) | iOS | SMTP-500 alert still shows "Open Supabase Docs" (correct for staging); toggle disarmed after |
| 16 | ✅ PASS | FIX-3 Item6 (dev-only Supabase Docs link, staging) | Android | Same; toggle disarmed after |
| 17 | 🔴 FINDING | Spot-check (Linked-Accounts error UI) | iOS | Generic "Failed to link apple account. Please try again." alert — NOT the friendly banner; pre-check fires (no sheet) |
| 18 | 🔴 FINDING | Spot-check (Linked-Accounts error UI) | Android | Same generic alert |
| 19 | ✅ (action) | Disarm fixture toggles | staging | All 3 → none, DB read-back verified (22:06:41Z / 22:07:50Z; avatar toggle untouched at none) |

**Roll-up:** 16 PASS / 2 spot-check FINDING (open Part-1 defect) / 0 FAIL on the 6 numbered items / 0 BLOCKED / 1 action-item (disarm).
**Part 2 (O04-free / B01 / Q / J / K / L / S08+S11-C2):** deferred with explicit per-case reasons (report §6) — the brief's structure requires Part 1 fully clean before Part 2, and the Linked-Accounts spot-check is an open defect on both platforms.

## Call ledger (manual tally — transcript not cleanly mineable this session)

The full session transcript was not cleanly mineable for `qa:mine-call-ledger` (only the pointer `main.jsonl` existed in the session-log dir — same limitation as 43d; QA Task 41 / 43d precedent: manual tally). Manual count of tool executions across this QA Task 43e session (recon + Part 1 dual-platform + this continuation) ≈ **395**.

**Verdict denominator:** counting item-platform verdicts + the disarm action at 43d granularity = 19 rows → **≈ 20.8 calls/verdict**. (Note: this denominator undercounts work — each Item-3 row bundles 1 dialog, and the A06 fresh-signup legs behind rows 5-6 consumed ~25 calls each.)

**Why the ratio is higher this round (structural, not avoidable):**
1. Dual-platform MANDATORY execution for every FIX-Task-3 item — every item × 2 devices ≈ doubles the device-driving tax.
2. Cold-reload-first discipline (mandated by the brief): full terminate→launch + Expo Dev Launcher tap + discriminating fresh-bundle check on BOTH platforms before any verdict (~15 calls, necessary to guarantee no stale bundle — 43d's failure mode).
3. Two fresh-signup A06 persona flows (one per platform, ~25 calls each) to reach the signup-gated invalid-referral dialog.
4. Item-4 required arm→check→disarm of the outage toggle per platform (fixture discipline) + DB read-back verifications.
5. Android Linked-Accounts re-auth modal: keyboard occluded the Confirm button → needed Gboard hide-chevron handling (~6 extra calls; also a real Android UX finding flagged in report §7).

**Per-tool dominant costs (approximate, manual):** ~150 clicks · ~120 element re-lists · ~55 terminal (incl. ~10 qa:admin-config-set + adb + simctl) · ~35 screenshot saves + ~12 qa:ocr/badge-scan analyses · ~12 mcp_supabase_execute_sql · ~18 read_file/grep source reads · ~12 memory/todo/bookkeeping.
