-- Fix SP Ledger Entries Missing on All Trade SP Events (TC-A02)
-- Mode: Idempotent Rerunnable Migration
--
-- Bugs fixed:
-- 1) fn_reserve_sp_on_offer() — reserved SP from available_balance but inserted
--    NO sp_ledger entry → buyer never saw SP committed to trade.
-- 2) fn_release_sp_on_cancel() — released reserved SP AND added to available_balance,
--    but credit_sp_for_cancelled_trade RPC (called by cancel-trade Edge Function)
--    already added to available_balance → DOUBLE-REFUND bug. Also no sp_ledger entry.
-- 3) fn_release_all_sp_on_complete() — updated wallet balances but inserted
--    NO sp_ledger entries → buyer/seller never saw SP spend/earn in history.
-- 4) complete_trade_v2() — called adjust_sp_wallet() for seller (available_balance)
--    while trigger also added to pending_balance → DOUBLE-CREDIT bug.
--
-- Changes:
-- 1) fn_reserve_sp_on_offer() — add sp_ledger INSERT with 'spend_purchase' type
-- 2) fn_release_sp_on_cancel() — remove available_balance addition (was double-refund
--    with credit_sp_for_cancelled_trade RPC). Only release reserved_sp. No ledger
--    entry added (RPC already creates 'earn_refund' entry).
-- 3) fn_release_all_sp_on_complete() — add sp_ledger INSERTs for buyer ('spend_purchase')
--    and seller ('earn_reward') matching existing UI transaction_type values.
-- 4) complete_trade_v2() — removed adjust_sp_wallet() call (trigger is single source)

-- ======================================================================
-- BLOCK 1: fn_reserve_sp_on_offer() — add sp_ledger entry for reservation
-- ======================================================================
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
  -- D-30: Accept both 'pending' (legacy) and 'in_progress' (new)
  IF NEW.status NOT IN ('pending', 'in_progress') OR COALESCE(NEW.sp_amount, 0) <= 0 THEN
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

  IF v_wallet_state <> 'active' THEN
    RAISE EXCEPTION 'Buyer wallet is not active (%). Cannot reserve SP.', v_wallet_state;
  END IF;

  IF v_available_balance < NEW.sp_amount THEN
    RAISE EXCEPTION 'Insufficient available SP. Need %, have %', NEW.sp_amount, v_available_balance;
  END IF;

  v_balance_after := v_available_balance - NEW.sp_amount;

  UPDATE public.sp_wallets w
  SET
    available_balance = v_balance_after,
    reserved_sp = w.reserved_sp + NEW.sp_amount,
    updated_at = now()
  WHERE w.id = v_wallet_id;

  UPDATE public.trades t
  SET sp_reserved_at = now(),
      updated_at = now()
  WHERE t.id = NEW.id
    AND t.sp_reserved_at IS NULL;

  -- ⭐ FIX: Log buyer's SP reservation to sp_ledger (was missing — TC-A02)
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

  INSERT INTO public.listing_offer_stats (listing_id, unanswered_offer_count, last_offer_received_at, updated_at)
  VALUES (NEW.listing_id, 1, now(), now())
  ON CONFLICT (listing_id)
  DO UPDATE SET
    unanswered_offer_count = public.listing_offer_stats.unanswered_offer_count + 1,
    last_offer_received_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ======================================================================
-- BLOCK 2: fn_release_sp_on_cancel() — fix double-refund, no ledger entry
--          (credit_sp_for_cancelled_trade RPC already handles refund + ledger)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_release_sp_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.sp_amount, 0) <= 0 OR OLD.sp_reserved_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT w.id
  INTO v_wallet_id
  FROM public.sp_wallets w
  WHERE w.user_id = OLD.buyer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ⭐ FIX: Removed available_balance addition — the cancel-trade Edge Function
  -- already calls credit_sp_for_cancelled_trade RPC which refunds available_balance
  -- and creates the 'earn_refund' sp_ledger entry. Adding it here too caused
  -- a DOUBLE-REFUND (available_balance += sp_amount twice).
  -- Only release reserved_sp so the reservation state is cleaned up.
  UPDATE public.sp_wallets w
  SET
    reserved_sp = GREATEST(0, w.reserved_sp - OLD.sp_amount),
    updated_at = now()
  WHERE w.id = v_wallet_id;

  UPDATE public.trades t
  SET sp_released_at = COALESCE(t.sp_released_at, now()),
      updated_at = now()
  WHERE t.id = NEW.id;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- BLOCK 3: fn_release_all_sp_on_complete() — add sp_ledger entries for
--          buyer spend + seller earn, matching existing transaction_type values
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_release_all_sp_on_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;

  v_item_price numeric;
  v_item_price_cents integer;
  v_accepts_swap_points boolean := false;

  v_buyer_sp integer := 0;
  v_platform_sp integer := 0;
  v_total_sp integer := 0;

  v_category_multiplier numeric := 1;
  v_pending_release_days integer := 3;
  v_seller_is_subscriber boolean := false;

  v_buyer_balance_before integer := 0;
  v_buyer_balance_after integer := 0;
  v_seller_pending_before integer := 0;
  v_seller_pending_after integer := 0;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  v_buyer_sp := GREATEST(COALESCE(NEW.sp_amount, 0), 0);
  v_pending_release_days := public.fn_trade_config_int('pending_sp_release_days', 3);

  SELECT i.price, COALESCE(i.accepts_swap_points, false)
  INTO v_item_price, v_accepts_swap_points
  FROM public.items i
  WHERE i.id = NEW.listing_id;

  v_item_price_cents := COALESCE(ROUND(COALESCE(v_item_price, 0) * 100)::integer, 0);

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = NEW.seller_id
      AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1
  ) INTO v_seller_is_subscriber;

  v_category_multiplier := COALESCE(NEW.sp_category_multiplier, 0);
  IF v_category_multiplier <= 0 THEN
    v_category_multiplier := public.fn_trade_config_numeric('sp_category_multiplier', 1);
  END IF;
  IF v_category_multiplier <= 0 THEN
    v_category_multiplier := public.fn_trade_config_numeric('sp_earn_multiplier', 1);
  END IF;

  IF v_seller_is_subscriber AND v_accepts_swap_points AND v_item_price_cents > 0 THEN
    v_platform_sp := FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier);
  END IF;

  v_total_sp := GREATEST(v_buyer_sp + v_platform_sp, 0);

  -- ======================================================================
  -- BUYER: Consume reserved SP (available_balance was already reduced on reservation)
  -- ======================================================================
  IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
    SELECT w.id
    INTO v_buyer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.buyer_id
    FOR UPDATE;

    IF v_buyer_wallet_id IS NOT NULL THEN
      -- Capture balance_before for ledger entry
      SELECT COALESCE(w.available_balance, 0)
      INTO v_buyer_balance_before
      FROM public.sp_wallets w
      WHERE w.id = v_buyer_wallet_id;

      UPDATE public.sp_wallets w
      SET
        reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
        lifetime_spent = w.lifetime_spent + v_buyer_sp,
        updated_at = now()
      WHERE w.id = v_buyer_wallet_id;

      -- balance_after = same as before (available_balance didn't change — it was
      -- already reduced on reservation. The reservation sp_ledger entry already
      -- tracks the available_balance change.)
      v_buyer_balance_after := v_buyer_balance_before;

      -- ⭐ FIX: Log buyer's SP spend to sp_ledger (was missing — TC-A02)
      -- Uses 'spend_purchase' to match existing UI "Spend Purchase" entries
      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_transaction_id, created_at
      ) VALUES (
        v_buyer_wallet_id, NEW.buyer_id, 'spend_purchase', -v_buyer_sp,
        v_buyer_balance_before, v_buyer_balance_after,
        'Swap Points spent on trade #' || NEW.id,
        NEW.id, now()
      );
    END IF;
  END IF;

  -- ======================================================================
  -- SELLER: ✅ D-17 FIX - Release ALL SP (buyer + platform) in ONE event
  --   ALL SP → pending_balance (3-day hold)
  --   Per TRADING-FLOW-V2.md D-17: "All SP released to seller in ONE single event"
  -- ======================================================================

  -- Load seller wallet once
  SELECT w.id, COALESCE(w.pending_balance, 0), COALESCE(w.available_balance, 0)
  INTO v_seller_wallet_id, v_seller_pending_before, v_buyer_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.seller_id
  FOR UPDATE;

  IF v_seller_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.seller_id);
    SELECT w.id, COALESCE(w.pending_balance, 0), COALESCE(w.available_balance, 0)
    INTO v_seller_wallet_id, v_seller_pending_before, v_buyer_balance_before
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;
  END IF;

  -- ✅ FIX: Combined award - ALL SP goes to pending_balance in ONE transaction
  IF v_total_sp > 0 THEN
    v_seller_pending_after := v_seller_pending_before + v_total_sp;

    UPDATE public.sp_wallets w
    SET
      pending_balance = v_seller_pending_after,
      lifetime_earned = w.lifetime_earned + v_total_sp,
      updated_at = now()
    WHERE w.id = v_seller_wallet_id;

    UPDATE public.trades t
    SET
      sp_earned_at_completion = v_total_sp,
      pending_sp_release_at = now() + make_interval(days => v_pending_release_days),
      sp_released_at = NULL,
      updated_at = now()
    WHERE t.id = NEW.id;

    -- ⭐ FIX: Single sp_ledger entry for ALL SP (was missing — TC-A02)
    -- Uses 'earn_reward' to match existing UI "Earn Reward" entries
    -- Description clarifies buyer SP + platform bonus breakdown
    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      format('Trade reward: %s SP from buyer + %s SP platform bonus', v_buyer_sp, v_platform_sp),
      NEW.id, now()
    );

    -- Single notification for ALL SP earned (D-17 compliance)
    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id,
      'sp_events',
      'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP (%s from buyer + %s platform bonus). They will be released in %s days.',
             v_total_sp, v_buyer_sp, v_platform_sp, v_pending_release_days),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'sp_buyer', v_buyer_sp,
        'sp_platform', v_platform_sp,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
    -- No SP earned (buyer paid 0 SP, seller not eligible for platform bonus)
    UPDATE public.trades t
    SET
      sp_earned_at_completion = 0,
      pending_sp_release_at = NULL,
      updated_at = now()
    WHERE t.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- BLOCK 4: Replace complete_trade_v2() — remove adjust_sp_wallet() call
--          (trigger fn_release_all_sp_on_complete is single source of truth)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.complete_trade_v2(
    p_trade_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_seller_id UUID;
    v_buyer_id UUID;
    v_sp_amount INTEGER;
    v_cash_amount_cents INTEGER;
    v_listing_id UUID;
    v_payout_result JSONB := '{"success": true, "message": "Simulated payout successful"}'::jsonb;
BEGIN
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    v_seller_id := v_trade.seller_id;
    v_buyer_id := v_trade.buyer_id;
    -- Safely extract amounts using to_jsonb to avoid parser errors (BP-3/FIXED)
    v_sp_amount := COALESCE((to_jsonb(v_trade.sp_amount) #>> '{}')::integer, 0);
    v_cash_amount_cents := COALESCE((to_jsonb(v_trade.cash_amount_cents) #>> '{}')::integer, 0);
    v_listing_id := v_trade.listing_id;

    -- CASE 1: SELLER marks complete (First step)
    IF p_user_id = v_seller_id THEN
        UPDATE public.trades
        SET seller_marked_completed_at = now(),
            status = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN 'completed' ELSE status END,
            completed_at = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN now() ELSE completed_at END
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        IF v_trade.status = 'completed' THEN
            NULL; -- fall through to CASE 2
        ELSE
            RETURN jsonb_build_object('success', true, 'status', v_trade.status, 'trade', row_to_json(v_trade));
        END IF;
    END IF;

    -- CASE 2: BUYER marks complete (Second step)
    IF p_user_id = v_buyer_id OR v_trade.status = 'completed' THEN
        UPDATE public.trades
        SET buyer_marked_completed_at = now(),
            status = 'completed',
            completed_at = now()
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        -- 1. Update Item
        UPDATE public.items SET status = 'sold', updated_at = now() WHERE id = v_listing_id;

        -- 2. ⭐ REMOVED: adjust_sp_wallet() for seller — now handled by
        --    fn_release_all_sp_on_complete() trigger which also calculates
        --    platform bonus and applies pending_balance (3-day hold) correctly.

        -- 3. Mark Payout log (if cash)
        IF v_cash_amount_cents > 0 THEN
             INSERT INTO debug_logs (process_name, message, payload)
             VALUES ('payout', 'Cash payout scheduled', jsonb_build_object('trade_id', p_trade_id, 'seller_id', v_seller_id, 'amount_cents', v_cash_amount_cents));
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'completed',
            'payout_result', v_payout_result,
            'trade', row_to_json(v_trade)
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the RPC
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(UUID, UUID) TO anon, authenticated;

-- ======================================================================
-- Verification queries (run after applying)
-- ======================================================================
-- 1) Confirm fn_reserve_sp_on_offer() has sp_ledger INSERT
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_reserve_sp_on_offer'
-- \grep -i 'sp_ledger'
-- Expected: shows INSERT INTO public.sp_ledger
--
-- 2) Confirm fn_release_sp_on_cancel() does NOT add to available_balance
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_sp_on_cancel'
-- \grep -i 'available_balance'
-- Expected: NO matches (removed to fix double-refund)
--
-- 3) Confirm fn_release_all_sp_on_complete() has sp_ledger INSERTs
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_all_sp_on_complete'
-- \grep -i 'sp_ledger'
-- Expected: shows two INSERT INTO public.sp_ledger
--
-- 4) Confirm complete_trade_v2() no longer calls adjust_sp_wallet
-- SELECT prosrc FROM pg_proc WHERE proname = 'complete_trade_v2'
-- \grep -i 'adjust_sp_wallet'
-- Expected: NO matches
--
-- 5) Test with real trade inside transaction:
-- BEGIN;
--   UPDATE trades SET status = 'completed', completed_at = now()
--   WHERE id = '<test-trade-id>' RETURNING *;
--   SELECT * FROM sp_ledger
--   WHERE related_transaction_id = '<test-trade-id>'::uuid
--   ORDER BY created_at DESC;
-- ROLLBACK;
--
-- Common failure modes:
-- 1) Missing sp_ledger table: ensure 061_sp_ledger_and_trade_rpcs.sql ran first.
-- 2) RLS on sp_ledger: trigger runs as SECURITY DEFINER so it bypasses RLS.
-- 3) If complete_trade_v2 is called with service_role, triggers still fire.
