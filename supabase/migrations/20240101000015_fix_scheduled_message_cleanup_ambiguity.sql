-- Migration: Fix scheduled_message_cleanup ambiguity
-- Module: MODULE-07 MSG-005 - Fix Duplicate Function Overloads
-- Date: 2026-01-09
-- Description: Drop ambiguous no-parameter version of scheduled_message_cleanup()
--              Keep only the parameterized version (which has defaults)
-- Mode: B (Idempotent rerunnable migration)

-- ================================================================
-- BLOCK 1: Drop old no-parameter version
-- ================================================================

-- Drop the no-parameter version that's causing ambiguity
DROP FUNCTION IF EXISTS public.scheduled_message_cleanup() CASCADE;

-- ================================================================
-- BLOCK 2: Ensure the parameterized version exists with defaults
-- ================================================================

-- This version has default parameters so it can be called:
-- - SELECT scheduled_message_cleanup();  (uses all defaults)
-- - SELECT scheduled_message_cleanup('pg_cron', '{...}');  (with parameters)
CREATE OR REPLACE FUNCTION public.scheduled_message_cleanup(
  p_invoked_by text DEFAULT 'system',
  p_job_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_errors_count integer := 0;
  v_results jsonb;
  v_error_msg text;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('action', 'cleanup-messages') || COALESCE(p_job_payload, '{}'::jsonb);

  -- Call the core logic
  BEGIN
    SELECT mark_expired_messages() INTO v_deleted_count;
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    v_errors_count := 1;
    v_results := jsonb_build_object('status', 'error', 'error', v_error_msg);

    INSERT INTO public.message_cleanup_runs (invoked_by, error, errors_count, job_payload, result, processed_count)
    VALUES (p_invoked_by, v_error_msg, v_errors_count, v_payload, v_results, 0);

    RETURN jsonb_build_object(
      'run_at', now(),
      'processed_count', 0,
      'errors_count', v_errors_count,
      'result', v_results
    );
  END;

  v_results := jsonb_build_object(
    'status', 'success',
    'processed_count', v_deleted_count
  );

  INSERT INTO public.message_cleanup_runs (invoked_by, result, processed_count, errors_count, job_payload)
  VALUES (p_invoked_by, v_results, v_deleted_count, 0, v_payload);

  RETURN jsonb_build_object(
    'run_at', now(),
    'processed_count', v_deleted_count,
    'errors_count', 0,
    'result', v_results
  );
END;
$$;

-- ================================================================
-- BLOCK 3: Verification Queries
-- ================================================================

-- Verify there's only ONE version of the function now
-- SELECT proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p
-- WHERE proname = 'scheduled_message_cleanup'
-- AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: 1 row with args "(text, jsonb)" or similar

-- Test the function can be called without parameters
-- SELECT public.scheduled_message_cleanup();

-- Test the function can be called with parameters
-- SELECT public.scheduled_message_cleanup('manual', '{"test": true}'::jsonb);

-- Check cron job is still configured
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'cleanup-expired-messages';

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback (restore both versions, though not recommended):
-- DROP FUNCTION IF EXISTS public.scheduled_message_cleanup(text, jsonb);
-- Then re-run migrations 083 and 084 to recreate both versions
-- (Better to just keep the single parameterized version)
