-- SAFETY-001: Cleanup script for incomplete cpsc_recalls table
-- Run this BEFORE running 303_cpsc_recalls_schema.sql if you got "recall_number does not exist" error

-- Drop incomplete table and related objects
DROP TABLE IF EXISTS public.cpsc_recalls CASCADE;
DROP TABLE IF EXISTS public.cpsc_import_log CASCADE;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_cpsc_recalls_updated_at ON public.cpsc_recalls;
DROP TRIGGER IF EXISTS update_cpsc_recalls_keywords ON public.cpsc_recalls;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_cpsc_recalls_updated_at();
DROP FUNCTION IF EXISTS update_cpsc_recalls_keywords();

-- Verify cleanup
SELECT 'Cleanup complete. Now run 303_cpsc_recalls_schema.sql' AS status;
