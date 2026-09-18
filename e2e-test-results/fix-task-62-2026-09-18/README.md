# FIX-Task-62 — PAYOUT workstream (this folder)

**This folder is the PAYOUT workstream**, not the anon-access lockdown. Two different
dispatches were both labelled "FIX-Task-62" on 2026-09-18 and they collided on migration
file numbers; both folders are kept deliberately so no evidence is lost.

| | |
|---|---|
| **This folder** | `fix-task-62-2026-09-18/` — payout `requires_action` stranding, `rpc_release_due_payouts` requeue (Fix A/B/C/D/E), the `$205` double-pay incident, the D2 presumed-settled guard |
| **Sibling folder** | `fix-task-62-anon-access-2026-09-18/` — anonymous-access lockdown (admin read signatures, `profiles` anon policies, `setup_user_profile`, plus Part 1 FIX-Task-61 and the paused Part 3 staging apply) |

Contents here:
- `report.md` — verdict, evidence, fix plan A–E, the D2 guard (§15), rollback, verification
- `local-harness/` — `00-setup.sql` + `10-tests.sql`, **16 assertions** (T1–T15 incl. the
  §9.1h non-vacuity probes)

Migrations owned by this workstream (do not confuse with the sibling's reserved block):

```
20260918000010_fix_task_62_requeue_action_required_payouts.sql   (APPLIED to staging)
20260918000011_fix_task_62_backfill_payout_amount_cents.sql      (APPLIED to staging)
20260918000012_fix_task_62_gate_requeue_behind_flag.sql          (APPLIED to staging)
20260918000013_fix_task_62_d2_presumed_settled_guard.sql         (APPLIED to staging + harness T13–T15)
```

The sibling's files live in a **reserved block** (`20260918050000`/`20260918050001`) precisely
so the two workstreams cannot collide again — see that folder's `README.md`.
