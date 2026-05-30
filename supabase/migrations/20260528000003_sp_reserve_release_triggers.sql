-- File: supabase/migrations/20260528000003_sp_reserve_release_triggers.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (TFV2-003)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Reserve buyer SP when pending offers are created.
-- 2) Release reserved SP on cancellation.
-- 3) On completion, transfer buyer reserved SP and compute seller pending SP (buyer SP + platform SP bonus).

-- -----------------------------------------------------------------------------
-- 1) Shared helper: read numeric admin_config values with defaults.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trade_config_int(
  p_key text,
  p_default integer
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value text;
BEGIN
  SELECT ac.value
  INTO v_value
  FROM public.admin_config ac
  WHERE ac.key = p_key
  LIMIT 1;

  RETURN public.fn_admin_config_safe_int(v_value, p_default);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trade_config_numeric(
  p_key text,
  p_default numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value text;
  v_clean text;
BEGIN
  SELECT ac.value
  INTO v_value
  FROM public.admin_config ac
  WHERE ac.key = p_key
  LIMIT 1;

  v_clean := regexp_replace(COALESCE(v_value, ''), '[^0-9\.-]', '', 'g');

  IF v_clean = '' OR v_clean = '-' OR v_clean = '.' OR v_clean = '-.' THEN
    RETURN p_default;
  END IF;

  RETURN v_clean::numeric;
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_default;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Set offer expiration automatically for new pending trades.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_offer_expires_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer_timeout_hours integer := 48;
BEGIN
  IF NEW.status = 'pending' AND NEW.offer_expires_at IS NULL THEN
    v_offer_timeout_hours := public.fn_trade_config_int('offer_timeout_hours', 48);
    NEW.offer_expires_at := now() + make_interval(hours => v_offer_timeout_hours);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_offer_expires_at ON public.trades;
CREATE TRIGGER trigger_set_offer_expires_at
BEFORE INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_offer_expires_at();

-- -----------------------------------------------------------------------------
-- 3) Reserve SP when offer is created.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reserve_sp_on_offer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_wallet_state text;
  v_available_balance integer;
BEGIN
  IF NEW.status <> 'pending' OR COALESCE(NEW.sp_amount, 0) <= 0 THEN
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

DROP TRIGGER IF EXISTS trigger_reserve_sp_on_offer ON public.trades;
CREATE TRIGGER trigger_reserve_sp_on_offer
AFTER INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_reserve_sp_on_offer();

-- -----------------------------------------------------------------------------
-- 4) No-op trigger placeholder for acceptance status.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_transfer_sp_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'payment_processing' THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_transfer_sp_on_accept ON public.trades;
CREATE TRIGGER trigger_transfer_sp_on_accept
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_transfer_sp_on_accept();

-- -----------------------------------------------------------------------------
-- 5) Release reserved SP if offer/trade is cancelled.
-- -----------------------------------------------------------------------------
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

  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance + OLD.sp_amount,
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

DROP TRIGGER IF EXISTS trigger_release_sp_on_cancel ON public.trades;
CREATE TRIGGER trigger_release_sp_on_cancel
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_release_sp_on_cancel();

-- -----------------------------------------------------------------------------
-- 6) On completion:
--    - consume buyer reserved SP (if reserved)
--    - award seller pending SP (buyer SP + platform bonus when eligible)
-- -----------------------------------------------------------------------------
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

  IF v_buyer_sp > 0 AND NEW.sp_reserved_at IS NOT NULL THEN
    SELECT w.id
    INTO v_buyer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.buyer_id
    FOR UPDATE;

    IF v_buyer_wallet_id IS NOT NULL THEN
      UPDATE public.sp_wallets w
      SET
        reserved_sp = GREATEST(0, w.reserved_sp - v_buyer_sp),
        lifetime_spent = w.lifetime_spent + v_buyer_sp,
        updated_at = now()
      WHERE w.id = v_buyer_wallet_id;
    END IF;
  END IF;

  IF v_total_sp > 0 THEN
    SELECT w.id
    INTO v_seller_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = NEW.seller_id
    FOR UPDATE;

    IF v_seller_wallet_id IS NULL THEN
      PERFORM public.initialize_sp_wallet(NEW.seller_id);

      SELECT w.id
      INTO v_seller_wallet_id
      FROM public.sp_wallets w
      WHERE w.user_id = NEW.seller_id
      FOR UPDATE;
    END IF;

    UPDATE public.sp_wallets w
    SET
      pending_balance = w.pending_balance + v_total_sp,
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

    INSERT INTO public.user_notifications (user_id, category, type, title, body, data)
    VALUES (
      NEW.seller_id,
      'sp_events',
      'sp_pending_release',
      'Swap Points Pending Release',
      format('You earned %s SP. They will be released in %s days.', v_total_sp, v_pending_release_days),
      jsonb_build_object(
        'trade_id', NEW.id,
        'sp_total', v_total_sp,
        'pending_release_at', now() + make_interval(days => v_pending_release_days)
      )
    );
  ELSE
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

DROP TRIGGER IF EXISTS trigger_release_all_sp_on_complete ON public.trades;
CREATE TRIGGER trigger_release_all_sp_on_complete
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_release_all_sp_on_complete();

-- -----------------------------------------------------------------------------
-- Verification queries
-- -----------------------------------------------------------------------------
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
--   AND event_object_table = 'trades'
--   AND trigger_name IN (
--     'trigger_set_offer_expires_at',
--     'trigger_reserve_sp_on_offer',
--     'trigger_transfer_sp_on_accept',
--     'trigger_release_sp_on_cancel',
--     'trigger_release_all_sp_on_complete'
--   )
-- ORDER BY trigger_name;
--
-- SELECT public.fn_trade_config_int('offer_timeout_hours', 48) AS offer_timeout_hours,
--        public.fn_trade_config_int('pending_sp_release_days', 3) AS pending_sp_release_days;
--
-- Common failure modes:
-- 1) Wallet state not active: reservation fails by design to protect frozen/suspended wallets.
-- 2) Missing initialize_sp_wallet grants: seller wallet autoprovision can fail if grants were removed.
-- 3) Notification table missing: ensure user_notifications exists before relying on pending release notifications.
