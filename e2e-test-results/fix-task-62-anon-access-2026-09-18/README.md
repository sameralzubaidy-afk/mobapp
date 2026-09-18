# FIX-Task-62 — ANON-ACCESS LOCKDOWN workstream (this folder)

**This folder is the anonymous-access lockdown**, not the payout sweep. Two different
dispatches were both labelled "FIX-Task-62" on 2026-09-18; both folders are kept so no
evidence is lost.

| | |
|---|---|
| **This folder** | `fix-task-62-anon-access-2026-09-18/` — 4 admin READ signatures gated, anon policies dropped, `setup_user_profile` service-role-only, Part 1 FIX-Task-61 confirmation, and the **paused Part 3** FIX-Task-60 staging apply |
| **Sibling folder** | `fix-task-62-2026-09-18/` — payout `requires_action` stranding + D2 presumed-settled guard |

Contents here:
- `report.md` — Parts 1–3 (Part 3 = the paused staging apply, §6)
- `evidence/` — FIX-Task-61 device screenshots + the source-modal blocker crops
- `fidelity-fix62b.json`, `keys-fix62b.txt` — fidelity gate output (**136** findings) and its key set
- `keys-fidelity-report.txt` — FIX-Task-60 **baseline** key set (**135**), used for the 0-NEW diff
- `fidelity-part3-preapply.json`, `keys-part3-preapply.txt` — **fresh Part 3 pre-apply re-measure
  (2026-09-18 16:15): 137 findings, 0 unexplained, exactly ONE new key vs the 136 above, attributed
  to the payout workstream's `20260918000013` extending `financial_audit_log_mutation_type_check`
  (`payout_requeue_skipped`) — chain-ahead of a Sep-16 staging snapshot, not a Part 3 change.**

> **Fidelity snapshot caveat (read before quoting any count):** the gate's *staging* side is a
> **captured snapshot** at `/tmp/staging-fp{1,2,3}.txt` (mtime **Sep 16 13:07**), not a live read.
> It predates every FIX-58…62 migration, so some conflicts are simply *chain-ahead*. Only the
> **key-set diff** is load-bearing; the absolute count is not a live staging measurement.

Migrations owned by this workstream — a **reserved block**, deliberately far from the payout set
so a filename order key can never collide again (BP-99):

```
20260918050000_fix_task_62_admin_read_and_anon_function_lockdown.sql   (written, NOT applied)
20260918050001_fix_task_62_anon_policy_alignment.sql                   (written, NOT applied)
20260916000077_admin_user_management.sql                               (edited: analytics creator fix)
```
