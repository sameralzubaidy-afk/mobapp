-- =====================================================
-- FILE: supabase/migrations/302_safety_p003_add_appeal_reason.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-P003 appeal reason capture
-- SQL-0 MODE: Mode B (idempotent rerunnable migration)
-- =====================================================

-- BLOCK 1 - Schema
-- 1) Add appeal metadata columns for seller appeal context
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS appeal_reason TEXT,
ADD COLUMN IF NOT EXISTS appealed_at TIMESTAMPTZ;

-- 2) Column verification
-- Expected: two rows, appeal_reason + appealed_at
SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'items'
  AND c.column_name IN ('appeal_reason', 'appealed_at')
ORDER BY c.column_name;

-- BLOCK 2 - Security + Performance
-- 1) Index supports admin queue ordering/filtering for appealed flagged items
CREATE INDEX IF NOT EXISTS idx_items_appealed_at_flagged
  ON public.items (appealed_at DESC)
  WHERE status = 'flagged' AND appealed_at IS NOT NULL;

-- 2) RLS verification (existing policy should remain enabled)
SELECT p.tablename, p.rowsecurity
FROM pg_tables p
WHERE p.schemaname = 'public'
  AND p.tablename = 'items';

SELECT pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check
FROM pg_policies pol
WHERE pol.schemaname = 'public'
  AND pol.tablename = 'items'
ORDER BY pol.policyname;

-- 3) Index verification
SELECT i.indexname, i.indexdef
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.tablename = 'items'
  AND i.indexname = 'idx_items_appealed_at_flagged';

-- Common failure modes
-- 1) Missing relation or wrong schema name: ensure table is public.items.
-- 2) RLS confusion after deploy: verify seller/admin visibility policy still exists on items.
-- 3) Null appeal reason in admin review: ensure mobile app sends appeal_reason in update payload.

-- Rollback (safe forward-compatible rollback)
-- DROP INDEX IF EXISTS public.idx_items_appealed_at_flagged;
-- ALTER TABLE public.items DROP COLUMN IF EXISTS appealed_at;
-- ALTER TABLE public.items DROP COLUMN IF EXISTS appeal_reason;
