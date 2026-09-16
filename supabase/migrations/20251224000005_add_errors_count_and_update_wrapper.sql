-- Migration: Add errors_count column to auto_complete_runs and update wrapper to populate it
-- Date: 2025-12-27

-- 1) Add `errors_count` column if missing, set default 0 and normalize existing NULLs
ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS errors_count integer NOT NULL DEFAULT 0;

UPDATE public.auto_complete_runs SET errors_count = 0 WHERE errors_count IS NULL;

-- 2) Replace wrapper function to compute errors_count and insert it explicitly
CREATE OR REPLACE FUNCTION public.scheduled_auto_complete_trades()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  candidate RECORD;
  results jsonb := '[]'::jsonb;
  item_result jsonb;
  processed_count int := 0;
  errors_count int := 0;
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
        -- If complete_trade_v2 returns null or non-json, wrap safely
        IF item_result IS NULL THEN
          item_result := jsonb_build_object('ok', true);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        item_result := jsonb_build_object('error', SQLERRM);
      END;

      -- If there was an outer error (from EXCEPTION outer), we might have put an object with 'error' at top-level
      -- To be consistent, record each entry with either 'result' or 'error' field
      IF (item_result ? 'error') THEN
        results := results || jsonb_build_array(jsonb_build_object('trade_id', candidate.id, 'result', item_result));
      ELSE
        results := results || jsonb_build_array(jsonb_build_object('trade_id', candidate.id, 'result', item_result));
      END IF;

      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object('trade_id', candidate.id, 'error', SQLERRM));
    END;
  END LOOP;

  -- Compute errors_count: elements that have top-level 'error' or whose 'result' contains 'error'
  SELECT count(*) INTO errors_count
  FROM jsonb_array_elements(results) elem
  WHERE (elem ? 'error') OR ((elem->'result') ? 'error');

  INSERT INTO public.auto_complete_runs (invoked_by, job_payload, result, processed_count, errors_count)
  VALUES ('pg_cron'::text, jsonb_build_object('cutoff_days','7'), jsonb_build_object('processed_count', processed_count, 'results', results), processed_count, errors_count);

  RETURN jsonb_build_object('run_at', now(), 'processed_count', processed_count, 'errors_count', errors_count, 'results', results);
END;
$$;

-- Verification queries:
-- SELECT * FROM public.auto_complete_runs ORDER BY run_at DESC LIMIT 10;
-- SELECT public.scheduled_auto_complete_trades();
