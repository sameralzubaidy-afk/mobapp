-- Fix SP Category Multiplier Formula (User Feedback 2026-06-07)
-- Mode: Idempotent Rerunnable Migration
--
-- Bug: Platform SP calculation used WRONG formula:
--   OLD (WRONG): platform_sp = FLOOR(price × 0.25 × multiplier)
--   NEW (CORRECT): seller_total_sp = buyer_sp × multiplier (when buyer uses SP)
--                  seller_total_sp = price × multiplier (when buyer pays all cash)
--
-- Example (user's feedback):
--   $50 item, 1.10× multiplier
--   Buyer offers: 30 SP + $20 cash
--   OLD result: 30 SP (buyer) + 14 SP (platform) = 44 SP
--   NEW result: 30 SP × 1.10 = 33 SP ✅
--
-- Example (all cash):
--   $50 item, 1.10× multiplier
--   Buyer offers: $50 cash (0 SP)
--   NEW result: $50 × 1.10 = 55 SP ✅
--
-- Matches ADMIN-CATEGORY-MANAGEMENT.md line 890:
--   "Seller earns: 55 SP (1.10×)" for $50 item

-- ======================================================================
-- BLOCK 1: fn_release_all_sp_on_complete() — CORRECTED SP FORMULA
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

  -- ⭐ FIX: CORRECTED SP FORMULA per user feedback + ADMIN-CATEGORY-MANAGEMENT.md
  -- If seller is subscriber + listing accepts SP → calculate total SP with multiplier
  IF v_seller_is_subscriber AND v_accepts_swap_points THEN
    IF v_buyer_sp > 0 THEN
      -- Buyer used SP: multiply buyer's SP by category multiplier
      -- Example: 30 SP × 1.10 = 33 SP
      v_total_sp := FLOOR(v_buyer_sp * v_category_multiplier);
    ELSIF v_item_price_cents > 0 THEN
      -- Buyer paid all cash: multiply item price by category multiplier
      -- Example: $50 × 1.10 = 55 SP
      v_total_sp := FLOOR((v_item_price_cents::numeric / 100) * v_category_multiplier);
    END IF;
  ELSE
    -- Non-subscriber seller OR cash-only listing → no SP earned
    v_total_sp := 0;
  END IF;

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

      -- Log buyer's SP spend to sp_ledger (was missing — TC-A02)
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
  -- SELLER: ✅ D-17 FIX - Release ALL SP in ONE event
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
    -- Description now shows formula used (buyer SP × multiplier OR price × multiplier)
    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      CASE 
        WHEN v_buyer_sp > 0 THEN 
          format('Trade reward: %s SP (buyer %s SP × %.2f multiplier)', v_total_sp, v_buyer_sp, v_category_multiplier)
        ELSE
          format('Trade reward: %s SP (price $%.2f × %.2f multiplier)', v_total_sp, v_item_price, v_category_multiplier)
      END,
      NEW.id, now()
    );

    -- Single notification for ALL SP earned (D-17 compliance)
    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id,
      'sp_events',
      'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP. They will be released in %s days.',
             v_total_sp, v_pending_release_days),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'sp_formula', CASE 
          WHEN v_buyer_sp > 0 THEN 'buyer_sp_multiplied'
          ELSE 'price_multiplied'
        END,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
    -- No SP earned (non-subscriber seller OR cash-only listing)
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
-- Verification queries (run after applying)
-- ======================================================================
-- 1) Confirm new formula exists
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_release_all_sp_on_complete'
-- \grep -i 'FLOOR(v_buyer_sp * v_category_multiplier)'
-- Expected: shows corrected formula
--
-- 2) Test with real trade inside transaction:
-- BEGIN;
--   -- Simulate: $50 item, buyer offers 30 SP, multiplier = 1.10
--   UPDATE trades 
--   SET status = 'completed', completed_at = now(),
--       sp_amount = 30, sp_category_multiplier = 1.10
--   WHERE id = '<test-trade-id>' 
--   RETURNING *;
--
--   -- Check seller wallet
--   SELECT pending_balance, lifetime_earned 
--   FROM sp_wallets 
--   WHERE user_id = '<seller-user-id>';
--   -- Expected: pending_balance increased by FLOOR(30 × 1.10) = 33 SP
--
--   -- Check sp_ledger
--   SELECT description, amount 
--   FROM sp_ledger
--   WHERE related_transaction_id = '<test-trade-id>'::uuid
--   ORDER BY created_at DESC;
--   -- Expected: description mentions "buyer 30 SP × 1.10 multiplier"
--   -- Expected: amount = 33
-- ROLLBACK;
--
-- Common failure modes:
-- 1) Missing sp_ledger table: ensure 061_sp_ledger_and_trade_rpcs.sql ran first.
-- 2) Trigger runs as SECURITY DEFINER so it bypasses RLS.
-- 3) If complete_trade_v2 is called with service_role, triggers still fire.
