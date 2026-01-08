-- ================================================================
-- Migration: 083_message_cleanup_audit.sql
-- Module: MODULE-07 MSG-005 - Message Cleanup Audit Table
-- Description: Add audit table and wrapper function for message cleanup, 
--              matching the pattern used for auto-complete-trades.
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Schema
-- ================================================================

-- 1. Create audit table for message cleanup runs
CREATE TABLE IF NOT EXISTS public.message_cleanup_runs (
  id serial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  invoked_by text,           -- 'edge_function', 'pg_cron', 'manual'
  job_payload jsonb,         -- Parameters used for the run
  result jsonb,              -- Summary of results (processed counts, etc.)
  error text,                -- Error message if the run failed at the top level
  processed_count integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0
);

-- Add indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_message_cleanup_runs_run_at ON public.message_cleanup_runs(run_at DESC);

-- 2. Create/update wrapper function for scheduled cleanup
-- This mirrors the pattern in scheduled_auto_complete_trades()
CREATE OR REPLACE FUNCTION public.scheduled_message_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_errors_count INTEGER := 0;
  v_results jsonb;
  v_error_msg text;
BEGIN
  -- Call the core logic
  BEGIN
    SELECT mark_expired_messages() INTO v_deleted_count;
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    v_results := jsonb_build_object('error', v_error_msg, 'hint', SQLHINT);
    v_errors_count := 1;
    
    INSERT INTO public.message_cleanup_runs (invoked_by, error, errors_count, job_payload, result)
    VALUES ('system', v_error_msg, v_errors_count, jsonb_build_object('action', 'cleanup-messages'), v_results);
    
    RETURN v_results;
  END;

  v_results := jsonb_build_object(
    'processed_count', v_deleted_count,
    'status', 'success'
  );

  -- Log the run
  INSERT INTO public.message_cleanup_runs (invoked_by, result, processed_count, errors_count, job_payload)
  VALUES ('system', v_results, v_deleted_count, 0, jsonb_build_object('action', 'cleanup-messages', 'description', 'Daily automated cleanup'));

  RETURN jsonb_build_object(
    'run_at', now(), 
    'processed_count', v_deleted_count, 
    'errors_count', 0, 
    'result', v_results
  );
END;
$$;

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify table and columns
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='message_cleanup_runs' ORDER BY ordinal_position;

-- Verify function exists
-- SELECT proname FROM pg_proc WHERE proname = 'scheduled_message_cleanup';

-- Test run (Manual)
-- SELECT public.scheduled_message_cleanup();

-- Check logs
-- SELECT * FROM public.message_cleanup_runs ORDER BY run_at DESC LIMIT 5;
