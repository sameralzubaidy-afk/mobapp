-- File: supabase/migrations/20260829000001_dev_task_34_seller_ignore_streak.sql
-- Date: 2026-08-29
-- Mode B: Idempotent rerunnable migration (safe to re-run)
--
-- DEV-TASK-34 — Rebuild `listing_offer_stats.unanswered_offer_count` as a TRUE
-- consecutive-unanswered-expiry streak (replaces the simultaneous-pending-offer
-- count model). This is a full semantic replacement, not an additive change.
--
-- Before (simultaneous-pending count):
--   * fn_reserve_sp_on_offer       INCREMENT on every pending offer submission
--   * fn_update_unanswered_counter DECREMENT on non-expiry cancel
--   * rpc_process_expired_offers   DECREMENT per expired offer; prompt fires when
--                                  the pre-decrement pending count >= 2
--   * fn_reset_unanswered_counter  RESET on ANY cancel that is not an expiry
--   * accept reset trigger         (never deployed live — see BP-47 note below)
--
-- After (consecutive-expiry streak):
--   * fn_reserve_sp_on_offer       NO LONGER touches the counter (keeps
--                                  last_offer_received_at only)
--   * fn_update_unanswered_counter NO-OP (decrement model removed); trigger dropped
--   * rpc_process_expired_offers   INCREMENT per unanswered expiry (streak + 1);
--                                  prompt fires when the STREAK reaches the
--                                  existing threshold (2 consecutive expiries)
--   * fn_reset_unanswered_counter  RESET to 0 ONLY on a real seller DECLINE
--                                  (cancellation_reason = 'seller_declined')
--   * fn_reset_unanswered_counter_on_offer_accepted — restored + attached:
--                                  RESET to 0 on seller ACCEPT
--
-- The nudge semantics: it fires only for a seller who lets offers expire
-- unanswered (a non-response signal). A chain of declines never triggers it —
-- declines RESET the streak (the seller is engaged, just selective). Declines
-- never count toward the streak.
--
-- Data backfill: existing counts carry old-model simultaneous-pending values and
-- are NOT valid streak values, so every count is reset to 0 (clean slate). The
-- 7-day last_prompt_sent_at cooldown is preserved.
--
-- Note (BP-47): fn_reset_unanswered_counter_on_offer_accepted was specified by
-- 20260606000002 but was NEVER deployed to staging — the live trigger list has
-- no `trigger_reset_unanswered_counter_on_offer_accepted`. This migration
-- restores it so seller ACCEPT resets the streak. Also, the live
-- fn_update_unanswered_counter was a stale pre-D-30 body; it is neutralized
-- here (the whole decrement model is removed).

-- =============================================================================
-- BLOCK 1 — fn_reserve_sp_on_offer: remove the counter increment
--           (keep last_offer_received_at). SP reserve ledger unchanged.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reserve_sp_on_offer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_wallet_state text;
  v_available_balance integer;
  v_balance_after integer;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- DEV-TASK-34: the seller-ignore counter is now a consecutive-expiry streak
  -- driven ONLY by rpc_process_expired_offers (+1 per unanswered expiry) and
  -- reset by seller accept/decline. It is NO LONGER incremented on offer
  -- submission (the old simultaneous-pending count model is removed). We still
  -- record last_offer_received_at so the seller sees when the last offer came in.
  INSERT INTO public.listing_offer_stats (listing_id, last_offer_received_at, updated_at)
  VALUES (NEW.listing_id, now(), now())
  ON CONFLICT (listing_id)
  DO UPDATE SET
    last_offer_received_at = now(),
    updated_at = now();

  -- SP reservation applies only when the offer actually uses Swap Points.
  IF COALESCE(NEW.sp_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT w.id, w.state, w.available_balance
  INTO v_wallet_id, v_wallet_state, v_available_balance
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.buyer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.buyer_id);

    SELECT w.id, w.state, w.available_balance
    INTO v_wallet_id, v_wallet_state, v_available_balance
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.buyer_id
    FOR UPDATE;
  END IF;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found for buyer %', NEW.buyer_id;
  END IF;

  -- R6: grace-period wallets may spend EXISTING SP (only post-grace 'frozen'
  -- blocks spending). Suspended wallets always block.
  IF v_wallet_state NOT IN ('active', 'grace_period') THEN
    RAISE EXCEPTION 'Buyer wallet is not spendable (%). Cannot reserve SP.', v_wallet_state;
  END IF;

  IF v_available_balance < NEW.sp_amount THEN
    RAISE EXCEPTION 'Insufficient available SP. Need %, have %', NEW.sp_amount, v_available_balance;
  END IF;

  -- R11: HP-4 DB invariant — never let an over-cap offer reserve SP, regardless
  -- of which client submitted it (Edge Function also checks for a clean error).
  IF NEW.sp_amount > public.fn_item_effective_sp_cap(NEW.listing_id) THEN
    RAISE EXCEPTION 'SP amount % exceeds the redemption cap for this item.', NEW.sp_amount;
  END IF;

  v_balance_after := v_available_balance - NEW.sp_amount;

  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance - NEW.sp_amount,
    reserved_sp = w.reserved_sp + NEW.sp_amount,
    updated_at = now()
  WHERE w.id = v_wallet_id;

  UPDATE public.trades t
  SET sp_reserved_at = now(),
      updated_at = now()
  WHERE t.id = NEW.id
    AND t.sp_reserved_at IS NULL;

  -- DT-19 (Fix 1): spend_purchase ledger entry on reserve (unchanged).
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, created_at
  ) VALUES (
    v_wallet_id, NEW.buyer_id, 'spend_purchase', -NEW.sp_amount,
    v_available_balance, v_balance_after,
    'Swap Points committed to trade #' || NEW.id,
    NEW.id, now()
  );

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 2 — rpc_process_expired_offers: decrement → streak increment,
--           nudge fires at streak threshold (2 consecutive expiries).
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
  v_streak_count integer := 0;
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
    -- DEV-TASK-34: read current streak + cooldown state BEFORE mutating.
    SELECT los.unanswered_offer_count, los.last_prompt_sent_at
    INTO v_stats_record
    FROM public.listing_offer_stats los
    WHERE los.listing_id = v_expired_trade.listing_id;

    -- Cancel the trade. Fires trg_reset_unanswered_counter with reason
    -- 'Offer expired' → NO reset (DT-34 resets only on 'seller_declined');
    -- trigger_update_unanswered_counter is dropped by DT-34 (no decrement).
    UPDATE public.trades
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Offer expired',
        updated_at = now(),
        last_status_change_at = now()
    WHERE id = v_expired_trade.id;

    -- DEV-TASK-34: each unanswered expiry INCREMENTS the consecutive-expiry
    -- streak by 1 (this REPLACES the old simultaneous-pending-count decrement).
    -- Insert-or-update so a listing with no stats row still accumulates.
    INSERT INTO public.listing_offer_stats (listing_id, unanswered_offer_count, updated_at)
    VALUES (v_expired_trade.listing_id, 1, now())
    ON CONFLICT (listing_id)
    DO UPDATE SET
      unanswered_offer_count = public.listing_offer_stats.unanswered_offer_count + 1,
      updated_at = now()
    RETURNING unanswered_offer_count INTO v_streak_count;

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

    -- DEV-TASK-34: fire the seller-ignore nudge when the STREAK reaches the
    -- existing threshold (2 consecutive unanswered expiries). Cooldown and
    -- threshold unchanged — only WHAT counts toward the streak changed.
    IF v_streak_count >= 2 AND 
       (v_stats_record.last_prompt_sent_at IS NULL OR 
        v_stats_record.last_prompt_sent_at < now() - INTERVAL '7 days') THEN

      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_expired_trade.id,
        'event_type', 'seller_ignore_prompt',
        'recipient_user_id', v_expired_trade.seller_id,
        'extra_data', jsonb_build_object(
          'listing_title', v_expired_trade.listing_title,
          'listing_id', v_expired_trade.listing_id,
          'unanswered_count', v_streak_count
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
'Cancels expired pending offers, updates stats. Returns notification payloads for the caller (Edge Function) to send. DEV-TASK-34: unanswered_offer_count is now a consecutive-expiry streak — each unanswered expiry increments it by 1; the seller_ignore_prompt fires when the streak reaches 2 (cooldown 7d).';

-- =============================================================================
-- BLOCK 3 — fn_update_unanswered_counter → NO-OP; drop its trigger
--           (removes the old simultaneous-count decrement model).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- DEV-TASK-34: NO-OP. This function implemented the old simultaneous-pending
  -- offer-count decrement model, which is fully removed. Streak semantics:
  --   +1 per unanswered expiry  → rpc_process_expired_offers
  --   reset to 0 on ACCEPT      → fn_reset_unanswered_counter_on_offer_accepted
  --   reset to 0 on DECLINE     → fn_reset_unanswered_counter
  -- The trigger is dropped below; the function is kept as a documented no-op.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_unanswered_counter ON public.trades;

-- =============================================================================
-- BLOCK 4 — fn_reset_unanswered_counter: reset ONLY on a real seller DECLINE.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DEV-TASK-34: the streak resets ONLY when the seller takes real action —
  -- a DECLINE (cancellation_reason = 'seller_declined'; bundle declines store
  -- the same literal). Every other cancel reason — buyer_cancelled /
  -- requested_by_customer / authorization_expired / payment_hold_failed /
  -- dispute_resolved_refund / extension_denied / free-text buyer reasons /
  -- 'Offer expired' / 'offer_expired_competing' — is NOT a seller response and
  -- must NOT reset the streak. Accept resets via
  -- fn_reset_unanswered_counter_on_offer_accepted.
  IF NEW.status = 'cancelled'
    AND NEW.cancellation_reason = 'seller_declined'
  THEN
    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = 0,
      updated_at = NOW()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_unanswered_counter ON public.trades;
CREATE TRIGGER trg_reset_unanswered_counter
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_reset_unanswered_counter();

-- =============================================================================
-- BLOCK 5 — fn_reset_unanswered_counter_on_offer_accepted: restore + attach.
--           Seller ACCEPT resets the streak to 0.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter_on_offer_accepted()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status
     AND OLD.auto_complete_at IS NOT DISTINCT FROM NEW.auto_complete_at THEN
    RETURN NEW;
  END IF;

  -- DEV-TASK-34: seller ACCEPT resets the consecutive-expiry streak to 0.
  -- Fires when a pending/in_progress trade is accepted (status → in_progress
  -- with auto_complete_at set). Restored by DT-34 — specified by
  -- 20260606000002 but never deployed live (BP-47: verify live trigger before
  -- trusting a migration). Single and bundle accepts both include `status` and
  -- `auto_complete_at` in their UPDATE, so the trigger fires for both.
  IF ((OLD.status = 'pending' OR OLD.status = 'in_progress')
      AND NEW.status = 'in_progress'
      AND NEW.auto_complete_at IS NOT NULL
      AND OLD.auto_complete_at IS NULL)
  THEN
    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = 0,
      updated_at = now()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reset_unanswered_counter_on_offer_accepted ON public.trades;
CREATE TRIGGER trigger_reset_unanswered_counter_on_offer_accepted
  AFTER UPDATE OF status, auto_complete_at ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reset_unanswered_counter_on_offer_accepted();

-- =============================================================================
-- BLOCK 6 — Data backfill: old-model counts are NOT valid streak values.
--           Reset every count to 0 (clean slate); keep last_prompt_sent_at
--           (cooldown) and last_offer_received_at.
-- =============================================================================
UPDATE public.listing_offer_stats
SET unanswered_offer_count = 0,
    updated_at = now()
WHERE unanswered_offer_count <> 0;

-- =============================================================================
-- Verification queries (run ONE per call)
-- =============================================================================
-- 1) fn_reserve_sp_on_offer no longer increments the counter:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_reserve_sp_on_offer';
--    Expected: prosrc contains "last_offer_received_at = now()" but does NOT
--    contain "unanswered_offer_count + 1".
--
-- 2) rpc_process_expired_offers increments (RETURNING) instead of decrementing:
--    SELECT prosrc FROM pg_proc WHERE proname = 'rpc_process_expired_offers';
--    Expected: contains "RETURNING unanswered_offer_count INTO v_streak_count"
--    and "v_streak_count >= 2"; does NOT contain "GREATEST(0, unanswered_offer_count - 1)".
--
-- 3) fn_update_unanswered_counter is a no-op + its trigger is dropped:
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.trades'::regclass
--      AND tgname = 'trigger_update_unanswered_counter';
--    Expected: 0 rows.
--
-- 4) fn_reset_unanswered_counter resets only on 'seller_declined':
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_reset_unanswered_counter';
--    Expected: contains "NEW.cancellation_reason = 'seller_declined'".
--
-- 5) Accept-reset trigger is attached:
--    SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
--    WHERE tgrelid='public.trades'::regclass
--      AND tgname = 'trigger_reset_unanswered_counter_on_offer_accepted';
--    Expected: 1 row (AFTER UPDATE OF status, auto_complete_at).
--
-- 6) No stale non-zero counts remain:
--    SELECT count(*) FROM public.listing_offer_stats WHERE unanswered_offer_count <> 0;
--    Expected: 0.
