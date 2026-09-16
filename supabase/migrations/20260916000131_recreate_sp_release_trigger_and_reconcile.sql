-- File: supabase/migrations/20260828000001_recreate_sp_release_trigger_and_reconcile.sql
-- Mode B: Idempotent Rerunnable Migration
--
-- Dev Task 17 (Revised): Fix missing SP-settlement trigger + reconcile staging.
--
-- Root cause (QA report 2026-08-28, P1):
--   Migration 20260715000001 (points_redemption_caps_and_accept_transfer) L316 ran
--   `DROP FUNCTION IF EXISTS public.fn_release_all_sp_on_complete() CASCADE;`
--   which destroyed `trigger_release_all_sp_on_complete` on public.trades. The
--   FUNCTION was recreated (BLOCK 7) but the TRIGGER was never recreated.
--   complete_trade_v2 relies entirely on that trigger ("SP is handled by
--   fn_release_all_sp_on_complete() trigger — no manual SP call needed"), so every
--   SP trade completing since 2026-07-15 leaves buyer reserved SP stuck, never
--   credits the seller, and writes no sp_ledger rows. Proven live on staging
--   (trade d9e32360) and confirmed by pg_trigger (trigger absent).
--
-- This migration:
--   1. Recreates trigger_release_all_sp_on_complete (WHEN clause form).
--   2. Neutralizes fn_transfer_sp_on_accept into a documented no-op (its gate
--      `pending -> payment_processing` can never fire: D-30 deprecated that
--      status; the accept Edge Function transitions pending -> in_progress
--      directly; zero trades are in payment_processing; its platform-bonus
--      formula (m-1)*S conflicts with the completion function's 0.25*price*m
--      -> split-brain hazard (BP-27) if it were ever "fixed" to fire).
--   3. Reconciles every stuck completed SP trade (status='completed' AND
--      sp_amount>0 AND sp_reserved_at IS NOT NULL AND no seller earn_reward
--      ledger row) by mirroring exactly what fn_release_all_sp_on_complete()
--      + rpc_release_pending_sp() would have done:
--        - Buyer:  reserved_sp -= buyer_sp, lifetime_spent += buyer_sp,
--                  sp_ledger 'spend_purchase' (-buyer_sp)
--        - Seller: pending_balance += total_sp (buyer_sp + platform_sp),
--                  lifetime_earned += total_sp,
--                  sp_ledger 'earn_reward' (+total_sp)
--        - Trade:  sp_earned_at_completion = total_sp,
--                  pending_sp_release_at = completed_at + pending_sp_release_days
--        - Release (window elapsed): pending_balance -> available_balance,
--                  sp_released_at = now()  (mirrors rpc_release_pending_sp)
--      Notification rows are intentionally NOT backfilled (historical noise;
--      money/points integrity is wallet + ledger + trade state).
--
-- Reconciliation set (verified 2026-08-28 on staging, drntwgporzabmxdqykrp):
--   - 2ea0d572-4f7e-4b13-8dba-aa3541a9b6b5  (100 SP, $300, mult 1.10, seller active, 07-19)
--   - d9e32360-45fb-45e3-8353-0f815c88c441  (8 SP, $30 LEGO, mult 1.20, seller trial, 08-28)
--   The 10 older completed SP trades lacking a seller earn_reward row all have
--   sp_reserved_at IS NULL (pre-modern-reserve legacy, Feb-May 2026) and are
--   intentionally NOT reconciled — their SP was never reserved from the buyer,
--   so crediting the seller would mint SP from nothing. Flagged as observation.

-- ======================================================================
-- BLOCK 1: Recreate trigger_release_all_sp_on_complete on public.trades
-- ======================================================================
DROP TRIGGER IF EXISTS trigger_release_all_sp_on_complete ON public.trades;

CREATE TRIGGER trigger_release_all_sp_on_complete
AFTER UPDATE ON public.trades
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
EXECUTE FUNCTION public.fn_release_all_sp_on_complete();

-- ======================================================================
-- BLOCK 2: fn_transfer_sp_on_accept -> documented no-op
--   Accept-time SP transfer is effectively DEPRECATED in favor of
--   complete-time release (single source of truth = fn_release_all_sp_on_complete
--   + rpc_release_pending_sp). The old body's status gate (pending ->
--   payment_processing) can never fire, and its platform-bonus formula
--   ((m-1)*S) conflicts with the completion function's (0.25*price*m), so
--   re-enabling it would double-credit the seller (BP-27). Do NOT "fix" the
--   gate to pending -> in_progress without reconciling the two formulas.
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_transfer_sp_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- DEPRECATED (DT-17, 2026-08-28): accept-time SP transfer never fires.
  -- D-30 (20260606000002) removed the payment_processing status; the accept
  -- Edge Function (transactions-accept-bundle) transitions pending ->
  -- in_progress directly, so the old gate (OLD.status='pending' AND
  -- NEW.status='payment_processing') is unreachable and zero trades are in
  -- payment_processing. SP settlement is handled ENTIRELY at completion by
  -- trigger_release_all_sp_on_complete -> fn_release_all_sp_on_complete()
  -- (buyer reserved -> spent; seller pending_balance credit) followed by
  -- rpc_release_pending_sp (pending -> available after 3 days).
  -- Do NOT re-enable accept-time transfer without reconciling its platform
  -- bonus formula ((multiplier-1)*S) against the completion function's
  -- (0.25 * item_price * multiplier) — the two disagree and would
  -- double-credit the seller.
  RETURN NEW;
END;
$$;

-- ======================================================================
-- BLOCK 3: Reconcile stuck completed SP trades (atomic DO block)
--   Guard (idempotent): only processes a trade with no seller 'earn_reward'
--   sp_ledger row for that trade — a re-run is a no-op.
-- ======================================================================
DO $$
DECLARE
  v_rec RECORD;
  v_buyer_sp integer;
  v_platform_sp integer;
  v_total_sp integer;
  v_seller_is_subscriber boolean;
  v_item_price_cents integer;
  v_category_multiplier numeric;
  v_pending_release_days integer;
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;
  v_buyer_balance_before integer;
  v_seller_pending_before integer;
  v_settled_total integer := 0;
  v_released_total integer := 0;
BEGIN
  v_pending_release_days := public.fn_trade_config_int('pending_sp_release_days', 3);

  FOR v_rec IN
    SELECT t.id, t.buyer_id, t.seller_id, t.sp_amount, t.sp_category_multiplier,
           t.sp_reserved_at, t.completed_at, t.listing_id,
           i.price, COALESCE(i.accepts_swap_points, false) AS accepts_sp
    FROM public.trades t
    JOIN public.items i ON i.id = t.listing_id
    WHERE t.status = 'completed'
      AND COALESCE(t.sp_amount, 0) > 0
      AND t.sp_reserved_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.sp_ledger l
        WHERE l.related_transaction_id = t.id
          AND l.user_id = t.seller_id
          AND l.transaction_type = 'earn_reward'
      )
    ORDER BY t.completed_at
  LOOP
    v_buyer_sp := GREATEST(COALESCE(v_rec.sp_amount, 0), 0);

    -- Platform bonus eligibility: seller must have an active/trial subscription.
    SELECT EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = v_rec.seller_id
        AND s.status IN ('active', 'trial')
      ORDER BY s.created_at DESC
      LIMIT 1
    ) INTO v_seller_is_subscriber;

    v_item_price_cents := COALESCE(ROUND(COALESCE(v_rec.price, 0) * 100)::integer, 0);

    v_category_multiplier := COALESCE(v_rec.sp_category_multiplier, 0);
    IF v_category_multiplier <= 0 THEN
      v_category_multiplier := public.fn_trade_config_numeric('sp_category_multiplier', 1);
    END IF;
    IF v_category_multiplier <= 0 THEN
      v_category_multiplier := public.fn_trade_config_numeric('sp_earn_multiplier', 1);
    END IF;

    IF v_seller_is_subscriber AND v_rec.accepts_sp AND v_item_price_cents > 0 THEN
      v_platform_sp := FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier);
    ELSE
      v_platform_sp := 0;
    END IF;

    v_total_sp := GREATEST(v_buyer_sp + v_platform_sp, 0);

    -- BUYER: consume reserved SP (mirrors fn_release_all_sp_on_complete)
    IF v_buyer_sp > 0 THEN
      SELECT w.id INTO v_buyer_wallet_id
      FROM public.sp_wallets w
      WHERE w.user_id = v_rec.buyer_id
      FOR UPDATE;

      IF v_buyer_wallet_id IS NOT NULL THEN
        SELECT COALESCE(w.available_balance, 0) INTO v_buyer_balance_before
        FROM public.sp_wallets w
        WHERE w.id = v_buyer_wallet_id;

        UPDATE public.sp_wallets w
        SET reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
            lifetime_spent = w.lifetime_spent + v_buyer_sp,
            updated_at = now()
        WHERE w.id = v_buyer_wallet_id;

        INSERT INTO public.sp_ledger (
          wallet_id, user_id, transaction_type, amount,
          balance_before, balance_after, description,
          related_transaction_id, created_at
        ) VALUES (
          v_buyer_wallet_id, v_rec.buyer_id, 'spend_purchase', -v_buyer_sp,
          v_buyer_balance_before, v_buyer_balance_before,
          'Swap Points spent on trade #' || v_rec.id || ' (reconciled DT17)',
          v_rec.id, now()
        );
      END IF;
    END IF;

    -- SELLER: credit pending_balance + lifetime_earned (mirrors fn_release_all_sp_on_complete)
    SELECT w.id, COALESCE(w.pending_balance, 0)
    INTO v_seller_wallet_id, v_seller_pending_before
    FROM public.sp_wallets w
    WHERE w.user_id = v_rec.seller_id
    FOR UPDATE;

    IF v_seller_wallet_id IS NULL THEN
      PERFORM public.initialize_sp_wallet(v_rec.seller_id);
      SELECT w.id, COALESCE(w.pending_balance, 0)
      INTO v_seller_wallet_id, v_seller_pending_before
      FROM public.sp_wallets w
      WHERE w.user_id = v_rec.seller_id
      FOR UPDATE;
    END IF;

    IF v_total_sp > 0 AND v_seller_wallet_id IS NOT NULL THEN
      UPDATE public.sp_wallets w
      SET pending_balance = w.pending_balance + v_total_sp,
          lifetime_earned = w.lifetime_earned + v_total_sp,
          updated_at = now()
      WHERE w.id = v_seller_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_transaction_id, created_at
      ) VALUES (
        v_seller_wallet_id, v_rec.seller_id, 'earn_reward', v_total_sp,
        v_seller_pending_before, v_seller_pending_before + v_total_sp,
        format('Trade completion: %s SP platform earning (reconciled DT17)', v_platform_sp),
        v_rec.id, now()
      );

      UPDATE public.trades t
      SET sp_earned_at_completion = v_total_sp,
          pending_sp_release_at = COALESCE(v_rec.completed_at, now()) + make_interval(days => v_pending_release_days),
          updated_at = now()
      WHERE t.id = v_rec.id;
    END IF;

    v_settled_total := v_settled_total + 1;

    -- RELEASE if the 3-day pending window has elapsed (mirrors rpc_release_pending_sp)
    IF v_total_sp > 0 AND v_seller_wallet_id IS NOT NULL
       AND (COALESCE(v_rec.completed_at, now()) + make_interval(days => v_pending_release_days)) <= now() THEN
      UPDATE public.sp_wallets w
      SET pending_balance = GREATEST(0, w.pending_balance - v_total_sp),
          available_balance = w.available_balance + v_total_sp,
          updated_at = now()
      WHERE w.id = v_seller_wallet_id;

      UPDATE public.trades t
      SET sp_released_at = now(),
          updated_at = now()
      WHERE t.id = v_rec.id;

      v_released_total := v_released_total + 1;
    END IF;

    RAISE NOTICE 'DT17 reconcile: trade % settled (+% buyer SP, +% seller total, release=%s)',
      v_rec.id, v_buyer_sp, v_total_sp,
      ((COALESCE(v_rec.completed_at, now()) + make_interval(days => v_pending_release_days)) <= now());
  END LOOP;

  RAISE NOTICE 'DT17 reconcile complete: % trades settled, % released', v_settled_total, v_released_total;
END;
$$;

-- ======================================================================
-- BLOCK 4: Verification queries (run after apply)
-- ======================================================================
-- 1) Trigger recreated:
--    SELECT trigger_name, event_manipulation, action_statement
--    FROM information_schema.triggers
--    WHERE event_object_table = 'trades'
--      AND trigger_name = 'trigger_release_all_sp_on_complete';
--    Expected: 1 row, EXECUTE FUNCTION fn_release_all_sp_on_complete()
--
-- 2) fn_transfer_sp_on_accept is a documented no-op:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_transfer_sp_on_accept';
--    Expected: body contains 'DEPRECATED (DT-17' and only 'RETURN NEW;'
--
-- 3) Reconciliation — zero stuck trades remain:
--    SELECT count(*) FROM public.trades t
--    WHERE t.status = 'completed' AND COALESCE(t.sp_amount,0) > 0
--      AND t.sp_reserved_at IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM public.sp_ledger l
--                      WHERE l.related_transaction_id = t.id
--                        AND l.user_id = t.seller_id
--                        AND l.transaction_type = 'earn_reward');
--    Expected: 0
--
-- 4) Per-trade settlement (expect sp_earned_at_completion 182 / 17):
--    SELECT t.id, t.sp_earned_at_completion, t.pending_sp_release_at, t.sp_released_at
--    FROM public.trades t
--    WHERE t.id IN ('2ea0d572-4f7e-4b13-8dba-aa3541a9b6b5','d9e32360-45fb-45e3-8353-0f815c88c441');
--
-- 5) Wallets (before -> after):
--    SELECT w.user_id, w.available_balance, w.pending_balance, w.reserved_sp,
--           w.lifetime_earned, w.lifetime_spent
--    FROM public.sp_wallets w
--    WHERE w.user_id IN ('fe83f218-3f3c-446a-beab-3130f65387cb','b219a7c9-0761-4c61-b2b1-591c7fd09416',
--                        '49243010-f458-4744-add1-a6c84ab95f1f','14be337c-aad6-403f-bab2-ba1a7d80b666');

-- ======================================================================
-- ROLLBACK
--   DROP TRIGGER IF EXISTS trigger_release_all_sp_on_complete ON public.trades;
--   (fn_release_all_sp_on_complete body is untouched by this migration.)
--   fn_transfer_sp_on_accept no-op: restore the R6 body from
--   20260810000010_r11_r6_sp_caps_and_entitlement.sql BLOCK 5 if ever needed.
--   Reconciliation wallet/ledger edits are data mutations; to reverse,
--   subtract the corresponding amounts and delete the '(reconciled DT17)'
--   sp_ledger rows. Pre-release test/staging data only.
-- ======================================================================
