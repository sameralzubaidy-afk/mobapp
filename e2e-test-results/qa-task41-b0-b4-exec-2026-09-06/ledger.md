# QA Task 41 — Ledger (B0–B4 execution) — FINAL

Date: 2026-09-06 · Device: iPhone 17 Pro Max sim (iOS 26.1, UDID 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E) · HEAD 48347297 · ~148 tool executions (manual tally; exact miner N/A).
Scope: AUTH 11 + ACC 13 in-scope (28 tracked minus MFA K01–K04 owner-excluded). Excluded everywhere: ADM B03/B06/B07, TRD 19, ACC K01–K04.

| TC-ID | Batch | Verdict (this round) | Evidence / note |
|---|---|---|---|
| B0 (6 handoffs) | B0 | ✅ filed #14–#19 | handoffs-filed.md |
| AUTH-TC-H03 | B1 | ✅ PASS | spot-confirm 09-06 (Warning → profile w/o avatar, DB avatar_url NULL) |
| AUTH-TC-L02 | B1 | ✅ PASS (reconcile) | group-l-reverify 08-21 |
| AUTH-TC-P18 | B1 | ✅ PASS (reconcile) | group-p-reverify 08-23 |
| AUTH-TC-P19 | B1 | ✅ PASS (reconcile) | group-p-reverify 08-23 |
| AUTH-TC-Q06 | B1 | ✅ PASS (reconcile) | group-qs-fix-verify 08-23 |
| ACC-TC-F02 | B1 | ✅ PASS (reconcile) | account-file-f02-g07-closures 08-25 |
| ACC-TC-L02 | B1 | ✅ PASS (reconcile) | full-closure 08-26 |
| ACC-TC-L03 | B1 | ✅ PASS (reconcile) | full-closure 08-26 |
| ACC-TC-L04 | B1 | ✅ PASS (reconcile) | full-closure 08-26 |
| AUTH-TC-C05 | B2 | ✅ PASS | qa_provider_unavailable=google → banner + CTA; disarmed |
| AUTH-TC-Q04 | B2 | ✅ PASS | both personas; sub $1.49 / free $20.00 (live cfg) |
| AUTH-TC-P03 | B2 | 🟡 BLOCKED (fixture) | no unread inbound; seed unread fixture skips; convos terminal |
| AUTH-TC-C07 | B2 | 🟡 BLOCKED (fixture + #19) | qa-social-only now password-bearing (regression); identity owed |
| ACC-TC-B03 | B0 | env-gated (#16) | real-SMS leg owed |
| ACC-TC-G02 | B4 | fixture-gated | needs payment-fail + ≤7d-trial personas |
| ACC-TC-G09 | B0 | dev-gated (#18) | dead-branch disposition |
| ACC-TC-H03 | B0 | dev-gated (#17) | FAQ-failure toggle |
| AUTH-TC-C03 | B0 | env-gated (#14) | Apple |
| AUTH-TC-S01 | B0 | env-gated (#15) | SMTP |
| ACC J02/J05/J07/J08/J12 | B3 | not driven | legal cluster — continuation (mechanisms ready; J02/J05 need persona+admin) |
| ACC K01–K04 | — | owner-excluded | MFA NOT IMPLEMENTED |

Tracker result (atomic, R56/R57): **AUTH PASS 118→125 · OPEN 11→4 · ACC PASS 57→61 · OPEN 17→13**.
Genuinely-open remaining (per tracker): **AUTH 4** (C03, C07, P03, S01) · **ACC 13** (B03, G02, G09, H03, J02, J05, J07, J08, J12 + 4 others pre-existing). Dev/ops handoffs #14–#19 open in the triage queue.

