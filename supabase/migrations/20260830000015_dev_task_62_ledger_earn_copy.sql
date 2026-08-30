-- =============================================================================
-- DEV TASK 62 (QA Task 8) — Item 4: ledger earn description shows the real
-- credited SP amount
--
-- MODE: B (idempotent, rerunnable)
--
-- Root cause: the live SP-release trigger (fn_release_all_sp_on_complete,
-- latest definition 20260830000001:38) writes the earn ledger description with
-- ONLY the platform bonus:
--   format('Trade completion: %s SP platform earning', v_platform_sp)
-- while the ledger row's amount is v_total_sp = v_buyer_sp + v_platform_sp.
-- Whenever the buyer applied SP, the description under-reports the credited
-- amount (e.g. ledger credits 7 SP but the row reads "3 SP platform earning").
-- The ledger amount itself is correct; only the description disagrees.
--
-- Fix: restore the accurate two-part copy (the pre-June-2026 template at
-- 20260606000001:319) so the description always reflects the real transaction
-- amount:
--   'Trade reward: <buyer_sp> SP from buyer + <platform_sp> SP platform bonus'
--
-- CREATE OR REPLACE FUNCTION keeps the existing attached trigger
-- (trigger_release_all_sp_on_complete) intact — no trigger change needed.
-- This is the FULL body of the live definition, with only the description
-- format string changed (see the DEV-TASK-62-ITEM4 marker below).
-- =============================================================================

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

  v_already_transferred boolean := false;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if SP was already transferred at acceptance time
  v_already_transferred := NEW.sp_transferred_at IS NOT NULL;

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

  IF NOT v_already_transferred THEN
    -- BUYER: Consume reserved SP (only if not transferred at acceptance)
    -- DT-19 (Fix 1): the buyer's 'spend_purchase' ledger debit is logged at
    -- RESERVE time by fn_reserve_sp_on_offer(). Do NOT re-log it here — that
    -- produced the June-2026 double-charge bug ('spend_purchase' twice per
    -- completed trade). Completion only moves reserved -> spent (wallet) and
    -- credits the seller; the buyer's single debit entry comes from reserve.
    IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
      SELECT w.id INTO v_buyer_wallet_id
      FROM public.sp_wallets w WHERE w.user_id = NEW.buyer_id FOR UPDATE;

      IF v_buyer_wallet_id IS NOT NULL THEN
        UPDATE public.sp_wallets w
        SET reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
            lifetime_spent = w.lifetime_spent + v_buyer_sp,
            updated_at = now()
        WHERE w.id = v_buyer_wallet_id;
      END IF;
    END IF;

    v_total_sp := GREATEST(v_buyer_sp + v_platform_sp, 0);
  ELSE
    v_total_sp := GREATEST(v_platform_sp, 0);
  END IF;

  -- SELLER: Release SP to pending_balance
  SELECT w.id, COALESCE(w.pending_balance, 0)
  INTO v_seller_wallet_id, v_seller_pending_before
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.seller_id
  FOR UPDATE;

  IF v_seller_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.seller_id);
    SELECT w.id, COALESCE(w.pending_balance, 0)
    INTO v_seller_wallet_id, v_seller_pending_before
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;
  END IF;

  IF v_total_sp > 0 THEN
    v_seller_pending_after := v_seller_pending_before + v_total_sp;

    UPDATE public.sp_wallets w
    SET pending_balance = v_seller_pending_after,
        lifetime_earned = w.lifetime_earned + v_total_sp,
        updated_at = now()
    WHERE w.id = v_seller_wallet_id;

    -- Dev Task 41 item 9: keep the trade row in sync with the ledger/wallet —
    -- seller_sp_earned / final_sp_amount = total credited, seller_sp_bonus = the
    -- platform-funded portion, sp_transferred_at = completion (the actual
    -- transfer point; the old accept-time transfer is deprecated DT-17).
    UPDATE public.trades t
    SET sp_earned_at_completion = v_total_sp,
        pending_sp_release_at = now() + make_interval(days => v_pending_release_days),
        seller_sp_earned = v_total_sp,
        seller_sp_bonus = v_platform_sp,
        final_sp_amount = v_total_sp,
        sp_transferred_at = now(),
        updated_at = now()
    WHERE t.id = NEW.id;

    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      -- DEV-TASK-62-ITEM4: use the FULL credited amount (buyer SP + platform
      -- bonus) so the description matches the ledger amount. Restores the
      -- pre-June-2026 accurate template (20260606000001:319). Old copy
      -- ("Trade completion: %s SP platform earning", v_platform_sp) used only
      -- the platform bonus and disagreed whenever the buyer paid SP.
      format('Trade reward: %s SP from buyer + %s SP platform bonus', v_buyer_sp, v_platform_sp),
      NEW.id, now()
    );

    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id, 'sp_events', 'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP from trade completion. They will be released in %s days.',
             v_total_sp, v_pending_release_days),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
    UPDATE public.trades t
    SET sp_earned_at_completion = 0,
        pending_sp_release_at = NULL,
        seller_sp_earned = 0,
        seller_sp_bonus = 0,
        final_sp_amount = 0,
        sp_transferred_at = NULL,
        updated_at = now()
    WHERE t.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verification queries (run after applying)
-- -----------------------------------------------------------------------------
-- 1) Confirm the live body has the new copy (search for 'platform bonus'):
--    SELECT position('platform bonus' IN p.prosrc) > 0 AS has_new_copy
--    FROM pg_proc p WHERE p.proname = 'fn_release_all_sp_on_complete';
-- 2) Confirm the trigger is still attached:
--    SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_release_all_sp_on_complete';
-- 3) After 2+ real completions with different SP amounts:
--    SELECT transaction_type, amount, description FROM sp_ledger
--    WHERE transaction_type = 'earn_reward' ORDER BY created_at DESC LIMIT 5;
--    Expect description split to sum to the amount (e.g. amount=7 →
--    "Trade reward: 4 SP from buyer + 3 SP platform bonus").
