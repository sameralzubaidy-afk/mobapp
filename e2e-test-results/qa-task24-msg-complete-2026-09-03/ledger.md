# QA Task 24 — MSG Guide Ledger (updated 2026-09-03)

Full detail: `report.md` in this directory. Verdict keys: PASS / BLOCKED (with reason) / NOT-SUPPORTED / GATED (fixture/config/time/service) / DEFERRED / PASS-ALREADY-COVERED (in-session evidence).

| TC | Verdict | Notes |
|---|---|---|
| I06 | PASS | pull-to-refresh wired; order matches DB |
| A04 | PASS | realtime receive (msg c71c2b17) |
| A05 | PASS | typing indicator (CDP presence) |
| A06 | PASS | native picker image + full-screen viewer nav |
| A07 | PASS | 2000-char hard cap; doc-drift: no truncation notice on iOS |
| A10 | PASS | OS photo permission-denied alert |
| I07 | PASS | live notif (bd55ef2a) atop open center |
| F06 | PASS | fresh signup w/ code; invalid-code dialog |
| F07 | PASS | pause banner + disabled share; reverted |
| F08 | PASS | admin amounts propagated; reverted to 40/20/10/25 |
| B04 | PASS | badge celebration modal via admin manual award (realtime) |
| D01 | PASS | upload from library, preview, Change Image |
| D02 | PASS | camera-denied alert; capture leg toolset-limited |
| D03 | PASS | submit → pending req 34254b02 |
| D04 | PASS | pending-state duplicate lock |
| D05 | PASS | no-image guard (disabled submit); doc-drift copy |
| D06 | PASS | pending-state screen |
| D07 | BLOCKED | needs admin decision (E02) — id-badge auth bug |
| D08 | BLOCKED | needs admin decision (E03) — id-badge auth bug |
| D09 | PASS (in-app) | notif df20f0ef; email leg: NO email_logs row |
| D10 | NOT-SUPPORTED | no id_verification notif category |
| E01 | PASS | admin queue stats/filters/search |
| E02 | BLOCKED | decide API 401 — client attaches no admin auth |
| E03 | BLOCKED | decide API 401 — same |
| E04 | BLOCKED | detail API 401 — same |
| E05 | BLOCKED | message templates API 401 — same |
| E06 | PASS | 3 admin_notifications rows for submission |
| G01 | GATED | needs standing-seller flagged listing fixture |
| G02 | GATED | needs rejected-listing fixture + appeal |
| G03 | GATED | needs needs-edits fixture + resubmit |
| G04 | GATED | needs flagged-listing fixture + remove |
| G05 | GATED | recall fixture (edge-fn check; recall data + config live) |
| G06 | GATED | needs rejected fixture + config set/revert (key exists=3) |
| G07 | GATED | time-aged rejection reachable as standing user (window=14d) |
| G08 | GATED | AI moderation image path (currently disabled; external service) |
| G09 | GATED | needs recall fixture + threshold run |
| H01 | PASS | moderation queue (filters + review modal) |
| H02 | PASS | approve → available (DB + notif) |
| H03 | PASS | reject w/ reason (DB + notif); guard=disabled btn (doc-drift) |
| H04 | PASS | request edits → needs_edits (DB + notif) |
| H05 | GATED | needs reported-dispute fixture (admin UI verified working) |
| H06 | GATED | needs reported-dispute fixture (admin UI verified working) |
| R01 | PASS-ALREADY-COVERED | Batch 2 realtime evidence |
| R02 | GATED | needs trade-status + listing-approval notifs |
| R03 | GATED | needs recall fixture (G05) |
| R04 | BLOCKED | depends on E02/E03 admin decide (auth bug) |
| R05 | PASS | flagged/rejected/needs-edits not publicly searchable |
| R06 | PASS-ALREADY-COVERED | Batch 4 F07/F08 evidence |
| B05 | DEFERRED | Leaderboard (excluded per task) |

## Summary
- PASS verdicts this run: 29 (incl. 2 PASS-already-covered).
- BLOCKED (genuine infra/app defect): E02,E03,E04,E05,D07,D08,R04 → root cause: admin ID-badge review client sends no admin auth header (verifyAdminAuth 401); is_admin() reads profiles.role but samer has no profiles row.
- NOT-SUPPORTED: D10 (no id_verification category).
- GATED (fixture/config/time/service, each investigated): G01-G09, H05, H06, R02, R03, D09-email-leg.
- DEFERRED: B05.
- MSG guide: NOT fully closed (see report §6).
