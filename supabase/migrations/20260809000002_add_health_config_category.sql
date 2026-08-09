-- ============================================================================
-- Add 'health' to the admin_config_category enum
-- Mode B: Idempotent Rerunnable Migration
--
-- WHY THIS IS ITS OWN MIGRATION:
--   PostgreSQL raises SQLSTATE 55P04 ("unsafe use of new value ... New enum
--   values must be committed before they can be used") if a newly-ADD VALUE'd
--   enum label is used in the SAME transaction that added it. Each migration
--   file is its own transaction, so this migration commits the new 'health'
--   value, and the health-strip migration that follows it in version order
--   (20260809000003_admin_health_strip.sql) can safely seed rows with
--   category = 'health' — in BOTH a SQL-editor run and `supabase db reset`
--   replay.
--
-- Naming: p_ params, v_ locals, qualified columns (supabase-sql.instructions).
-- ============================================================================

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'health';
  EXCEPTION
    WHEN undefined_object THEN
      -- Legacy environments may not use the enum category at all.
      NULL;
  END;
END;
$$;

-- ============================================================================
-- Verification (run one statement at a time):
--   SELECT e.enumlabel FROM pg_enum e
--   JOIN pg_type t ON t.oid = e.enumtypid
--   WHERE t.typname = 'admin_config_category'
--   ORDER BY e.enumsortorder;
--   -- Expected: ... includes 'health'
-- ============================================================================
