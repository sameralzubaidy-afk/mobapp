-- File: supabase/migrations/20260219000001_cron_observability_rpc.sql
-- Purpose: Reliable pg_cron observability with one row per job + timezone-safe rendering
-- Mode: B (idempotent rerunnable migration)

-- 1) Latest run per cron job (one row per jobid)
CREATE OR REPLACE FUNCTION public.get_cron_jobs_with_last_run(
  p_include_inactive boolean DEFAULT true,
  p_timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database_name text,
  username text,
  active boolean,
  last_runid bigint,
  last_status text,
  last_return_message text,
  last_start_time_utc timestamptz,
  last_end_time_utc timestamptz,
  last_start_time_local timestamp,
  last_end_time_local timestamp,
  has_recent_run boolean,
  appears_future_in_local_time boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  WITH v_latest_runs AS (
    SELECT DISTINCT ON (jrd.jobid)
      jrd.jobid,
      jrd.runid,
      jrd.status,
      jrd.return_message,
      jrd.start_time,
      jrd.end_time
    FROM cron.job_run_details jrd
    ORDER BY jrd.jobid, jrd.start_time DESC
  )
  SELECT
    j.jobid::bigint AS jobid,
    j.jobname::text AS jobname,
    j.schedule::text AS schedule,
    j.command::text AS command,
    j.nodename::text AS nodename,
    j.nodeport::integer AS nodeport,
    j.database::text AS database_name,
    j.username::text AS username,
    j.active::boolean AS active,
    lr.runid::bigint AS last_runid,
    COALESCE(lr.status::text, 'never_run'::text) AS last_status,
    lr.return_message::text AS last_return_message,
    lr.start_time::timestamptz AS last_start_time_utc,
    lr.end_time::timestamptz AS last_end_time_utc,
    timezone(p_timezone, lr.start_time)::timestamp AS last_start_time_local,
    timezone(p_timezone, lr.end_time)::timestamp AS last_end_time_local,
    (lr.runid IS NOT NULL)::boolean AS has_recent_run,
    (
      lr.start_time IS NOT NULL
      AND timezone(p_timezone, lr.start_time)::timestamp > timezone(p_timezone, now())::timestamp
    )::boolean AS appears_future_in_local_time
  FROM cron.job j
  LEFT JOIN v_latest_runs lr ON lr.jobid = j.jobid
  WHERE p_include_inactive OR j.active = true
  ORDER BY j.jobid ASC;
$$;

COMMENT ON FUNCTION public.get_cron_jobs_with_last_run(boolean, text)
IS 'Returns exactly one row per pg_cron job, including latest run metadata. Use p_timezone for local rendering to avoid UTC "future" confusion.';

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_with_last_run(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_jobs_with_last_run(boolean, text) TO service_role;

-- 2) Raw recent runs with timezone-normalized columns for UI usage
CREATE OR REPLACE FUNCTION public.get_cron_recent_runs(
  p_lookback_hours integer DEFAULT 48,
  p_limit integer DEFAULT 500,
  p_timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  jobid bigint,
  runid bigint,
  status text,
  return_message text,
  start_time_utc timestamptz,
  end_time_utc timestamptz,
  start_time_local timestamp,
  end_time_local timestamp,
  jobname text,
  schedule text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    jrd.jobid::bigint AS jobid,
    jrd.runid::bigint AS runid,
    jrd.status::text AS status,
    jrd.return_message::text AS return_message,
    jrd.start_time::timestamptz AS start_time_utc,
    jrd.end_time::timestamptz AS end_time_utc,
    timezone(p_timezone, jrd.start_time)::timestamp AS start_time_local,
    timezone(p_timezone, jrd.end_time)::timestamp AS end_time_local,
    j.jobname::text AS jobname,
    j.schedule::text AS schedule,
    j.active::boolean AS active
  FROM cron.job_run_details jrd
  LEFT JOIN cron.job j ON j.jobid = jrd.jobid
  WHERE jrd.start_time >= now() - make_interval(hours => p_lookback_hours)
  ORDER BY jrd.start_time DESC
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.get_cron_recent_runs(integer, integer, text)
IS 'Returns recent pg_cron runs with both UTC and local timestamps.';

GRANT EXECUTE ON FUNCTION public.get_cron_recent_runs(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_recent_runs(integer, integer, text) TO service_role;

-- Verification queries
-- A) One row per active job (no missing jobs)
-- SELECT * FROM public.get_cron_jobs_with_last_run(false, 'America/Los_Angeles');

-- B) Recent run stream with local timestamps
-- SELECT * FROM public.get_cron_recent_runs(48, 500, 'America/Los_Angeles');

-- C) Detect active jobs with no run history yet
-- SELECT *
-- FROM public.get_cron_jobs_with_last_run(false, 'UTC') r
-- WHERE r.last_status = 'never_run';

-- Common failure modes notes
-- 1) Invalid timezone value in p_timezone -> timezone() will error.
-- 2) Job was recently created -> last_status = 'never_run' until first schedule fires.
-- 3) Querying cron.job_run_details with hard LIMIT can hide low-frequency jobs behind hourly jobs.
