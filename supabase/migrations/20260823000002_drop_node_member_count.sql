-- File: supabase/migrations/20260823000002_drop_node_member_count.sql
-- Purpose: Deprecate the stale `nodes.member_count` counter + its RPCs.
--
-- Mode B: idempotent / rerunnable (DROP ... IF EXISTS everywhere).
--
-- Context: `nodes.member_count` was a client-maintained counter — incremented
-- only on signup via `increment_node_member_count()` (mobile profile.ts) with
-- NO decrement path, never backfilled for historical assignments, and hardcoded
-- in seed data (Test Node 1 = 100 with 0 real profiles). The admin /nodes page
-- now computes membership LIVE from `profiles.node_id` via `admin_node_kpis`
-- (see docs/flow-registry.md FLOW-03 NODE-MEMBER-COUNT-LIVE). Nothing in the
-- codebase reads the stored column for logic anymore (grep on 2026-08-23:
-- admin uses live count only; mobile has no reads; no reporting/analytics
-- consumer exists). This migration removes the dead column, its index, and the
-- two RPCs.
--
-- ⚠️ APPROVAL-GATED: authored for local commit only. Do NOT apply to staging
--    until Samer approves (standing DB-change discipline). Safe to apply after
--    the code changes that stopped writing it have shipped.

-- ============================================================================
-- BLOCK 1: Drop RPCs (they reference the column in their bodies)
-- ============================================================================
DROP FUNCTION IF EXISTS public.increment_node_member_count(UUID);
DROP FUNCTION IF EXISTS public.decrement_node_member_count(UUID);

-- ============================================================================
-- BLOCK 2: Drop the column index + column (column CHECK constraint is dropped
--          implicitly with the column)
-- ============================================================================
DROP INDEX IF EXISTS public.idx_nodes_member_count;

ALTER TABLE public.nodes
  DROP COLUMN IF EXISTS member_count;

-- ============================================================================
-- VERIFICATION (run one statement at a time — result-granularity rule):
--  1) Functions gone (expect 0 rows):
--     SELECT proname FROM pg_proc
--     WHERE proname IN ('increment_node_member_count', 'decrement_node_member_count');
--
--  2) Column gone (expect 0 rows):
--     SELECT column_name FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'nodes'
--       AND column_name = 'member_count';
--
--  3) Index gone (expect 0 rows):
--     SELECT indexname FROM pg_indexes
--     WHERE schemaname = 'public' AND tablename = 'nodes'
--       AND indexname = 'idx_nodes_member_count';
--
--  4) Admin live count still works (expect JSONB array with per-node users):
--     SELECT public.admin_node_kpis(NULL);
-- ============================================================================

-- ============================================================================
-- DB OBJECT CHECKLIST (SQL-6)
--   - Dropped objects: increment_node_member_count, decrement_node_member_count,
--     idx_nodes_member_count, nodes.member_count.
--   - Nothing else is created/modified. No RLS changes (nodes RLS untouched).
--   - The mobile signup path no longer calls these RPCs (profile.ts/location.ts
--     cleaned up in the same change) — safe to drop once code is deployed.
--   - Legacy `geographic_nodes.member_count` (pre-008 unify table) is NOT
--     touched — historical, unused by live code.
-- ============================================================================
