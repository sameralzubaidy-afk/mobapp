-- File: supabase/migrations/20260715000001_points_redemption_caps_and_accept_transfer.sql
-- Mode B: Idempotent Rerunnable Migration
-- Purpose:
--   1. Add sp_redemption_cap to categories table (per-category max SP redeemable per item)
--   2. Replace fn_transfer_sp_on_accept NO-OP with real SP transfer logic:
--      On seller acceptance (status → payment_processing):
--        a) Debit buyer wallet for sp_amount (transfer from reserved to actual debit)
--        b) Credit seller wallet for sp_amount + platform bonus (seller_side only)
--        c) Create sp_ledger entries for buyer (final spend) and seller (earn_reward)
--        d) Reduce seller cash payout tracking

-- ======================================================================
-- BLOCK 1: Schema — Add sp_redemption_cap to categories
-- ======================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sp_redemption_cap'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN sp_redemption_cap INTEGER DEFAULT NULL;
    
    COMMENT ON COLUMN public.categories.sp_redemption_cap IS
      'Maximum SP a buyer can redeem per item in this category. NULL = no category-level cap (50% global cap still applies).';
  END IF;
END $$;

-- Seed some sensible defaults for existing categories (optional, can be admin-configured)
-- NULL cap means only the 50% global cap applies
UPDATE public.categories
SET sp_redemption_cap = 200
WHERE name ILIKE '%baby%gear%' AND sp_redemption_cap IS NULL;

UPDATE public.categories
SET sp_redemption_cap = 100
WHERE name ILIKE '%toy%' AND sp_redemption_cap IS NULL;

-- Verification:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'categories' AND column_name = 'sp_redemption_cap';
-- SELECT id, name, sp_redemption_cap FROM categories WHERE sp_redemption_cap IS NOT NULL;


-- ======================================================================
-- BLOCK 2: Replace fn_transfer_sp_on_accept — real SP transfer on acceptance
-- ======================================================================
DROP FUNCTION IF EXISTS public.fn_transfer_sp_on_accept() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_transfer_sp_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_buyer_wallet_id uuid;
  v_seller_wallet_id uuid;
  v_buyer_balance_before integer;
  v_buyer_balance_after integer;
  v_seller_balance_before integer;
  v_seller_balance_after integer;
  v_sp_amount integer;
  v_platform_bonus integer;
  v_category_multiplier numeric;
  v_pending_release_days integer;
  v_seller_wallet_state text;
BEGIN
  -- Only fire when moving from pending → payment_processing (seller acceptance)
  IF OLD.status <> 'pending' OR NEW.status <> 'payment_processing' THEN
    RETURN NEW;
  END IF;

  v_sp_amount := COALESCE(NEW.sp_amount, 0);
  IF v_sp_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- ── Resolve category multiplier for platform bonus ──
  v_category_multiplier := COALESCE(NEW.sp_category_multiplier, 0);
  IF v_category_multiplier <= 0 THEN
    v_category_multiplier := public.fn_trade_config_numeric('sp_category_multiplier', 1);
  END IF;

  -- Platform bonus = sp_amount × (multiplier - 1), floored to integer
  -- e.g., multiplier=1.10 → bonus = 10% of sp_amount
  v_platform_bonus := FLOOR(v_sp_amount * (v_category_multiplier - 1));

  v_pending_release_days := public.fn_trade_config_int('pending_sp_release_days', 3);

  -- ── DEBIT BUYER: transfer from reserved to actual spent ──
  SELECT w.id, w.available_balance
  INTO v_buyer_wallet_id, v_buyer_balance_before
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.buyer_id
  FOR UPDATE;

  IF v_buyer_wallet_id IS NULL THEN
    RAISE WARNING 'fn_transfer_sp_on_accept: buyer wallet not found for %', NEW.buyer_id;
    RETURN NEW;
  END IF;

  -- Release reserved_sp (it was reserved at offer time) — the debit already happened
  -- in fn_reserve_sp_on_offer(). Now we just clear the reservation.
  UPDATE public.sp_wallets w
  SET
    reserved_sp = GREATEST(0, w.reserved_sp - v_sp_amount),
    lifetime_spent = w.lifetime_spent + v_sp_amount,
    updated_at = now()
  WHERE w.id = v_buyer_wallet_id;

  v_buyer_balance_after := v_buyer_balance_before;

  -- Log buyer's final spend (replaces the reservation ledger entry conceptually)
  -- We create a second entry marking the spend as "finalized" (different from the
  -- reservation entry which was already created by fn_reserve_sp_on_offer)
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, created_at
  ) VALUES (
    v_buyer_wallet_id, NEW.buyer_id, 'spend_purchase', -v_sp_amount,
    v_buyer_balance_before, v_buyer_balance_after,
    'SP transferred to seller — trade #' || NEW.id || ' accepted',
    NEW.id, now()
  );

  -- ── CREDIT SELLER: sp_amount + platform bonus, pending release ──
  SELECT w.id, w.pending_balance, w.state
  INTO v_seller_wallet_id, v_seller_balance_before, v_seller_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = NEW.seller_id
  FOR UPDATE;

  IF v_seller_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(NEW.seller_id);
    SELECT w.id, w.pending_balance, w.state
    INTO v_seller_wallet_id, v_seller_balance_before, v_seller_wallet_state
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;
  END IF;

  IF v_seller_wallet_id IS NULL THEN
    RAISE WARNING 'fn_transfer_sp_on_accept: seller wallet not found for %', NEW.seller_id;
    RETURN NEW;
  END IF;

  -- Credit seller pending_balance for both buyer SP and platform bonus
  UPDATE public.sp_wallets w
  SET
    pending_balance = w.pending_balance + v_sp_amount + v_platform_bonus,
    lifetime_earned = w.lifetime_earned + v_sp_amount + v_platform_bonus,
    updated_at = now()
  WHERE w.id = v_seller_wallet_id;

  v_seller_balance_after := v_seller_balance_before + v_sp_amount + v_platform_bonus;

  -- Log seller earn (buyer SP + platform bonus)
  INSERT INTO public.sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, created_at
  ) VALUES (
    v_seller_wallet_id, NEW.seller_id, 'earn_reward', v_sp_amount + v_platform_bonus,
    v_seller_balance_before, v_seller_balance_after,
    'Received ' || v_sp_amount || ' SP + ' || v_platform_bonus || ' bonus from trade #' || NEW.id,
    NEW.id, now()
  );

  -- ── Update trade record with seller-side SP amounts ──
  UPDATE public.trades t
  SET
    seller_sp_earned = COALESCE(t.seller_sp_earned, 0) + v_sp_amount + v_platform_bonus,
    seller_sp_bonus = v_platform_bonus,
    sp_transferred_at = now(),
    updated_at = now()
  WHERE t.id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_transfer_sp_on_accept ON public.trades;
CREATE TRIGGER trigger_transfer_sp_on_accept
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_transfer_sp_on_accept();

-- ======================================================================
-- BLOCK 3: Add seller_sp_earned and seller_sp_bonus columns to trades
-- ======================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'seller_sp_earned'
  ) THEN
    ALTER TABLE public.trades
      ADD COLUMN seller_sp_earned INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.trades.seller_sp_earned IS
      'Total SP credited to seller (buyer SP + platform bonus). Set at acceptance.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'seller_sp_bonus'
  ) THEN
    ALTER TABLE public.trades
      ADD COLUMN seller_sp_bonus INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.trades.seller_sp_bonus IS
      'Platform-funded SP bonus (seller-side only). Set at acceptance.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'sp_transferred_at'
  ) THEN
    ALTER TABLE public.trades
      ADD COLUMN sp_transferred_at TIMESTAMPTZ;
    COMMENT ON COLUMN public.trades.sp_transferred_at IS
      'Timestamp when SP was transferred from buyer to seller (set at acceptance).';
  END IF;
END $$;

-- ======================================================================
-- BLOCK 4: Add sp_redemption_cap to admin_config (global fallback)
-- ======================================================================
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES ('sp_redemption_cap_global', '100', 'Global max SP redeemable per item when category has no specific cap', 'swap_points', 'number', FALSE, TRUE)
ON CONFLICT (key) DO NOTHING;

-- ======================================================================
-- BLOCK 5: RPC — Get buyer's available SP balance (for live balance check)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_sp_balance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_available integer;
  v_reserved integer;
  v_state text;
BEGIN
  SELECT w.id, w.available_balance, w.reserved_sp, w.state
  INTO v_wallet_id, v_available, v_reserved, v_state
  FROM public.sp_wallets w
  WHERE w.user_id = auth.uid();

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'available_balance', 0,
        'reserved_sp', 0,
        'state', 'no_wallet'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'available_balance', v_available,
      'reserved_sp', v_reserved,
      'state', v_state
    )
  );
END;
$$;

-- ======================================================================
-- BLOCK 6: RPC — Get category SP redemption cap for a listing
-- ======================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_category_sp_cap(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer;
  v_global_cap integer;
BEGIN
  -- Try category-specific cap first
  SELECT c.sp_redemption_cap
  INTO v_cap
  FROM public.items i
  JOIN public.categories c ON c.id = i.category_id
  WHERE i.id = p_listing_id;

  -- Fall back to global cap from admin_config
  IF v_cap IS NULL THEN
    SELECT COALESCE((ac.value)::integer, 100)
    INTO v_global_cap
    FROM public.admin_config ac
    WHERE ac.key = 'sp_redemption_cap_global';

    v_cap := v_global_cap;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'listing_id', p_listing_id,
      'sp_redemption_cap', COALESCE(v_cap, 100)
    )
  );
END;
$$;

-- ======================================================================
-- BLOCK 7: Update fn_release_all_sp_on_complete — skip if already transferred at acceptance
-- ======================================================================
DROP FUNCTION IF EXISTS public.fn_release_all_sp_on_complete() CASCADE;

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
    IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
      SELECT w.id INTO v_buyer_wallet_id
      FROM public.sp_wallets w WHERE w.user_id = NEW.buyer_id FOR UPDATE;

      IF v_buyer_wallet_id IS NOT NULL THEN
        SELECT COALESCE(w.available_balance, 0)
        INTO v_buyer_balance_before
        FROM public.sp_wallets w WHERE w.id = v_buyer_wallet_id;

        UPDATE public.sp_wallets w
        SET reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
            lifetime_spent = w.lifetime_spent + v_buyer_sp,
            updated_at = now()
        WHERE w.id = v_buyer_wallet_id;

        v_buyer_balance_after := v_buyer_balance_before;

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


-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after Block 1, then after Blocks 2-6):
-- ═══════════════════════════════════════════════════════════════════════

-- After Block 1:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'sp_redemption_cap';

-- After Blocks 2-3:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'trades' AND column_name IN ('seller_sp_earned', 'seller_sp_bonus', 'sp_transferred_at');

-- After Blocks 5-6:
-- SELECT proname FROM pg_proc WHERE proname IN ('rpc_get_buyer_sp_balance', 'rpc_get_category_sp_cap');

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (if needed):
--   DROP FUNCTION IF EXISTS public.fn_transfer_sp_on_accept() CASCADE;
--   ALTER TABLE public.trades DROP COLUMN IF EXISTS seller_sp_earned;
--   ALTER TABLE public.trades DROP COLUMN IF EXISTS seller_sp_bonus;
--   ALTER TABLE public.trades DROP COLUMN IF EXISTS sp_transferred_at;
--   ALTER TABLE public.categories DROP COLUMN IF EXISTS sp_redemption_cap;
--   DROP FUNCTION IF EXISTS public.rpc_get_buyer_sp_balance();
--   DROP FUNCTION IF EXISTS public.rpc_get_category_sp_cap(UUID);
--   DELETE FROM public.admin_config WHERE key = 'sp_redemption_cap_global';
-- ═══════════════════════════════════════════════════════════════════════
