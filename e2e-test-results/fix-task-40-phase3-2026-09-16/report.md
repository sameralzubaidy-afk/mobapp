# FIX-Task-40 phase 3 — migration chain repair, fidelity gate, renumbering (2026-09-16)

**Continues:** FIX-Task-38 → FIX-Task-40 (`supabase/migrations/README.md`, `memories/repo/fix-task-40-migration-chain-phase2.md`)
**Artefacts:** `scripts/migrations/replay-probe.mjs` · `scripts/migrations/renumber.mjs` · `scripts/migrations/fidelity-check.mjs` · `supabase/migrations/tools/fp{1,2,3}-*.sql`
**Owner decisions honoured:** fidelity gate = subset + explained-delta + no-conflicting-definitions · `supabase db push` untouched · renumbering performed **last**.

---

## 1. Outcome

| Deliverable | Result |
|---|---|
| `replay-probe.mjs` showing `unresolved: 0` | ✅ **0 unresolved — 528/528 apply** |
| Fidelity check run, every exception named | ✅ run — **119 subset misses · 114 conflicts · 60 explained replay-only · 0 unexplained**; every one named in `fidelity-exceptions.md` |
| Renumbering of the legacy files | ✅ **252 files renamed; all 528 now 14-digit; 0 legacy prefixes left** |
| `supabase db reset` passing clean | ❌ **STILL BLOCKED** — see §6. **Tier 2 is NOT yet a real gate** |
| Ledger reconciliation | Not attempted (by decision). `supabase db push` remains off-limits. |

---

## 2. The repair ledger — 14 → 0

The baseline probe reproduced exactly the 14 files the FIX-Task-40 README listed. Every repair was measured against the pass-1 "applied" canary.

| # | File | Class | Repair |
|---|---|---|---|
| 1 | `20251227_admin_trade_tools.sql` | return-type | `DROP FUNCTION IF EXISTS admin_force_cancel_trade_db(uuid,uuid,text)` prologue (chain creates it `RETURNS JSON`; this file wants `JSONB`) + re-grant the ACL the drop discards |
| 2 | `20260830000010_dev_task_57_rpc_identity_lockdown.sql` | return-type | same prologue; its own REVOKE/GRANT already re-establishes service_role-only |
| 3 | `20251216_create_admin_config.sql` | legacy duplicate | INSERT now supplies the NOT NULL `category` (`'sms'`) — the check runs **before** `ON CONFLICT` resolves, which is why it failed even for existing keys |
| 4 | `20251216100002_admin_config_trial_settings.sql` | legacy duplicate | legacy table/indexes/INSERTs/`get_admin_config` RPC removed (never-shipped `config_key` design); **kept `update_admin_config_updated_at()`** because staging carries it and nothing else creates it; trigger re-point **skipped** (staging binds `update_admin_config_timestamp`) |
| 5 | `20260528100001_cart_system_schema.sql` | legacy duplicate | `cart_settings` re-written in canonical shape — it is **not** skippable, `20260528100002` reads it |
| 6 | `20260207000010_referral_logic_alignment.sql` | missing columns | **10 staging `referrals` columns** + 2 FKs + 2 UNIQUEs added to the base repair (now 25 cols = staging) |
| 7 | `20260510000002_sp_hold_enum.sql` | dead code | `ALTER TYPE` guarded — `sp_transactions`/`sp_transaction_type` exist in **neither** the chain nor staging |
| 8 | `303_cpsc_cleanup.sql` | conditional-skip | `DROP TRIGGER … ON cpsc_recalls` guarded on table existence (it sorts *before* the schema file by design) |
| 9 | `077_add_auto_payout_admin_config.sql` | null actor | RPC call replaced with a canonical INSERT — `upsert_admin_config_setting` correctly rejects a NULL actor, and a migration has no acting admin (fabricating one would forge an audit actor) |
| 10 | `20260420000013_link_social_account_rpc.sql` | wrong column | verification SELECT now uses `action_type`/`payload` (there is no `action`/`details` column) |
| 11 | `20260912000005_fix_tax_clothing_ct_bands.sql` | too-narrow guard | band-B `NOT EXISTS` broadened to the question the overlap **trigger** asks (does an active CT rule already COVER the band?) instead of `min = 5000` exactly |
| 12 | `20260903000001_dev_task_97_admin_identity_reconcile.sql` | missing table | **`zip_waitlist` created** in the base repair — see §3 |
| 13 | `20260724000002_fix_tax_refund_reconciliation.sql` | enum 55P04 | new migration `20260601000002_tax_status_add_missing_values.sql` commits `pending_refund` + `reconciliation_required` in their own transaction (sibling of `20250114000000_admin_config_category_add_missing_values.sql`) |
| 14 | `20260724000001_tax_refund_and_reconciliation.sql` | stale overload ref | see §4 — this was the hardest and revealed a 4-file class defect |

### Measured ladder (pass-1 = canary; every pass also compared)

| Step | applied | unresolved | pass-1 | pass-2 |
|---|---|---|---|---|
| baseline | 513/527 | 14 | 380 | 130 |
| + DROP FUNCTION ×2 | 515/527 | 12 | 381 | 131 |
| + admin_config ×3 | 518/527 | 9 | 384 | 131 |
| + referrals / SP / cpsc / 077 | 522/527 | 5 | 386 | 135 |
| + tax_status labels + COMMENT retarget | 527/528 | 1 | 389 | 135 |
| + `tax_status` type hoist (**regressed**) | 525/528 | **3** | 389 | **133 ↓** |
| + 4-arg COMMENT class sweep | **528/528** | **0** | **392** | 133 |

---

## 3. The staging objects the chain never created

Two of the 14 were not ordering problems at all — they were **silent absences**:

- **`zip_waitlist`** — staging carries it (8 columns, RLS on, 4 policies); the chain never created it. Its only creator, the legacy `006_resolve_active_node_and_waitlist.sql`, guards the CREATE behind *"IF EXISTS (… table_name = 'nodes')"*, and `006` sorts **first** among the legacy files — before `20241213000001_add_auth_module_tables.sql` creates `nodes`. So the guard was **always false** on a fresh rebuild. Every previous "rebuilt" database has been missing this table.
- **the 10 `referrals` columns** — 2026-02 migrations UPDATE `referrals.completed_at`, a column no migration adds.

Both were repaired by adding the objects (shapes taken verbatim from the captured staging fingerprint) to `20241213000004_base_schema_repair_missing_base_objects.sql`.

---

## 4. The class defect that hid behind the last file

`20260724000001`'s reported error was a **deferral artifact**, not its root cause. Two layers had to be peeled:

1. Its pass-1 error was `55P04 unsafe use of new value "reconciliation_required"` — the enum label was not committed before use. Fixed by the new label migration.
2. It then failed on `COMMENT ON FUNCTION public.get_tax_summary_for_period(date, date, uuid, text)` — a **four**-argument signature the file does not create (it creates the **five**-argument version) and that `20260724000002` **DROPs**.

Sweeping the class (not just the one instance) found the same stale 4-arg `COMMENT` in **three more** files: `20260801000004`, `20260831220000`, `20260912000002`.

**Why this mattered more than a cosmetic comment.** `20260724000001` must apply **before** `20260724000002`, or it re-creates the same 5-arg function with its **older body** — a silent behavioural regression the schema fingerprint **cannot see** (the fingerprint records a function's identity/returns/security/config, not its body). Fixing the comment alone still left that ordering hazard, so the `tax_status` **type** was hoisted to the base repair (the real creator is itself deferred, which cascaded the label commit later than its consumer). Verified afterwards from the derived order: the function's creators now run 202 → 206 → 268 (`…0001`) → 269 (`…0002`) → 277 → 333 → 356, i.e. **oldest first, newest body last**.

> **Process lesson (worth a rule).** The pass-1 canary did **not** catch the regression the hoist introduced — pass 1 stayed at 389 while unresolved went 1 → 3. What caught it was **pass 2 dropping 135 → 133**. A canary that watches only one pass is not enough; the whole per-pass ladder has to be compared.

---

## 5. Fidelity gate

`node scripts/migrations/fidelity-check.mjs` — the three agreed rules, applied to the freshly rebuilt database against the captured staging fingerprints. Full named lists: **`fidelity-exceptions.md`** (every single object).

| Rule | Result |
|---|---|
| **1 · SUBSET** — every staging object exists in the replay | **119 missing** — 38 policies, 26 columns, 21 indexes, 21 functions, 9 constraints, 4 triggers |
| **2 · EXPLAINED** — every replay-only object has provenance | **60 explained** (12 columns, 11 constraints, 11 functions, 24 policies, 2 indexes) · **0 with NO CREATOR** |
| **3 · CONFLICT** — no shared object has a different definition | **114** — 79 functions, 18 columns, 4 indexes, 3 constraints, 4 policies, 3 enum labels, 2 RLS flags, 1 view |

The 18 column conflicts break down as: **10 nullability**, **6 type**, **2 default**.

**These are named, not waved through.** The root cause is the one FIX-Task-40 established and this round reconfirmed: staging was **built partly out-of-band and is not at the repo head**. Evidence gathered this round: staging's `schema_migrations` holds 266 rows whose `version` values are **apply timestamps** rather than filename prefixes, and whose `name` values are **inconsistently prefixed** — 253 unique names, **32 with no local file at all**, and 304 local files with no ledger row. A file-level attribution is therefore not derivable, which is why rule 2 is stated as **provenance** (a creator exists in the chain) rather than "maps to a migration absent from staging's ledger".

**Two harness bugs were found and fixed before any of these numbers were trusted** — which is the point of dry-running a matcher:
- Policy `qual`/`with_check` values contain **newlines**, so a line-by-line read invented phantom objects; four of them showed up as NO-CREATOR findings. Fixed by reassembling logical records. **NO-CREATOR is now 0.**
- The `uuid_generate_v4()` ↔ `gen_random_uuid()` equivalence was normalised on **only one side**, so the "equivalent" pair still compared unequal. Caught by the harness's own dry-run case.

---

## 6. Renumbering — done, and Tier 2's status

`node scripts/migrations/renumber.mjs --apply` → **252 files renamed**, 528 files still, **0** non-14-digit prefixes, **0** legacy `0xx_` files. The rename map is at `/tmp/renumber-map.json`. The algorithm keeps each file's own timestamp wherever the order allows, so 276 of 528 names are unchanged.

`db reset` then got **further than it ever has** (29 files vs 19 vs the historical 2) — but it **still does not pass**. Two privilege failures, both rooted in the same place:

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto` → `permission denied for function pg_read_file` (42501)
2. `CREATE POLICY … ON storage.objects` → `must be owner of table objects` (42501)

**Root cause: the CLI's migration session runs as a role that lacks the privileges these historical migrations assume.** Measured directly: `current_user = postgres` with **`rolsuper = false`**, and `storage.objects` is owned by `supabase_storage_admin` while `postgres` is **not** a member of it.

**Critically, the same statements succeed through the psql path** — the probe applies all 528 files, and applying `20241214000005_create_user_avatars_bucket.sql` by hand created all four storage policies **and** the bucket. So this is a **CLI execution-context mismatch, not a migration-content defect.**

- The `CREATE EXTENSION` class was repaired (7 unguarded sites, using the guarded `DO $$ … EXCEPTION WHEN OTHERS THEN RAISE NOTICE` pattern this repo's pg_cron migrations already use). That is a safe fail-soft because the platform provides those extensions. **It bought 19 → 29 files.**
- The `storage.objects` **policy** class was deliberately **NOT** repaired. Guarding RLS policies on `storage.objects` would silently skip **security** controls; "make the reset pass" is not worth weakening bucket protection by hand. **This needs an owner decision.**

### 🔴 Tier 2 is NOT a real gate yet
The answer to the deliverable's explicit question is **no**. The ordering defect is now fixed and the chain is complete (528/528 under the probe), so `db reset` can now be *worked* — but it still cannot pass, because of a role-privilege mismatch between the Supabase CLI's migration session and these migrations. Options for the owner (see §8) are a scoped privilege fix, a documented quarantine of the storage/extension statements, or accepting the probe as the local tier-2 evidence while `db reset` stays blocked.

**Every other Tier-2 leg still applies and is unaffected:** DB lint, the smoke scripts, and real invocation of every changed branch remain required.

---

## 7. Data / staging impact

**None.** No migration was applied to staging, no DDL, no data change, no ledger write. The only staging interaction this round was **reading the already-captured fingerprint files** (`/tmp/staging-fp{1,2,3}.txt`, captured in FIX-Task-40) — no new staging query was issued. All work was against the local Supabase stack.

---

## 8. Files touched (Part B)

```
scripts/migrations/replay-probe.mjs                     (unchanged - used as the canary instrument)
scripts/migrations/renumber.mjs                         (NEW - committed, dry-run by default)
scripts/migrations/fidelity-check.mjs                   (NEW - committed 3-rule gate)
supabase/migrations/tools/fp1-columns.sql               (NEW)
supabase/migrations/tools/fp2-constraints.sql           (NEW)
supabase/migrations/tools/fp3-objects.sql               (NEW)
supabase/migrations/<12 migrated files>.sql             (the 14-file repairs, see §2)
supabase/migrations/20260601000002_tax_status_add_missing_values.sql   (NEW - enum label commit)
e2e-test-results/fix-task-40-phase3-2026-09-16/         (this report + fidelity-exceptions.md)
```
Plus the **renumbering** of 252 files (map at `/tmp/renumber-map.json`).

## 9. Still owed / needs an owner decision

1. **The `storage.objects` privilege blocker** — the single thing standing between this round and a green `db reset`. Named options in §6.
2. **The 119 subset misses and 114 conflicts** are now *enumerated and named* but **not resolved**. Resolving them is a materially larger task (the FIX-Task-40 estimate was 30 tables / 82 functions / 124 policies) and should be its own round.
3. **`supabase/migrations/README.md` references a few pre-renumber filenames** (e.g. `006_resolve_active_node_and_waitlist.sql`, `20260913000000_base_schema_repair_deferred_constraints.sql`). They need updating to the new names, and the README needs a section stating that filenames are now an ORDER KEY, not a date — several legacy files now legitimately carry `20240101…` versions.
