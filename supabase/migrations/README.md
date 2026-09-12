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
