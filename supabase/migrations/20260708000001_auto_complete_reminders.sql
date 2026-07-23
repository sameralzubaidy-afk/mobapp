-- File: supabase/migrations/20260708000001_auto_complete_reminders.sql
-- Module: MODULE-15.1.2 TradeFlowV2 — Auto-Complete Reminders (TC-G02)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Add ac_reminder_24h_sent_at, ac_reminder_2h_sent_at columns to trades
-- 2) Seed auto_complete_notif_1_hours_before / auto_complete_notif_2_hours_before config
-- 3) Create rpc_send_auto_complete_reminders RPC (data only, returns notifications)
-- 4) Schedule the send-auto-complete-reminders Edge Function (every 5 min)
--
-- Follows same pattern as rpc_send_offer_reminders in 20260609000002_fix_rpc_remove_http_calls.sql

-- =============================================================================
-- 1) Add tracking columns to trades table
-- =============================================================================
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS ac_reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS ac_reminder_2h_sent_at timestamptz;

COMMENT ON COLUMN public.trades.ac_reminder_24h_sent_at IS 
'Timestamp when the 24h-before-auto-complete reminder was sent to the buyer.';

COMMENT ON COLUMN public.trades.ac_reminder_2h_sent_at IS 
'Timestamp when the 2h-before-auto-complete reminder was sent to the buyer.';

-- =============================================================================
-- 2) Seed admin_config keys for auto-complete notification timing
-- =============================================================================
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('auto_complete_notif_1_hours_before', '24', 'First reminder before auto-complete (hours). Default: 24', 'trade', 'number', true),
  ('auto_complete_notif_2_hours_before', '2', 'Final reminder before auto-complete (hours). Default: 2', 'trade', 'number', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 3) rpc_send_auto_complete_reminders — creates in-app notifications + returns push payloads
-- =============================================================================
-- The RPC now does double duty:
--   1) Inserts user_notifications rows directly (in-app notifications)
--   2) Returns notification payloads for the Edge Function to send push via send-trade-notifications
CREATE OR REPLACE FUNCTION public.rpc_send_auto_complete_reminders(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminder_24h_count integer := 0;
  v_reminder_2h_count integer := 0;
  v_in_app_created integer := 0;
  v_in_progress_trade RECORD;
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  -- 24-hour reminders (window: 23h30m to 24h30m before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title as listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + INTERVAL '23 hours 30 minutes'
      AND t.auto_complete_at <= now() + INTERVAL '24 hours 30 minutes'
      AND (t.ac_reminder_24h_sent_at IS NULL OR t.ac_reminder_24h_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET ac_reminder_24h_sent_at = now() WHERE id = v_in_progress_trade.id;
    v_reminder_24h_count := v_reminder_24h_count + 1;

    -- Create in-app notification
    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'ac_reminder_24h',
      'Auto-Complete Soon',
      'Your trade for "' || v_in_progress_trade.listing_title || '" auto-completes in 24h. Got it? Tap ''I Got It''.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'ac_reminder_24h', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', 24)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'ac_reminder_24h',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_in_progress_trade.listing_title,
        'hours_remaining', 24
      )
    );
  END LOOP;

  -- 2-hour reminders (window: 1h30m to 2h30m before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title as listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + INTERVAL '1 hour 30 minutes'
      AND t.auto_complete_at <= now() + INTERVAL '2 hours 30 minutes'
      AND (t.ac_reminder_2h_sent_at IS NULL OR t.ac_reminder_2h_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET ac_reminder_2h_sent_at = now() WHERE id = v_in_progress_trade.id;
    v_reminder_2h_count := v_reminder_2h_count + 1;

    -- Create in-app notification
    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'ac_reminder_2h',
      'Auto-Complete Soon',
      '"' || v_in_progress_trade.listing_title || '" trade auto-completes in 2 hours.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'ac_reminder_2h', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', 2)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'ac_reminder_2h',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_in_progress_trade.listing_title,
        'hours_remaining', 2
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'ac_reminded_24h', v_reminder_24h_count,
    'ac_reminded_2h', v_reminder_2h_count,
    'in_app_created', v_in_app_created,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_send_auto_complete_reminders(integer) TO service_role;

COMMENT ON FUNCTION public.rpc_send_auto_complete_reminders IS 
'Finds in-progress trades needing auto-complete reminders, marks tracking columns, creates in-app user_notifications rows, and returns push notification payloads for the Edge Function.';

-- =============================================================================
-- 4) Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_trades_ac_reminder_24h 
  ON public.trades (auto_complete_at, ac_reminder_24h_sent_at)
  WHERE status = 'in_progress' AND auto_complete_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_ac_reminder_2h
  ON public.trades (auto_complete_at, ac_reminder_2h_sent_at)
  WHERE status = 'in_progress' AND auto_complete_at IS NOT NULL;

-- =============================================================================
-- 5) Scheduler wiring: call edge function every 5 minutes
-- =============================================================================
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_sql text;
BEGIN
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );

  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss'
  );

  IF v_base_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Skipping send-auto-complete-reminders cron schedule: could not resolve base URL or service role key. Set via: ALTER DATABASE postgres SET app.edge_function_base_url TO ''https://your-project.supabase.co/functions/v1''; ALTER DATABASE postgres SET app.service_role_key TO ''your-service-role-key''; Or add keys to admin_config table.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'send-auto-complete-reminders';

    v_job_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/send-auto-complete-reminders',
      v_service_role_key
    );

    PERFORM cron.schedule(
      'send-auto-complete-reminders',
      '*/5 * * * *',
      v_job_sql
    );
  END IF;
END;
$$;

-- =============================================================================
-- Verification queries
-- =============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'trades' AND column_name IN ('ac_reminder_24h_sent_at', 'ac_reminder_2h_sent_at');
--
-- SELECT key, value, description FROM public.admin_config WHERE key LIKE 'auto_complete_notif%';
--
-- SELECT public.rpc_send_auto_complete_reminders(10);
--
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'send-auto-complete-reminders';
--
-- Common failure modes:
-- 1) Missing pg_cron or pg_net extension: schedule section safely no-ops.
-- 2) Missing app/custom runtime settings for service auth: schedule no-ops with NOTICE.
-- 3) The RPC only processes in_progress trades with auto_complete_at set — trades without
--    auto_complete_at (e.g., expired offers or legacy states) are correctly excluded.
