-- ================================================================
-- Migration: 082_message_cleanup_cron.sql
-- Module: MODULE-07 MSG-005 - Auto-Delete Expired Messages (Cron Job)
-- Description: Create pg_cron job to run scheduled_message_cleanup() daily (if pg_cron is available)
-- Mode: B (Idempotent rerunnable migration)
-- NOTE: pg_cron must be enabled by Supabase support. This is OPTIONAL.
-- Alternative: Use Supabase Dashboard → Database → Cron Jobs to schedule cleanup-messages Edge Function
-- ================================================================

-- BLOCK 1: Create cron job (if pg_cron extension is available)
-- ================================================================

-- Check if pg_cron extension is available
-- If not, this will fail gracefully and you should use Supabase Dashboard Cron Jobs instead

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  -- Only attempt to schedule if cron.schedule exists
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'schedule' AND n.nspname = 'cron'
  ) THEN
    -- Unschedule existing job if present (idempotent)
    SELECT j.jobid INTO v_jobid
    FROM cron.job j
    WHERE j.jobname = 'cleanup-expired-messages'
    LIMIT 1;

    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;

    -- Schedule daily cleanup at 2 AM UTC
    PERFORM cron.schedule(
      'cleanup-expired-messages',
      '0 2 * * *',
      'SELECT public.scheduled_message_cleanup();'
    );

    RAISE NOTICE 'Successfully scheduled cleanup-expired-messages cron job';
  ELSE
    RAISE NOTICE 'cron.schedule is not available on this database; skip creating cron job (use external scheduler to invoke cleanup-messages Edge Function).';
  END IF;
END;
$$;

-- ================================================================
-- BLOCK 2: Verification & Alternative Setup Instructions
-- ================================================================

-- Verify cron job exists (if pg_cron is available)
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-messages';

-- Manual execution (for testing)
-- SELECT public.scheduled_message_cleanup();

-- ================================================================
-- ALTERNATIVE: Supabase Dashboard Cron Jobs Setup
-- ================================================================
/*
If pg_cron is NOT enabled in your Supabase project:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Click "Create Cron Job"
3. Configure:
   - Name: cleanup-expired-messages
   - Schedule: 0 2 * * * (2 AM daily UTC)
   - Type: Edge Function
   - Edge Function: cleanup-messages
   - Method: POST
   - Auth: Service Role Key

4. Save

This will invoke the cleanup-messages Edge Function daily at 2 AM UTC.
The Edge Function will call mark_expired_messages() RPC.

MANUAL INVOCATION FOR TESTING:
curl -X POST \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/cleanup-messages' \
  -H 'Authorization: Bearer <YOUR_ANON_KEY>' \
  -H 'Content-Type: application/json'
*/

-- ================================================================
-- Common Failure Modes
-- ================================================================
/*
FAILURE MODE 1: pg_cron extension not enabled
- Error: "extension pg_cron does not exist"
- Solution: Use Supabase Dashboard Cron Jobs instead (see above)

FAILURE MODE 2: Insufficient permissions
- Error: "permission denied to create extension"
- Solution: Contact Supabase support to enable pg_cron OR use Dashboard Cron Jobs

FAILURE MODE 3: Cron job doesn't run
- Check cron.job_run_details for execution history:
  SELECT * FROM cron.job_run_details 
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-messages')
  ORDER BY start_time DESC LIMIT 10;

BEST PRACTICE:
- For Supabase hosted projects, use Dashboard Cron Jobs (more reliable)
- For self-hosted Postgres with pg_cron, this migration works
*/

-- ================================================================
-- Monitoring Query
-- ================================================================
/*
-- Check how many messages were deleted in the last 7 days
SELECT 
  DATE(deleted_at) as deletion_date,
  COUNT(*) as messages_deleted
FROM messages
WHERE deleted_at IS NOT NULL
  AND deleted_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;

-- Check upcoming messages that will expire soon
SELECT 
  COUNT(*) as messages_to_expire_soon
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at < (NOW() - INTERVAL '25 days'); -- 5 days before expiration
*/
