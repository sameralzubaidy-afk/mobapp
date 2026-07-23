-- File: supabase/migrations/20260528000005_auto_complete_cron.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (TFV2-005)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Auto-complete eligible in-progress trades.
-- 2) Release pending SP after configured delay.
-- 3) Schedule edge functions for both jobs.

-- -----------------------------------------------------------------------------
-- 1) Auto-complete eligible trades (guard unresolved disputes).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_process_auto_complete(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  WITH eligible_trades AS (
    SELECT t.id
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (
        t.disputed_at IS NULL
        OR t.dispute_resolution IS NOT NULL
      )
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  )
  UPDATE public.trades t
  SET
    status = 'completed',
    completed_at = COALESCE(t.completed_at, now()),
    updated_at = now(),
    last_status_change_at = now()
  FROM eligible_trades et
  WHERE t.id = et.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'auto_completed_count', v_updated_count,
    'processed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Release pending SP after pending_sp_release_at.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_release_pending_sp(
  p_batch_size integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count integer := 0;
BEGIN
  WITH ready_trades AS (
    SELECT t.id, t.seller_id, COALESCE(t.sp_earned_at_completion, 0) AS sp_points
    FROM public.trades t
    WHERE t.status = 'completed'
      AND t.pending_sp_release_at IS NOT NULL
      AND t.pending_sp_release_at <= now()
      AND t.sp_released_at IS NULL
      AND COALESCE(t.sp_earned_at_completion, 0) > 0
    ORDER BY t.pending_sp_release_at ASC
    LIMIT p_batch_size
  ),
  grouped_points AS (
    SELECT rt.seller_id, SUM(rt.sp_points)::integer AS total_points
    FROM ready_trades rt
    GROUP BY rt.seller_id
  ),
  wallet_updates AS (
    UPDATE public.sp_wallets w
    SET
      pending_balance = GREATEST(0, w.pending_balance - gp.total_points),
      available_balance = w.available_balance + gp.total_points,
      updated_at = now()
    FROM grouped_points gp
    WHERE w.user_id = gp.seller_id
    RETURNING w.user_id
  ),
  trades_update AS (
    UPDATE public.trades t
    SET
      sp_released_at = now(),
      updated_at = now()
    FROM ready_trades rt
    WHERE t.id = rt.id
    RETURNING t.id
  ),
  notification_insert AS (
    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    SELECT
      gp.seller_id,
      'sp_events',
      'sp_released',
      'Swap Points Released',
      format('%s SP moved from pending to available balance.', gp.total_points),
      jsonb_build_object('sp_released', gp.total_points, 'processed_at', now())
    FROM grouped_points gp
    RETURNING 1
  )
  SELECT count(*) INTO v_released_count FROM trades_update;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'processed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_release_pending_sp(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Scheduler wiring for auto-complete + pending release.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_auto_complete_sql text;
  v_release_pending_sql text;
BEGIN
  v_base_url := COALESCE(
    current_setting('app.edge_function_base_url', true),
    current_setting('custom.edge_function_base_url', true)
  );

  v_service_role_key := COALESCE(
    current_setting('app.service_role_key', true),
    current_setting('custom.service_role_key', true)
  );

  IF v_base_url IS NULL OR v_service_role_key IS NULL OR v_base_url = '' OR v_service_role_key = '' THEN
    RAISE NOTICE 'Skipping auto-complete/release schedules: missing base URL or service role key setting';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'process-auto-complete';

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'release-pending-sp';

    v_auto_complete_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/process-auto-complete',
      v_service_role_key
    );

    v_release_pending_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/release-pending-sp',
      v_service_role_key
    );

    PERFORM cron.schedule('process-auto-complete', '*/15 * * * *', v_auto_complete_sql);
    PERFORM cron.schedule('release-pending-sp', '0 * * * *', v_release_pending_sql);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verification queries
-- -----------------------------------------------------------------------------
-- SELECT public.rpc_process_auto_complete(25);
-- SELECT public.rpc_release_pending_sp(25);
--
-- SELECT jobname, schedule, command
-- FROM cron.job
-- WHERE jobname IN ('process-auto-complete', 'release-pending-sp')
-- ORDER BY jobname;
--
-- Common failure modes:
-- 1) Missing user_notifications table: notification insert will fail (ensure notifications migrations are applied).
-- 2) Missing wallet rows for sellers: pending release updates no-op for those users.
-- 3) Dispute fields not present in older trades: ensure 20260528000002 ran successfully first.
