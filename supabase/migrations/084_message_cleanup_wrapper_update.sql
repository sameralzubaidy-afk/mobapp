-- ================================================================
-- Migration: 084_message_cleanup_wrapper_update.sql
-- Module: MODULE-07 MSG-005 - Message Cleanup Wrapper Update
-- Description: Update scheduled_message_cleanup() to accept p_invoked_by + p_job_payload
--              so Edge Function / cron runs are logged consistently.
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

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
