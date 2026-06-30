-- =============================================================================
-- Migration: Fix RPC settings namespace
-- Date: 2026-06-09
-- Mode B: Idempotent rerunnable migration
-- Purpose:
--   Update rpc_process_expired_offers and rpc_send_offer_reminders to use
--   existing app.edge_function_base_url / app.service_role_key settings
--   instead of app.settings.* which can't be set in managed Supabase Postgres.
-- =============================================================================

-- =============================================================================
-- 1. Fix rpc_process_expired_offers — use app.edge_function_base_url
-- =============================================================================
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
  v_expired_trade RECORD;
  v_edge_base_url text;
  v_service_role_key text;
  v_notification_response text;
  v_stats_record RECORD;
BEGIN
  -- Get environment variables from existing DB settings
  v_edge_base_url := current_setting('app.edge_function_base_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);

  -- Process expired pending offers
  FOR v_expired_trade IN (
    SELECT 
      t.id, 
      t.listing_id, 
      t.buyer_id, 
      t.seller_id,
      i.title as listing_title,
      i.status as item_status
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at <= now()
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  )
  LOOP
    -- Update trade status to cancelled
    UPDATE public.trades
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Offer expired',
      updated_at = now(),
      last_status_change_at = now()
    WHERE id = v_expired_trade.id;

    -- Update listing stats
    UPDATE public.listing_offer_stats
    SET
      unanswered_offer_count = GREATEST(0, unanswered_offer_count - 1),
      updated_at = now()
    WHERE listing_id = v_expired_trade.listing_id;

    v_updated_count := v_updated_count + 1;

    -- Send notification to buyer
    IF v_edge_base_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      BEGIN
        SELECT extensions.http_post(
          v_edge_base_url || '/send-trade-notifications',
          jsonb_build_object(
            'trade_id', v_expired_trade.id,
            'event_type', 'offer_expired',
            'recipient_user_id', v_expired_trade.buyer_id,
            'extra_data', jsonb_build_object(
              'listing_title', v_expired_trade.listing_title,
              'item_still_available', v_expired_trade.item_status = 'available'
            )
          )::text,
          jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        ) INTO v_notification_response;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send buyer notification for expired trade %: %', v_expired_trade.id, SQLERRM;
      END;

      -- Send notification to seller
      BEGIN
        SELECT extensions.http_post(
          v_edge_base_url || '/send-trade-notifications',
          jsonb_build_object(
            'trade_id', v_expired_trade.id,
            'event_type', 'offer_expired_seller',
            'recipient_user_id', v_expired_trade.seller_id,
            'extra_data', jsonb_build_object('listing_title', v_expired_trade.listing_title)
          )::text,
          jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        ) INTO v_notification_response;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send seller notification for expired trade %: %', v_expired_trade.id, SQLERRM;
      END;

      -- Check if this is the 2nd consecutive unanswered offer for this listing
      SELECT 
        los.unanswered_offer_count,
        los.last_prompt_sent_at
      INTO v_stats_record
      FROM public.listing_offer_stats los
      WHERE los.listing_id = v_expired_trade.listing_id;

      IF v_stats_record.unanswered_offer_count >= 2 AND 
         (v_stats_record.last_prompt_sent_at IS NULL OR 
          v_stats_record.last_prompt_sent_at < now() - INTERVAL '7 days') THEN
        BEGIN
          SELECT extensions.http_post(
            v_edge_base_url || '/send-trade-notifications',
            jsonb_build_object(
              'trade_id', v_expired_trade.id,
              'event_type', 'seller_ignore_prompt',
              'recipient_user_id', v_expired_trade.seller_id,
              'extra_data', jsonb_build_object(
                'listing_title', v_expired_trade.listing_title,
                'listing_id', v_expired_trade.listing_id,
                'unanswered_count', v_stats_record.unanswered_offer_count
              )
            )::text,
            jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_role_key
            )
          ) INTO v_notification_response;

          UPDATE public.listing_offer_stats
          SET last_prompt_sent_at = now()
          WHERE listing_id = v_expired_trade.listing_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to send seller ignore prompt for listing %: %', v_expired_trade.listing_id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_offers_processed', v_updated_count,
    'processed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_process_expired_offers IS 
'Processes expired PENDING offers — uses app.edge_function_base_url and app.service_role_key settings';

-- =============================================================================
-- 2. Fix rpc_send_offer_reminders — use app.edge_function_base_url
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_send_offer_reminders(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminder_6h_count integer := 0;
  v_reminder_1h_count integer := 0;
  v_pending_trade RECORD;
  v_edge_base_url text;
  v_service_role_key text;
  v_notification_response text;
BEGIN
  -- Get environment variables from existing DB settings
  v_edge_base_url := current_setting('app.edge_function_base_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);

  IF v_edge_base_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing environment variables — check app.edge_function_base_url and app.service_role_key settings'
    );
  END IF;

  -- Send 6-hour reminders
  FOR v_pending_trade IN (
    SELECT 
      t.id, 
      t.listing_id, 
      t.seller_id,
      i.title as listing_title,
      t.offer_expires_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at > now() + INTERVAL '5 hours 30 minutes'
      AND t.offer_expires_at <= now() + INTERVAL '6 hours 30 minutes'
      AND (t.reminder_6h_sent_at IS NULL OR t.reminder_6h_sent_at < t.created_at)
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  )
  LOOP
    BEGIN
      SELECT extensions.http_post(
        v_edge_base_url || '/send-trade-notifications',
        jsonb_build_object(
          'trade_id', v_pending_trade.id,
          'event_type', 'offer_reminder_6h',
          'recipient_user_id', v_pending_trade.seller_id,
          'extra_data', jsonb_build_object(
            'listing_title', v_pending_trade.listing_title,
            'hours_remaining', 6
          )
        )::text,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        )
      ) INTO v_notification_response;

      UPDATE public.trades
      SET reminder_6h_sent_at = now()
      WHERE id = v_pending_trade.id;

      v_reminder_6h_count := v_reminder_6h_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send 6h reminder for trade %: %', v_pending_trade.id, SQLERRM;
    END;
  END LOOP;

  -- Send 1-hour reminders
  FOR v_pending_trade IN (
    SELECT 
      t.id, 
      t.listing_id, 
      t.seller_id,
      i.title as listing_title,
      t.offer_expires_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at > now() + INTERVAL '30 minutes'
      AND t.offer_expires_at <= now() + INTERVAL '1 hour 30 minutes'
      AND (t.reminder_1h_sent_at IS NULL OR t.reminder_1h_sent_at < t.created_at)
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  )
  LOOP
    BEGIN
      SELECT extensions.http_post(
        v_edge_base_url || '/send-trade-notifications',
        jsonb_build_object(
          'trade_id', v_pending_trade.id,
          'event_type', 'offer_reminder_1h',
          'recipient_user_id', v_pending_trade.seller_id,
          'extra_data', jsonb_build_object(
            'listing_title', v_pending_trade.listing_title,
            'hours_remaining', 1
          )
        )::text,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        )
      ) INTO v_notification_response;

      UPDATE public.trades
      SET reminder_1h_sent_at = now()
      WHERE id = v_pending_trade.id;

      v_reminder_1h_count := v_reminder_1h_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send 1h reminder for trade %: %', v_pending_trade.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reminder_6h_sent', v_reminder_6h_count,
    'reminder_1h_sent', v_reminder_1h_count,
    'processed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_send_offer_reminders IS 
'Sends reminder notifications to sellers at 6h and 1h before offer expiry — uses app.edge_function_base_url and app.service_role_key settings';

-- =============================================================================
-- Verification
-- =============================================================================
-- Test the RPC:
-- SELECT public.rpc_send_offer_reminders(100);
-- SELECT public.rpc_process_expired_offers(10);
