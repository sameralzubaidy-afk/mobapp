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

### 🔴 Tier 2 (`supabase db reset`) — ordering blocker fixed, one role-privilege step still owed

*Re-diagnosed in FIX-Task-43 (2026-09-16). The phase-3 text that stood here blamed `postgres`
having `rolsuper = false`; **that is not the cause** — see blocker 2 below.*

Two blockers were found, in this order.

**1 · The migration set itself was broken — FIXED.**

Seven migration files were **duplicated**: the original name *and* its renumbered name, byte-identical,
re-introduced after the phase-3 renumbering. `077_add_auto_payout_admin_config.sql` therefore sorted
**first** (legacy prefixes sort before 14-digit ones) and `supabase db reset` died on
`relation "public.admin_config" does not exist` — never reaching a privilege check at all. FIX-Task-43
removed the seven leftovers, each `cmp`-verified byte-identical to the copy it was removed against.
The set is back to **528 files, 0 non-14-digit names**.

> ⚠️ **A renumbering is not durable until it is committed.** Those seven names reappeared after the
> phase-3 run. Re-verify the set before trusting a renumber:
> `ls supabase/migrations | grep -E '\.sql$' | grep -vcE '^[0-9]{14}_'` must print `0`.

**2 · `CREATE POLICY … ON storage.objects` fails under the CLI — OPEN, needs the local bootstrap step.**

| Failure | Statement | Measured cause |
|---|---|---|
| `must be owner of table objects` (42501) | `CREATE POLICY … ON storage.objects` | the CLI applies migrations as `postgres`, and `postgres` is **not** a member of `supabase_storage_admin`, which owns `storage.objects` |

Measured on a **fresh CLI-built volume** (so this is not volume drift), with a throwaway diagnostic
migration that raised its findings into the CLI's own error output:

```
current_user=postgres  session_user=postgres  is_superuser=off
db_owner=postgres      objects_owner=supabase_storage_admin
pg_has_role('postgres','supabase_storage_admin','MEMBER') = false
CREATE POLICY …  ->  42501 must be owner of table objects
```

**`rolsuper = false` is NOT the cause.** A stock `supabase/postgres:17.6.1.054` container booted on a
fresh volume has exactly the same role state — `postgres` not superuser, not a member of
`supabase_storage_admin`, `storage.objects` owned by `supabase_storage_admin` — and a plain
`psql -U postgres` session **can** create the policy, including the exact statement the CLI fails on.
The divergence is in the CLI's execution context, not in the database or in the migration content.

**The image already ships this fix and documents why.** Its bootstrap applies, as `supabase_admin`,
`…/docker-entrypoint-initdb.d/migrations/20220609081115_grant-supabase-auth-admin-and-supabase-storage-admin-to-postgres.sql`:

```sql
-- "This is done so that the `postgres` role can manage auth tables triggers,
--  storage tables policies, etc. which unblocks the revocation of superuser access."
grant supabase_auth_admin, supabase_storage_admin to postgres;
```

The image only runs that file through its own `migrate.sh` on a first-time `initdb`; the CLI's
"Initialising schema" step does not — so a CLI-built local database never receives the membership.

> ⚠️ **Do NOT put that GRANT in `supabase/roles.sql`.** The CLI does run `roles.sql` before
> migrations, but as a **non-superuser**, and these roles are reserved in the Supabase Postgres
> build: `ERROR: "supabase_auth_admin" role memberships are reserved, only superusers can grant
> them (42501)` — which aborts `supabase start` outright. The grant must come from a superuser
> connection: use `scripts/migrations/local-stack-privileges.sh` (loopback-guarded, idempotent,
> local-stack only, never staging/production).

**The `storage.objects` policies are NOT to be fail-softened.** Guarding them so the reset goes green
would silently drop real bucket-security controls. The privilege gap gets fixed instead.

**Tier-2 status: still NOT a real gate.** The ordering blocker is gone, but a green reset cannot be
confirmed until the bootstrap step above has been applied to a live local stack. Every other Tier-2
leg — DB lint, all smoke scripts, real invocation of every changed branch — is unaffected and still
required.

> 🔴 **CORRECTED 2026-09-18 (FIX-Task-57) — the bootstrap step above does NOT unblock the reset.**
> Two measurements falsify this section's conclusion (see the FIX-Task-57 section at the end of this
> file for the full evidence): **(1)** `supabase db reset` deletes and re-creates the local DB
> **volume**, so a post-hoc `local-stack-privileges.sh` grant is reverted before migrations run —
> verified by the volume's `CreatedAt` and the container `Id` changing across the reset, with the
> full stack healthy. **(2)** The membership is not the discriminator anyway: with `postgres`
> provably *not* a member of `supabase_storage_admin`, a plain `psql` session as `postgres` **can**
> create the policy, and the exact failing statement sequence succeeds in a transaction. The failure
> is therefore in the **CLI's execution context**, not in the DB privileges or the migration content
> — and the mechanism inside the CLI is still **unexplained**. Read the FIX-Task-57 section before
> acting on anything in this one.

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

---

## ✅ FIX-Task-57 (2026-09-18) — chain is replayable again (531/531, one pass); `db reset` blocked elsewhere

Report + evidence: `e2e-test-results/fix-task-57-2026-09-18/`. **Read this before the FIX-Task-43
section above — it corrects that section's conclusion.**

### Result

```
node scripts/migrations/replay-probe.mjs
  migrations : 531 files in supabase/migrations
  pass 1: applied 531, deferred 0
  applied    : 531/531
  unresolved : 0
```

**Single pass, zero deferral** — the property `supabase db reset` needs. The baseline was proven
pristine first (reset with the migrations dir moved aside → **0 tables in `public`**).

### Defect 5 (new) — a renumbered legacy file re-declares a function's ROW TYPE after R6

`20260917000001_fix_task_51_grace_status_allowlist.sql` was the **only** unresolved file
(`530/531`, `ERROR: cannot change return type of existing function | DETAIL: Row type defined by OUT
parameters is different`). Cause: `public.get_subscription_summary(uuid)` has two return shapes in
the chain — the R6 five-column row type (with `can_earn_sp`) and the pre-R6 four-column one. The
renumbered legacy file `20260916000064_fix_trade_sp_credit_integrity.sql` (its own header still
reads `090_fix_trade_sp_credit_integrity.sql`) sorts **after** R6 and re-installs the **4-column**
shape, so FIX-Task-51's later `CREATE OR REPLACE` with 5 columns is refused. FIX-Task-51's comment
*"Signature is UNCHANGED (BP-12: no DROP needed)"* was true against **live staging** but false on a
**fresh replay** — the surface that had never been exercised. Staging's captured fingerprint
confirms the live signature is the 5-column one, so the rebuild had been silently keeping the pre-R6
shape.

**Fixed** with a `DROP FUNCTION IF EXISTS public.get_subscription_summary(uuid);` prologue in the
FIX-Task-51 file (it already re-asserts the EXECUTE grants in BLOCK 1d, which the DROP discards —
BP-79), plus correction of the two now-false claims in its header comments. The two sibling
functions were checked and need no `DROP` (`can_user_spend_sp` is `boolean` throughout;
`fn_get_sp_entitlement` has one shape in both definitions).

> ⚠️ **This is why a verified chain is not a proven one.** FIX-Task-51's file was added one day after
the chain was last proven replayable, and it re-broke the replay. **Re-run `replay-probe.mjs` after
every migration you add** — it is a 5-minute check and the only thing that catches this class.

### `db reset` — still NOT green, and for a different reason than FIX-Task-43 recorded

`npx supabase db reset --yes` still exits 1, dying at `20241214000005_create_user_avatars_bucket.sql`:

```
ERROR: must be owner of table objects (SQLSTATE 42501)
CREATE POLICY "Users can upload their own avatars" ON storage.objects ...
```

Measured findings (full evidence in the report):

1. **Not a content defect.** The identical statement sequence — same role, same DB state —
   succeeds via `psql` inside `BEGIN/COMMIT`, and the probe applies all 531 files. The storage
   statements are byte-unchanged and were **not** fail-softened.
2. **`db reset` deletes and re-creates the DB volume**, so no post-hoc role grant can survive it.
   Volume `CreatedAt` `13:35:39Z → 13:37:50Z` and container `Id` `651722ba… → d45932498…` across a
   reset, **with the whole stack healthy**. (`supabase stop` + `start` *does* preserve the volume.)
3. **The `supabase_storage_admin` membership is not the discriminator.** With
   `pg_has_role(postgres,'supabase_storage_admin','MEMBER'|'USAGE'|'SET') = false`, `psql` as
   `postgres` still creates the policy; the CLI's session does not, at the same state.
4. **One observation is left UNEXPLAINED, deliberately:** instrumenting the CLI's own session shows
   `create_policy=OK` at file 1 and `create_policy=FAILED sqlstate=42501` at file ~30 — **same run,
   same session, same role**. Ruled out by direct test: `search_path` (a psql session with the CLI's
   identical `search_path="$user", public, extensions` succeeds), the transaction context, `SET ROLE`
   (no such statement exists in the chain), and container state (measured with the `storage`
   container stopped). Mechanism unidentified — recorded as an open question, not dressed up as a
   root cause.

**Owner decision needed** (carried since FIX-Task-35; do not silently defer again). Options, cheapest
first: **(A)** accept `replay-probe.mjs` as the local Tier-2 wipe-and-replay evidence (the dispatch
allows "`db reset` *or equivalent wipe-and-replay*") and document `db reset` as CLI-blocked; **(B)**
try a newer CLI (2.117.0 is available; this workspace runs 2.65.5); **(C)** diagnose the CLI's
migrator execution context as its own ticket; **(D)** fail-soft the storage policies — **rejected**,
it weakens bucket security and is unnecessary.

### Fidelity diff — unchanged residuals, and `NO CREATOR = 0` again

| Rule | FIX-40 phase 3 (528 files) | FIX-Task-57 (531 files) |
|---|---|---|
| 1 · SUBSET — staging objects missing from the replay | 119 | **119** |
| 2 · EXPLAINED — replay-only objects with provenance | 60 | **65** |
| 2 · replay-only objects with **NO CREATOR** | 0 | **0** ✅ |
| 3 · CONFLICT — same object, different definition | 114 | **114** |

**The 119/114 residuals are the pre-existing, documented staging-vs-head gap — not a regression.**
They are identical to phase 3, so nothing in this task changed them, and a **strict byte-equal
"zero drift" match to staging is not achievable** (staging was built partly out of band and is not
at the repo head). The honest gate is the three agreed rules; the residual needs its own scoped
task, split by table ownership (see `e2e-test-results/fix-task-43-2026-09-16/fidelity-triage.md`).

### Two operational facts worth remembering

* **The CLI only picks up files matching `<digits>_<name>.sql`.** A file named
  `20241214000004z_…​.sql` was **silently skipped** — never listed as `Applying migration …`.
  If a file appears not to run, check its name before its contents.
* **`supabase db reset` wipes cluster-level role state; `supabase stop` + `supabase start` does not.**
  Plan any local privilege bootstrap (e.g. `scripts/migrations/local-stack-privileges.sh`) around that.


