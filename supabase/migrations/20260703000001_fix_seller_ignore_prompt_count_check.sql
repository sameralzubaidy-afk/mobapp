-- Migration: Fix seller ignore prompt count check in rpc_process_expired_offers
-- Date: 2026-07-03
-- Mode B: Idempotent rerunnable migration
-- Bug: The function checks `unanswered_offer_count >= 2` AFTER decrementing by 1,
-- so the prompt never fires for exactly 2 expired offers (count goes 2->1, check 1>=2 fails).
-- Fix: Check the count BEFORE the decrement.

-- =============================================================================
-- 1. Fix rpc_process_expired_offers — check count before decrementing
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
  v_unanswered_before integer := 0;
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
    -- ⭐ READ count BEFORE decrement for the seller ignore prompt check
    SELECT los.unanswered_offer_count, los.last_prompt_sent_at
    INTO v_stats_record
    FROM public.listing_offer_stats los
    WHERE los.listing_id = v_expired_trade.listing_id;

    v_unanswered_before := COALESCE(v_stats_record.unanswered_offer_count, 0);

    -- Cancel the trade
    UPDATE public.trades
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Offer expired',
        updated_at = now(),
        last_status_change_at = now()
    WHERE id = v_expired_trade.id;

    -- Decrement listing stats (AFTER reading the count above)
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

    -- ⭐ Check seller ignore prompt using pre-decrement count
    IF v_unanswered_before >= 2 AND 
       (v_stats_record.last_prompt_sent_at IS NULL OR 
        v_stats_record.last_prompt_sent_at < now() - INTERVAL '7 days') THEN

      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_expired_trade.id,
        'event_type', 'seller_ignore_prompt',
        'recipient_user_id', v_expired_trade.seller_id,
        'extra_data', jsonb_build_object(
          'listing_title', v_expired_trade.listing_title,
          'listing_id', v_expired_trade.listing_id,
          'unanswered_count', v_unanswered_before
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
'Cancels expired pending offers, updates stats. Returns notification payloads for the caller (Edge Function) to send. ⭐ FIXED: seller_ignore_prompt now uses pre-decrement count.';

-- =============================================================================
-- 2. Verification queries
-- =============================================================================
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'rpc_process_expired_offers';
-- 
-- Manual test:
-- 1. Create 2 offers on the same listing, let both expire
-- 2. Run: SELECT public.rpc_process_expired_offers(100);
-- 3. Check result jsonb for a 'seller_ignore_prompt' notification in the array
-- 4. If present, the fix works. If absent, the listing_offer_stats reset to 0 before this ran.
--
-- TODO(TC-B02): seller_ignore_prompt notification not arriving despite correct RPC output.
-- Suspected causes (check in order):
--   1. Stale `last_prompt_sent_at` in listing_offer_stats (clear with UPDATE SET last_prompt_sent_at = NULL)
--   2. Push token missing or expired for the test account
--   3. The `process-expired-offers` Edge Function (deployed) calls the RPC correctly,
--      but `send-trade-notifications` may fail silently — check its logs in Supabase dashboard
--   4. The cron job (every 5 min) may not be running — check `cron.job` table for 'process-expired-offers'
