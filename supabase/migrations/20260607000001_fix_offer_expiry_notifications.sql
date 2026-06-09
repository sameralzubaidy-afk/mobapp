-- =============================================================================
-- Migration: Fix Offer Expiry Notifications (TC-B02)
-- Date: 2026-06-07
-- Issues Fixed:
--   1. rpc_process_expired_offers now sends notifications to buyer and seller
--   2. Adds proper tracking of expired trades for notification
-- =============================================================================

-- =============================================================================
-- 1. Enhanced rpc_process_expired_offers with notifications
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
  v_supabase_url text;
  v_service_role_key text;
  v_notification_response text;
BEGIN
  -- Get environment variables for Edge Function calls
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- D-30: Expired offers are now 'in_progress' with auto_complete_at IS NULL
  FOR v_expired_trade IN (
    SELECT 
      t.id, 
      t.listing_id, 
      t.buyer_id, 
      t.seller_id,
      i.title as listing_title
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NULL
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
    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      BEGIN
        SELECT extensions.http_post(
          v_supabase_url || '/functions/v1/send-trade-notifications',
          jsonb_build_object(
            'trade_id', v_expired_trade.id,
            'event_type', 'offer_expired',
            'recipient_user_id', v_expired_trade.buyer_id,
            'extra_data', jsonb_build_object('listing_title', v_expired_trade.listing_title)
          )::text,
          jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        ) INTO v_notification_response;
      EXCEPTION WHEN OTHERS THEN
        -- Log but don't fail the main operation
        RAISE WARNING 'Failed to send buyer notification for expired trade %: %', v_expired_trade.id, SQLERRM;
      END;

      -- Send notification to seller
      BEGIN
        SELECT extensions.http_post(
          v_supabase_url || '/functions/v1/send-trade-notifications',
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
'Processes expired offers, updates status to cancelled, and sends notifications to both buyer and seller';

-- =============================================================================
-- Verification Query
-- =============================================================================
-- Test with a single offer:
-- SELECT public.rpc_process_expired_offers(1);
