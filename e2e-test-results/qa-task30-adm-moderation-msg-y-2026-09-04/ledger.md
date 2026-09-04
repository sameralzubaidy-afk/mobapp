# QA Task 30 — Per-Case Ledger (2026-09-04)

Guide: ADM = MODULE-ADMIN-PORTAL-MANUAL-TESTING.md; MSG = MESSAGING-...-MANUAL-TESTING.md. Verdicts: ✅ PASS · 🟡 PARTIAL · 📄 DOC-DRIFT · ⏭️ SKIPPED · 🔴 OPEN/BLOCKED · 🔒 FIXTURE-GATED (with reason).

## Batch 0 — Also-Confirm spot-checks (ADM)
| TC | Verdict | Notes |
|---|---|---|
| F06 (spot-check) | ✅ PASS | DT106 batch fix holds: one-Save 48→100/72→67 atomic success; reverted 48/72 DB-verified |
| K02 | ✅ PASS | /payouts/earnings data renders (100 rows, no 401) — DT106 client fix holds |
| Z05 | ✅ PASS | ?status=failed deep-link presets filter + empty state (0 failed rows, correct) |
| B04 | 📄 DOC-DRIFT | SP credit/debit + freeze lives on /sp-wallet, NOT /users (guide ref wrong); /users drawer read-only. Commit leg on a real wallet queued (needs disposable user) |
| K03 | 🔴 OPEN (fixture-gated) | retry commit needs a failed payout row (0 exist on staging); retry button correctly absent for non-failed |

## Batch 1 — ADM Moderation (disposable fixtures)
| TC | Verdict | Notes |
|---|---|---|
| C03 | ✅ PASS | approve flagged → available; approved_by samer; admin_activity_log |
| C04 | ✅ PASS | reject reason required (disabled w/o) → rejected + reason stored |
| C05 | ✅ PASS (+doc-drift) | appeal info on /items/flagged Review modal; /items/[id] renders no appeal data + load hang |
| C06 | ✅ PASS | force delete (reason required) → deleted |
| C07 | ✅ PASS | pause → paused |
| C08 | ✅ PASS | approve pending (pending-only btn) → available |
| C09 | ✅ PASS | request edits (note required) → needs_edits |
| C10 | ✅ PASS | reject (note required) → rejected |
| X05 | ✅ PASS | AC inline approve → toast + row left + count 3→2 |
| X06 | ✅ PASS | AC inline under-review → DB under_review (trade fe3924ee residue — see report §7) |
| X07 | 🟡 PARTIAL | affordance verified (0 failed → card absent correct); retry commit fixture-gated |

## Batch 3 — ADM Y-group (⌘K palette)
| TC | Verdict | Notes |
|---|---|---|
| Y01 | ✅ PASS | ⌘K handler via synthetic (opens/focus/toggle/Esc); real-keyboard driver-limited |
| Y02 | ✅ PASS | header pill opens palette |
| Y03 | ✅ PASS | grouped Users/Listings/Trades in one render |
| Y04 | ✅ PASS | breadcrumb per row |
| Y05 | 🟡 PARTIAL | 200ms source-verified; char-by-char not drivable |
| Y06 | ✅ PASS | top-5 + See-all expand (5→21) |
| Y07 | ✅ PASS | footer View-all → prefilled list pages |
| Y08 | 🟡 PARTIAL | settings/users/trades nav ✓; listings nav → empty (search-by-uuid gap — finding) |
| Y09 | ✅ PASS | arrows move cursor, Enter opens, Esc closes |
| Y10 | ✅ PASS | non-admins excluded (RBAC admin-only + profiles gate); RPC forbidden defense |
| Y11 | ✅ PASS | values never shown; value not a match source |
| Y12 | ✅ PASS | empty hint + no-results states |

## Batch 2 — MSG last-3 (moderation config)
| TC | Verdict | Notes |
|---|---|---|
| MSG-G05 | 🟡 PARTIAL | banner leg PASS (recall flag → Safety Review banner on-device); recall_alert notification leg product-decision-gated (no producer) |
| MSG-G08 | 🟡 PARTIAL | config round-trip PASS; AI-image-flag behavioral leg infra-gated (Google Vision reachability) |
| MSG-G09 | ✅ PASS | config round-trips PASS; recall match 0.9143≥0.5 + EF threshold gate verified; recall-flagged scenario driven. Residual: New-Item recall-title create comparison not driven |

## Totals
- **ADM this round:** 18 PASS (C03-C10 + X05/X06 + Y01-Y04/Y06/Y07/Y09-Y12 + K02 + Z05 + F06-spot) · 4 PARTIAL (X07, Y05, Y08 + note) · 1 DOC-DRIFT (B04) · 1 OPEN (K03 fixture-gated). Y-group 10 PASS/2 PARTIAL; C-group 8/8 PASS.
- **MSG this round:** 1 PASS (G09) · 2 PARTIAL (G05/G08). MSG never-run pool = 0.
- ADM moderation/action-center commit legs: **genuinely closed** on disposable targets (C03-C10 + X05 + X06 real commits, DB-verified). X07/K03 remain fixture-gated on a failed-payout row.
- MSG guide: **fully closed of never-run cases** (0 remaining).
