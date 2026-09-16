-- SAFETY-001: Cleanup script for incomplete cpsc_recalls table
-- Run this BEFORE running 303_cpsc_recalls_schema.sql if you got "recall_number does not exist" error

-- Drop incomplete table and related objects
DROP TABLE IF EXISTS public.cpsc_recalls CASCADE;
DROP TABLE IF EXISTS public.cpsc_import_log CASCADE;

-- Drop triggers if they exist
-- FIX-Task-40 phase 3: `DROP TRIGGER IF EXISTS <name> ON <table>` still requires the
-- TABLE to exist. In the chain `303_cpsc_cleanup` sorts BEFORE
-- `303_cpsc_recalls_schema` (which creates cpsc_recalls), so the table is always
-- absent at this point and the two statements aborted the whole replay. Guarded so
-- this manual-cleanup helper becomes a no-op on a fresh rebuild - which is exactly
-- its documented purpose ("run this BEFORE running 303_cpsc_recalls_schema.sql if
-- you got 'recall_number does not exist'"). The DROP TABLE / DROP FUNCTION lines are
-- already table-independent.
DO $$
BEGIN
  IF to_regclass('public.cpsc_recalls') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_cpsc_recalls_updated_at ON public.cpsc_recalls;
    DROP TRIGGER IF EXISTS update_cpsc_recalls_keywords ON public.cpsc_recalls;
  END IF;
END $$;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_cpsc_recalls_updated_at();
DROP FUNCTION IF EXISTS update_cpsc_recalls_keywords();

-- Verify cleanup
SELECT 'Cleanup complete. Now run 303_cpsc_recalls_schema.sql' AS status;
