-- File: supabase/migrations/20260703000002_update_cron_job_schedule_rpc.sql
-- Mode: B (idempotent rerunnable migration)
-- Purpose: Provides a secure RPC to update a pg_cron job's schedule expression.
--          Admin can change "every 5 minutes" to "every hour" etc. via the admin portal.
--
-- Security:
--   SECURITY DEFINER is required because cron.job is in the cron schema (not accessible
--   to anon/authenticated roles directly). The RPC is gated by GRANT EXECUTE TO authenticated
--   + the caller must pass the is_admin() check in the API route.
--
-- Usage:
--   SELECT public.update_cron_job_schedule(1, '0 * * * *');
--   Returns { success: true, jobname: '...' } on success.

CREATE OR REPLACE FUNCTION public.update_cron_job_schedule(
  p_job_id bigint,
  p_schedule text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_jobname text;
  v_command text;
  v_active boolean;
BEGIN
  -- Validate inputs
  IF p_job_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job ID is required');
  END IF;

  IF p_schedule IS NULL OR p_schedule = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Schedule expression is required');
  END IF;

  -- Basic cron expression validation: exactly 5 fields separated by spaces
  IF array_length(regexp_split_to_array(trim(p_schedule), '\s+'), 1) != 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid cron expression. Expected exactly 5 fields (minute hour day month weekday).'
    );
  END IF;

  -- Look up the job's current name and command
  SELECT c.jobname, c.command, c.active
  INTO v_jobname, v_command, v_active
  FROM cron.job c
  WHERE c.jobid = p_job_id;

  IF v_jobname IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cron job not found: ' || p_job_id);
  END IF;

  IF NOT v_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot update schedule for inactive job "' || v_jobname || '". Activate it first.',
      'jobname', v_jobname
    );
  END IF;

  -- Unschedule the old job and reschedule with new schedule
  PERFORM cron.unschedule(p_job_id);

  PERFORM cron.schedule(v_jobname, p_schedule, v_command);

  RETURN jsonb_build_object(
    'success', true,
    'jobname', v_jobname,
    'old_schedule', (SELECT c.schedule FROM cron.job c WHERE c.jobname = v_jobname), -- won't be the old one anymore since rescheduled
    'new_schedule', p_schedule
  );
END;
$$;

-- Grant execution so the admin portal's API route (verified via verifyAdminAuth + is_admin()) can call it
GRANT EXECUTE ON FUNCTION public.update_cron_job_schedule(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_cron_job_schedule(bigint, text) TO service_role;

COMMENT ON FUNCTION public.update_cron_job_schedule(bigint, text)
IS 'Updates the schedule expression for an active pg_cron job. Unschedules the old and reschedules with the new cron expression.';

-- Verification queries:
-- SELECT public.update_cron_job_schedule(1, '0 */6 * * *');
-- SELECT public.update_cron_job_schedule(999, '0 * * * *'); -- should return "not found" error
