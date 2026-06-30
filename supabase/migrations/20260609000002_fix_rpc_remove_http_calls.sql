-- =============================================================================
-- Migration: Remove HTTP calls from RPCs — Edge Functions handle notifications
-- Date: 2026-06-09
-- Mode B: Idempotent rerunnable migration
-- Purpose:
--   rpc_process_expired_offers and rpc_send_offer_reminders now do DATA ONLY.
--   They return notification payloads that the caller (Edge Function) sends
--   via HTTP to send-trade-notifications.
-- =============================================================================

-- =============================================================================
-- 1. rpc_process_expired_offers — data only, returns notification array
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
  v_notifications jsonb := '[]'::jsonb;
  v_stats_record RECORD;
BEGIN
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
  ) LOOP
    -- Cancel the trade
    UPDATE public.trades
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Offer expired',
        updated_at = now(),
        last_status_change_at = now()
    WHERE id = v_expired_trade.id;

    -- Update listing stats
    UPDATE public.listing_offer_stats
    SET unanswered_offer_count = GREATEST(0, unanswered_offer_count - 1),
        updated_at = now()
    WHERE listing_id = v_expired_trade.listing_id;

    v_updated_count := v_updated_count + 1;

    -- Queue buyer notification
    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_expired_trade.id,
      'event_type', 'offer_expired',
      'recipient_user_id', v_expired_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_expired_trade.listing_title,
        'item_still_available', v_expired_trade.item_status = 'available'
      )
    );

    -- Queue seller notification
    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_expired_trade.id,
      'event_type', 'offer_expired_seller',
      'recipient_user_id', v_expired_trade.seller_id,
      'extra_data', jsonb_build_object('listing_title', v_expired_trade.listing_title)
    );

    -- Check seller ignore prompt (2+ consecutive unanswered)
    SELECT los.unanswered_offer_count, los.last_prompt_sent_at
    INTO v_stats_record
    FROM public.listing_offer_stats los
    WHERE los.listing_id = v_expired_trade.listing_id;

    IF v_stats_record.unanswered_offer_count >= 2 AND 
       (v_stats_record.last_prompt_sent_at IS NULL OR 
        v_stats_record.last_prompt_sent_at < now() - INTERVAL '7 days') THEN

      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_expired_trade.id,
        'event_type', 'seller_ignore_prompt',
        'recipient_user_id', v_expired_trade.seller_id,
        'extra_data', jsonb_build_object(
          'listing_title', v_expired_trade.listing_title,
          'listing_id', v_expired_trade.listing_id,
          'unanswered_count', v_stats_record.unanswered_offer_count
        )
      );

      UPDATE public.listing_offer_stats
      SET last_prompt_sent_at = now()
      WHERE listing_id = v_expired_trade.listing_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_offers_processed', v_updated_count,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_process_expired_offers IS 
'Cancels expired pending offers, updates stats. Returns notification payloads for the caller (Edge Function) to send.';

-- =============================================================================
-- 2. rpc_send_offer_reminders — data only, returns notification array
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
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  -- 6-hour reminders
  FOR v_pending_trade IN (
    SELECT t.id, t.listing_id, t.seller_id, i.title as listing_title, t.offer_expires_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at > now() + INTERVAL '5 hours 30 minutes'
      AND t.offer_expires_at <= now() + INTERVAL '6 hours 30 minutes'
      AND (t.reminder_6h_sent_at IS NULL OR t.reminder_6h_sent_at < t.created_at)
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET reminder_6h_sent_at = now() WHERE id = v_pending_trade.id;
    v_reminder_6h_count := v_reminder_6h_count + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_pending_trade.id,
      'event_type', 'offer_reminder_6h',
      'recipient_user_id', v_pending_trade.seller_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_pending_trade.listing_title,
        'hours_remaining', 6
      )
    );
  END LOOP;

  -- 1-hour reminders
  FOR v_pending_trade IN (
    SELECT t.id, t.listing_id, t.seller_id, i.title as listing_title, t.offer_expires_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at > now() + INTERVAL '30 minutes'
      AND t.offer_expires_at <= now() + INTERVAL '1 hour 30 minutes'
      AND (t.reminder_1h_sent_at IS NULL OR t.reminder_1h_sent_at < t.created_at)
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades SET reminder_1h_sent_at = now() WHERE id = v_pending_trade.id;
    v_reminder_1h_count := v_reminder_1h_count + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_pending_trade.id,
      'event_type', 'offer_reminder_1h',
      'recipient_user_id', v_pending_trade.seller_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_pending_trade.listing_title,
        'hours_remaining', 1
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reminder_6h_sent', v_reminder_6h_count,
    'reminder_1h_sent', v_reminder_1h_count,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_send_offer_reminders IS 
'Marks offers as reminded in DB. Returns notification payloads for the caller (Edge Function) to send.';

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT public.rpc_process_expired_offers(10);
-- SELECT public.rpc_send_offer_reminders(100);
