# Supabase migrations

All schema/DDL changes live here as `.sql` files and are applied in filename order.
A few files in this folder are **not** migrations — `SCHEMA_SMOKE_TEST.sql` and
`VERIFY_*.sql` are hand-run diagnostics.

`supabase_migrations.schema_migrations` is the record of what has been applied. It and this
folder can legitimately disagree — the exceptions are recorded below so nobody re-applies a
migration blindly.

---

## ⚠️ Exception 1 — `20260911000001_fix_task_16_charge_one_fee_per_bundle_data_type.sql`

**Effect: APPLIED to staging · history row: MISSING**

- The file's DDL effect **is** live in staging, but the file has **no `schema_migrations` row**:
  it was applied out-of-band, and `mcp_supabase_apply_migration` does not write a history row
  (BP-81). This is a recordkeeping gap only.
- **Verified 2026-09-11** (QA FIX-Task-17 item 12 / FIX-Task-18 item 2): `admin_config` row
  `charge_one_fee_per_bundle` = `value 'true'`, `data_type 'boolean'` (correct), `is_active true`.
- **Action: do NOT re-run this file.** It is rerun-safe by design (`WHERE … IS DISTINCT FROM
  'boolean'` turns a second run into a no-op), but re-applying it fixes nothing and muddies the
  ledger further. The data state is already correct.
- **Verify at any time:**
  ```sql
  SELECT key, value, data_type, is_active, updated_at
  FROM public.admin_config
  WHERE key = 'charge_one_fee_per_bundle';
  ```
  Expected: `value='true'`, `data_type='boolean'`, `is_active=true`.
- **If strict ledger parity is ever required** (owner decision — *not* taken): re-run this one file
  solely so its history row is inserted; no data change is expected. Do not do this without an
  explicit owner confirmation first (BP-80).

---

## ⚠️ Exception 2 — `20260912000002_fix_tax_summary_gross_collected_reconcile.sql`

**Effect: APPLIED to staging · applied as an equivalent body substitution, not the file verbatim**

- The file carries the **full verbatim body** of `get_tax_summary_for_period` (copied from
  `20260831220000`) with ONE change: the summary `collected` CTE now uses the same status set as
  `by_jurisdiction` (the owner-approved GROSS convention). That is the canonical record.
- Because that body is ~15 KB / 376 lines, it was **applied to staging as an asserted in-place
  substitution** instead: `pg_get_functiondef(...)` → assert the target CTE substring occurs
  **exactly once** → `replace()` → `EXECUTE`. The assertion aborts without changing anything if the
  match count is not 1, so the substitution cannot half-apply. **The live effect is identical to
  applying this file.**
- **Verified 2026-09-12:** header == `SUM(by_jurisdiction)` on all three figures
  (`tax_collected_cents` 17143 · `tax_refunded_cents` 175 · `tax_net_cents` 16968 for
  2026-07-01..2026-09-12, was 16968 / 175 / 16793 before), and the admin Tax Reports page renders
  the matching headline + CT row ($32.75 / $1.75 / $31.00 on the default last-30-days window).
- **⚠️ Re-applying this file is safe (Mode B) — but any function replacement here MUST include the
  `GRANT EXECUTE … TO authenticated, service_role` line.** The repo's `dt61_guard_revoke_fn_public`
  EVENT TRIGGER REVOKEs PUBLIC/anon/authenticated on **every** `CREATE OR REPLACE FUNCTION`, and
  `pg_get_functiondef` does **not** emit GRANTs — omitting them leaves the admin portal failing with
  `permission denied for function get_tax_summary_for_period`. That happened during this session and
  was corrected by `fix_task_20_restore_tax_summary_function_grants`; verified with
  `aclexplode(pg_proc.proacl)`.

---

## ℹ️ Observed tool behaviour — `mcp_supabase_apply_migration` DOES insert a history row

The exception above notwithstanding, this session observed that `mcp_supabase_apply_migration`
**does** write a `schema_migrations` row, keyed by **the call's UTC timestamp at second
resolution**. Two `apply_migration` calls issued in the same second therefore collide with
`23505 duplicate key value violates unique constraint "schema_migrations_pkey"` and the second
migration **silently does not apply**. **Apply migrations ONE PER CALL, sequentially** — never batch
two of them in one tool block.
