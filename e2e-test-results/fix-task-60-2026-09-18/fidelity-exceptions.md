# Fidelity exceptions — FIX-Task-60 (2026-09-18)

Rebuilt schema: **536/536 migrations, single pass, 0 deferral** (`pass 1: applied 536, deferred 0`,
`unresolved: 0`). Compared against the staging fingerprints captured 2026-09-16
(`/tmp/staging-fp{1,2,3}.txt`).

| Rule | FIX-Task-57 baseline | **FIX-Task-60 (final)** |
|---|---|---|
| 1 · SUBSET — staging objects missing from the replay | 119 | **49** |
| 2 · EXPLAINED — replay-only objects *with* provenance | 65 | 62 |
| 2 · replay-only objects with **NO CREATOR** | 0 ✅ | **0** ✅ |
| 3 · CONFLICT — same object, different definition | 114 | **86** |
| **Hard findings total** | **233** | **135** |

**98 findings closed, 0 new findings introduced** (verified by diffing the finding key sets of
`fidelity-report` before/after — an empty "new findings" list is the regression gate for this work).

Every one of the 135 remaining findings is classified below. **Nothing is left unclassified**, and
the classification is deliberately *not* "backfill until the number is zero": several residuals are
objects the chain removed on purpose, and one class is a **staging security problem** where the
replay is the stricter side.

Machine-readable source for every claim here:
`fidelity-report.json` (the gate's own output) and `fidelity-delta.json` (field-level delta +
clobber scan). Reproduce the per-class counts with:

```bash
node scripts/migrations/fidelity-delta.mjs --report e2e-test-results/fix-task-60-2026-09-18/fidelity-report.json
node scripts/migrations/fidelity-delta.mjs --clobber-scan        # provable migration-order inversions
```

---

## A · BENIGN — 102 items, no action

### A1 · 74 × FUNCTION, `proconfig`-only delta
Same signature, same result, same security mode; the **only** difference is that the replay pins
`search_path=public, pg_temp` and staging leaves it mutable. The replay is the *stricter* side —
this is the repo's own search-path hardening sweep winning, not drift to reconcile.
*Reproduce:* `fidelity-delta.mjs` → `74  FUNCTION|search_path-only`.

### A2 · 3 × ENUM ordinal-only
`admin_config_category.referral` / `.tax` / `.trade` sit at different `enumsortorder` positions on
each side. The label SET is identical, so the only observable difference is `<`/`>`
comparisons or `ORDER BY` on the enum, which nothing in the repo does.

### A3 · 2 × INDEX definition drift (performance only)
`items.idx_items_node_id` (full vs `WHERE node_id IS NOT NULL`) and `trades.idx_trades_completed_at`
(full vs `WHERE status = 'completed'`). Same access path, different physical shape; no correctness
effect.

### A4 · 2 × FUNCTION return-type — **the chain is AHEAD**
`search_listings_by_category` and `search_listings_by_category_and_query` return three columns
staging lacks (`seller_name`, `seller_avatar_url`, `seller_verification_status`). The chain carries
the newer discovery feature; staging is behind the repo head.

### A5 · 1 × FUNCTION security-mode — **the chain is CORRECT**
`rpc_cart_add_item`: the chain is `SECURITY DEFINER` with `SET search_path = public` and gates on
`auth.uid()` internally (returns `UNAUTHENTICATED` when null); staging is `INVOKER`. The chain's
form is the deliberate BP-5/BP-78 pattern. Reverting it to match staging would be a regression.

### A6 · 19 × FUNCTION — pg_net extension placement
`http_get/http_post/http_put/http_patch/http_delete/http_head/http_reset_curlopt/
http_set_curlopt/http_list_curlopt/http_header/http`, `urlencode`, `bytea_to_text`, `text_to_bytea`.
**Verified**: the extension is installed on both sides (`pg_net 0.19.5`); locally its functions live
in schema `net`, while staging's older pg_net exposed them in `public`. Same extension, different
schema placement — not app schema. (`select n.nspname, p.proname from pg_proc … where proname='http_post'` → `net`.)

### A7 · 1 × FUNCTION `is_in_quiet_hours(p_user_id uuid)`
A legacy single-argument overload kept on staging for backward compatibility. Both sides have the
2-argument version, which is what the client calls first; the client only falls back to the 1-arg
form when the 2-arg one reports "does not exist" (`services/pushDelivery.ts:92-94`). Staging cruft;
the client's primary path works on a rebuilt database.

---

## B · DELIBERATE CHAIN DECISIONS — 5 items, no action

These are objects the chain removed or replaced **on purpose** in later hardening migrations.
Backfilling them would re-open access the repo closed.

| Item | Why it must NOT be restored |
|---|---|
| `admin_config.admin_config_authenticated_read` (SELECT, authenticated, `USING true`) | Dropped by `20260916000158_prod_p1_stage_security_lockdown.sql` ("Restrict admin_config to service_role only"), which also `REVOKE`s anon/authenticated on the table. Restoring it would expose the entire admin configuration to every signed-in user. |
| `items."Items visibility based on status"` | Replaced by `20260916000021_prod_p1_node_isolation_hardening.sql`, which installs `items_select_same_node_or_own`. Restoring it would widen item visibility back to the pre-node-isolation model. |
| `items.items_insert_own_seller` / `items.items_update_own_seller` | Redundant. Permissive policies OR together, and the rebuilt schema already grants the identical access via `items_insert_authenticated` (`WITH CHECK true`) and `items_update_own`. |
| `trades.trades_select_participant_same_node` (**CONFLICT**) | The chain carries the node-isolation predicate; staging's version ORs `buyer_id = auth.uid() OR seller_id = auth.uid()` back into the `USING` clause, which makes the node check a no-op. Chain is stricter and newer. |

---

## C · STAGING-SIDE SECURITY FINDINGS — 16 items (owner decision, no chain change)

The replay is **stricter** than the live staging database here, so the correct fix is on staging —
not in the chain. Nothing in FIX-Task-60 touched staging (BP-80: any staging DDL needs Samer's
explicit approval).

### C1 · 13 staging-only `*_anon_*` policies
`profiles_anon_insert/select/update`, `referrals_anon_insert/select/update`,
`subscriptions_anon_insert/select/update`, `user_notifications_anon_insert/select/update`,
`items_anon_select`.

These grant the **unauthenticated `anon` role** read/write access to profiles, referrals,
subscriptions, notifications and available items. A rebuilt database does not have them. This is the
one residual class where "staging is ahead of the repo" would be the wrong reading — staging is
**looser**, so the chain is not the thing to fix. Recommended action: decide per table whether these
are intentional; otherwise `DROP POLICY` them on staging.

### C2 · 3 policy predicates where staging is looser
| Policy | staging | rebuilt chain | Note |
|---|---|---|---|
| `badges."Admins can update badges"` | `USING (true)`, role `authenticated` | `user_has_role(auth.uid(),'admin')` | On staging **any authenticated user can update badges**. |
| `user_badges."Service role can read all user badges"` | role `public`, `USING true` | role `authenticated`, `USING true` | Staging lets `anon` read all user badges. |
| `profiles."Users can insert their own profile"` | `WITH CHECK (user_id IN (SELECT id FROM auth.users) OR auth.uid() IS NULL)` | `((auth.uid() IS NULL) OR (auth.uid() = user_id))` | Both permit an unauthenticated insert (the `auth.uid() IS NULL` arm); the chain's arm at least binds the row to the caller's own id. |

---

## D · CRUFT / REDUNDANT — 12 items, no backfill

Objects that exist on staging, add nothing, and in two cases are outright **dead rules**.

| Item | Verdict |
|---|---|
| `email_logs.email_logs_status_check` (CONSTRAINT) | A *second* CHECK on `email_logs.status` (admitting `pending/sent/bounced/failed/skipped`) alongside the chain's own `email_status_check`. Two CHECKs AND together, so staging's accepted set is a narrower intersection. Backfilling would only restrict the rebuilt database. Staging cruft. |
| `referrals.referrals_insert`, `referrals.referrals_select_own` | Written against the **legacy** `referrer_id` / `referee_id` columns. Modern code writes `referrer_user_id` / `referred_user_id`, which those columns' policies never match — they are dead on staging and would be dead in the replay too. |
| `trades.trades_insert_own`, `trades.trades_update_own` | Narrower duplicates of the rebuilt schema's `Users can insert trades` / `Users can update their trades`. Adding them cannot change the effective access (permissive policies OR). |
| `seller_payout_methods."Service role bypass - seller_payout_methods"`, `seller_payouts."Service role bypass - seller_payouts"`, `email_logs.email_logs_service_role`, `profiles."Service role can update profiles"` | `service_role` already bypasses RLS; these grant nothing extra. |
| `email_logs.email_logs_select_own`, `ai_moderation_logs.ai_logs_system_create`, `subscription_tiers.subscription_tiers_public` | No shipped code path reads/writes these with a user JWT: email delivery is service-role, AI moderation logging is Edge-Function/service-role, and tier pricing is already readable through existing policies. Adding them would widen access with no caller to serve. |

---

## Carried forward — needs an owner decision or an approval-gated read

1. **`staging` carries permissive `anon` policies and three loose policy predicates** (class C).
   Needs a per-table decision: intentional or leftover? Until then staging is the weaker database.
2. **Money RPCs pending the DEV-TASK-59 treatment.** `award_challenge_sp`,
   `refund_sp_for_cancelled_trade` and `extend_trial_period` have no `authenticated` EXECUTE grant and
   their only in-repo callers are `services/sp/earning.ts` and `services/subscriptions/trialExtension.ts`,
   which `20260916000136_dev_task_59_grant_lockdown.sql` characterised as test-only for its own
   sibling functions. They were **deliberately not granted** in this task: they are money mutations
   and need the same caller analysis DT-59 performed, not a unilateral widening. (The rest of the
   mobile-callable-but-ungranted set was repaired — see the report's grant section.)
3. **`user_subscriptions` view md5.** The rebuilt view now has the same 34 columns **in the same
   order** as staging, but the fingerprint compares `md5(pg_views.definition)`, which is
   whitespace/text-sensitive. Staging's view is `SELECT *` over a table whose column order differs
   from the chain's, so byte-equality is not reachable from the chain alone. Reading staging's exact
   `pg_get_viewdef` would settle it (approval-gated).
4. **The 252 provable migration-order inversions** (see the report §4) are a *class* risk that
   outlives this task: only the ones that produce an observable fingerprint difference could be
   found. Function **bodies** are not fingerprinted, so a legacy file that re-installs an older body
   with an identical signature/result is invisible to the gate.
5. **`nodes.latitude/longitude`** were changed to `DOUBLE PRECISION` in this task (BATCH-2 §1), so
   they are *resolved*, not carried — noted here only because they were the precondition that made
   `idx_nodes_location` reproducible at all.
