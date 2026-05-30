-- File: supabase/migrations/20260528000004_offer_expiry_cron.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (TFV2-004)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Auto-decline stale pending offers.
-- 2) Keep listing_offer_stats unanswered counters aligned.
-- 3) Provide cron-safe RPC and scheduler wiring for process-expired-offers edge function.

-- -----------------------------------------------------------------------------
-- 1) Auto-decline competing offers when a trade moves to payment processing.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_decline_competing_offers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'payment_processing' THEN
    RETURN NEW;
  END IF;

  UPDATE public.trades t
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Another offer accepted',
    updated_at = now(),
    last_status_change_at = now()
  WHERE t.listing_id = NEW.listing_id
    AND t.id <> NEW.id
    AND t.status = 'pending';

  UPDATE public.listing_offer_stats los
  SET
    unanswered_offer_count = 0,
    updated_at = now()
  WHERE los.listing_id = NEW.listing_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_decline_competing_offers ON public.trades;
CREATE TRIGGER trigger_auto_decline_competing_offers
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_decline_competing_offers();

-- -----------------------------------------------------------------------------
-- 2) Set auto_complete_at on transition to in_progress.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_auto_complete_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_auto_complete_hours integer := 72;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'in_progress' THEN
    RETURN NEW;
  END IF;

  IF NEW.auto_complete_at IS NULL THEN
    v_auto_complete_hours := public.fn_trade_config_int('auto_complete_hours', 72);
    NEW.auto_complete_at := now() + make_interval(hours => v_auto_complete_hours);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_auto_complete_at ON public.trades;
CREATE TRIGGER trigger_set_auto_complete_at
BEFORE UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_auto_complete_at();

-- -----------------------------------------------------------------------------
-- 3) Keep unanswered counter in sync for non-expiry seller actions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('payment_processing', 'cancelled') THEN
    IF NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'Offer expired' THEN
      RETURN NEW;
    END IF;

    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = GREATEST(0, los.unanswered_offer_count - 1),
      updated_at = now()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_unanswered_counter ON public.trades;
CREATE TRIGGER trigger_update_unanswered_counter
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_unanswered_counter();

-- -----------------------------------------------------------------------------
-- 4) RPC: process expired pending offers in batches.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_process_expired_offers(
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
  WITH expired_candidates AS (
    SELECT t.id, t.listing_id
    FROM public.trades t
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at <= now()
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  ),
  updated_trades AS (
    UPDATE public.trades t
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Offer expired',
      updated_at = now(),
      last_status_change_at = now()
    FROM expired_candidates ec
    WHERE t.id = ec.id
    RETURNING t.id, t.listing_id
  ),
  listing_counts AS (
    SELECT ut.listing_id, COUNT(*)::integer AS expired_count
    FROM updated_trades ut
    GROUP BY ut.listing_id
  )
  UPDATE public.listing_offer_stats los
  SET
    unanswered_offer_count = GREATEST(0, los.unanswered_offer_count - lc.expired_count),
    updated_at = now()
  FROM listing_counts lc
  WHERE los.listing_id = lc.listing_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'expired_offers_processed', v_updated_count,
    'processed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_process_expired_offers(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Scheduler wiring: call edge function every 5 minutes.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_sql text;
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
    RAISE NOTICE 'Skipping process-expired-offers cron schedule: missing base URL or service role key setting';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'process-expired-offers';

    v_job_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/process-expired-offers',
      v_service_role_key
    );

    PERFORM cron.schedule(
      'process-expired-offers',
      '*/5 * * * *',
      v_job_sql
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verification queries
-- -----------------------------------------------------------------------------
-- SELECT public.rpc_process_expired_offers(25);
--
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
--   AND event_object_table = 'trades'
--   AND trigger_name IN (
--     'trigger_auto_decline_competing_offers',
--     'trigger_set_auto_complete_at',
--     'trigger_update_unanswered_counter'
--   )
-- ORDER BY trigger_name;
--
-- SELECT jobname, schedule, command
-- FROM cron.job
-- WHERE jobname = 'process-expired-offers';
--
-- Common failure modes:
-- 1) Missing pg_cron or pg_net extension: schedule section safely no-ops.
-- 2) Missing app/custom runtime settings for service auth: schedule no-ops with NOTICE.
-- 3) Trigger ordering conflicts: verify cancellation reason checks when combining with other status triggers.
