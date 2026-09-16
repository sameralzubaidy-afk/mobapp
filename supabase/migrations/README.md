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

---

## 🛠️ FIX-Task-38 — the chain cannot (yet) be replayed from scratch

`supabase db reset` **does not pass** today, and this is not only an ordering problem. The
523 `.sql` files here are not a self-sufficient history: parts of the base schema were created
out-of-band and were never captured as migrations.

### Defect 1 — ordering (the reported symptom)

141 legacy-numbered files (`006_…`, `315_…`) sort **before** the timestamped chain, so the CLI
replays them first and dies at file 2:

```
Applying migration 006_resolve_active_node_and_waitlist.sql...
Applying migration 007_add_member_count_to_nodes.sql...
ERROR: relation "public.nodes" does not exist (SQLSTATE 42P01)
```

`006` survives only because plpgsql resolves names lazily inside function bodies; `007` does a
real `ALTER TABLE`. `nodes` is created by `20241213000001_add_auth_module_tables.sql`, which
replays last of all.

### Defect 2 — missing base schema (the reason renumbering alone is not enough)

1. **`public.trades` had no creator in any migration, ever.** 64 statements across the chain
   read or alter it. Verified against the working tree *and* the full git history
   (`git log -S 'CREATE TABLE trades'`); the only occurrence was inside
   `archive/misc./temp.sql` — a partial Dec-2025 schema dump, not a migration.
2. **Node identity columns were declared `TEXT`.** `20241213000001` creates `nodes.id`,
   `profiles.node_id` and `zip_codes.node_id` as `TEXT`, but the live schema stores them as
   `uuid`, and no migration converts them. The **only** migration that creates `public.items`
   (`20251217000002_create_items_table_node_filtering.sql`) therefore failed with
   `operator does not exist: text = uuid` on `p.node_id = gn.id`, which blocked the 34
   statements depending on `items`.
3. **`cron` is not part of the local base schema**, yet 35 statements use `cron.job`.

### Repair added

`20241213000003_base_schema_repair_node_ids_and_trades.sql` (Mode B — idempotent rerunnable):

- `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- retypes `nodes.id` / `zip_codes.node_id` / `profiles.node_id` to `uuid`, dropping and
  re-adding the two FKs onto `nodes(id)`;
- `CREATE TABLE IF NOT EXISTS public.trades (…)` — the 95 live columns, `id` as PRIMARY KEY.

It sits immediately after `20241213000001` and **before** `20241214000003` creates the
`profiles_with_auth` view — otherwise `ALTER COLUMN TYPE` fails with *"cannot alter type of a
column used by a view or rule"*.

**Measured effect**, replaying every file against a pristine local database:
**288 → 448** of 523 files apply; unresolved **234 → 75**.

### Still blocking a clean reset

75 files remain across ~30 error classes — a long tail, not one defect:

- `admin_config_category` enum values missing (7 files);
- functions that need an explicit `DROP FUNCTION` before a return-type change
  (`apply_referral_code`, `complete_trade_v2`, `admin_force_cancel_trade_db` — 12 files);
- tables whose own creator still fails, cascading to their dependents
  (`tax_rules` / `tax_categories` / `tax_records`, `id_badge_verification_*`, `cpsc_*`,
  `trade_events`, `listing_offer_stats` — ~20 files);
- tables with **no creator at all**: `favorites`, `swap_points_ledger`, `admin_users`.

**Until those are resolved, Tier 2's "DB rebuild from migrations" leg stays blocked.**

### How to reproduce and iterate

`scripts/migrations/replay-probe.mjs` performs a pristine reset and then applies every file,
deferring failures and retrying, so it reports *what can never apply* rather than just the first
error:

```bash
node scripts/migrations/replay-probe.mjs            # reset + replay
node scripts/migrations/replay-probe.mjs --no-reset # iterate on the current DB
```

**Do not renumber the legacy files until the chain applies end-to-end.** The apply order is
derived from what actually succeeds, so repairing the remaining 75 files will move it again —
renumbering first means renaming the whole set twice.

