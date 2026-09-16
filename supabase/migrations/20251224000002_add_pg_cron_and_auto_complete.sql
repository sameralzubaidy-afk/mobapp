-- Migration: Add pg_cron enablement (best-effort), audit table, scheduled function,
-- and create cron job (if pg_cron is available).
-- Date: 2025-12-26

/*
BLOCK 1 — Schema, extension (best-effort), audit table, scheduled function

Run this block first. It will:
 - attempt to create schema `cron` and enable extension `pg_cron` (may fail on managed DBs)
 - create an audit table `auto_complete_runs`
 - create a SQL wrapper `scheduled_auto_complete_trades()` which calls `complete_trade_v2` for eligible trades

Verification after Block 1:
  - Check `pg_extension` for `pg_cron`
  - Check `auto_complete_runs` exists
  - Call `SELECT scheduled_auto_complete_trades()` manually (test run)

If `CREATE EXTENSION` fails due to permissions, you can either:
  - Request the DB owner or Supabase support to enable `pg_cron`, OR
  - Use an external scheduler (GitHub Actions) to invoke the Edge Function.
*/

-- Attempt to create the cron schema and enable pg_cron — fail noisily but continue.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS cron';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create schema "cron": %', SQLERRM;
  END;

  BEGIN
    -- Try to create extension in the cron schema. This will fail if not allowed.
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron';
    RAISE NOTICE 'pg_cron extension enabled (or already present)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension could not be created here: %', SQLERRM;
  END;
END$$;

-- Audit table for scheduled runs (idempotent)
CREATE TABLE IF NOT EXISTS public.auto_complete_runs (
  id serial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  invoked_by text,
  job_payload jsonb,
  result jsonb,
  error text
);

-- Scheduled wrapper function: calls internal RPC `complete_trade_v2(trade_id)` on eligible trades
-- Returns a JSON summary of processed trade ids and results.
CREATE OR REPLACE FUNCTION public.scheduled_auto_complete_trades()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  candidate RECORD;
  results jsonb := '[]'::jsonb;
  item_result jsonb;
  processed_count int := 0;
BEGIN
  FOR candidate IN
    SELECT id
    FROM trades
    WHERE status = 'in_progress'
      AND (
        (seller_marked_completed_at IS NOT NULL AND seller_marked_completed_at < now() - interval '7 days')
        OR (seller_marked_completed_at IS NULL AND created_at < now() - interval '7 days')
      )
  LOOP
    BEGIN
      -- Call the existing RPC that finalizes a trade; capture response if any
      BEGIN
        SELECT complete_trade_v2(candidate.id) INTO item_result;
      EXCEPTION WHEN OTHERS THEN
        item_result := jsonb_build_object('error', SQLERRM);
      END;

      results := results || jsonb_build_array(jsonb_build_object(
        'trade_id', candidate.id,
        'result', item_result
      ));
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'trade_id', candidate.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  INSERT INTO public.auto_complete_runs (invoked_by, job_payload, result)
  VALUES ('pg_cron'::text, jsonb_build_object('cutoff_days','7'), jsonb_build_object('processed_count', processed_count, 'results', results));

  RETURN jsonb_build_object('run_at', now(), 'processed_count', processed_count, 'results', results);
END;
$$;

/*
BLOCK 2 — Schedule creation (safe): create the cron job only if the cron.schedule function exists

Run Block 2 after Block 1. If your DB provider doesn't allow creating the extension,
this block will skip creating the cron job but leave the wrapper function and audit table in place.

Verification after Block 2:
  - Check `cron.job` or use the version-agnostic listing DO block below
  - Query `auto_complete_runs` after a run

Rollback:
  - To remove the scheduled job: call `SELECT cron.unschedule(jobid);` after locating the jobid
  - To drop wrapper function and audit table: DROP FUNCTION public.scheduled_auto_complete_trades(); DROP TABLE public.auto_complete_runs;
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'schedule' AND n.nspname = 'cron'
  ) THEN
    -- Create a named cron job; cron.schedule returns bigint job id in recent versions
    -- Use a plain quoted string for the command to avoid nested dollar-quoting issues inside DO blocks.
    PERFORM cron.schedule('auto_complete_trades_every_12m', '*/12 * * * *', 'SELECT public.scheduled_auto_complete_trades();');
    RAISE NOTICE 'cron job auto_complete_trades_every_12m created (if not existing)';
  ELSE
    RAISE NOTICE 'cron.schedule is not available on this database; skip creating cron job';
  END IF;
END$$;

-- Version-agnostic listing helper (run to inspect created jobs)
-- This DO block will show the most relevant columns depending on the installed pg_cron version.
DO $$
DECLARE
  sql TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'next_start'
  ) THEN
    sql := 'SELECT jobid, schedule, command, nodename, active, next_start FROM cron.job ORDER BY jobid';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'next_run'
  ) THEN
    sql := 'SELECT jobid, schedule, command, nodename, active, next_run FROM cron.job ORDER BY jobid';
  ELSE
    sql := 'SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid';
  END IF;
  RAISE NOTICE '%', sql;
  -- (Don't EXECUTE automatically from migration; operator can run the appropriate SELECT in SQL editor.)
END$$;

-- Verification queries (run interactively after applying migration):
-- 1) Is pg_cron installed?  -> SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
-- 2) Inspect cron.job columns -> SELECT column_name FROM information_schema.columns WHERE table_schema = 'cron' AND table_name = 'job' ORDER BY ordinal_position;
-- 3) Check auto_complete_runs -> SELECT * FROM public.auto_complete_runs ORDER BY run_at DESC LIMIT 10;
-- 4) Manually run the wrapper to test -> SELECT public.scheduled_auto_complete_trades();
