-- =====================================================
-- FILE: supabase/migrations/20260402000001_safety_009_dynamic_appeal_limits_and_edit_tracking.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-009 dynamic appeal limits + edit tracking
-- SQL-0 MODE: Mode B (idempotent rerunnable migration)
-- =====================================================

-- BLOCK 1 - Schema
-- 1) Track whether seller made edits after a rejection and before appealing.
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS edited_since_rejection BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_since_rejection_at TIMESTAMPTZ;

-- 2) Backfill guard for legacy rows.
UPDATE public.items i
SET edited_since_rejection = FALSE
WHERE i.edited_since_rejection IS NULL;

-- 3) Column verification
SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'items'
  AND c.column_name IN ('edited_since_rejection', 'edited_since_rejection_at')
ORDER BY c.column_name;

-- BLOCK 2 - Security + Performance
-- 1) Seed dynamic moderation settings for seller appeal policy controls.
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES
  (
    'moderation_appeal_max_attempts',
    '3',
    'Maximum number of seller appeal attempts allowed for a rejected listing.',
    'moderation',
    'number',
    FALSE,
    TRUE
  ),
  (
    'moderation_appeal_window_days',
    '14',
    'Appeal submission window in days after listing rejection.',
    'moderation',
    'number',
    FALSE,
    TRUE
  )
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  is_secret = EXCLUDED.is_secret,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2) Config verification
SELECT ac.key, ac.value, ac.data_type, ac.category, ac.is_active
FROM public.admin_config ac
WHERE ac.key IN ('moderation_appeal_max_attempts', 'moderation_appeal_window_days')
ORDER BY ac.key;

-- 3) RLS verification
SELECT p.tablename, p.rowsecurity
FROM pg_tables p
WHERE p.schemaname = 'public'
  AND p.tablename = 'items';

SELECT pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check
FROM pg_policies pol
WHERE pol.schemaname = 'public'
  AND pol.tablename = 'items'
ORDER BY pol.policyname;

-- Common failure modes
-- 1) Missing admin_config key uniqueness: ON CONFLICT (key) requires a unique key column.
-- 2) Legacy rows with null edit-tracking values: backfill statement keeps booleans deterministic.
-- 3) Missing moderation category enum value: ensure 'moderation' exists in admin_config_category.

-- Rollback (safe forward-compatible rollback)
-- DELETE FROM public.admin_config
-- WHERE key IN ('moderation_appeal_max_attempts', 'moderation_appeal_window_days');
-- ALTER TABLE public.items DROP COLUMN IF EXISTS edited_since_rejection_at;
-- ALTER TABLE public.items DROP COLUMN IF EXISTS edited_since_rejection;
