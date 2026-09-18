# FIX-Task-60 — Resolve the remaining migration-vs-staging fidelity gap

**Date:** 2026-09-18 · **Classification:** A — DB / migrations · **Result:** 233 → **135** hard findings
(98 closed, **0 new**), chain still replays **single-pass, zero-deferral**.

---

## 1 · Outcome

| Rule | FIX-Task-57 baseline | **Now** | Δ |
|---|---|---|---|
| 1 · SUBSET — staging objects missing from the replay | 119 | **49** | −70 |
| 2 · EXPLAINED — replay-only objects with provenance | 65 | 62 | −3 |
| 2 · replay-only objects with **NO CREATOR** | 0 ✅ | **0** ✅ | — |
| 3 · CONFLICT — same object, different definition | 114 | **86** | −28 |
| **Hard findings** | **233** | **135** | **−98** |

Every remaining finding is classified with a stated reason in `fidelity-exceptions.md`
(102 benign-by-design · 5 deliberate chain decisions · 16 staging-side security findings · 12 cruft/redundant).
**No finding is left unexplained.**

Chain health (BP-96 — the WHOLE chain re-measured after every edit, not just the files touched):

```
node scripts/migrations/replay-probe.mjs
  migrations : 536 files in supabase/migrations
  pass 1: applied 536, deferred 0        <-- the load-bearing line for `supabase db reset`
  applied    : 536/536 ; unresolved : 0
```

**Regression gate used throughout:** after each batch, the *set* of finding keys was diffed against the
baseline. `NEW findings` was empty after every batch — i.e. all 98 closures are real and nothing was
traded away. (`comm -13 <(keys before) <(keys after)` → empty.)

---

## 2 · Method — two tools, because the gate reports symptoms, not causes

`fidelity-check.mjs` says *"same object, different definition"*. That is not actionable: the remedy for
a nullability delta differs from the remedy for a type delta or a return-type delta. Two analyses were
added (committed, reusable):

1. **`scripts/migrations/fidelity-delta.mjs`** — field-level delta over the gate's JSON report. It
   splits each conflicting fingerprint record by the field layout of the `fp*.sql` queries and reports
   *which field* differs (`proconfig` only vs `result` vs `security` vs `data_type` vs `default` …),
   then rolls up by impact class. It also flags money-adjacent findings so they are reviewed first
   (task item 3). It reads the JSON, not the rendered markdown — `fidelity-triage.mjs` (FIX-43) works
   off the markdown and documents that it "cannot tell nullability from type/default drift".
2. **`--clobber-scan`** — the enumeration of FIX-Task-57's defect class. `renumber.mjs` froze the
   probe's *dependency* order into filenames, so a file that had to move later now applies after files
   that are genuinely newer. Using `/tmp/renumber-map.json`, every object defined by more than one
   migration is tested for an **inversion**: originally earlier, currently later. That is provable from
   the map alone, with no guessing.

**Honesty note:** the fingerprints capture a function's signature/result/security/`proconfig` — **not its
body** (`prosrc`). Body-only drift is therefore invisible to this gate by construction, and the counts
below must not be read as "the schemas are otherwise identical".

---

## 3 · Root causes found (and fixed)

### 3.1 The FIX-Task-57 class is far wider than one file — 252 provable inversions
FIX-57 found **one** instance. The scan finds **252 object/inversion pairs** across the chain, e.g.
`get_user_sp_wallet_summary`, `items_status_check`, `admin_delete_user`, `admin_list_users`,
`admin_get_user_detail`, `issue_starter_pack`, `search_listings_by_category`, `log_trade_event`…

Most are currently harmless (the older file happens to re-install an equivalent body), but **four** were
producing real, silent damage in a rebuilt database — and all four are fixed:

| Object | What the inversion did | Fix |
|---|---|---|
| `get_user_sp_wallet_summary(uuid)` | `20260916000104` (originally `20260323000001`) moved after `20260704000001_text`, which had added `reserved_points`; the older 5-column definition won. The mobile app maps the missing field to `0` (`reserved_points: (walletSummary.reserved_points as number) || 0`), so **reserved SP displayed as zero** on a rebuilt DB. | 6-column definition restored (union of both: `wallet_state` + `reserved_points` from `sp_wallets.reserved_sp`), `DROP` prologue for the row-type change (BP-12), grants re-asserted (BP-79). |
| `items_status_check` | `20260916000009` (originally `301_…`) moved after `20260330000001_safety_008_request_edits_status.sql` and re-created the CHECK **without `needs_edits`** — so a rebuilt DB rejected the status used by `services/listing.ts`, `MyListingsScreen`, `ListingSafetyReviewScreen`, `EditListingScreen`, the admin status route and `lib/itemModerationStatus.ts`. | CHECK widened to the 9-status union (= staging exactly). |
| `search_listings_by_category*` | Returned 3 fewer seller columns than the newer definition. (Residual — the chain now wins; the *replay* is ahead of staging here.) | No change; documented as chain-ahead. |
| `log_trade_event` / `trade_events` | See 3.2. | Fixed. |

### 3.2 `trade_events` was a table no shipped code could write to
The chain created `trade_events` with **`event_name` / `user_id`**. Every real writer uses
**`event_type` / `actor_id`**: `_shared/trade-events.ts` (the shared `logTradeEvent` helper),
`create-trade-offer`, `release-payment`, `check-authorization-expiry`, `check-trade-notifications`,
`initiate-payout`, `open-dispute`, `resolve-dispute`, `transactions-update`, `admin-trade-action`,
the admin portal's `dispute-action` route, and the mobile e2e suite. Git history shows the migration
**never** contained `event_type`, and the live staging table has `event_type`/`actor_id`.

Impact on a from-scratch environment: every one of those writes fails with a missing-column error —
**silently**, because each call site swallows it (`console.warn` / `.then(({error}) => …)`) — so the
trade-event audit trail would simply stay empty, and the cron idempotency UNIQUE index
(`trade_id, event_type` partial) would not be doing its job. This is squarely money-adjacent
(`release-payment`, `initiate-payout`, `resolve-dispute` all log here).

Fixed at the table's creator: columns renamed back to the shipped names, indexes corrected to staging's
definitions, staging's two RLS policies added, and guarded convergence `ALTER`s for any database already
built by the old revision.

### 3.3 A false `IF EXISTS(nodes)` guard silently skipped a signup RPC **and** 7 other objects
`20240101000001_resolve_active_node_and_waitlist.sql` wraps its RPCs, indexes and policies in
`DO $$ IF EXISTS (… 'nodes') THEN …`. The renumber placed that file **first**; `nodes` is not created
until `20241213000001_add_auth_module_tables.sql`. The guard is therefore FALSE at replay time and the
whole block is skipped — with a clean exit code and no warning.

Consequence: `resolve_active_node_for_signup(...)` never existed in a rebuilt database, although the
mobile app calls it directly (`services/location.ts`) to turn a signup ZIP into a node. Also lost: 4
`zip_waitlist` indexes and 3 `zip_waitlist` policies.

Fixed by re-creating all of it at the end of the chain, with the **body copied verbatim** from the
guarded file and a signature/result that matches staging exactly (nothing invented).

### 3.4 RLS was off on two tables in every rebuilt database
`nodes` (which carries tax configuration) and `debug_logs` (raw error text) are **RLS-enabled on
staging** and were **RLS-disabled** in the replay — readable in full by any authenticated client via
PostgREST. Enabled, with staging's two `nodes` policies copied verbatim. `debug_logs` matches staging's
"RLS on, no policies" state; writers are DB-side trigger functions owned by the table owner, so logging
is unaffected.

### 3.5 A `SELECT *` view froze its column list at creation time
`user_subscriptions` is a **view** over `subscriptions`, created early as `SELECT *`. It therefore
captured 32 columns while the live staging view has 34 — missing `referral_extensions_used` (position 14)
and `trial_used_at` (last). Anything reading those through the view got `undefined` on a rebuilt DB.
Recreating it with `SELECT *` at the end would be wrong in the other direction (~38 columns). Fixed with
staging's explicit 34-column list, in staging's order, at the end of the chain.

> Two mistakes of mine were caught by re-measuring the chain (BP-96), and are recorded because they show
> the discipline working: (a) an earlier draft did `ALTER TABLE public.user_subscriptions ADD COLUMN …`
> — the replay rejected it outright, *"ADD COLUMN cannot be performed on relation … not supported for
> views"*; (b) putting the explicit column list in the view's own creator made that file fail on pass 1
> (`pass 1: applied 534, deferred 2`), because columns like `referral_extensions_used` do not exist yet
> at that point in the chain. Both are fixed; the final run is single-pass again.

---

## 4 · Additional money-adjacent / correctness discrepancies (task item 3)

Beyond the four above, this round found and fixed:

| Finding | Evidence | Fix |
|---|---|---|
| **21 user-facing RPCs were not executable by `authenticated` in a rebuilt database.** Includes `search_listings`, `search_listings_by_category*`, `get_recommendations`, `get_user_sp_wallet_summary`, `get_unread_notification_count`, `get_notification_preferences`, `update_notification_preference`, `mark_*_read`, `get_current_policy` / `has_accepted_current_policy` / `record_policy_acceptance`, `check_referral_code_exists`, `get_sp_config`, `get_user_expiration_warnings`, `process_unsubscribe`, trade-message receipts. **Not visible to the fidelity gate** — the fingerprints do not capture `proacl`. | `has_function_privilege('authenticated', …) = FALSE` on the rebuilt DB for all of them; **no migration has ever granted any of these names**; they relied on Postgres' default `PUBLIC` EXECUTE, which `dt61_guard_revoke_fn_public` strips on every create — and every replay file runs after that guard. All 21 have live mobile call sites. | Explicit `GRANT EXECUTE … TO authenticated` (plus `anon` for the two pre-session paths: `check_referral_code_exists`, `process_unsubscribe`). Net effect on a rebuilt DB: discovery, the notification centre, notification preferences, the policy gate and referral-code validation stop returning *"permission denied for function"*. |
| `sp_ledger.sp_ledger_transaction_type_check` | Rebuilt CHECK was a strict subset of staging's — rejecting **`earn_bonus`**, a type the live system accepts (the D-17 lineage wrote a separate `earn_bonus` row; `20260916000027_VERIFY_20260606_D17_FIX.sql` still asserts it as a legal historical value). | Widened to staging's exact 15-value list. |
| `get_subscription_status(uuid)` | Staging returns 20 columns; the chain returned 19 (missing `payment_failed_at`, which the `subscriptions` table has). A consumer reading it from the RPC would silently get `undefined`. | Column added, `DROP` prologue (BP-12), existing grants preserved. |
| `email_logs` FK | Chain: `ON DELETE CASCADE`; staging: `ON DELETE SET NULL`. CASCADE means deleting a user **destroys their email delivery history** — the opposite of what a delivery/audit log is for. | Changed to `ON DELETE SET NULL` in the creator + convergence `ALTER`. |
| `nodes.id` | No DEFAULT in the chain; staging defaults `gen_random_uuid()`. Any INSERT omitting the id fails on a rebuilt DB. | Default added at the creator + convergence `ALTER`. |
| `nodes.city/state/zip_code` | Chain `VARCHAR(100)/(2)/(5)`; staging `TEXT`. The limits reject legitimate data (a full state name, a ZIP+4 like `06850-1234`) and nothing in the code validates to them. | Widened to `TEXT`. |
| `nodes.latitude/longitude` | Chain `NUMERIC(10,8)/(11,8)`; staging `DOUBLE PRECISION`. This was not cosmetic: it also blocked `idx_nodes_location`, because `st_makepoint(longitude, latitude)` over NUMERIC renders as `st_makepoint((longitude)::double precision, …)` — a *different* index definition. Measured directly in the DB before deciding. | Changed to `DOUBLE PRECISION`; the gist index now reproduces byte-for-byte, and `resolve_active_node_for_signup`'s float8 overload becomes reachable again. |

Plus, in the same "silently missing on a rebuilt database" family (class 3.5 / §5 of the backfill):
`subscription_tiers` (5 entitlement columns), `ai_moderation_logs` (3), `email_logs` (6 columns, a
UNIQUE, 3 indexes), `cpsc_recalls.description`, `faq_items` counters, `auto_complete_runs` columns,
`profiles.auto_filled_from_provider`, 9 `trades` indexes, 5 integrity FKs, and the two
**auto-referral-code triggers** (`trg_profiles_ensure_referral_code_ins/upd`) — without which a rebuilt
database never creates a user's referral code on profile creation.

---

## 5 · What changed

**Modified (8)** — each at the object's own creator, so the chain *reads* correctly rather than being
patched at the end (BP-96), with convergence `ALTER`s where an older revision may already be applied:

```
20241213000001_add_auth_module_tables.sql          nodes.id DEFAULT gen_random_uuid()
20260213000000_enhance_subscriptions_sub_002.sql   note: view column list is finalised at chain end
20260213000001_subscription_rpcs_sub_002.sql       get_subscription_status += payment_failed_at
20260916000009_items_flagged_rejected_statuses.sql items_status_check keeps needs_edits
20260916000037_sp_ledger_and_trade_rpcs.sql        sp_ledger CHECK += earn_bonus (+ converge ALTER)
20260916000104_enforce_wallet_state_on_spend_earn.sql  get_user_sp_wallet_summary += reserved_points
20260916000106_trade_events.sql                    event_name/user_id -> event_type/actor_id (+ indexes,
                                                   policies, convergence ALTERs, helper insert)
20260916000153_email_notifications_tracking.sql    email_logs FK CASCADE -> SET NULL (+ converge)
```

**New (5)** — appended at the chain end, all Mode B (idempotent rerunnable):

```
20260918000003_fix_task_60_guarded_creations_restored.sql   resolve_active_node_for_signup + zip_waitlist
20260918000004_fix_task_60_nodes_debug_logs_rls_and_shape.sql  RLS + nodes columns/defaults
20260918000005_fix_task_60_user_facing_rpc_grants.sql       21 EXECUTE grants (the gate cannot see these)
20260918000006_fix_task_60_structural_backfill.sql          columns, FK/CHECK, indexes, triggers, the view
20260918000007_fix_task_60_admin_scoped_policies.sql        3 admin-scoped policies
```

**New tooling (1):** `scripts/migrations/fidelity-delta.mjs` (field-level delta + `--clobber-scan`).

---

## 6 · Verification

| Tier / leg | Status | Evidence |
|---|---|---|
| Tier 0 — app typecheck + lint | **N/A** | No `.ts`/`.tsx` file touched (SQL + one `.mjs` analysis script). |
| Tier 2 — DB rebuild from migrations | ✅ **PASS** | `replay-probe.mjs` → `pass 1: applied 536, deferred 0`, `unresolved: 0` (re-measured after EVERY batch, per BP-96) |
| Tier 2 — real invocation of every changed branch | ✅ **PASS** | Every object was verified live on the rebuilt DB: `has_function_privilege('authenticated', …)` per RPC, `pg_get_function_result` for the two changed row types, `pg_get_indexdef` for `idx_nodes_location` (byte-compared before adopting it), `pg_class.relrowsecurity` for `nodes`/`debug_logs`, `information_schema.columns` for all 34 view columns and their order, and `pg_constraint`/`pg_trigger` for the new FKs/triggers |
| Tier 2 — fidelity gate | ✅ **PASS (improved)** | 233 → 135 findings; **0 new findings** (key-set diff); `NO CREATOR` still 0 |
| Tier 2 — DB lint | ⏸ not re-run | Not run this session; FIX-Task-57 recorded it clean. Cheap follow-up: `npx supabase db lint --level warning` |
| Tier 2 — `supabase db reset` itself | ❌ **BLOCKED (pre-existing)** | The CLI-session `42501 must be owner of table objects` defect — **needs the owner decision already carried since FIX-Task-35** (options A–D in FIX-57 §2.4). The equivalent wipe-and-replay passes. |
| Tier 2 — ALL smoke scripts | ⏸ **NOT RUN — no coverage added** | Smoke scripts run against **staging**; nothing was applied to staging by this task (BP-80) |
| Tier 1 — staging application | ⏸ **DEFERRED — needs Samer's approval** | Everything here is **written, NOT applied** to staging. Staging already has the *correct* shape for almost all of it (that was the premise), so applying is mainly about the ledger; the exceptions are the staging-side class C findings. |

**Rollback:** every change is a migration file (revert the commit and re-run
`replay-probe.mjs` for a local DB). The grant file's rollback is stated per function inside it
(`REVOKE EXECUTE … FROM authenticated`). No data was mutated anywhere; no staging object was touched.

---

## 7 · Still owed / needs an owner decision

1. **Staging is the looser database** (class C in `fidelity-exceptions.md`): 13 `*_anon_*` policies
   granting the unauthenticated role read/write on `profiles`, `referrals`, `subscriptions`,
   `user_notifications`, `items`; `badges."Admins can update badges"` with `USING (true)` (any signed-in
   user can update badges); `user_badges` readable by `anon`; and a `profiles` insert policy that permits
   an unauthenticated insert. **Per-table decision needed: intentional or leftover?** Not fixed here —
   staging DDL needs approval.
2. **3 money RPCs deliberately left ungranted**: `award_challenge_sp`,
   `refund_sp_for_cancelled_trade`, `extend_trial_period`. Their only in-repo callers are in
   `services/sp/earning.ts` / `trialExtension.ts`, which DT-59 characterised as test-only for its own
   siblings. They need the same caller analysis DT-59 performed before anyone widens a money surface.
   (`issue_starter_pack`, `award_referral_sp`, `award_listing_referral_sp`, the `admin_*` family,
   `rpc_set_sp_wallet_state`, `rpc_void_tax_for_trade`, `rpc_record_stripe_refund`,
   `process_sp_expiration` are **intentionally** service-role-only — verified, untouched, and the
   grant file's verification block asserts they stay that way.)
3. **`supabase db reset`** — the pre-existing CLI-context defect, now carried by a fifth task.
   Options A–D in FIX-Task-57 §2.4. This is a **Blocked-Tier** item: it needs an owner decision, not
   another silent carry-forward.
4. **The 252 inversions are a class risk, not a checklist.** Only inversions that change a fingerprinted
   attribute could be found. Since bodies are not fingerprinted, a legacy file re-installing an older
   *body* with an identical signature/result/security is invisible. Suggested follow-up: extend the
   fingerprint to include `md5(prosrc)` so the gate can see body drift — that would make the whole class
   auditable in one run.
5. **`user_subscriptions` view md5** and **2 staging-only function bodies** (`is_in_quiet_hours(uuid)`,
   plus any staging object whose definition is body-only) need an **approval-gated staging read** to
   reconcile byte-exactly. Prepared queries, none executed.

---

## 8 · Recipes worth keeping

```bash
# 1. Rebuild from scratch and prove the chain is still single-pass
node scripts/migrations/replay-probe.mjs
#    want: "pass 1: applied <N>, deferred 0"  and  unresolved: 0
#    a "deferred N" > 0 means a file now depends on something that arrives later

# 2. Diff the rebuilt schema against the captured staging fingerprints
node scripts/migrations/fidelity-check.mjs --out=/tmp/fidelity-report.json

# 3. Explain the diff (field-level, not just "different definition")
node scripts/migrations/fidelity-delta.mjs --report /tmp/fidelity-report.json

# 4. Are any remaining findings NEW since the last run? (the regression gate)
jq -r '.findings[] | "\(.rule)|\(.kind)|\(.key)"' /tmp/delta-before.json | sort > /tmp/b
jq -r '.findings[] | "\(.rule)|\(.kind)|\(.key)"' /tmp/delta-after.json  | sort > /tmp/a
comm -13 /tmp/b /tmp/a          # must be EMPTY

# 5. Enumerate the FIX-Task-57 defect class (provable order inversions)
node scripts/migrations/fidelity-delta.mjs --clobber-scan

# 6. Grant check the gate CANNOT do for you (no proacl in the fingerprints)
psql "$DSN" -At -F'|' -c "select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'" > /tmp/fn-acl.txt
#   cross-reference against the names the app calls: grep -rhoE "rpc\('[a-z_0-9]+'" <app src>
```
