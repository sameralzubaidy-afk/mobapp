-- ============================================================================
-- R2 — Wire auto-complete reminders to admin-configurable thresholds
-- Date: 2026-08-10
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   rpc_send_auto_complete_reminders previously HARDCODED the two reminder
--   thresholds (24h / 2h before auto-complete). The admin keys
--   `auto_complete_notif_1/2_hours_before` existed but were not read, so
--   changing them had no effect. This rewrites the RPC to read those keys via
--   the canonical fn_admin_config_int helper (same pattern as pickup reminders).
--
--   Event type names (ac_reminder_24h / ac_reminder_2h) and return keys
--   (ac_reminded_24h / ac_reminded_2h) are KEPT STABLE for backward
--   compatibility with deployed callers (send-auto-complete-reminders EF and
--   send-trade-notifications templates); only the hours themselves are now
--   config-driven, and hours_remaining is passed in extra_data so push copy
--   reflects the configured threshold.
--
-- RULES: idempotent (CREATE OR REPLACE); p_ params, v_ locals, qualified
-- columns; canonical read helper fn_admin_config_int.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_send_auto_complete_reminders(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ac_notif_1 integer := 24;
  v_ac_notif_2 integer := 2;
  v_reminder_1_count integer := 0;
  v_reminder_2_count integer := 0;
  v_in_app_created integer := 0;
  v_in_progress_trade RECORD;
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  -- R2 (2026-08-10): read the configurable auto-complete reminder thresholds from
  -- admin_config (canonical keys auto_complete_notif_1/2_hours_before). Event type
  -- names (ac_reminder_24h / ac_reminder_2h) and return keys (ac_reminded_24h /
  -- ac_reminded_2h) stay stable for backward compatibility; the hours are now
  -- admin-configurable.
  v_ac_notif_1 := public.fn_admin_config_int('auto_complete_notif_1_hours_before', 24);
  v_ac_notif_2 := public.fn_admin_config_int('auto_complete_notif_2_hours_before', 2);

  -- First auto-complete reminder (window: threshold ± 30 min before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + (make_interval(hours => v_ac_notif_1) - INTERVAL '30 minutes')
      AND t.auto_complete_at <= now() + (make_interval(hours => v_ac_notif_1) + INTERVAL '30 minutes')
      AND (t.ac_reminder_24h_sent_at IS NULL OR t.ac_reminder_24h_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET ac_reminder_24h_sent_at = now() WHERE id = v_in_progress_trade.id;
    v_reminder_1_count := v_reminder_1_count + 1;

    -- Create in-app notification
    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'ac_reminder_24h',
      'Auto-Complete Soon',
      'Your trade for "' || v_in_progress_trade.listing_title || '" auto-completes in ' || v_ac_notif_1 || 'h. Got it? Tap ''I Got It''.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'ac_reminder_24h', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_ac_notif_1)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'ac_reminder_24h',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_in_progress_trade.listing_title,
        'hours_remaining', v_ac_notif_1
      )
    );
  END LOOP;

  -- Final auto-complete reminder (window: threshold ± 30 min before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + (make_interval(hours => v_ac_notif_2) - INTERVAL '30 minutes')
      AND t.auto_complete_at <= now() + (make_interval(hours => v_ac_notif_2) + INTERVAL '30 minutes')
      AND (t.ac_reminder_2h_sent_at IS NULL OR t.ac_reminder_2h_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET ac_reminder_2h_sent_at = now() WHERE id = v_in_progress_trade.id;
    v_reminder_2_count := v_reminder_2_count + 1;

    -- Create in-app notification
    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'ac_reminder_2h',
      'Auto-Complete Soon',
      '"' || v_in_progress_trade.listing_title || '" trade auto-completes in ' || v_ac_notif_2 || ' hours.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'ac_reminder_2h', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_ac_notif_2)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'ac_reminder_2h',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_in_progress_trade.listing_title,
        'hours_remaining', v_ac_notif_2
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'ac_reminded_24h', v_reminder_1_count,
    'ac_reminded_2h', v_reminder_2_count,
    'in_app_created', v_in_app_created,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_send_auto_complete_reminders(integer) TO service_role;

COMMENT ON FUNCTION public.rpc_send_auto_complete_reminders IS
'Finds in-progress trades needing auto-complete reminders, marks tracking columns, creates in-app user_notifications rows, and returns push payloads for the Edge Function. Thresholds read from auto_complete_notif_1/2_hours_before (R2).';

-- ---------------------------------------------------------------------------
-- Verification queries (SQL-3)
-- ---------------------------------------------------------------------------
-- SELECT proname FROM pg_proc WHERE proname = 'rpc_send_auto_complete_reminders';
-- SELECT public.rpc_send_auto_complete_reminders(10);
-- -- Threshold change test (should shift the reminder window):
-- SELECT upsert_admin_config_setting('auto_complete_notif_1_hours_before', '36', 'trade', 'number', false, true, NULL);
-- -- ... fast-forward an in_progress trade to ~36h before auto_complete_at, re-run the RPC,
-- --     confirm a reminder fires; then restore:
-- SELECT upsert_admin_config_setting('auto_complete_notif_1_hours_before', '24', 'trade', 'number', false, true, NULL);
