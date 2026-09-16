-- File: supabase/migrations/20260828000002_dt19_reserve_ledger_and_cash_only_counter.sql
-- Mode B: Idempotent Rerunnable Migration
--
-- Dev Task 19 (P2 batch) — Fix 1 (SP reserve ledger gap) + Fix 3 (seller-ignore
-- counter only tracks SP offers). Both touch fn_reserve_sp_on_offer, so they are
-- shipped in one migration. Fix 1 additionally requires reconciling the
-- completion-time buyer ledger entry to avoid a double charge.
--
-- Fix 1 — Missing spend_purchase ledger entry on SP reserve:
--   SP reservation on offer submission debits available_balance and bumps
--   reserved_sp, but the deployed fn_reserve_sp_on_offer (last rewritten by
--   20260810000010_r11_r6_sp_caps_and_entitlement.sql, 2026-08-10) writes NO
--   sp_ledger row — only refunds log 'earn_refund'. The ledger is incomplete on
--   the debit side (verified live: B01 trade 2c1a5228 shows only earn_refund).
--   This migration restores the 'spend_purchase' ledger INSERT at reserve time,
--   matching the original TC-A02 design (20260606000001).
--
--   Double-charge guard (REQUIRED for Fix 1): 20260715000001 re-added a buyer
--   'spend_purchase' INSERT to fn_release_all_sp_on_complete (the June-2026
--   double-charge bug — spend_purchase logged twice per completed trade). If we
--   add the reserve entry WITHOUT removing the completion one, every completed
--   SP trade gets two debits again. This migration also removes the buyer
--   'spend_purchase' INSERT from fn_release_all_sp_on_complete (wallet update
--   reserved->spent unchanged; seller 'earn_reward' unchanged). Canonical end
--   state per the double-charge fix guide:
--     - Reserve:  'spend_purchase' (debit, -sp_amount)         [fix 1]
--     - Cancel:   'earn_refund'  (credit, +sp_amount, via RPC) [existing]
--     - Complete: buyer's reserve entry stays; seller 'earn_reward' [existing]
--
-- Fix 3 — Seller-ignore counter only tracked SP offers:
--   fn_reserve_sp_on_offer early-returned `... OR COALESCE(NEW.sp_amount,0)<=0`,
--   so cash-only offers never incremented listing_offer_stats.unanswered_offer_count
--   and the seller-ignore prompt never fired for cash-only listings. The counter
--   increment now runs for EVERY pending offer (cash-only AND SP); the SP
--   reservation block is guarded separately by sp_amount > 0.

-- ======================================================================
-- BLOCK 1: fn_reserve_sp_on_offer — counter for all pending offers (fix 3)
--          + spend_purchase ledger on reserve (fix 1)
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
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- DT-19 (Fix 3): increment the seller-ignore counter for EVERY pending offer —
  -- cash-only AND SP — so the seller-ignore prompt fires for cash-only listings
  -- too. Previously this increment sat behind the SP early-return, so cash-only
  -- offers never touched listing_offer_stats.unanswered_offer_count.
  INSERT INTO public.listing_offer_stats (listing_id, unanswered_offer_count, last_offer_received_at, updated_at)
  VALUES (NEW.listing_id, 1, now(), now())
  ON CONFLICT (listing_id)
  DO UPDATE SET
    unanswered_offer_count = public.listing_offer_stats.unanswered_offer_count + 1,
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

  -- DT-19 (Fix 1): restore the spend_purchase ledger entry on reserve. The
  -- reservation debits available_balance, so it MUST log a ledger row to keep
  -- the ledger complete on the debit side (refunds already log earn_refund).
  -- Regressed by 20260810000010 which re-created this function without the
  -- sp_ledger INSERT. The completion function no longer re-logs the buyer debit
  -- (see BLOCK 2) so there is exactly ONE spend_purchase per trade.
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

-- ======================================================================
-- BLOCK 2: fn_release_all_sp_on_complete — drop the buyer spend_purchase
--          re-log (double-charge guard). Seller earn_reward unchanged.
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

    UPDATE public.trades t
    SET sp_earned_at_completion = v_total_sp,
        pending_sp_release_at = now() + make_interval(days => v_pending_release_days),
        updated_at = now()
    WHERE t.id = NEW.id;

    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_total_sp,
      v_seller_pending_before, v_seller_pending_after,
      format('Trade completion: %s SP platform earning', v_platform_sp),
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
        updated_at = now()
    WHERE t.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- BLOCK 3: Recreate both triggers (idempotent; CREATE OR REPLACE on the
--          functions above already points existing triggers at the new bodies,
--          DROP+CREATE keeps the definition explicit and rerun-safe).
-- ======================================================================
DROP TRIGGER IF EXISTS trigger_reserve_sp_on_offer ON public.trades;
CREATE TRIGGER trigger_reserve_sp_on_offer
AFTER INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_reserve_sp_on_offer();

DROP TRIGGER IF EXISTS trigger_release_all_sp_on_complete ON public.trades;
CREATE TRIGGER trigger_release_all_sp_on_complete
AFTER UPDATE ON public.trades
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
EXECUTE FUNCTION public.fn_release_all_sp_on_complete();

-- ======================================================================
-- BLOCK 4: Backfill reserve 'spend_purchase' for in-flight SP trades
--   Trades created while fn_reserve_sp_on_offer was missing its ledger insert
--   (2026-08-10 .. this migration) that are still pending/in_progress would
--   otherwise complete/cancel with no buyer debit entry. Guard: only trades
--   with SP reserved and NO existing 'spend_purchase' row for that trade — a
--   re-run is a no-op. balance_before is reconstructed (current available +
--   sp_amount) since the debit already happened; best-effort, documented.
--   Staging had 0 affected rows at authoring time; this protects production.
-- ======================================================================
DO $$
DECLARE
  v_rec RECORD;
  v_wallet_id uuid;
  v_available integer;
  v_backfilled integer := 0;
BEGIN
  FOR v_rec IN
    SELECT t.id, t.buyer_id, t.sp_amount
    FROM public.trades t
    WHERE t.status IN ('pending', 'in_progress')
      AND t.sp_amount > 0
      AND t.sp_reserved_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.sp_ledger l
        WHERE l.related_transaction_id = t.id AND l.transaction_type = 'spend_purchase'
      )
  LOOP
    SELECT w.id, COALESCE(w.available_balance, 0)
    INTO v_wallet_id, v_available
    FROM public.sp_wallets w
    WHERE w.user_id = v_rec.buyer_id;

    IF v_wallet_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.sp_ledger (
      wallet_id, user_id, transaction_type, amount,
      balance_before, balance_after, description,
      related_transaction_id, created_at
    ) VALUES (
      v_wallet_id, v_rec.buyer_id, 'spend_purchase', -v_rec.sp_amount,
      v_available + v_rec.sp_amount, v_available,
      'Swap Points committed to trade #' || v_rec.id || ' (backfilled DT19)',
      v_rec.id, now()
    );
    v_backfilled := v_backfilled + 1;
  END LOOP;

  RAISE NOTICE 'DT-19: backfilled % reserve spend_purchase ledger rows', v_backfilled;
END;
$$;

-- ======================================================================
-- VERIFICATION QUERIES (run after applying; see also supabase-sql.instructions)
-- ======================================================================
-- 1. fn_reserve_sp_on_offer now contains the reserve ledger INSERT:
--    SELECT position('spend_purchase' in prosrc) > 0 AS has_reserve_ledger
--    FROM pg_proc WHERE proname = 'fn_reserve_sp_on_offer';
--    Expected: has_reserve_ledger = t
--
-- 2. fn_release_all_sp_on_complete no longer re-logs the buyer debit:
--    (the only 'spend_purchase' remaining must be the seller-side comment/format;
--     expect exactly ONE spend_purchase INSERT source -> count occurrence of
--     "'spend_purchase'" in prosrc for fn_release_all_sp_on_complete = 0, and
--     'earn_reward' = 1)
--    SELECT position("'spend_purchase'" in prosrc) AS sp_pos,
--           position("'earn_reward'" in prosrc) AS earn_pos
--    FROM pg_proc WHERE proname = 'fn_release_all_sp_on_complete';
--    Expected: sp_pos = 0 (no buyer re-log), earn_pos > 0 (seller earn kept)
--
-- 3. Both triggers attached + enabled:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'public.trades'::regclass
--      AND tgname IN ('trigger_reserve_sp_on_offer','trigger_release_all_sp_on_complete');
--    Expected: both rows, tgenabled = 'O'
--
-- 4. Backfill is idempotent (no duplicate reserve entries):
--    SELECT COUNT(*) FROM public.sp_ledger l
--    WHERE l.transaction_type='spend_purchase'
--      AND l.description LIKE '%(backfilled DT19)%';
--    Re-running the DO block must not increase this count.
