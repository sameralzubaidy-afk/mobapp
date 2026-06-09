-- =============================================================================
-- Migration: Fix Offer Expiry Complete (TC-B02)
-- Date: 2026-06-08
-- Critical Fixes:
--   1. rpc_process_expired_offers now looks for status='pending' (was incorrectly checking 'in_progress')
--   2. Adds reminder notifications at 6h and 1h before expiry
--   3. Adds seller ignore prompt after 2 consecutive unanswered offers
--   4. CRITICAL: Fixes SP release trigger to create ledger entry for audit trail
-- =============================================================================

-- =============================================================================
-- 0. Fix SP Release Trigger to Create Ledger Entry
-- =============================================================================
-- CRITICAL FIX: fn_release_sp_on_cancel was releasing SP but not creating a ledger entry
-- This made it appear as if SP was not being returned (no audit trail)

CREATE OR REPLACE FUNCTION public.fn_release_sp_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  -- Only process cancellations
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Skip if no SP was reserved
  IF COALESCE(OLD.sp_amount, 0) <= 0 OR OLD.sp_reserved_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already released
  IF OLD.sp_released_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get buyer's wallet with lock
  SELECT w.id, w.available_balance
  INTO v_wallet_id, v_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = OLD.buyer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE WARNING 'SP wallet not found for buyer % in cancelled trade %', OLD.buyer_id, OLD.id;
    RETURN NEW;
  END IF;

  v_balance_after := v_balance_before + OLD.sp_amount;

  -- Release SP back to available balance
  UPDATE public.sp_wallets w
  SET
    available_balance = v_balance_after,
    reserved_sp = GREATEST(0, w.reserved_sp - OLD.sp_amount),
    updated_at = now()
  WHERE w.id = v_wallet_id;

  -- ⭐ CRITICAL FIX: Create ledger entry for the SP refund
  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id,
    created_at
  ) VALUES (
    v_wallet_id,
    OLD.buyer_id,
    'earn_refund',
    OLD.sp_amount,
    v_balance_before,
    v_balance_after,
    'SP refunded for cancelled offer (expired)',
    OLD.id,
    now()
  );

  -- Mark SP as released
  UPDATE public.trades t
  SET sp_released_at = COALESCE(t.sp_released_at, now()),
      updated_at = now()
  WHERE t.id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_release_sp_on_cancel IS 
'Releases reserved SP back to buyer when trade is cancelled and creates audit ledger entry';

-- Recreate trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_release_sp_on_cancel ON public.trades;
CREATE TRIGGER trigger_release_sp_on_cancel
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_release_sp_on_cancel();

-- =============================================================================
-- 1. Fix rpc_process_expired_offers to look for status='pending'
-- =============================================================================
-- CRITICAL FIX: The function was looking for status='in_progress' but create-trade-offer
-- creates trades with status='pending'. This is why expired offers were not being processed.

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
  v_stats_record RECORD;
BEGIN
  -- Get environment variables for Edge Function calls
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- ✅ FIX: Look for status='pending' (not 'in_progress')
  -- Trades are created with status='pending' by create-trade-offer Edge Function
  -- When seller accepts, they transition to 'payment_processing' then 'in_progress'
  -- Expired offers are PENDING offers that were never answered by the seller
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
    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      BEGIN
        SELECT extensions.http_post(
          v_supabase_url || '/functions/v1/send-trade-notifications',
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

      -- Check if this is the 2nd consecutive unanswered offer for this listing
      -- Send seller ignore prompt if so
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
          -- Send seller ignore prompt
          SELECT extensions.http_post(
            v_supabase_url || '/functions/v1/send-trade-notifications',
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

          -- Update last_prompt_sent_at
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
'Processes expired PENDING offers, updates status to cancelled, restores buyer SP, and sends notifications to both parties';

-- =============================================================================
-- 2. Add reminder notification function (6h and 1h before expiry)
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
  v_supabase_url text;
  v_service_role_key text;
  v_notification_response text;
BEGIN
  -- Get environment variables for Edge Function calls
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing environment variables'
    );
  END IF;

  -- Send 6-hour reminders
  -- (expires between 5h30m and 6h30m from now, and hasn't been reminded yet)
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
        v_supabase_url || '/functions/v1/send-trade-notifications',
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

      -- Mark as sent
      UPDATE public.trades
      SET reminder_6h_sent_at = now()
      WHERE id = v_pending_trade.id;

      v_reminder_6h_count := v_reminder_6h_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send 6h reminder for trade %: %', v_pending_trade.id, SQLERRM;
    END;
  END LOOP;

  -- Send 1-hour reminders
  -- (expires between 30m and 1h30m from now, and hasn't been reminded yet)
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
        v_supabase_url || '/functions/v1/send-trade-notifications',
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

      -- Mark as sent
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
'Sends reminder notifications to sellers at 6h and 1h before offer expiry';

-- =============================================================================
-- 3. Add reminder tracking columns to trades table
-- =============================================================================
ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS reminder_6h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

COMMENT ON COLUMN public.trades.reminder_6h_sent_at IS 
'Timestamp when 6-hour expiry reminder was sent to seller';

COMMENT ON COLUMN public.trades.reminder_1h_sent_at IS 
'Timestamp when 1-hour expiry reminder was sent to seller';

-- =============================================================================
-- 4. Add last_prompt_sent_at to listing_offer_stats
-- =============================================================================
ALTER TABLE public.listing_offer_stats 
  ADD COLUMN IF NOT EXISTS last_prompt_sent_at timestamptz;

COMMENT ON COLUMN public.listing_offer_stats.last_prompt_sent_at IS 
'Timestamp when seller was last prompted to pause listing due to ignored offers';

-- =============================================================================
-- 5. Update the index to cover pending status
-- =============================================================================
DROP INDEX IF EXISTS public.idx_trades_offer_expires_at;
CREATE INDEX idx_trades_offer_expires_at
  ON public.trades (offer_expires_at)
  WHERE status = 'pending' AND offer_expires_at IS NOT NULL;

-- =============================================================================
-- 6. Add indexes for reminder queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_trades_reminder_6h
  ON public.trades (offer_expires_at, reminder_6h_sent_at)
  WHERE status = 'pending' AND offer_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_reminder_1h
  ON public.trades (offer_expires_at, reminder_1h_sent_at)
  WHERE status = 'pending' AND offer_expires_at IS NOT NULL;

-- =============================================================================
-- Verification Queries
-- =============================================================================
-- Test expired offer processing:
-- SELECT public.rpc_process_expired_offers(10);

-- Test reminder sending:
-- SELECT public.rpc_send_offer_reminders(10);

-- Check if columns were added:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'trades' AND column_name IN ('reminder_6h_sent_at', 'reminder_1h_sent_at');

-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'listing_offer_stats' AND column_name = 'last_prompt_sent_at';

-- Check for pending expired offers:
-- SELECT id, created_at, offer_expires_at, status 
-- FROM trades 
-- WHERE status = 'pending' 
--   AND offer_expires_at IS NOT NULL 
--   AND offer_expires_at <= now()
-- ORDER BY offer_expires_at ASC 
-- LIMIT 5;

-- =============================================================================
-- SP RESTORATION VERIFICATION (CRITICAL)
-- =============================================================================
-- After running rpc_process_expired_offers, verify SP was restored:
-- 
-- 1. Check that SP was released in the trade record:
-- SELECT id, buyer_id, sp_amount, sp_reserved_at, sp_released_at, status
-- FROM trades
-- WHERE status = 'cancelled'
--   AND sp_amount > 0
--   AND sp_released_at IS NOT NULL
-- ORDER BY cancelled_at DESC
-- LIMIT 5;
--
-- 2. Verify ledger entry was created for the refund:
-- SELECT 
--   l.id,
--   l.user_id,
--   l.transaction_type,
--   l.amount,
--   l.balance_before,
--   l.balance_after,
--   l.description,
--   l.related_transaction_id,
--   l.created_at
-- FROM sp_ledger l
-- INNER JOIN trades t ON l.related_transaction_id = t.id
-- WHERE t.status = 'cancelled'
--   AND l.transaction_type = 'earn_refund'
-- ORDER BY l.created_at DESC
-- LIMIT 5;
--
-- 3. Verify buyer's wallet balance was restored:
-- SELECT 
--   w.user_id,
--   w.available_balance,
--   w.reserved_sp,
--   w.lifetime_earned,
--   w.lifetime_spent
-- FROM sp_wallets w
-- WHERE w.user_id = '<buyer-user-id>';
--
-- EXPECTED RESULTS:
-- - sp_released_at should be set to the cancellation timestamp
-- - sp_ledger should have an 'earn_refund' entry with amount = sp_amount
-- - wallet.available_balance should increase by sp_amount
-- - wallet.reserved_sp should decrease by sp_amount
