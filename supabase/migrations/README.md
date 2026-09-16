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

---

## 🛠️ FIX-Task-40 — the gap was ~10× larger than FIX-38 estimated

Continues FIX-Task-38. **Read this before acting on the FIX-38 section above.**

### The FIX-38 blocker list was an under-count

FIX-38 reported the remaining work as "3 creator-less tables (`favorites`,
`swap_points_ledger`, `admin_users`) + a long tail". That list came from the **first error each
file happens to hit**, which is not evidence of the underlying gap. The probe also overwrites a
file's recorded error every pass, so a later deferral artifact
(`cannot change return type of existing function`) can mask a file's real root cause.

Diffing staging's live catalogue against the replayed local schema gives the true number:

| Object | In staging | Missing from the replay |
|---|---|---|
| tables | 104 | **30** |
| functions | 452 | **82** |
| RLS policies | 267 | **124** |

Of those, the ones with **no creator anywhere in the chain** — the true unrecoverable gaps — are
13 tables and 11 functions (the rest are cascades whose creator is itself blocked).

> ⚠️ A creator search must be **case-insensitive** and must match `CREATE [OR REPLACE] FUNCTION`.
> A naive `CREATE FUNCTION <name>` pattern misses every `CREATE OR REPLACE`, which is how a first
> pass wrongly concluded that all 82 functions had no creator.

### Also fixed in the tooling

`scripts/migrations/replay-probe.mjs` reported 43 of 75 failures as `(no output captured)`:
`firstError()` anchored on `/^(ERROR|FATAL)/`, but psql prefixes the primary line with
`psql:<stdin>:<line>: `. It now strips that prefix first.

### Defect 3 (new) — an enum value added and used in the same transaction

`admin_config_category` gains `referral` and `health` in the chain, but three labels the live
database carries (`payout_fees`, `trade`, `tax`) are added **nowhere**. Every migration that seeds
a row in those categories both `ADD VALUE`s and **uses** the label in the same file, which
PostgreSQL rejects with SQLSTATE 55P04. Fixed by
`20250114000000_admin_config_category_add_missing_values.sql`, which commits the labels in their
own transaction.

### Defect 4 (new) — node ids were declared TEXT at creation

FIX-38 repaired this with a later `ALTER COLUMN TYPE`. That works only if the retype happens
before `20241214000003` creates the `profiles_with_auth` view — and **the two are adjacent in
filename order**, so any deferral of `20241213000003` makes the retype abort with *"cannot alter
type of a column used by a view or rule"* — which then fails ~130 downstream files, because the
node-id retype is what makes `items` (and everything built on it) creatable.

Fixed at the source: `20241213000001_add_auth_module_tables.sql` now declares `nodes.id`,
`profiles.node_id` and `zip_codes.node_id` as `uuid`. The retype in `20241213000003` stays, but
its guard now sees `uuid` and skips — so the ordering coincidence no longer matters.

### Repairs added

| File | Purpose |
|---|---|
| `20250114000000_admin_config_category_add_missing_values.sql` | commits the 3 missing enum labels |
| `20241213000004_base_schema_repair_missing_base_objects.sql` | `profiles.role` + 13 creator-less tables, with live PKs/indexes/RLS/policies |
| `20241213000005_base_schema_repair_missing_base_functions.sql` | 11 creator-less functions, verbatim from `pg_get_functiondef()` |
| `20260916000145_base_schema_repair_deferred_constraints.sql` | the FKs/triggers/`user_has_role` policies that cannot be declared early (renumbered in phase 3 — a filename is an ORDER KEY, see the phase-3 section at the end of this file) |

Individual broken files also fixed: `008` (`gn.id::TEXT` → `::uuid`), `084` (a `*/` inside a
`/* */` comment closed it early → "syntax error at 30"), `20251218000002` (unguarded FK add),
`20251220000003` (`AS $` is not a valid dollar-quote delimiter), `20260212000001` (RAISE had 2
placeholders for 3 arguments), `20260528000010` (policy read `admin_users`, a table that exists
nowhere), `314` (search-path sweep hit PostGIS-owned functions), `065` (JS-escaped quotes — psql
reads a bare backslash as a meta-command), `077` (ambiguous `upsert_admin_config_setting`
overload), `20260420000013` (`action`/`details` are not columns of `admin_audit_logs`),
`20260112000000` (called `is_admin()`, which exists in neither the chain nor the live database).

### Measured effect

| Iteration | Files applying | Unresolved |
|---|---|---|
| FIX-38 baseline | 448 / 523 | 75 |
| after the node-id fix (regression window) | 347 / 527 | 180 |
| after the `pg_cron` placeholder fix | 508 / 527 | 19 |
| after the file-level fixes | **513 / 527** | **14** |

### ⚠️ Cross-file landmine: fixing `084` briefly BROKE the FIX-38 repair

Worth understanding, because the same shape will recur. `084` sorts **earlier** than
`20241213000003`, and its first step is `CREATE SCHEMA IF NOT EXISTS cron` — a fallback for
environments where pg_cron cannot be installed. pg_cron's own install script runs a bare
`CREATE SCHEMA cron`, so once that empty placeholder exists,
`CREATE EXTENSION IF NOT EXISTS pg_cron` aborts the whole repair with
`schema "cron" already exists` — silently removing `public.trades` and cascading into ~77 files.

Neither `CREATE EXTENSION IF NOT EXISTS pg_cron` nor `... WITH SCHEMA cron` works while an empty
`cron` schema exists (both verified live). The repair now drops the placeholder **only when it is
provably empty** (no `pg_class` / `pg_proc` / `pg_type` entries), then installs the extension.

**Lesson: after making a previously-failing migration succeed, re-measure the whole chain.** A
newly-succeeding early file creates state that a later file may have assumed absent. The pass-1
"applied" count is a cheap canary for exactly this.

### Remaining (14 files, all individual defects — no structural gaps left)

- `DROP FUNCTION` still needed before a signature change on `admin_force_cancel_trade_db`
  (2 files) and on the `get_tax_summary_for_period` row type (1);
- two legacy files that redefine `admin_config` with `config_key` / `config_value` / `enabled`
  columns — the canonical table uses `key` / `value` / `is_active` / `category` (2);
- `20260724000002` adds `reconciliation_required` to `tax_status` and uses it in the same
  transaction (the same 55P04 class as the `admin_config_category` labels — needs its own file);
- `referrals.completed_at` plus the other referral columns staging has and the chain never adds;
- the `sp_transaction_type` enum (no creator anywhere);
- `zip_waitlist` and `cpsc_recalls` — both have creators that skip themselves via conditional blocks;
- a tax-rule price-band overlap guard that two migrations trip;
- `20260420000013` references a bare `action` column somewhere beyond the insert already corrected;
- `077`: passing `NULL::uuid` resolved the overload ambiguity, and the RPC's own
  `only admins or service_role can update configuration` guard correctly rejects a null actor —
  this file needs a real acting-admin id (or a direct insert) rather than a NULL one.

### Fidelity gate — status

**Not yet run against the repaired schema.** The staging and local fingerprints are captured
(`/tmp/staging-fp{1,2,3}.txt` and `/tmp/local-fp{1,2,3}.txt`, regenerated with
`fp1-columns.sql`, `fp2-constraints.sql`, `fp3-objects.sql`). The known deltas to reconcile or
name are listed in the session memory note `fix-task-40-migration-chain-phase2.md`.


### The Step-2 fidelity gate cannot be "matches staging exactly"

Staging was **not** built from this folder alone, and it is **not** at the repo head:

- it contains 30 tables / 82 functions that no migration creates (applied out-of-band);
- it is *missing* objects the repo migrations add — e.g. `trades.authorization_*`,
  `nodes.member_count`, `admin_config.offer_timeout_hours`. The migration that adds
  `offer_timeout_hours` (`20260528000001_admin_config_trade_timing.sql`) has **no row** in
  staging's ledger;
- `supabase_migrations.schema_migrations` holds 266 rows whose `version` values are **apply
  timestamps**, not filename prefixes, so the historical apply order is unrecoverable.

So the gate is applied as three checks instead, and every exception must be named:

1. **Subset** — every staging object exists in the replay.
2. **Explained delta** — every replay-only object maps to a migration absent from staging's ledger.
3. **Conflict** — no object present on both sides has a different definition.

Excluded by name from the comparison: `_orphan_image_snapshot_20260829` (a manual one-off
snapshot, not schema) and PostGIS-owned objects (`geography_columns`, `geometry_columns`,
`spatial_ref_sys`, ~837 functions) which live in `public` locally but not in staging.

### ⚠️ `supabase db push` is unsafe today — independent of renumbering

Because staging's ledger versions are apply timestamps while local versions are filename prefixes,
the CLI sees essentially **every** local migration as pending and would try to re-apply them.
Renumbering changes every version key and makes this worse.

**Plan (owner decision — do NOT run `db push` before this is settled):**

- **Interim posture:** don't `db push` this project. Tier 2 (`supabase db reset`) is **local** and
  reads no staging ledger, so Tier 2 can be unblocked without resolving this at all.
- **If `db push` is wanted:** baseline first —
  `supabase migration repair --status applied <version> …` (or an equivalent insert into
  `supabase_migrations.schema_migrations`) for every local version, **after** the fidelity gate
  passes. Ledger-only write; rollback = delete the inserted rows. Baselining before the gate would
  mark migrations as applied whose effects are absent.
- **Structural alternative:** the 527-file history provably does not describe how staging was
  built; collapsing to one baseline migration + fresh history is cleaner long-term, at the cost of
  per-migration traceability.

---

## ✅ FIX-Task-40 phase 3 — the chain applies end-to-end, and filenames are now an ORDER KEY

Continues FIX-38 / FIX-40. **Read this before the two sections above — it supersedes their
"still blocking" statements.**

### Result: `unresolved: 0`, and the whole chain applies in ONE pass

```
node scripts/migrations/replay-probe.mjs
  migrations : 528 files in supabase/migrations
  pass 1: applied 528, deferred 0
  applied    : 528/528
  unresolved : 0
```

**"pass 1: applied 528, deferred 0" is the important line.** A single-pass, zero-deferral replay
is exactly the property `supabase db reset` needs (it applies in strict filename order with no
deferral), so the apply ORDER is now correct — not merely "everything can be squeezed in somewhere".

### The chain has been renumbered

The 141 legacy-numbered files (`006_…`, `315_…`) are gone:

```bash
node scripts/migrations/renumber.mjs           # dry run FIRST - prints counts + first renames
node scripts/migrations/renumber.mjs --apply   # renames; writes /tmp/renumber-map.json
```

It renamed **252 of 528** files so that lexicographic filename order IS the dependency-valid order;
the other 276 keep their original names (the script preserves each file's own timestamp wherever the
order allows).

> ⚠️ **A migration filename is now an ORDER KEY, not a date.** Several legacy files legitimately
> carry `20240101…` versions. Do not infer a file's age from its prefix, never renumber by hand, and
> re-run the tool (dry run first) after any repair that changes the derived order — a repair can
> move the order and leave the filenames lying about it.

### The fidelity gate has been run — every exception is named

```bash
node scripts/migrations/fidelity-check.mjs
```

It compares the rebuilt schema against the captured staging fingerprints on the three agreed rules
(SUBSET / EXPLAINED / CONFLICT) and prints each exception by name.

| Rule | Result |
|---|---|
| SUBSET — every staging object exists in the replay | **119 missing** (38 policies, 26 columns, 21 indexes, 21 functions, 9 constraints, 4 triggers) |
| EXPLAINED — every replay-only object has provenance | **60 explained** · **0 with NO creator** |
| CONFLICT — no shared object differs | **114** (79 functions, 18 columns, 4 indexes, 3 constraints, 4 policies, 3 enum labels, 2 RLS flags, 1 view) |

**Every one is enumerated in
`e2e-test-results/fix-task-40-phase3-2026-09-16/fidelity-exceptions.md`** — a passing check must
never be read as "no diff". They are expected: staging was built partly out-of-band and is not at the
repo head. `NO CREATOR: 0` is the meaningful number — it means no replay-only object is an invention
of the rebuild.

> ⚠️ **Rule 2 is deliberately "provenance", not "maps to a migration absent from staging's ledger".**
> Staging's `schema_migrations` holds 266 rows whose `version` values are APPLY timestamps rather
> than filename prefixes, and whose `name` values are inconsistently prefixed — 253 unique names,
> **32 with no local file at all**, and 304 local files with no ledger row. A file-level attribution
> is therefore not derivable, so the binding test is that a creator exists in the chain.

### 🔴 Tier 2 (`supabase db reset`) is STILL BLOCKED — now an OWNER DECISION

`db reset` gets further than ever — it now replays the whole set — but still fails, on **role
privileges**, not on ordering or content:

| Failure | Statement | Cause |
|---|---|---|
| `permission denied for function pg_read_file` (42501) | `CREATE EXTENSION …` | the CLI's migration session runs as `postgres`, which has **`rolsuper = false`** in this local stack |
| `must be owner of table objects` (42501) | `CREATE POLICY … ON storage.objects` | `storage.objects` is owned by `supabase_storage_admin`, and `postgres` is **not** a member of it |

**The same statements succeed through psql:** the probe applies all 528 files, and applying
`20241214000005_create_user_avatars_bucket.sql` by hand creates all four storage policies *and* the
bucket. So this is a **CLI execution-context mismatch, not a migration-content defect.**

- The `CREATE EXTENSION` class **was** repaired — 7 unguarded sites now use the
  `DO $$ … EXCEPTION WHEN OTHERS THEN RAISE NOTICE` guard this repo's pg_cron migrations already
  used. Fail-soft is safe there because the platform provides those extensions. It took `db reset`
  from 19 to 29 files before the next blocker.
- The `storage.objects` **policy** class was deliberately **NOT** repaired. Guarding RLS policies on
  `storage.objects` would silently skip **security** controls; making the reset pass is not worth
  weakening bucket protection by hand. **Owner decision required** — a scoped privilege fix, a
  documented quarantine of those statements, or accepting the probe as the local tier-2 evidence.

**Every other Tier-2 leg is unaffected and still required** — DB lint, the smoke scripts, and real
invocation of every changed branch.

### Which files were repaired to get from 14 → 0

Return-type `DROP FUNCTION` prologues (`…admin_trade_tools`, `…dev_task_57_rpc_identity_lockdown`);
the three-creator `admin_config` tangle (canonical is `20241215100005_create_admin_config.sql` — the other
two were superseded duplicates, one of which also supplied the still-live
`update_admin_config_updated_at()`); **10 missing `referrals` columns** and **`zip_waitlist`** (a
staging table the chain never created, because its only creator guards on `nodes` existing while it
sorts first); `cart_settings` re-seeded in canonical shape; the dead `sp_transaction_type` design
guarded; `077`'s NULL-actor RPC replaced with a canonical INSERT; a `DROP TRIGGER … ON cpsc_recalls`
guarded; the tax-band overlap guard broadened to the question the trigger asks; and **four files
whose `COMMENT ON FUNCTION` targeted a 4-argument overload they do not create** (the class that hid
behind the last unresolved file). The `tax_status` enum TYPE was hoisted into the base repair so the
tax chain resolves in pass 1 — without it, `20260724000001` applies *after* `20260724000002` and
silently re-creates `get_tax_summary_for_period` with its **older body**, which the schema
fingerprint cannot see (it records identity, not the body).

> ⚠️ **Canary discipline, learned the hard way this round.** The pass-1 "applied" count did **not**
> catch that hoist's regression — pass 1 stayed flat at 389 while `unresolved` went 1 → 3. What
> caught it was **pass 2 dropping 135 → 133**. Compare the WHOLE per-pass ladder after every
> change, not just pass 1.


