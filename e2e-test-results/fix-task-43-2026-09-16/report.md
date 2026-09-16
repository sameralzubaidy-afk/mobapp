# FIX-Task-43 — DB-reset blocker + role-privilege fix + fidelity triage (2026-09-16)

**Source:** FIX-Task-42 / migration-chain phase 3 (`e2e-test-results/fix-task-40-phase3-2026-09-16/`).
**Owner decisions honoured:** fix the privilege setup, do **not** fail-soft the `storage.objects`
RLS/security statements · leave the `test-payfail-retry` fixture live.

---

## 1 · Outcome

| Deliverable | Result |
|---|---|
| Item 1 — root cause of the `db reset` privilege failure | ✅ **Established by measurement** (it is *not* `rolsuper = false`) |
| Item 1 — fix | ✅ **Written** — `scripts/migrations/local-stack-privileges.sh` (local-only, loopback-guarded). **Not executed in-session** (see §2) |
| Item 2 — clean `supabase db reset` | ⚠️ **NOT confirmed** — blocked: no container engine available in-session (owner instruction). Ordering blocker *is* fixed; the reset is no longer expected to fail on ordering |
| Item 2 — explicit Tier 2 status | ❌ **Still not a real gate** — one local bootstrap step has to be applied before a green reset can be observed |
| Item 3 — fidelity-residual triage | ✅ `fidelity-triage.md` (counts per category; nothing resolved, as scoped) |
| Item 4 — `test-payfail-retry` left live | ✅ **Not reset by this task.** See §4 — the persona and all Stripe objects are intact; its *failure-state flags* are cleared (the documented consequence of M07 having been driven) |

---

## 2 · Item 1 — root cause and fix

### 2.1 The premise in the dispatch was stale: `db reset` was failing on **content**, not privileges

The task described a pure privilege failure. Reproducing it first (§9.1e) showed a different
blocker in front of it: **seven migration files were duplicated** — the original name *and* its
phase-3 renumbered name, byte-identical — re-introduced after the phase-3 run. Because legacy
prefixes sort before 14-digit ones, `077_add_auto_payout_admin_config.sql` ran **first** and the
reset died on `relation "public.admin_config" does not exist`, long before any privilege check.

Evidence they were re-introduced (not never-renamed): the phase-3 map
(`/tmp/renumber-map-phase3.json`, 14:49) maps all four legacy files to 14-digit names, and all
seven leftovers share mtime `2026-09-16 14:58:39`.

**Fixed** by deleting the seven leftovers, each `cmp`-verified byte-identical to the copy it was
removed against. Set restored to **528 files, 0 non-14-digit names**; the fresh replay probe then
reported `applied 528/528, unresolved 0`.

### 2.2 The privilege blocker — is it an environment gap or a platform constraint?

**It is a gap in the CLI's local bootstrap, and the image already ships the fix.** Both halves were
measured, not inferred.

*(a) The database is not the problem.* On a **freshly CLI-built volume**, a throwaway diagnostic
migration raised its findings into the CLI's own error output:

```
current_user=postgres   session_user=postgres   is_superuser=off
db_owner=postgres       objects_owner=supabase_storage_admin
pg_has_role('postgres','supabase_storage_admin','MEMBER') = false
CREATE POLICY …         -> 42501 must be owner of table objects
```

*(b) But a plain `psql` session on the same database and the same role can do it.* Verified three
ways: against the project's own volume, against a stock fresh-volume container, and with the
**exact statement the CLI fails on** — `CREATE POLICY "Users can upload their own avatars" ON
storage.objects FOR INSERT TO authenticated WITH CHECK (…)` → `CREATE POLICY` (success).

*(c) `rolsuper = false` is therefore not the cause.* A stock
`supabase/postgres:17.6.1.054` container on a fresh volume has the **identical** role state
(`postgres` not superuser, not a member of `supabase_storage_admin`, `storage.objects` owned by
`supabase_storage_admin`) and is not broken. The divergence is the CLI's execution context.

*(d) The image documents the missing step.* Its bootstrap applies, as `supabase_admin`,
`…/docker-entrypoint-initdb.d/migrations/20220609081115_grant-supabase-auth-admin-and-supabase-storage-admin-to-postgres.sql`:

```sql
-- "This is done so that the `postgres` role can manage auth tables triggers,
--  storage tables policies, etc. which unblocks the revocation of superuser access."
grant supabase_auth_admin, supabase_storage_admin to postgres;
```

The image runs that file only through its own `migrate.sh` on a first-time `initdb`. The CLI's
"Initialising schema" step does not, so a CLI-built local database never gets the membership.

**Option 1 from the task (fix the environment so it is automatic) was tried and is not available:**
the CLI *does* apply `supabase/roles.sql` before migrations, but as a **non-superuser**, and these
roles are reserved in the Supabase Postgres build:

```
ERROR: "supabase_auth_admin" role memberships are reserved, only superusers can grant them (42501)
```

…which aborts `supabase start` outright — worse than the bug being fixed. (`supabase/roles.sql` was
therefore **not** shipped; that experiment was reverted.)

**Option 2 is what shipped:** `scripts/migrations/local-stack-privileges.sh` — applies the image's
own documented GRANT over a `supabase_admin` connection. Loopback-only (refuses any non-loopback
host), idempotent, and it deletes nothing: the only change is a role membership, which a DB-volume
delete or an `ALTER ROLE …` undoes. Local-stack only — never applied to staging or production.

**The security statements were not touched.** No `CREATE POLICY … ON storage.objects` was guarded
or skipped anywhere.

---

## 3 · Item 2 — `db reset` confirmation and Tier-2 status

**A green `supabase db reset` was NOT observed in this session.** The local stack needs a container
engine and Docker was taken out of scope by owner instruction mid-task.

What *is* established:

* The **ordering/content blocker is fixed** — the reset previously aborted at migration #2 and now
  applies the whole chain in dependency order (it reached `20241214000005_create_user_avatars_bucket.sql`,
  i.e. ~15 files in, before hitting the privilege statement). The repo's own replay probe applies
  **528/528 with 0 unresolved**.
* The **remaining failure is one statement class** — `CREATE POLICY … ON storage.objects` — and its
  cause and remedy are identified above.

### Tier 2 status (explicit)

**Tier 2 is still NOT a real gate for A/D/F-classified tasks.** It stops being blocked as soon as a
local stack has `scripts/migrations/local-stack-privileges.sh` applied **and** a full `supabase db
reset` is observed green end-to-end. Until that observation exists, the honest status is
"unverified", not "unblocked".

**Every other Tier-2 leg is unaffected and still required:** DB lint, all smoke scripts, and real
invocation of every changed branch.

**Docker-independence note (owner instruction).** The local `db reset` leg fundamentally needs a
container engine — the Supabase CLI has no Docker-free path for the local stack, and a native
Homebrew Postgres cannot substitute (it lacks the image's `auth`/`storage`/`extensions` bootstrap
and the `pg_cron`/`pg_net`/`postgis` extensions the chain uses). So the Tier-2 blocker needs an
owner decision on *how* the local stack is provisioned, not another deferral.

---

## 4 · Item 3 — fidelity-residual triage

Full document: **`e2e-test-results/fix-task-43-2026-09-16/fidelity-triage.md`**
(reproducible via `node scripts/migrations/fidelity-triage.mjs`). Nothing was resolved, as scoped.

| Bucket | Count |
|---|---|
| BENIGN — `search_path` hardening (replay is *stricter*) | 77 |
| BENIGN — pg_net extension artifacts | 19 |
| BENIGN — performance-only indexes | 24 |
| BENIGN — explained by design (replay-only, creator exists) | 60 |
| BENIGN — superseded shape / enum ordinals / duplicate overload / service-role bypass | 6 |
| **SECURITY — staging-only permissive `*_anon_*` policies** | **13** |
| RISK-LITE — column nullability | 10 |
| **RISK — missing column** | **24** |
| **RISK — missing RLS policy** | **25** |
| **RISK — missing constraint** | **9** |
| **RISK — missing trigger** | **4** |
| **RISK — RLS predicate / on-off** | **4 + 2** |
| **RISK — shape/rule drift (columns, CHECKs, bodies, index, view)** | **13** |

Two headline readings:

1. **The 77 `search_path` "conflicts" are not drift to reconcile** — the replay pins `search_path`
   and staging does not, so the replay is the safer side. They should be re-labelled, not fixed.
2. **The 13 staging-only `*_anon_select/insert/update` policies are a *staging* security finding**,
   not a repo gap: `profiles`, `referrals`, `subscriptions`, `user_notifications` and `items` are
   readable/writable by the unauthenticated `anon` role there. Recommended as its own audit task.

Suggested scoping for the ~73 genuine RISK items is in the triage document's §5 (split by table
ownership so it lands as a few coherent migrations).

---

## 5 · Item 4 — `test-payfail-retry` left live

`npm run qa:payfail-retry -- status` (read-only) →

```
test-payfail-retry (…@kidsmarketplace.test) — auth user a1234567-0000-0000-0000-000000000018
  stripe_subscription_id=sub_1UGN8j4I6kCJlvXo7xNiCSuD
  stripe_customer_id=cus_VGuy7SRAI8T6Ko
  stripe_payment_method_id=pm_1UGN8i4I6kCJlvXoOV9YMJ2U
  current_period_end=2026-09-23T18:01:04Z
  ✅ 2 Stripe ids   ✅ 3 zero open invoices   ✅ 4 client sends resolve_without_invoice:true
  ❌ 1 payment_failed_at + payment_retry_count<>0 — no failure state
  → M07 true-retry-success branch: NOT DRIVABLE
```

**Nothing was reset by this task** — the persona, profile, and all three Stripe objects are intact,
so M07 was not torn down. Two honest caveats:

* Its **failure-state flags are currently cleared** (`retry_count=0`, `failed_at=—`), which is the
  documented consequence of M07 having been driven in FIX-Task-42 (the fixture's own help text says
  "running this CLEARS payment_retry_count — re-run `ensure` for a repeat drive"). So M07 is
  re-drivable **after `npm run qa:payfail-retry -- ensure`**, which is a staging mutation and
  therefore needs Samer's approval before it is run.

---

## 6 · What changed

```
supabase/migrations/README.md                 root cause corrected in place (the phase-3 entry
                                              blamed `rolsuper = false`; replaced with the measured
                                              findings, the reserved-roles trap, and the fix)
scripts/migrations/local-stack-privileges.sh  NEW — local-only, loopback-guarded privilege
                                              bootstrap (the image's own documented GRANT)
scripts/migrations/fidelity-triage.mjs        NEW — reproduces the triage counts
supabase/migrations/<7 duplicate files>       DELETED — byte-identical leftovers (cmp-gated)
e2e-test-results/fix-task-43-2026-09-16/      this report + fidelity-triage.md
```

Not touched: the migration *contents*, the storage policies, `supabase/roles.sql` (created then
removed during investigation), and the three other files currently modified in the working tree by
a concurrent session (`cross-checked-and-consolidated/…MANUAL-TESTING.md`,
`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`, `p2p-kids-marketplace/…PayoutSettingsScreen.tsx`,
`p2p-kids-marketplace/scripts/qa/payout-fixture.mjs`).

## 7 · How to verify (once a container engine is available)

```bash
# 1. the migration set is clean (must print 528 and 0)
ls supabase/migrations/*.sql | wc -l
ls supabase/migrations | grep -E '\.sql$' | grep -vcE '^[0-9]{14}_'

# 2. boot the local stack (first pass is expected to fail at the storage-policy migration)
cd supabase && npx supabase start

# 3. apply the local-only privilege bootstrap
bash scripts/migrations/local-stack-privileges.sh          # add --dry-run to inspect first

# 4. the real proof: a clean reset from scratch
npx supabase db reset
```

Expected: step 3 prints `postgres is_member_of supabase_storage_admin=true` **before and after**
(`false` only on a brand-new volume), and step 4 completes with no `42501`.

## 8 · Staging impact

**None.** No migration applied, no DDL, no data change, no ledger write. The only staging
interaction was the read-only fixture `status` check in §5.

## 9 · Known gaps / not done yet

1. **`supabase db reset` not observed green** — owed, blocked on a container engine (owner decision
   needed on how the local stack is provisioned). The privilege fix is **written, NOT executed**.
2. **M07 re-drivability** needs `npm run qa:payfail-retry -- ensure` (staging mutation → approval).
3. The **~73 RISK fidelity residuals** are triaged, not resolved (out of scope by the task).
