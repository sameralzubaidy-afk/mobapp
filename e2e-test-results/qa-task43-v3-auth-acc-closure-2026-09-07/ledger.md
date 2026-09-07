# QA Task 43 v3 — Ledger

Run: `qa-task43-v3-auth-acc-closure-2026-09-07` · 2026-09-07 · HEAD `fe5294a3` (DT-128 v2) · Device iPhone 17 Pro Max sim `3F3293A3`

| TC-ID | Guide | Verdict | Date | Evidence / source |
|---|---|---|---|---|
| ACC-J07 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §J07; screenshots `ACC-J07-*`; toggle `policy_failure=no_policy` |
| ACC-J08 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §J08; screenshots `ACC-J08-*`; toggle `policy_failure=fetch_failure` (+ Retry recovery) |
| ACC-J12 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §J12; screenshot `ACC-J12-*` |
| ACC-J02 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §J02; Decline leg (0 rows) + relaunch re-prompt + Accept (v1.1 row 13:34:36) — test-payfail email/pw |
| ACC-J05 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §J05; real admin publish TOS v1.2 + Privacy v1.1 → test-buyer re-prompt → accept → original restored |
| ACC-G02 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §G02; test-payfail/test-trial/test-grace banners + draft Continue/Maybe later |
| AUTH-P03 | AUTH/Onboarding/... | ✅ PASS | 2026-09-07 | `report.md` §P03; seed self-refresh fixture → badge 1 → read → cleared (DB read_at) |
| ACC-H03 | Account/Dashboard/Help/Legal | ✅ PASS | 2026-09-07 | `report.md` §H03; FAQ 5-cat fallback armed; disarm → DB FAQs |
| AUTH-C07 | AUTH/Onboarding/... | 🟡 PARTIAL | 2026-09-07 | `report.md` §C07; RPC `can_set_password` true + wiring verified; modal drive gated on Google identity attach |

## Bookkeeping / tracker
- ACC-K01–K04 → moved 🔴 OPEN → 🚫 NOT-SUPPORTED (NOT-IMPLEMENTED bucket) in `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`.
- AUTH-Q04 guide doc confirmed `$1.49` (subscriber flat fee) — no tracker change (already PASS).
- Tracker notes: AUTH-S01 (still BLOCKED, SendGrid step pending — not re-attempted); AUTH-C07 (PARTIAL, Google identity pending).
- Roll-ups after this round: **AUTH 126 PASS / 3 PARTIAL / 2 OPEN** (P03 PASS, C07 PARTIAL) · **ACC 68 PASS / 2 OPEN / 4 NOT-SUPPORTED / 1 SKIP** (7 PASS flips; K-group reclassified). R56-reconciled.

## Excluded (unchanged dispositions)
AUTH-S01 (owner SendGrid step), AUTH-C03 (Apple — no dev account), ACC-B03 real-SMS leg (F&F), ACC-G09 (won't-test), ADM 3 permanent, TRD 19 deferred, ACC MFA (K-group now NOT-IMPLEMENTED bucket).
