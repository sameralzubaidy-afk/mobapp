---
description: "Use when writing or reviewing Supabase Postgres migrations, RLS policies, triggers, or RPC functions for the Kids P2P Marketplace. Covers migration mode, ordering, rerun safety, naming conventions, and DB invariants for money/points/state logic."
applyTo: "supabase/migrations/**/*.sql"
---

# Supabase SQL / Migration Hardening Protocol

Full bug-prevention rule text below: BP-1, BP-2, BP-3, BP-4, BP-5, BP-6, BP-9, BP-10, BP-11, BP-12, BP-16, BP-21, BP-22, BP-44, BP-45, BP-46, BP-48, BP-73, BP-74, BP-75, BP-76. (BP-19 cron `verify_jwt` lives in `edge-functions.instructions.md`.) See the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md` for the one-line summary of all rules.

### Rule Index (scan this first; open the full rule below only when it's relevant to your current task)

- Naming convention — `p_` params, `v_` locals, always qualify columns with a table alias.
- SQL-0 Migration mode — declare one-time vs. idempotent-rerunnable, never mix.
- SQL-1 Compatibility — no `CREATE POLICY IF NOT EXISTS`; use DROP+CREATE for rerunnable policies.
- SQL-2 Ordering — referenced tables/columns before indexes/policies/views; RLS enabled before policies.
- SQL-3 Assertions — a verification query after every critical step (columns, indexes, RLS).
- SQL-4 2-phase plan — split every deliverable into Schema block + Verification block.
- SQL-5 Rerun behavior — never hand-wave whether a script is safe to re-run.
- SQL-6 DB Object Checklist — required in every SQL response.
- SQL-7 SQL Editor rerun safety — guard against partial-apply failures.
- HP-4 DB invariants — bugs must not reach data; constraints as a last line of defense.
- HP-5 Atomic RPC — multi-table mutations go through a single Postgres RPC, not scattered updates.
- BP-1 RLS — every new table needs RLS policies in the same migration.
- BP-2 FK type matching — verify target column type before INSERT (user_id vs profile.id).
- BP-3 Ambiguous columns — qualify every column with a table alias.
- BP-4 Trigger silent failures — never bare-catch; log to debug_logs.
- BP-5 SECURITY DEFINER — document why; set search_path.
- BP-6 Pre-deploy SQL checklist — run the 5 verification queries before staging SQL.
- BP-9 Migration order — tables → constraints → RLS → policies → functions → triggers → indexes → seed.
- BP-10 Verification queries — include column/RLS/function/trigger checks in every DB response.
- BP-11 Admin config two tables — check both admin_config and sp_config; don't trust is_active alone.
- BP-12 RPC RETURNS TABLE changes — DROP FUNCTION before changing the signature.
- BP-16 Stale trigger comments — if a referenced trigger doesn't exist in any migration, it's a defect.
- BP-21 RPC → data-only refactor — the corresponding cron.schedule must exist in the same migration.
- BP-22 API-key COALESCE chains — always include a hardcoded fallback, not just for base URLs.
- BP-44 RPC tax/SP/fee recompute — must be category-aware and match the offer-time calculation; grep for stale `get_node_tax_rate`-only writers on tax-exemption bugs.
- BP-45 Searchable admin surfaces — never `ilike` a UUID column or `::cast` inside `or=()`; create a text-cast view (`admin_trades_view`/`admin_payments_view`).
- BP-46 Function DECLARE hygiene — every `v_*` used in the body must be declared; diff the DECLARE block before authoring/applying (`42601 <var> is not a known variable`).
- BP-48 Admin config writes — settings MUST go through the shared `upsert_admin_config_setting(p_admin_id)` RPC, never direct `admin_config` table writes (records the editor + lands in the shared audit trail).
- BP-73 Trades FK + payout-method schema — the `trades`→`items` FK is `listing_id` (never `item_id`); Stripe Connect / payout-method state lives in `seller_payout_methods` (never `profiles`).
- BP-75 RLS-disabled audit — the authoritative source for "which tables have RLS off" is the LIVE `pg_class.relrowsecurity` query, not migration greps (greps miss DO-block/seed enablement, commented-out `ENABLE RLS` lines, and orphaned DB-only tables); trace every table's readers/writers (client vs service-role vs SECURITY DEFINER) before enabling RLS.
- BP-74 Tier-1 notification assertion — anchor on the linkage key (`user_notifications.data.ledger_id` ↔ `sp_ledger.id`); never a shared/fuzzy filter helper that can silently drop the row (DT-19, 2026-08-28).
- BP-76 Enum-like status/reason literals — DB writers must emit the canonical snake value (`'offer_expired'`) that triggers AND the client match exactly; never store a display string (`'Offer expired'`) in a machine-compared column (silently breaks surfacing/counters, TRD re-verify 2026-08-28).

## Postgres RPC / SQL Naming Convention (MANDATORY)

For ALL Postgres functions/RPC:
- ALL parameters MUST be prefixed with `p_` (e.g., `p_radius_miles`)
- ALL local variables MUST be prefixed with `v_`
- ALL column references MUST be qualified with table aliases (e.g., `i.node_id`, not `node_id`)
- NEVER reuse a column name as a parameter name.

Required in every SQL deliverable:
- A verification query that calls the RPC with sample inputs
- A "common failure modes" note (e.g., ambiguous columns, missing indexes, RLS scope)

## SQL-0: Migration mode must be declared

Before writing SQL, you MUST declare ONE mode:
- Mode A: "one-time migration" (assumes fresh DB; not rerunnable)
- Mode B: "idempotent rerunnable migration" (safe to re-run multiple times)

You MUST NOT mix patterns. Pick one and implement consistently.

## SQL-1: Supabase/Postgres compatibility rules

You MUST NOT use unsupported syntax. In particular:
- DO NOT use `CREATE POLICY IF NOT EXISTS` (unsupported in Postgres).
- DO NOT claim a statement is rerunnable unless it truly is.

If you need rerunnable policies:
- Use `DROP POLICY IF EXISTS ... ON <table>;` then `CREATE POLICY ...;` (or implement a DO block that checks `pg_policies` and conditionally creates).

## SQL-2: Strict ordering + explicit dependencies

When tables depend on other tables:
- create referenced tables FIRST (e.g., categories before items)
- create columns BEFORE indexes/policies/views that reference them
- create RLS policies only AFTER `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

## SQL-3: Mandatory assertions ("fail fast with clear diagnosis")

After each critical step, you MUST include a verification query that can be run immediately:
- After `CREATE TABLE items...` you MUST include:
  ```sql
  SELECT column_name FROM information_schema.columns ... WHERE table_name='items';
  ```
- Before creating indexes, you MUST include a check that required columns exist.
- Before creating policies, you MUST include a check that RLS is enabled.

## SQL-4: Provide a 2-phase execution plan (prevents "copy/paste all" confusion)

Every SQL deliverable MUST be split into exactly two runnable blocks:

BLOCK 1 — Schema:
- create/alter tables
- constraints + enums
- RLS enablement
- functions/RPC (if any)

BLOCK 2 — Security + Performance:
- policies (drop then create if rerunnable)
- indexes
- views

And you MUST tell the user: run Block 1 first, confirm verification query results, then run Block 2.

## SQL-5: Never hand-wave re-run behavior

If the user is using the Supabase SQL Editor (manual execution), you MUST:
- avoid partial execution assumptions
- include safe drop statements where required for reruns (policies/views/functions)
- explicitly state what is safe to re-run vs not

## SQL-6: DB Object Checklist (must be included in your response)

For every migration you generate, include this checklist in your response:
- [ ] tables created in correct order
- [ ] columns verified (include verification query)
- [ ] constraints created
- [ ] RLS enabled
- [ ] policies created (no unsupported syntax)
- [ ] indexes reference verified columns
- [ ] view/function drop/create behavior stated
- [ ] rollback instructions provided (or explicitly "no rollback" + why)

## SQL-7: SQL Editor rerun safety

Assume the user might accidentally re-run the same SQL in Supabase SQL Editor. Therefore:
- policies/views/functions must be droppable safely
- table creation must either be `IF NOT EXISTS` (if idempotent mode) OR clearly marked one-time
- never include "run entire file" advice without also giving the 2-block plan above

## HP-4: DB invariants (bugs must not reach data)

For points/money/state logic you MUST enforce:
- CHECK constraints (non-negative values, valid caps)
- enums for statuses
- uniqueness constraints (idempotency keys, Stripe event IDs)
- foreign keys + indexes

## HP-5: Atomic operations via Postgres RPC

Any multi-table mutation that must be atomic MUST be implemented as a Postgres RPC function (e.g., `rpc_create_transaction_with_ledger`) and called from Edge Functions. No scattered updates across multiple tables without atomicity.

---

## BP-1: RLS Policy Prevention (Most Common Bug Category)
Problem: PGRST204 no rows returned or data not visible to users.

Rules:
- EVERY new table MUST have RLS policies created in the SAME migration.
- BEFORE creating any RPC/function that reads data, verify RLS allows the operation.
- For Edge Functions needing to bypass RLS: use service role key explicitly, document WHY bypass is needed, add audit logging for the operation.
- Test RLS policies with this verification query BEFORE deployment:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '<table>';
-- List policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = '<table>';
```
RLS Policy Template (use for every new table):
```sql
-- Enable RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own data
CREATE POLICY "<table>_select_own" ON public.<table_name>
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert their own data
CREATE POLICY "<table>_insert_own" ON public.<table_name>
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users can update their own data
CREATE POLICY "<table>_update_own" ON public.<table_name>
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role bypasses RLS (for admin/webhooks)
CREATE POLICY "<table>_service_role" ON public.<table_name>
  FOR ALL TO service_role
  USING (true);
```

## BP-2: Foreign Key Type Matching (Second Most Common Bug)
Problem: FK violations due to `user_id` (UUID from `auth.users`) vs `profile.id` (UUID from `profiles` table) confusion.

Rules:
- ALWAYS check the target table's column type before creating FK references:
```sql
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = '<target_table>' AND column_name = '<fk_column>';
```
- In RPC functions, ALWAYS query the correct ID before INSERT:
```sql
-- WRONG: Assuming user_id works for profile foreign key
INSERT INTO referrals (referrer_id) VALUES (p_user_id);

-- CORRECT: Look up the profile_id first
SELECT id INTO v_referrer_profile_id FROM profiles WHERE user_id = p_user_id;
INSERT INTO referrals (referrer_id) VALUES (v_referrer_profile_id);
```

## BP-3: Ambiguous Column Reference Prevention
Problem: `ERROR: column reference "X" is ambiguous` in SQL queries.

Rules:
- EVERY column in SELECT/WHERE/JOIN MUST be table-qualified.
- Parameter names MUST NOT match any column name in touched tables.
```sql
-- WRONG
SELECT id, name, status FROM items WHERE node_id = p_node_id;

-- CORRECT
SELECT i.id, i.name, i.status FROM items i WHERE i.node_id = p_node_id;
```

## BP-4: Trigger Silent Failure Prevention
Problem: Triggers fail silently, appearing to succeed but doing nothing.

Rules:
- NEVER use bare `EXCEPTION WHEN OTHERS THEN RETURN NEW;` — this hides all errors.
- ALWAYS log errors to `debug_logs` table (or equivalent) in exception handlers:
```sql
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('function_name', 'ERROR', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
  RAISE WARNING 'Trigger error: %', SQLERRM;
  RETURN NEW; -- Only if you want to proceed despite error
END;
```
- For critical triggers (auth, referrals, SP), add step-by-step logging.

## BP-5: SECURITY DEFINER Function Rules
Problem: Functions with `SECURITY DEFINER` can bypass RLS unexpectedly or fail to access needed data.

Rules:
- Only use `SECURITY DEFINER` when the function MUST bypass RLS.
- Document WHY it needs `SECURITY DEFINER` in a comment.
- Always set explicit `search_path`:
```sql
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void AS $$
-- SECURITY DEFINER needed because: <reason>
BEGIN
  -- function body
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## BP-6: Pre-Deploy SQL Validation Checklist
BEFORE running ANY SQL on staging, you MUST provide these verification queries:
```sql
-- 1. Check for ambiguous column references (dry run)
EXPLAIN (VERBOSE) <your_query>;

-- 2. Verify FK targets exist
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = '<target_table>';

-- 3. Verify RLS is configured
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = '<new_table>';

-- 4. Test RPC with sample data
SELECT public.<function_name>(<test_params>);

-- 5. Check for constraint violations
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint WHERE conrelid = '<table>'::regclass;
```

## BP-9: Migration Dependency Order
Problem: Migrations fail because they reference tables/columns that don't exist yet.

Rules:
- Create tables in dependency order (referenced tables first).
- Add columns BEFORE indexes/constraints that use them.
- Enable RLS BEFORE creating policies.
- Create functions BEFORE triggers that call them.
- Template order: 1. Create/alter tables → 2. Add constraints → 3. Enable RLS → 4. Create policies → 5. Create functions → 6. Create triggers → 7. Create indexes → 8. Insert seed data (if any).

## BP-10: Required Verification Queries
For EVERY database change, include these verification queries in your response:
```sql
-- After table creation
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = '<table>';

-- After RLS setup
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = '<table>';
SELECT policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies WHERE tablename = '<table>';

-- After function creation
SELECT proname, prosrc FROM pg_proc WHERE proname = '<function>';

-- After trigger creation
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers WHERE trigger_schema = 'public';
```

## BP-11: Admin Config Two-Table Architecture
Problem: The system has two config tables (`admin_config` and `sp_config`) with different write paths — the config page writes via RPC `secure_upsert_admin_config` to `admin_config` but does NOT set `is_active = true` or `data_type` properly, the sync trigger to `sp_config` does NOT exist, and mobile app readers filter by `is_active = true` so admin-saved rows are silently excluded.

Rules:
- When reading config values, ALWAYS check both `admin_config` and `sp_config`.
- Document the precedence order explicitly.
- For `admin_config` queries, NEVER rely on the `is_active` filter — use direct key lookups instead.
- When creating config write paths, ALWAYS set `is_active = true` and `data_type = 'number'` for numeric values.
- If you see a comment saying a trigger "will fire automatically" but no trigger exists in any migration, file it as a defect.

## BP-12: RPC Return Type Changes Require DROP First
Problem: `CREATE OR REPLACE FUNCTION` errors with `42P13` when the `RETURNS TABLE` signature changes.

Rules:
- If you add/remove/reorder columns in `RETURNS TABLE`, you MUST `DROP FUNCTION IF EXISTS` first.
```sql
-- WRONG — errors with 42P13
CREATE OR REPLACE FUNCTION get_foo() RETURNS TABLE (a int, b int) ...

-- CORRECT
DROP FUNCTION IF EXISTS get_foo();
CREATE FUNCTION get_foo() RETURNS TABLE (a int, b int) ...
```

## BP-16: Config Comments Referencing Non-Existent Triggers Are Defects
Problem: A comment implies a trigger (e.g., `trigger_sync_sp_config_on_admin_update`) automatically syncs a change, but the trigger does NOT exist in any migration.

Rules:
- If a SQL comment references a trigger, constraint, or function that does not exist in any migration file, treat it as a defect.
- Verify existence by searching ALL migration files, not just the file you are editing.
- Add a `// DEFECT:` comment noting the missing dependency.

## BP-21: Cron Job Must Be Created When Refactoring RPC from HTTP-Calling to Data-Only
Problem: An RPC was refactored to data-only (removed HTTP calls), but the corresponding cron job to call the Edge Function was never created — the RPC appears to work (sets timestamps) but the notification never reaches the user because the Edge Function is never triggered.

Rules:
- When refactoring an RPC from HTTP-calling to data-only, ALWAYS verify the corresponding cron job or trigger is created in the SAME migration.
- Follow the established pattern: DO block with `cron.schedule` that calls the Edge Function via `net.http_post`, using `admin_config` + hardcoded fallbacks for the project URL and service role key (since `current_setting()` is blocked in Supabase managed Postgres).
- Verify the cron was created: `SELECT jobname, schedule, command FROM cron.job WHERE jobname = '<job-name>';`

## BP-22: COALESCE Chains for API Keys Must Include Hardcoded Fallback
Problem: A migration's DO block has a COALESCE chain for `v_service_role_key` that relies on `current_setting()` and `admin_config` lookups, but lacks a hardcoded fallback — when neither source resolves, the key stays NULL and the cron job is silently skipped.

Rules:
- Every COALESCE chain for API keys/secrets in a migration DO block MUST include a hardcoded fallback as the last element — not just for base URLs, but also for service role keys.
- Cross-check against existing sibling migrations that successfully schedule cron jobs.
- Verify the cron was actually created after running the DO block: `SELECT jobname FROM cron.job WHERE jobname = '<job-name>';`. Zero rows means the fallback chain is incomplete.

## BP-44: RPCs That Recompute Tax/SP/Fees on a Trade Must Be Category-Aware and Match the Offer-Time Calculation
Problem: `apply_tax_to_trade` (migration `20260510000003`) recomputed tax from the seller node's FLAT rate on `(cash_amount_cents - buyer_transaction_fee_cents)` and OVERWROTE `trades.tax_amount_cents`. For a tax-exempt item, `create-trade-offer` had already stored the authoritative category-aware value ($0). But because exempt trades have no `tax_records` row, the RPC's idempotency check did not short-circuit — it rewrote the correct $0 to $6.29 (`FLOOR(9900 * 0.0635 + 0.5) = 629` for a $100 exempt item with a $1 fee). The phantom tax then showed on the mobile timeline, the admin Trade Details page, and the admin refund card while Stripe captured $101 with zero tax.

Rules:
- The `create-trade-offer` calculation is the AUTHORITATIVE tax source: category-aware via `get_applicable_tax_rule`, `tax_exempt_goods` → $0, taxable base = full item price (BP-37). Any RPC that recomputes tax/SP/fees on an existing trade MUST produce the SAME result — never a flat node-rate recompute.
- When recomputing tax on a trade, resolve the item's `tax_category_id` (via `trades.listing_id → items.tax_category_id`) and call the category-aware `calculate_tax(p_node_id, p_taxable_amount_cents, p_tax_category_id, p_item_price_cents)` — never `get_node_tax_rate(...)` alone.
- Only write a `tax_records` row when tax > 0 (mirror `create-trade-offer`); exempt trades stay clean (0 / NULL) so the lifecycle RPCs (`rpc_mark_tax_collected` / `rpc_void_tax_for_trade` / `rpc_mark_tax_capture_failed`) no-op on them.
- When a tax-exemption bug is reported, grep for stale flat-rate writers: any RPC/function that calls `get_node_tax_rate(` AND writes `trades.tax_amount_cents` or inserts a `tax_records` row outside `create-trade-offer`.

Detection checklist: search migrations + Edge Functions for `UPDATE ... tax_amount_cents` on `trades` or `INSERT INTO tax_records` outside `create-trade-offer`; verify each writer is category-aware. Cross-ref BP-37 (taxable base = full item price), BP-42 (client previews use joined listing price), BP-31 (verify trigger AND RPC layers).

## BP-45: Searchable Admin Surfaces Need Text-Cast Views — Never `ilike` a UUID Column or Cast Inside `or=()`
Problem: The admin Payments reconciliation page search (`/api/admin/payments`) applied `ilike` to `payments.trade_id` / `payments.bundle_id`, which are UUID columns. PostgREST cannot apply the text operator `ilike` to a UUID type (404), and casts like `trade_id::text` are NOT supported inside `or=(...)` filters — the PostgREST filter grammar only parses `::` casts in `select`, not in filter fields (400). The search failed with "Fetch failed: 404" then "Fetch failed: 400".

Rules:
- NEVER apply `ilike`/`like`/`match` to a UUID column via PostgREST — it fails (404).
- NEVER put a `::cast` inside `or=(...)` / `and=(...)` filters — the PostgREST filter grammar does not accept it (400); casts are only supported in `select`.
- For any searchable admin surface, create a text-cast VIEW (e.g. `admin_trades_view`, `admin_payments_view` — "We cast UUIDs to text to support ILIKE searching via PostgREST") and query the view with plain `ilike` plus URL-encoded wildcards (`encodeURIComponent('*q*')`).
- GRANT SELECT on the view to `service_role` (and `authenticated` for symmetry); keep the actual RLS on the underlying financial table (service-role-only) intact.

Detection checklist: for every admin search query, confirm the target relation is a view/text-cast (not a raw table with UUID PK), and that no filter term contains `::`. PostgREST docs: "For more complicated filters you will have to create a new view in the database, or use a function."

## BP-46: Postgres Function DECLARE Block Must Declare Every `v_*` Variable Used in the Body
Problem: A `CREATE OR REPLACE FUNCTION` body references a `v_*` variable that its `DECLARE` block never declares — the apply fails with `42601: "<var>" is not a known variable`. This bit twice on referral functions (`v_referrer_batch_id`/`v_referee_batch_id`): once when transcribing a migration into `apply_migration`, and once as a latent bug in a committed migration FILE that would have failed a fresh `supabase db reset` build.

Rules:
- After writing — and again BEFORE applying — ANY Postgres function migration, diff the `DECLARE` block against every `v_*` used in the body. A missing declaration is the #1 cause of `42601 "<var>" is not a known variable`.
- The check applies to BOTH SQL pasted into `mcp_supabase_apply_migration` AND migration files committed under `supabase/migrations/` — a file can look correct yet fail a fresh DB build.
- Pay special attention to variables assigned inside `RETURNING id INTO v_*`, `PERFORM`, and `INSERT ... SELECT ... FROM` blocks — those are the easiest to miss.
- If an apply fails with `42601 ... is not a known variable`, diff the DECLARE list against the body BEFORE re-attempting; do not just re-paste the same SQL.

Detection checklist: for every `CREATE [OR REPLACE] FUNCTION` authored or applied this session, grep the body for `\bv_[a-z_]+` and confirm each token appears in `DECLARE`; after a successful apply, re-read the migration file so the committed file and the live DB stay in sync.

## BP-48: Admin Config Settings Writes Must Go Through the Shared RPC — Never Direct Table Writes
Problem: The /config hub and the standalone settings pages (Tax Settings, Cart Settings, Trade Timing, Node Settings) all read/write the SAME `admin_config` table, but each surface recorded the editor differently (or not at all): the `/config` API wrote `updated_by = NULL` (no editor) and its audit write targeted `audit_logs` — a table that does not exist, so it was silently dropped; standalone pages called `upsert_admin_config_setting`, which did not set `updated_by` at all. The result: an admin could edit a value in one place and the other surface could not tell WHO changed it or WHEN, and edits from `/config` left no audit row.

Rules:
- ANY write to an `admin_config` settings row (admin UI, migration seed, cron, Edge Function) MUST go through the shared SECURITY DEFINER RPC `upsert_admin_config_setting` — NEVER a direct `INSERT`/`UPDATE` on `public.admin_config` from app/EF code (that bypasses `updated_by`/`updated_at` recording and the audit contract).
- When the caller is an admin, ALWAYS pass `p_admin_id` = the acting admin's `auth.uid()` so `admin_config.updated_by` is recorded. Both write paths must set it: `secure_upsert_admin_config(p_user_id)` for the /config API and `upsert_admin_config_setting(..., p_admin_id)` for standalone settings pages.
- The RPC must NEVER wipe a recorded editor: on `ON CONFLICT (key) DO UPDATE`, set `updated_by = COALESCE(p_admin_id, admin_config.updated_by)` so a legacy/system caller that omits the admin id does not erase the previous editor.
- Every settings-edit surface must land a row in the shared `admin_audit_log` trail (action `update_config` / `update_*_settings`, entity_type `admin_config`, key + before/after in `changes`). Audit targets must be REAL tables — verify the table exists (`to_regclass`) before writing; a write to a non-existent table is a silent bug.
- When adding a NEW admin settings page, it must reuse these shared RPCs + audit helpers rather than writing `admin_config` directly, so it automatically inherits the single-source + editor + audit contract.

Detection checklist: grep for direct `admin_config` INSERT/UPDATE outside `upsert_admin_config_setting`/`secure_upsert_admin_config`; confirm each settings page passes `p_admin_id`/`user_id`; confirm every settings-edit surface writes `admin_audit_log`; confirm audit target tables exist. Cross-ref BP-11 (read both `admin_config` and `sp_config`; don't trust `is_active` alone) and HP-5 (atomic multi-table mutations via a single RPC).

## BP-73: Trades→Items FK Is `listing_id`; Payout-Method/Stripe-Connect State Lives in `seller_payout_methods` (Never `profiles`)
Problem: Read-back/verification queries (and RPCs joining trades to their listing) that assume the FK is `trades.item_id` fail with `42703: column t.item_id does not exist`; likewise, queries that look for a seller's Stripe Connect / payout-method state in `profiles` (columns like `stripe_connect_account_id`, `payout_method_status`) fail with 42703 because that state lives in a separate table. Both were hit live in the 2026-08-27 TRD part-2 verification (the `trades` FK, and locating the seller-payout-method table).

Rules:
- The `trades` table's FK to its listing/item is **`listing_id`** — NEVER `item_id`. Join `items i ON i.id = t.listing_id` (e.g. `SELECT t.id, i.title FROM trades t LEFT JOIN items i ON i.id = t.listing_id`).
- A seller's Stripe Connect / payout-method state is NOT on `profiles` — query **`seller_payout_methods`** (per-user payout method / Connect state) and **`seller_payouts`** (per-trade payout records); `admin_payouts_view` is the admin aggregate. Example: `SELECT * FROM seller_payout_methods WHERE user_id = '<seller>';` — an empty result means the seller has no payout method (a valid `payout_status='requires_action'` state, not a bug).
- Before writing a query against an unfamiliar table this session, introspect its columns (`information_schema.columns` WHERE table_name = ...) rather than assuming the schema (mirrors the QA pre-read-DB-schema discipline).

Detection checklist: if a query fails `42703 ... does not exist`, introspect the table's actual columns before assuming a name; when the `trades` table is involved, the item FK is `listing_id`.

## BP-75: RLS-Disabled Audits Must Use the Live `pg_class.relrowsecurity` Query, Not Migration Greps
Problem: A security-advisory/audit that asks "which public tables have RLS disabled" — or a decision about whether a table is actually locked down — cannot be answered from the migration files alone. Migration greps are incomplete and misleading in both directions: a table can be RLS-enabled in a `DO` block or seed file (so it is absent from a naive `ENABLE ROW LEVEL SECURITY` grep — e.g. `nodes` appears disabled in the repo but is actually enabled), a migration can have the enable line commented out (e.g. `role_based_access_control` in `20251216_create_geographic_nodes_table.sql`), and a table can exist in the live DB with no migration creating it at all (legacy/orphaned tables like `swap_points_ledger`, `v_config_value`, `v_referrer_sp`, `auto_complete_results`). Designing RLS policies (or concluding "nothing is exposed") from a grep-based inventory is how RLS gaps survive to launch.

Rules:
- The authoritative source for "which tables have RLS disabled" is the LIVE database, not the migrations:
  ```sql
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
  ORDER BY 1;
  ```
  Use this query (via the Supabase MCP per the MCP Usage Protocol) to enumerate the RLS-disabled set before designing any policy, and re-run it after enabling RLS to confirm 0 rows remain.
- Before enabling RLS on any table, trace EVERY reader/writer first: the mobile app (`supabase.from(...)` with a user JWT), Edge Functions (service-role or user-JWT), admin-portal client pages (user JWT) vs API routes (service role), and SECURITY DEFINER functions/triggers/cron (owner context — bypass RLS). A user-JWT client read/write is the one that breaks when RLS is enabled without a matching policy.
- Recursion-safe admin policies: when a policy on a table needs to check a role stored in that same table (e.g. `role_based_access_control`), call a SECURITY DEFINER helper (owner context bypasses RLS) — never inline a self-referencing subquery, which recurses infinitely.
- After enabling RLS, verify per-table policy counts (`pg_policies`) and functionally exercise every user-JWT path that touches the table (e.g. the admin-portal login reads its own `role_based_access_control` row).

Detection checklist: whenever an audit/security-advisory enumerates RLS-disabled tables, or a "locked down" table is reachable from a client, confirm against the live `pg_class.relrowsecurity` snapshot and the table's actual reader/writer inventory before changing anything.

## BP-74: Tier-1 Harness Verification of a DB-Triggered Notification Must Assert on the Linkage Key (`user_notifications.data.ledger_id` ↔ `sp_ledger.id`), Never a Fuzzy/Shared Filter Helper
Problem: A Tier-1 live-verification harness verified the `spend_purchase` reserve row on `sp_ledger` (the DT-19 ledger fix), but its notification check FALSE-FAILed: it filtered `user_notifications` through a shared "recent notifications" helper that kept only rows where `data.ledger_id` was NULL OR `data.trade_id` was present — silently dropping the `sp_spent`/`sp_refunded` rows, which DO carry a non-null `data.ledger_id` (DT-19, 2026-08-28). The notification actually existed and matched the ledger row; only the harness filter was wrong. Cost: an extra investigation round on a false negative.

Rules:
- When a Tier-1 harness verifies a notification created by the `sp_ledger` triggers (`send_sp_transaction_notification` → `create_sp_notification`), assert DIRECTLY on the linkage key: `SELECT * FROM user_notifications WHERE user_id = <buyer> AND data->>'ledger_id' = <sp_ledger_row_id>`. The notification row is joined to the ledger row by `data.ledger_id` — obtain that id from the `sp_ledger` row you already verified and anchor the assertion on it, not on fuzzy body/title text or a broad recency filter.
- NEVER funnel a side-effect assertion through a shared "recent rows" helper that applies its own predicate (e.g. keeping only rows with `data.trade_id` or a NULL `data.ledger_id`) — such a helper can silently exclude the very row being asserted and turn a PASS into a false FAIL.
- When a harness check false-fails, confirm the "absence" with a direct, unfiltered read keyed on the exact linkage id before treating it as a product bug (DT-19 S3 "refunded notification": present and correct — the harness filter was the only defect).

Detection checklist: in any Tier-1 harness asserting a `user_notifications` side effect, grep the filter predicate — if it is not `data->>'ledger_id' = <id>` (or the equivalent direct-key equality), rewrite the assertion; verify the notification via a direct query keyed on `data.ledger_id`. Cross-ref BP-72 (read the DB row directly, not the UI response) and BP-31 (verify both trigger AND RPC layers).

## BP-76: Enum-Like Status/Reason Values Must Use One Canonical Literal Across DB Writer, Triggers, and Client — Never a Display String in a Machine-Compared Column
Problem: DB RPCs/triggers write enum-like values into machine-compared columns (`trades.cancellation_reason`, status, state) as human display strings — e.g. the expiry processor writes `'Offer expired'` (capital O + space) — while downstream consumers compare snake-case machine literals. The mobile client's fetch filter (`TradeListScreen.tsx` L358 `.in('cancellation_reason', ['seller_declined', 'offer_expired'])` and its memo filter `=== 'offer_expired'`) and even another DB trigger (`fn_reset_unanswered_counter`'s guard `IS DISTINCT FROM 'offer_expired'`) compare the snake form. The strings never match → features silently break with no error: expired offers never surface in the buyer's "Your Offers", and the seller-ignore streak resets to 0 on every expiry so the 2-consecutive-unanswered-offer prompt can never fire. Found live 2026-08-28 (TRD re-verify run: `rpc_process_expired_offers` writes `'Offer expired'`; the declined branch worked only because the decline EFs write `'seller_declined'` snake, which matches).

Rules:
- When a DB function/trigger writes an enum-like value (status, reason, event type, state), write the canonical **snake-case machine literal** (`'offer_expired'`, `'seller_declined'`, `'buyer_cancelled'`) so both DB triggers AND the mobile client can match it exactly. If a human-readable display string is genuinely needed for the UI, derive it in the client from the canonical value (or keep a separate display column) — never store the display string in the machine-compared column.
- Before authoring/applying any function that sets or compares one of these literals, grep BOTH forms repo-wide (migrations + Edge Functions + mobile client) — e.g. `rg -n "offer_expired" supabase p2p-kids-marketplace/src` AND `rg -n "'Offer expired'" supabase p2p-kids-marketplace/src`. One canonical value per semantic; if both forms exist, reconcile to one before shipping (prefer fixing the WRITER side — fewest call sites).
- Trigger guards that must NOT act on a specific reason (e.g. don't reset the seller-ignore streak on expiry) must compare the exact literal the writer emits — a snake/spaced mismatch flips a "keep" into a "reset" (the live `fn_reset_unanswered_counter` case).
- Cross-layer check when judging a surfaced/expired UI case: compare the client's literal against the LIVE DB value (`SELECT DISTINCT cancellation_reason FROM trades`) — a silent no-error mismatch means the literals differ, not that the feature "just doesn't render".

Detection checklist: an expired/declined offer missing from the app's "Your Offers", or a counter resetting unexpectedly on expiry, with no error → compare the client/trigger literal against the live DB value in `trades.cancellation_reason`; a `'offer_expired'` vs `'Offer expired'` difference is the bug. Cross-ref BP-3 (silent mis-filtering), BP-16 (stale trigger comments), BP-31 (verify both trigger AND RPC layers).
