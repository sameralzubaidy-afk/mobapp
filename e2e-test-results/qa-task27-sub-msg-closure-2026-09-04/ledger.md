# QA Task 27 — Ledger (SUB reconciliation + MSG closure)

**Folder:** `e2e-test-results/qa-task27-sub-msg-closure-2026-09-04/` · **Date:** 2026-09-04

## Per-case verdicts this round

| TC-ID | Guide | Verdict | Type | Evidence |
|---|---|---|---|---|
| MSG-TC-H02 | MSG | ✅ PASS | Live admin execution | Approve flagged ba6345ce → confirm → item left the moderation queue (DB-rendered). `H02-*.png` |
| MSG-TC-H03 | MSG | ✅ PASS | Live admin execution | Reject flagged ccf97ae4 with Decision Note (Reject disabled until note) → queue shows Rejected + note persisted. `H03-*.png` |
| SUB-TC-D01 | SUB | 🔴 BLOCKED (tooling) | On-device (would be) | mobile-mcp disabled this session. test-grace → manage-kids-club ready to run. |
| MSG-TC-D02 | MSG | 🔴 BLOCKED (tooling) | On-device | mobile-mcp disabled. Source-scoped (camera path + sim limitation). |
| MSG-TC-D04 | MSG | 🔴 BLOCKED (tooling) | On-device | mobile-mcp disabled + no pending ID request in DB (needs a submission first). |
| MSG-TC-D05 | MSG | 🔴 BLOCKED (tooling) | On-device | mobile-mcp disabled. Submit-disabled guard source-verified. |
| MSG-TC-D10 | MSG | 🔴 BLOCKED / by-design NOT SUPPORTED | On-device / source | mobile-mcp disabled; no id_verification category (source + guide). Testable badges-category proxy queued. |
| MSG-TC-I01 | MSG | 🔴 BLOCKED (env/tooling) | On-device | mobile-mcp disabled; success leg needs a physical device. |
| MSG-TC-I02 | MSG | 🔴 BLOCKED (tooling) | On-device | mobile-mcp disabled; simulator error-state leg queued. |

## Reconciliation-only verdict changes (tracker, R52) — not live re-runs

**SUB → PASS (13, evidence from prior reports qa19/qa21/qa22/qa25/DT99):** A02, C04, C06, C07, C08, E01, E02, J03, J04, L01, L02, L03, L04
**SUB → PARTIAL (1):** C05 (Manage reason-modal surface not driven — outcome verified via retention/alert path only)
**SUB OPEN unchanged (3):** D06, D07, I08 (dev-run fixture-gated)
**MSG PARTIAL → PASS (5):** D07, D08, E02, E03, E05 (qa25 Batch 1 verbatim PASSes; caveats preserved in tracker notes)

## Roll-ups after this round (tracker `QA-TESTCASE-STATUS-2026-09-03.md`)

- **SUB (100):** PASS **44** · PARTIAL **2** (L05, C05) · OPEN **3** (D06/D07/I08) · Remaining **51**
- **MSG (72):** PASS **61** · PARTIAL **0** · OPEN **1** (B05) · Remaining **10** (D02, D04, D05, D10, G05, G08, G09, I01, I02, J05)

## Remaining MSG NEVER-RUN ledger (10) — reason

| TC-ID | Status | Why |
|---|---|---|
| MSG-TC-D02 | Queued (on-device) | mobile-mcp disabled this session |
| MSG-TC-D04 | Queued (on-device) | needs a pending ID request (0 in DB); mobile-mcp disabled |
| MSG-TC-D05 | Queued (on-device) | mobile-mcp disabled; source-verified disabled-guard |
| MSG-TC-D10 | NOT SUPPORTED by design | no id_verification category; ID-verif routes through badges (source+guide); proxy testable next session |
| MSG-TC-G05 | Blocked (product decision) | recall_alert producer not built — parked |
| MSG-TC-G08 | Blocked (product decision) | AI-moderation toggle/AI-vision reachability — parked |
| MSG-TC-G09 | Blocked (product decision) | recall-check toggle/threshold — parked |
| MSG-TC-I01 | Blocked (env) | push-success leg needs a physical device |
| MSG-TC-I02 | Queued (on-device) | simulator error-state leg testable once mobile toolset enabled |
| MSG-TC-J05 | NOT SUPPORTED | no id_verification preference category |

## Remaining SUB NEVER-RUN (51) — composition note
17 RETIRED/🚫 N/A (B01–B13, D02, D04, G02, G03); ~22 payout-domain guide entries re-mapped to the live `PayoutSettingsScreen` (qa21 F-D2 guide-refresh finding; qa19 F02/H05 PASSed the live surface); fixture-gated OPENs already counted above; small genuinely-attemptable remainder (D01 grace, D05 reactivate, K02 empty≈E02, I06/A05 reachability) queued.

## Evidence files (screenshots/)
- `H02-H03-flagged-queue-all.png`, `H02-review-modal-flagged.png`, `H02-post-approve-queue.png`
- `H03-reject-modal-flagged-prefill.png`, `H03-post-reject-queue.png`

## Tracker + memory writes
- `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (SUB + MSG sections) — updated per R52.
- `/memories/repo/qa-task27-2026-09-04.md` — dated consolidation.
