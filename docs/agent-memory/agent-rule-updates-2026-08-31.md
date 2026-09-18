# Agent-rule improvements landed 2026-08-31 (DT68→DT73 / QA11→QA13 arc)

Consolidation of process fixes from the tax/copy/wording arc across Dev Tasks 68–73 and QA Tasks 11–13. All doc/rule-only — no code. This is the standing-rules capture file for the Dev agent (continuation of `agent-rule-updates-2026-08-27.md` / `-08-28.md`).

## 1. Full-string sweep on the FIRST fix of a wording-consistency class — never incrementally
- The "charged/paid/captured vs authorized" language issue was found and fixed piecemeal across THREE separate tasks: DT68's refund-vs-void investigation → DT71 item 1 (seller-accept alert "Payment captured" → "Payment authorized"; QA Task 12 P2) → DT73 items 1–2 (pre-accept confirm modal "The buyer will be charged…" → authorized; Trade Timeline "Buyer paid. Awaiting pickup confirmation." → authorized). Each round fixed only the exact string QA had flagged, then a later QA round found another instance of the same class (QA Task 13 P3/P4 — surfaced only one session after DT71's fix).
- **STANDING RULE:** when a fix changes user-facing copy to correct a conceptual mismatch (e.g. "captured" vs "authorized"), in that SAME session grep the whole codebase for all related strings near the affected flow (`paid`, `charged`, `captured`, `authorized`, `refund`, `hold`) and fix or explicitly triage every instance at once. Do not leave same-class instances for QA to find one-per-round.
- Evidence: `e2e-test-results/qa-task12-close-2026-08-30/report.md` P2 (R06); `e2e-test-results/qa-task13-dt71-dt72-verify-2026-08-31/report.md` P3/P4 + A1.

## 2. Real invocation of every code branch immediately after a CREATE OR REPLACE FUNCTION deploy
- Postgres compiles function bodies LAZILY — a runtime SQL error in an unexercised branch surfaces only on the first real invocation, not on a clean apply. DT71's tax-voided-report fix (migration `20260831220000_dev_task_71_tax_voided_report_fix.sql` + admin `/tax/reports`) cost a re-apply for exactly this: the migration applied cleanly but a report branch hit the GROUP BY 42803 error on first real call.
- **STANDING RULE:** add "drive every branch with a real invocation" as a Tier-2 checklist item for ANY DB/RPC change with multiple branches or report types. After apply, call the function with inputs that exercise each branch (at minimum one per report type / status path) and confirm a real result — never a clean-apply check alone.

## 3. State upfront whether a QA finding is being confirmed or ruled out — "false alarm, no bug" is a first-class outcome
- This discipline worked well twice and should be a standing instruction, not something that happened to go well: DT68 (refund-vs-void — CONFIRMED not a bug: uncaptured PIs are correctly voided, not refunded; auth-and-capture model) and DT71 (tax-report mislabeling — ruled out after source + DB check).
- **STANDING RULE:** at the top of any QA-finding investigation, explicitly state whether you are confirming a bug or ruling one out. A "false alarm, no bug" verdict with evidence (source + DB read-back) is an equally valid, first-class outcome and must be recorded as such in the handoff — not treated as a wasted investigation.

## Cross-references
- Dev-task evidence files: `dev-task-68-global-tax-toggle-2026-08-30.md` (Item 2 refund-vs-void), `dev-task-69-qa11-remaining-2026-08-30.md`, `dev-task-72-ux-2026-08-31.md`.
- QA evidence: `qa-task11-nopqr-2026-08-30/`, `qa-task12-close-2026-08-30/`, `qa-task13-dt71-dt72-verify-2026-08-31/` (all under `e2e-test-results/`).
- Companion QA-side standing notes added the same day to `/memories/repo/qa-test-agent.md` (2026-08-31 entry).
- **Wired into the tracked agents/docs 2026-08-31 (commit `08cc8e41`, NOT pushed):** Copy-Consistency Class Sweep under USER-FACING COPY STANDARDS (`.github/agents/Kids P2P App Builder.agent.md`); real-invocation-every-branch rule added to the Tier 2 "MUST include" checklist; confirm-vs-rule-out added as §9.1a. QA-side R39–R41 added as playbook §5.46 + a pointer in `.github/agents/QA-Test-Agent.agent.md` §4.
