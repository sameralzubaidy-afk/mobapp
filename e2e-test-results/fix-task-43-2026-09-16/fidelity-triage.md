# Fidelity-residual triage — FIX-Task-43 item 3 (2026-09-16)

Input: `e2e-test-results/fix-task-40-phase3-2026-09-16/fidelity-exceptions.md`
(the 119 SUBSET misses + 114 CONFLICTs produced by `scripts/migrations/fidelity-check.mjs`).

**Scope of this document: categorisation only.** Nothing here is fixed; the point is to say
which residuals are *known-benign* and which deserve their own scoped task, with counts.

Classification was computed mechanically over the named exceptions (`node
scripts/migrations/fidelity-triage.mjs`, pattern rules over the section/class of every entry),
then hand-corrected for the two places a pattern rule is too coarse to trust — noted inline.

---

## 1 · Headline counts

| Category | Count | Meaning |
|---|---|---|
| **BENIGN · `search_path` hardening** | **77** | replay pins `search_path=public, pg_temp`; staging does not. The **replay is stricter** — a hardening delta, not behaviour |
| **BENIGN · extension artifact** | **19** | the `http_*` / `urlencode` / `bytea_to_text` / `text_to_bytea` family is the **pg_net extension**, not app schema |
| **BENIGN · performance only** | **24** | 21 missing + 3 partial-vs-full indexes. Indexes do not affect correctness |
| **BENIGN · explained by design** | **60** | the EXPLAINED set: replay-only objects that all have a creator in the chain (`NO CREATOR: 0`) |
| **BENIGN · superseded shape** | **2** | `trade_events.event_type` / `actor_id` — the replay carries the newer `event_name` / `user_id` |
| **BENIGN · other** | **6** | enum ordinal-only ×3, service-role-bypass policy, `resolve_active_node_for_signup` duplicate overload, `is_in_quiet_hours`… see §4 |
| **SECURITY · staging-only permissive** | **13** | staging keeps `*_anon_select/insert/update` policies that a rebuilt DB does not — see §3 |
| **RISK-LITE · nullability** | **10** | only whether a column permits NULL differs |
| **RISK · missing column** | **24** | staging has a column the chain never creates |
| **RISK · unenforced rule** | **9** | FK / CHECK / UNIQUE present in staging, absent from the chain |
| **RISK · missing trigger** | **4** | `updated_at` stamping + automatic referral-code creation |
| **RISK · RLS drift** | **25 + 4 + 2** | 25 missing policies, 4 changed-predicate policies, 2 tables with RLS on one side only |
| **RISK · shape / rule drift** | **6 + 3 + 2 + 1 + 1** | 6 column types, 3 CHECK/FK, 2 function bodies, 1 index, 1 view |

Counts reconcile: machine-classified **113 of 114** CONFLICTs; the one it missed
(`trade_events.idx_trade_events_cron_idempotency`) is classified by hand in §2 — it is a RISK,
because it is built on the drifted `event_type` / `event_name` column.

---

## 2 · The CONFLICT set (114), by class

**BENIGN — do nothing (88 of 114)**

* **77 functions with only a `search_path` difference.** Staging runs these functions with the
  default (mutable) `search_path`; the replay pins `search_path=public, pg_temp`. This is the
  repo's own hardening sweep. The replay is the *safer* side; staging is the outlier.
* 3 indexes (partial vs full) — performance only.
* 3 enum ordinals — `admin_config_category.referral` / `trade` / `tax` sit at different sort
  positions on each side. Same label set, so this is only observable through ordinal
  comparisons (`<`, `>`, `ORDER BY` on the enum) — nothing in the repo does that.

**RISK — worth a dedicated follow-up (26 of 114)**

| Item(s) | Why it is a real risk |
|---|---|
| 6 column **types** (`nodes.city/state/zip_code` `text` vs `varchar(n)`; `nodes.latitude/longitude` `double precision` vs `numeric(10,8)`; `auto_complete_runs.id` `bigint` vs `integer`) | The lat/lng one is the load-bearing case: it also changes the *signature* of `resolve_active_node_for_signup`, which is why that function shows up as both a SUBSET miss and a duplicate overload. Precision/rounding and function-overload resolution both depend on it |
| 2 column **defaults** (`nodes.id` `GEN_RANDOM_UUID()` vs no default; `auto_complete_runs.errors_count` no default vs `0`) | Silent behaviour difference on insert |
| 3 **CHECK/FK** rules (`items.items_status_check` — staging allows `needs_edits`, the replay does not; `sp_ledger.sp_ledger_transaction_type_check` — staging allows `earn_bonus`, the replay does not; `email_logs.email_logs_user_id_fkey` — `ON DELETE SET NULL` in staging vs `CASCADE` in the replay) | **The direction differs per item**: the replay's two CHECKs are *stricter* (a local insert of `needs_edits` / `earn_bonus` fails), while the FK is *looser in effect* (deleting a user cascades the email logs away locally). Both are real divergences, and the FK one is a data-loss difference |
| 4 **policy predicates** (`badges.Admins can update badges`, `profiles.Users can insert their own profile`, `trades.trades_select_participant_same_node`, `user_badges.Service role can read all user badges`) | Same policy name, different rule — the two databases are not enforcing the same access rules |
| 2 **RLS on/off** (`debug_logs`, `nodes`) | One side has RLS enabled and the other does not. Security-relevant; `nodes` in particular is a table a fresh rebuild may expose |
| 2 **function bodies / security settings** (`search_listings_by_category_and_query`, `search_listings_by_category`) | Same signature, different body — a silent behavioural difference the schema fingerprint cannot see |
| 1 **index** (`trade_events.idx_trade_events_cron_idempotency`) | Built on `event_type` (staging) vs `event_name` (replay) — part of the same shape drift, and it is a UNIQUE index that gates cron idempotency |
| 1 **view** | Definition differs |

---

## 3 · The SUBSET set (119), by class

**BENIGN — do nothing (63 of 119)**

* 21 missing indexes (performance only).
* 19 pg_net extension functions (`http_get/http_post/http_delete/http_put/http_patch/
  http_head/http_reset_curlopt/http_set_curlopt/http_list_curlopt/http_header/http.request`,
  `urlencode`, `bytea_to_text`, `text_to_bytea`). Staging's pg_net version exposes them in
  `public`; the local build exposes them elsewhere. Extension version artifact.
* 13 `*_anon_*` policies + the 2 superseded `trade_events` columns + 1 duplicate overload
  (`resolve_active_node_for_signup` with `double precision`) + 3 service-role-bypass policies
  + other explained objects. See §4 for the `*_anon_*` ones — they are benign *for the local
  rebuild* but are themselves a **staging security finding**.

**RISK — worth dedicated follow-up (47 of 119)**

| Item(s) | Count | Why |
|---|---|---|
| Missing **columns** | 24 | The chain never creates them, so a rebuilt DB breaks any code path that reads/writes them. Concentrated in: `email_logs` (7 — `email_type`, `notification_category`, `is_critical`, `unsubscribe_token`, `failed_at`, `metadata`, …), `subscription_tiers` (5), `ai_moderation_logs` (3), `debug_logs` (2), `auto_complete_runs` (2), plus `cpsc_recalls.description`, `faq_items.yes_count/no_count`, `profiles.auto_filled_from_provider`, `user_subscriptions.referral_extensions_used/trial_used_at` |
| Missing **RLS policies** | 25 | A rebuilt DB enforces different access than staging on `trades`, `items`, `nodes`, `zip_waitlist`, `subscription_tiers`, `referrals`, `trade_events`, `ai_moderation_logs`, `email_logs`, `admin_config`, `seller_payout_*` |
| Missing **constraints** | 9 | `items.items_node_id_fkey`, `profiles.profiles_node_id_fkey`, `trades.trades_disclaimer_policy_id_fkey`, `trades.trades_dispute_resolved_by_fkey`, `id_badge_verification_requests.*_node_id_fkey`, `referrals.referrals_no_self_referral`, `email_logs.email_logs_status_check`, `email_logs.email_logs_unsubscribe_token_key`, `referral_codes.code_length` — integrity rules simply not enforced on a rebuilt DB |
| Missing **triggers** | 4 | `nodes.update_nodes_updated_at`, `trades.update_trades_updated_at` (stale `updated_at`), `profiles.trg_profiles_ensure_referral_code_ins/upd` (referral codes are **not** auto-created locally) |
| Missing **function** | 1 | `is_in_quiet_hours(p_user_id uuid)` — a notification-quiet-hours helper that exists only in staging |

---

## 4 · Separate finding: staging carries permissive `anon` policies

The 13 staging-only `*_anon_select / _anon_insert / _anon_update` policies are benign for the
local rebuild (a rebuilt DB simply does not have them), but they are **a risk in staging
itself**: `profiles`, `referrals`, `subscriptions`, `user_notifications` and `items` are
readable/writable by the unauthenticated `anon` role there.

Nothing in this task touched staging, and this triage does not change it. It is called out
because it is the one residual class where "staging is ahead of the repo" would be the wrong
reading — staging is *looser* than the chain, so the chain is not the thing to fix.

---

## 5 · Recommended follow-up scoping

1. **One task: "close the staging-only objects gap."** Working list = the 47 RISK SUBSET
   items + the 26 RISK CONFLICT items (§2, §3). Split it by table-ownership
   (`email_logs` → notifications, `subscription_tiers`/`user_subscriptions` → subscriptions,
   `ai_moderation_logs`/`cpsc_recalls`/`debug_logs` → moderation/ops) so it lands as a few
   coherent migrations rather than one sweeping one.
2. **One security task: audit staging's `anon` policies** (§4) and decide, per table, whether
   they are intentional or a leftover.
3. **Do not touch the 88 benign CONFLICTs** except to re-note in the fidelity report that the
   77 `search_path` deltas are the *replay being stricter* — the next reader should not
   mistake them for drift to reconcile.
4. **Keep the fidelity gate's 3 rules as-is.** After (1), the honest expectation is that
   SUBSET RISK goes to ~0 while the benign classes stay — a passing check must still never be
   read as "no diff".
