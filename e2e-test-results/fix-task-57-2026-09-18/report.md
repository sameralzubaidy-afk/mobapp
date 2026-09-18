# FIX-Task-57 — DB rebuild from migrations: fix the replay chain, verify against staging

**Date:** 2026-09-18
**Supersedes the "still blocking" statements in:** `supabase/migrations/README.md` (FIX-38 / FIX-40 / FIX-43 sections)
**Evidence:** `replay-probe.log` · `replay-probe-before-fix.log` · `fidelity-check.log` · `fidelity-report.json` · `fidelity-exceptions.md` · `db-reset-failure.log`

---

## 1 · Outcome

| Deliverable | Result |
|---|---|
| Exact defect behind a from-scratch rebuild failing | ✅ **Established and fixed** — a return-type conflict, §3 |
| Corrective migration written | ✅ `20260917000001_fix_task_51_grace_status_allowlist.sql` patched (`DROP FUNCTION` prologue, §3.4) |
| Full wipe-and-replay against a scratch database | ✅ **`pass 1: applied 531, deferred 0` — `unresolved: 0`** (§4) |
| Schema diffed against staging's live catalogue | ✅ Run; **every exception named** (`fidelity-exceptions.md`) — counts §5 |
| Report explaining the original defect + the fix | ✅ This document |
| Backfill migrations for out-of-band DDL (item 5) | ⚠️ **Partly** — the base-schema repairs from FIX-38/40 stand; the remaining **119 SUBSET / 114 CONFLICT** residuals are enumerated but **NOT resolved** (§5, §7) |
| A green `supabase db reset` | ❌ **STILL BLOCKED** — by a *different* blocker than the one dispatched against (§2). Needs an owner decision. |

**Read §2 first.** The dispatch described the blocker as a migration-ordering defect. Ordering
was in fact already fixed (FIX-Task-40 phase 3 / FIX-Task-42); what remained was (a) one genuine
**content** defect (now fixed, §3) and (b) a **separate, non-content** blocker that stops the CLI's
`db reset` (§2). Both are measured.

---

## 2 · What actually blocks `supabase db reset` (measured, not inferred)

Reproduced from a **verified-pristine** database (see §4.1 for the pristine-state proof).
The reset applies 29 files and then dies:

```
Applying migration 20241214000005_create_user_avatars_bucket.sql...
NOTICE (00000): policy "Users can upload their own avatars" for relation "storage.objects" does not exist, skipping
ERROR: must be owner of table objects (SQLSTATE 42501)
At statement: 2
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = 'avatars' AND ...)
```

### 2.1 It is **not** a defect in the migration content

The **identical statement sequence** — same role, same database, same state — succeeds through
`psql`:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -tA <<'SQL'
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-avatars','user-avatars',true,5242880,ARRAY['image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "ft57_seq_probe" ON storage.objects;
CREATE POLICY "ft57_seq_probe" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = 'avatars');
SELECT 'exact-sequence=OK';
ROLLBACK;
SQL
# -> CREATE POLICY / exact-sequence=OK / ROLLBACK
```

And the repo's own probe — which applies every file with `psql --single-transaction` — gets all
**531/531 applied with zero deferral**. So the storage-policy files are **valid SQL that a
from-scratch replay can execute**. Only the CLI's execution context fails on them.

### 2.2 It is **not** the privilege gap the repo currently documents

`supabase/migrations/README.md` (FIX-Task-43 section) states that a one-time
`grant supabase_auth_admin, supabase_storage_admin to postgres` — shipped as
`scripts/migrations/local-stack-privileges.sh` — unblocks the reset. **That is not correct**, in
two separately measured ways:

1. **`supabase db reset` deletes and re-creates the local DB volume, so a post-hoc grant cannot
   survive it.** Measured by comparing the Docker volume's `CreatedAt` and the DB container's `Id`
   across the reset:

   | | before reset | after reset |
   |---|---|---|
   | volume `CreatedAt` | `2026-09-18T13:35:39Z` | `2026-09-18T13:37:50Z` |
   | container `Id` | `651722ba5171` | `d45932498cc2` |

   The same test was run with the **whole stack healthy** (all 14 containers `Up`/`healthy`), so
   this is not a "stack not running" artefact. (`supabase stop` + `supabase start`, by contrast,
   **does** preserve the volume — `CreatedAt` unchanged and the grant survived.)

2. **The membership is not the discriminator.** With `postgres` provably *not* a member
   (`pg_has_role('postgres','supabase_storage_admin','MEMBER') = false`, `USAGE = false`,
   `SET = false`, owner `supabase_storage_admin`), a plain `psql` session as `postgres` **can**
   still create the policy — and the CLI's session **cannot**, at the same database state. The
   capability therefore does not track the membership.

### 2.3 What *is* true, and the one observation left unexplained

Instrumenting the CLI's own migration session (a temporary `DO` block whose `RAISE NOTICE` output
lands in the CLI's log — the file was removed and `git status` re-verified clean afterwards):

* **At file 1** the CLI's session reports
  `role=postgres session=postgres super=false inherit=true member_storage=false owner=supabase_storage_admin`
  and **`create_policy=OK`**.
* **At file 30**, in the *same run, same session, same role*, the same probe reports
  `search_path="$user", public, extensions` and **`create_policy=FAILED sqlstate=42501`**.

⚠️ **Stated plainly: the mechanism that flips the CLI's session capability mid-run is NOT
identified.** I ruled out, by direct test, the obvious candidates: the `search_path` difference
(a `psql` session *with* that identical `search_path` succeeds), the transaction context (the exact
sequence inside `BEGIN/COMMIT` succeeds), `SET ROLE` (no such statement exists anywhere in the
chain), and container state (the `storage` container was stopped and the probe still succeeded).
This is recorded as an open question rather than dressed up as a root cause.

### 2.4 Options for the owner (this needs a decision, not another deferral)

Per Blocked-Tier Discipline, this blocker has now been carried across FIX-Task-35 → 40 → 43 → 56 →
57 and needs a named owner decision. The options, cheapest first:

* **A. Accept the probe as the local Tier-2 wipe-and-replay evidence** (`replay-probe.mjs`: pristine
  base + all 531 files in filename order, `pass 1: applied 531, deferred 0`). This is what the
  dispatch itself allows ("`db reset` **or equivalent wipe-and-replay**"), it is reproducible, and
  it is currently the only path that exercises the whole chain end-to-end. Document `db reset` as
  *known-blocked by the CLI*, not as *failing content*.
* **B. Try a newer Supabase CLI.** The workspace runs **2.65.5**; **2.117.0** is available. The
  bootstrap gap is in the CLI's "Initialising schema" step, so a newer CLI is a plausible fix — but
  it is a workspace-wide toolchain change and must be tested against the rest of the workflow.
* **C. Diagnose the CLI execution context properly** (its own ticket): capture the exact
  connection/role the migrator uses. Worth doing because the same defect can resurface on any
  future Postgres-image bump.
* **D. Fail-soft the `storage.objects` policies** so the reset goes green — **explicitly rejected**;
  it would silently drop real bucket-security controls (owner decision, FIX-Task-43), and is not
  needed to make the chain replayable.

**Nothing in this task weakens a security control.** No `CREATE POLICY … ON storage.objects` was
guarded, skipped, or rewritten; the storage statements are byte-unchanged.

---

## 3 · The genuine content defect found and fixed (the FIX-Task-35 lineage)

### 3.1 It was a *mirror* of the class FIX-Task-51 already knew about

The chain replays in **strict filename order**. The FIX-Task-42 renumbering gave legacy files
`20240101…`–style keys, and several legacy files legitimately sort **after** the newer
"R6" migration that owns a function's current definition. `20260917000001_fix_task_51_…` was
authored *specifically* to win that ordering (see its header) — but it made one wrong assumption
about a sibling.

### 3.2 The exact failure

`node scripts/migrations/replay-probe.mjs`, before the fix:

```
migrations : 531 files in supabase/migrations
pass 1: applied 530, deferred 1
pass 2: applied 0, deferred 1
applied    : 530/531
unresolved : 1
```

```
file : 20260917000001_fix_task_51_grace_status_allowlist.sql
error: ERROR: cannot change return type of existing function
       DETAIL: Row type defined by OUT parameters is different.
```

### 3.3 Root cause

`public.get_subscription_summary(p_user_id uuid)` has **two** return shapes in the chain:

| Migration | Row type |
|---|---|
| `20260225000004_fix_get_subs_summary_grace_period_v2.sql` (pre-R6) | 4 cols — no `can_earn_sp` |
| `20260810000010_r11_r6_sp_caps_and_entitlement.sql` (R6) | **5 cols — includes `can_earn_sp`** |
| **`20260916000064_fix_trade_sp_credit_integrity.sql`** (renumbered legacy `090_fix_trade_sp_credit_integrity.sql`) | **4 cols again** |
| `20260917000001_fix_task_51_…` (this file) | 5 cols |

`20260916000064` sorts **before** `20260917000001`, so on a fresh replay it installs the pre-R6
**4-column** row type; the FIX-Task-51 file then tries `CREATE OR REPLACE` with a **5-column** row
type, which PostgreSQL refuses (SQLSTATE 42P13). FIX-Task-51's comment asserted *"Signature is
UNCHANGED (BP-12: no DROP needed)"* — true against **live staging** (where the signature is the
5-column R6 one, verified below) but **false on a fresh replay**, which is exactly the surface that
had never been exercised.

**Authoritative shape = the 5-column R6 one.** Confirmed from the captured **staging** fingerprint
(`/tmp/staging-fp3.txt`):

```
FUNCTION|public|get_subscription_summary|p_user_id uuid|TABLE(status text, can_spend_sp boolean,
can_earn_sp boolean, trial_end_date timestamp with time zone, current_period_end timestamp with time zone)
|SECURITY_DEFINER|search_path=public
```

So the live database has *always* matched the FIX-Task-51 definition; the 4-column shape exists
**only inside the replay**. The rebuild was silently keeping the pre-R6 shape.

**Why this matters beyond the reset:** `20260810000010`'s own `DROP FUNCTION IF EXISTS …` prologue
exists precisely because this function's row type changes between generations — the pattern was
already established in this repo (BP-12). FIX-Task-51 simply missed applying it to the one function
whose row type a legacy file re-declares.

### 3.4 The fix

In `20260916000064`… no — **in the FIX-Task-51 file** (minimal, and it is the file numbered to win
the replay), before its `CREATE OR REPLACE`:

```sql
DROP FUNCTION IF EXISTS public.get_subscription_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_user_id uuid)
 RETURNS TABLE(status text, can_spend_sp boolean, can_earn_sp boolean, ...)
```

* The `DROP` is safe: every caller is a plpgsql body
  (`20240101000003_update_trade_rpcs_v2.sql`, `20240101000004_…`, `20260103000000_…`,
  `20260203000000_…`) or the mobile client via PostgREST — **no view or rule depends on it**.
* The `GRANT EXECUTE` lines the file already carried in **BLOCK 1d** re-assert the ACLs the `DROP`
  discards (required by BP-79: `dt61_guard_revoke_fn_public` strips PUBLIC/anon/authenticated on
  every `CREATE OR REPLACE`).
* The now-false claims in the file's header/block comments ("CREATE OR REPLACE FUNCTION only",
  "Signature is UNCHANGED … no DROP needed") were corrected in place — an engineering-safety claim
  that a later engineer would otherwise plan work on.
* The sibling functions in the same file were checked and need **no** `DROP`:
  `can_user_spend_sp` returns `boolean` in every definition, and `fn_get_sp_entitlement` has only
  two definitions (R6 + this file) with an identical row type.

Verified immediately:

```
psql … -f 20260917000001_fix_task_51_grace_status_allowlist.sql   -> exit 0
pg_get_function_result(get_subscription_summary) ->
  TABLE(status text, can_spend_sp boolean, can_earn_sp boolean,
        trial_end_date timestamp with time zone, current_period_end timestamp with time zone)
```

…i.e. **byte-identical to staging's live signature.**

> ⚠️ **This is the compounding gap the dispatch warned about, caught in the act.** The file was
> added on 2026-09-17, one day after the chain was last proven replayable, and it (plus
> `…20260918000002_fix_task_58_…`, untracked, added by another session today — not touched here)
> had already re-broken the replay. **No migration added after a chain is verified may be assumed
> replayable** — re-run the probe after every migration.

---

## 4 · Verification

### 4.1 Proof the "pristine" baseline really is pristine

`supabase db reset` was run with `supabase/migrations/` temporarily moved aside:

```bash
mv supabase/migrations /tmp/hold && mkdir supabase/migrations
npx supabase db reset --no-seed --yes      # exit 0
# public tables = 0 ; profiles/nodes/trades = (none)
rmdir supabase/migrations && mv /tmp/hold supabase/migrations
```

**0 tables in `public`** — so `db reset` is a genuine wipe, and the probe's baseline is a true
empty-plus-platform-base state. (This also rules out "leftover state" as an explanation for the
replay results.)

### 4.2 The replay (equivalent wipe-and-replay)

```bash
node scripts/migrations/replay-probe.mjs
```

```
migrations : 531 files in supabase/migrations
resetting   : pristine base...
pass 1: applied 531, deferred 0

applied    : 531/531
unresolved : 0
```

**`pass 1: applied 531, deferred 0` is the load-bearing line.** A single-pass, zero-deferral replay
is exactly what `supabase db reset` requires — the apply **order** is correct, not merely
"squeezable in somewhere". This is the best result the chain has ever produced (FIX-38: 288/522;
FIX-40 p2: 448/523; FIX-40 p3: 528/528 at the 528-file head; **now 531/531 at the 531-file head**).

### 4.3 The schema diff against staging

```bash
node scripts/migrations/fidelity-check.mjs     # -> /tmp/fidelity-report.json
```

See §5. Every exception is named in `fidelity-exceptions.md`.

### 4.4 `supabase db reset`

```bash
npx supabase db reset --yes        # still exit 1
```

Fails at `20241214000005_create_user_avatars_bucket.sql` with 42501 — §2. Log:
`db-reset-failure.log`.

### 4.5 Database lint (Tier-2 leg)

```bash
npx supabase db lint --level warning     # exit 0 — clean
```

`get_subscription_summary` is not flagged. Log: `db-lint.log`.

### 4.6 Tier status for this change

Change classification: **A — DB / migrations**. Required tiers for A: Tier 0 + Tier 2.

| Tier / leg | Status | Note |
|---|---|---|
| Tier 0 — app typecheck + lint | **N/A** | No `.ts`/`.tsx` file was touched (scope was one `.sql` migration + the README + this report). The other modified files in `git status` belong to a different session. |
| Tier 2 — DB rebuild from migrations | ✅ **PASS** (equivalent wipe-and-replay) | `replay-probe.mjs`: pristine base + `pass 1: applied 531, deferred 0`, `unresolved: 0` |
| Tier 2 — DB lint | ✅ **PASS** | `supabase db lint --level warning` → exit 0 |
| Tier 2 — real invocation of every changed branch | ✅ **PASS** | The repaired function was actually applied and invoked-by-introspection: `psql -f` exits 0 and `pg_get_function_result` returns the 5-column R6 row type, byte-equal to staging |
| Tier 2 — ALL smoke scripts | ⏸ **NOT RUN — no coverage added** | The smoke scripts exercise **staging**; nothing was applied to staging by this task (BP-80: written + Tier 0, execution approval-gated). Running them would validate staging, not this change. |
| Tier 2 — `supabase db reset` itself | ❌ **BLOCKED** | CLI execution-context defect, §2. Achieved only via the equivalent replay. Needs the owner decision in §2.4. |

---

## 5 · Fidelity diff vs staging — the numbers, and what they mean

Against the staging fingerprints captured 2026-09-16 (`/tmp/staging-fp{1,2,3}.txt`), on the freshly
rebuilt 531-file schema:

| Rule | FIX-Task-40 phase 3 (528 files) | **FIX-Task-57 (531 files)** |
|---|---|---|
| 1 · SUBSET — staging objects missing from the replay | 119 | **119** |
| 2 · EXPLAINED — replay-only objects *with* provenance | 60 | **65** |
| 2 · replay-only objects with **NO CREATOR** | 0 | **0** ✅ |
| 3 · CONFLICT — same object, different definition | 114 | **114** |
| Excluded by name | — | `_orphan_image_snapshot_20260829` (+596 extension-owned objects) |

**How to read this honestly:**

* **`NO CREATOR = 0`** is the meaningful result: no object in the rebuilt schema is an invention of
  the rebuild, and every replay-only object traces to a creator in the chain. This is the property
  that FIX-Task-38/40 were built to establish, and it still holds at the new head.
* **The 119 / 114 residuals are the pre-existing, documented staging-vs-head gap — NOT a
  regression, and NOT introduced by this task.** They are identical to the phase-3 numbers, so
  nothing here changed them. Their cause is the one FIX-Task-40 established: **staging was built
  partly out of band and is not at the repo head** (its `schema_migrations` holds 266 rows whose
  `version` values are *apply timestamps*, and it both lacks objects the repo adds and carries
  objects no migration creates).
* **"Zero drift" in the strict byte-equality sense is not achievable and not the right goal.** The
  honest gate is the three agreed rules, and the residual is triaged (FIX-Task-43's
  `fidelity-triage.md`): ≈73 genuine RISK items (24 missing columns, 25 missing RLS policies, 9
  constraints, 4 triggers, 4+2 RLS drift, 13 shape), 13 SECURITY items that are a **staging**
  finding (staging-only permissive `*_anon_*` policies on `profiles`, `referrals`,
  `subscriptions`, `user_notifications`, `items`), and the rest benign.

**The 119/114 residual is therefore reported as UNRESOLVED and needs its own scoped task** — fixing
it means authoring/repairing migrations across ~40 tables, which is a materially larger change than
this dispatch and one that should be owner-prioritised (FIX-Task-43 already recommended splitting it
by table ownership). It is *not* a blocker for a from-scratch rebuild working.

---

## 6 · What changed

```
supabase/migrations/20260917000001_fix_task_51_grace_status_allowlist.sql
    + DROP FUNCTION IF EXISTS public.get_subscription_summary(uuid);  (BLOCK 1c prologue)
    ~ corrected the two now-false "no DROP needed" claims in the header/BLOCK 1 comments
    ~ added the measured "why" (renumbered legacy file installs a pre-R6 row type)

supabase/migrations/README.md
    ~ FIX-Task-57 section: the new content defect, the corrected `db reset` blocker analysis,
      and the owner options

e2e-test-results/fix-task-57-2026-09-18/
    report.md · fidelity-exceptions.md · fidelity-report.json
    replay-probe.log · replay-probe-before-fix.log
    fidelity-check.log · db-reset-failure.log
```

**Local stack only.** No migration was applied to staging; no DDL, no data change, no ledger write.
The only staging interaction was reading the already-captured fingerprint files in `/tmp` — no new
staging query was issued.

Two local-environment repairs were needed to run any of this (both loopback-only, both disclosed):

1. **Docker Desktop was started** (the daemon was down).
2. **The stale local DB volume's role passwords were reset** to the value the stack's containers
   expect (`supabase_auth_admin`, `supabase_storage_admin`, `authenticator`, `supabase_admin` →
   `postgres`). Without this the stack could not start at all (28P01 on every service) — this is an
   unrelated pre-existing local-environment fault, **not** a migration defect.

Rollback for both is trivial: deleting the local DB volume (or `ALTER ROLE …`) reverts them, and
neither touches staging or production.

---

## 7 · Still owed / needs an owner decision

1. **`db reset` remains blocked** (§2). Choose from options A–D in §2.4. This is the fourth
   consecutive task to carry this; it should be decided, not deferred again.
2. **The CLI-session capability flip is unexplained** (§2.3). Only worth chasing if option C is
   chosen.
3. **119 SUBSET misses / 114 CONFLICTS** are enumerated, unchanged, and unresolved (§5). Needs its
   own scoped task, split by table ownership.
4. **`supabase db push` is still unsafe** (unchanged, pre-existing): staging's ledger versions are
   apply timestamps while local versions are filename prefixes, so the CLI would see every
   migration as pending. Do not run it. If ever wanted: baseline the ledger *after* the fidelity
   gate passes.
5. **A second, untracked migration exists in the working tree** —
   `supabase/migrations/20260918000002_fix_task_58_phone_verified_source_of_truth.sql` — added by
   another session. It was present during this run (531 files includes it) and applied cleanly. It
   is **not part of this task** and was not modified.

---

## 8 · Verified-live recipes worth keeping

```bash
# 1. Is the migrations directory in a valid (all-14-digit) state?
ls supabase/migrations | grep -E '\.sql$' | grep -vcE '^[0-9]{14}_'    # must print 0

# 2. Prove the chain replays from scratch, in order, in ONE pass
node scripts/migrations/replay-probe.mjs
#   want:  "pass 1: applied <N>, deferred 0"  and  unresolved: 0

# 3. Diff the rebuilt schema against the captured staging fingerprints
node scripts/migrations/fidelity-check.mjs
#   want:  UNEXPLAINED (NO CREATOR) = 0 ;  read the SUBSET/CONFLICT names, don't just read FAIL

# 4. Prove the baseline really is pristine
mv supabase/migrations /tmp/hold && mkdir supabase/migrations
npx supabase db reset --no-seed --yes
psql "$DSN" -tAc "select count(*) from information_schema.tables where table_schema='public'"   # 0
rmdir supabase/migrations && mv /tmp/hold supabase/migrations
```

> ⚠️ **A migration file is only picked up by the CLI if it matches `<digits>_<name>.sql`.**
> Measured accidentally: `20241214000004z_ft57_tmp_diag2.sql` was **silently skipped** — the CLI
> never printed `Applying migration 20241214000004z…`. If a file ever appears not to run, check its
> name before its contents.

> ⚠️ **`supabase db reset` deletes and re-creates the local DB volume** (§2.2). Anything you
> `GRANT`/`ALTER ROLE` on the local cluster is gone after a reset; `supabase stop` + `start`
> preserves it. Plan local privilege bootstraps accordingly.
