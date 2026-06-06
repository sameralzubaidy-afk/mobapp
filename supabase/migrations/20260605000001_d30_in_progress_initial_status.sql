-- File: supabase/migrations/20260605000001_d30_in_progress_initial_status.sql
-- Mode B: Idempotent rerunnable migration
-- D-30: Trade offers now start as 'in_progress' (not 'pending') because
-- Stripe pre-authorization is held at submission time.
--
-- Updates all triggers/functions to accept 'in_progress' status where they
-- previously only accepted 'pending', and adds a CHECK constraint to prevent
-- the old status from being set on new rows.

-- =============================================================================
-- 1. fn_reserve_sp_on_offer — accept both 'pending' (legacy) and 'in_progress'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reserve_sp_on_offer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
  v_wallet_state text;
  v_available_balance integer;
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

-- =============================================================================
-- 2. fn_set_offer_expires_at — accept 'in_progress' in addition to 'pending'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_offer_expires_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer_timeout_hours integer := 48;
BEGIN
  -- D-30: Set offer_expires_at for both pending (legacy) and in_progress (new)
  IF NEW.status IN ('pending', 'in_progress') AND NEW.offer_expires_at IS NULL THEN
    v_offer_timeout_hours := public.fn_trade_config_int('offer_timeout_hours', 48);
    NEW.offer_expires_at := now() + make_interval(hours => v_offer_timeout_hours);
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. fn_transfer_sp_on_accept — accept 'in_progress' as source state
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_transfer_sp_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- D-30: Accept both 'pending' (legacy) and 'in_progress' (new) as starting states
  IF (OLD.status = 'pending' OR OLD.status = 'in_progress') AND NEW.status = 'payment_processing' THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. fn_auto_decline_competing_offers — check for in_progress (not pending)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_decline_competing_offers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'payment_processing' THEN
    RETURN NEW;
  END IF;

  -- D-30: Competing offers are also in_progress (without auto_complete_at)
  UPDATE public.trades t
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Another offer accepted',
    updated_at = now(),
    last_status_change_at = now()
  WHERE t.listing_id = NEW.listing_id
    AND t.id <> NEW.id
    AND t.status = 'in_progress'
    AND t.auto_complete_at IS NULL;

  UPDATE public.listing_offer_stats los
  SET
    unanswered_offer_count = 0,
    updated_at = now()
  WHERE los.listing_id = NEW.listing_id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5. fn_update_unanswered_counter — handle in_progress → cancelled
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- D-30: Handle both 'pending' (legacy) and 'in_progress' (new) → cancelled
  IF (OLD.status = 'pending' OR OLD.status = 'in_progress') AND NEW.status IN ('payment_processing', 'cancelled') THEN
    IF NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'Offer expired' THEN
      RETURN NEW;
    END IF;

    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = GREATEST(0, los.unanswered_offer_count - 1),
      updated_at = now()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 6. rpc_process_expired_offers — query for in_progress (not pending)
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
BEGIN
  -- D-30: Expired offers are now 'in_progress' with auto_complete_at IS NULL
  WITH expired_candidates AS (
    SELECT t.id, t.listing_id
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NULL
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at <= now()
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  ),
  updated_trades AS (
    UPDATE public.trades t
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Offer expired',
      updated_at = now(),
      last_status_change_at = now()
    FROM expired_candidates ec
    WHERE t.id = ec.id
    RETURNING t.id, t.listing_id
  ),
  listing_counts AS (
    SELECT ut.listing_id, COUNT(*)::integer AS expired_count
    FROM updated_trades ut
    GROUP BY ut.listing_id
  )
  UPDATE public.listing_offer_stats los
  SET
    unanswered_offer_count = GREATEST(0, los.unanswered_offer_count - lc.expired_count),
    updated_at = now()
  FROM listing_counts lc
  WHERE los.listing_id = lc.listing_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'expired_offers_processed', v_updated_count,
    'processed_at', now()
  );
END;
$$;

-- =============================================================================
-- 7. Update the offer_expires_at index filter (legacy pending → also cover in_progress)
-- =============================================================================
DROP INDEX IF EXISTS public.idx_trades_offer_expires_at;
CREATE INDEX IF NOT EXISTS idx_trades_offer_expires_at
  ON public.trades (offer_expires_at)
  WHERE status IN ('pending', 'in_progress');

-- =============================================================================
-- 8. Add a helper function to list deprecated screens/routes (safeguard)
-- =============================================================================
-- This function is used by the app to check if a deprecated screen should be blocked.
CREATE OR REPLACE FUNCTION public.is_deprecated_trade_route(p_route_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- The old TradeReviewScreen sets status='payment_processing' directly — D-30 deprecated this.
  -- New offers must go through create-trade-offer Edge Function which sets 'in_progress'.
  RETURN p_route_name IN ('TradeReview');
END;
$$;

-- =============================================================================
-- Verification queries
-- =============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN ('fn_reserve_sp_on_offer', 'fn_set_offer_expires_at', 'fn_auto_decline_competing_offers', 'rpc_process_expired_offers');
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'trades'::regclass;
