-- ============================================================================
-- R11 + R6 — Category SP Cap Enforcement & Subscription Entitlement Gating
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   R11: Makes the per-category Swap Points config (sp_earning_multiplier "m" +
--        sp_spending_cap_percent) actually ENFORCED by R5 checkout, server-side.
--        Previously the cap was enforced client-side only (mobile UI); a caller
--        hitting the Edge Function directly could submit any sp_amount up to the
--        wallet balance. Now:
--          * fn_item_effective_sp_cap(listing_id) computes the authoritative cap
--            = FLOOR(price × category.sp_spending_cap_percent / 100) [category %
--            OVERRIDES the global 50% — owner decision 2026-08-09], then bounded
--            by the category's absolute sp_redemption_cap (or the legacy
--            admin_config.sp_redemption_cap_global fallback when no absolute).
--          * fn_reserve_sp_on_offer (DB trigger, fires on offer INSERT) rejects
--            any offer whose sp_amount exceeds that cap (HP-4 DB invariant).
--   R6: Flips the grace-period model to match the R6 spec (2026-08-09):
--          * grace period  -> CAN spend existing SP, CANNOT earn new SP
--          * post-grace    -> wallet FROZEN (NOT deleted) — can't earn or spend
--          * resubscribe   -> frozen balance becomes spendable again
--        New/changed objects:
--          * get_subscription_summary: can_spend_sp now TRUE for grace_period;
--            adds can_earn_sp (TRUE only for trial/active). DROP first (BP-12 —
--            RETURNS TABLE signature changed).
--          * fn_get_sp_entitlement(user_id): shared entitlement resolver used by
--            create-trade-offer so entitlement checks run before any SP action.
--          * fn_reserve_sp_on_offer: allows spend when wallet state is 'active'
--            OR 'grace_period' (grace can spend existing SP).
--          * fn_transfer_sp_on_accept: platform bonus (net-new SP from the
--            multiplier, (m-1)×S) is granted ONLY when the seller has an
--            active/trial subscription — grace/expired sellers receive the
--            buyer's transferred SP but no newly-created bonus.
--          * downgrade_trial_to_grace: wallet state becomes 'grace_period'
--            (spendable) instead of 'frozen'.
--          * rpc_set_sp_wallet_state(user_id, state): first-party freeze /
--            unfreeze / grace primitive — replaces the external
--            SP_SUBSCRIPTION_UNFREEZE_URL dependency (not in this repo) so
--            resubscribe-restores-frozen-SP is deterministic and testable.
--
-- Backward compatibility:
--   * All changes are CREATE OR REPLACE on existing functions (same signatures)
--     or new additive functions — no columns/tables dropped or renamed.
--   * Existing pending offers are untouched (cap/entitlement fire on new inserts
--     and new transfer events only).
--   * A wallet already in 'frozen' state from an earlier grace entry is NOT
--     auto-migrated here (data stays consistent; the next state transition
--     follows the new rules). See verification #5 for a helper to reconcile.
--
-- RULES applied: SQL-0 (Mode B), BP-9 order, BP-10 verification, BP-12 (DROP
--   before RETURNS TABLE change), BP-5 (SECURITY DEFINER + search_path),
--   p_/v_ naming, qualified columns, HP-4 (DB invariant cap check).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1 — R11: authoritative per-item SP redemption cap
-- ---------------------------------------------------------------------------
-- New categories default to the global 50% spend cap (category % OVERRIDES the
-- global only when an admin sets it higher). Existing rows are untouched —
-- they remain whatever the admin configured (may be >50%).
ALTER TABLE public.categories ALTER COLUMN sp_spending_cap_percent SET DEFAULT 50;

CREATE OR REPLACE FUNCTION public.fn_item_effective_sp_cap(p_listing_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- SECURITY DEFINER needed because: reads items/categories/admin_config that RLS
-- (or an unprivileged trigger/EF context) might otherwise hide from the caller.
SET search_path = public
AS $$
DECLARE
  v_price NUMERIC;
  v_cap_percent INTEGER;
  v_pct_cap INTEGER;
  v_abs_cap INTEGER;
  v_global_abs_cap INTEGER;
  v_effective INTEGER;
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Item price + category spend-cap %. Category % OVERRIDES the global 50%
  -- default (owner decision 2026-08-09): a 70% category allows up to 70% SP.
  SELECT i.price, COALESCE(c.sp_spending_cap_percent, 50)
  INTO v_price, v_cap_percent
  FROM public.items i
  LEFT JOIN public.categories c ON c.id = i.category_id
  WHERE i.id = p_listing_id;

  IF v_price IS NULL OR v_price <= 0 THEN
    RETURN 0;
  END IF;

  v_pct_cap := FLOOR(v_price * GREATEST(v_cap_percent, 0) / 100)::INTEGER;
  v_effective := v_pct_cap;

  -- Absolute per-category cap (categories.sp_redemption_cap) is an additional
  -- ceiling when set; otherwise the legacy global absolute fallback applies.
  SELECT c.sp_redemption_cap
  INTO v_abs_cap
  FROM public.items i
  JOIN public.categories c ON c.id = i.category_id
  WHERE i.id = p_listing_id;

  IF v_abs_cap IS NOT NULL THEN
    v_effective := LEAST(v_effective, v_abs_cap);
  ELSE
    SELECT COALESCE((ac.value)::INTEGER, NULL)
    INTO v_global_abs_cap
    FROM public.admin_config ac
    WHERE ac.key = 'sp_redemption_cap_global' AND ac.is_active = TRUE
    LIMIT 1;
    IF v_global_abs_cap IS NOT NULL THEN
      v_effective := LEAST(v_effective, v_global_abs_cap);
    END IF;
  END IF;

  RETURN GREATEST(v_effective, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_item_effective_sp_cap(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_item_effective_sp_cap IS
  'R11: authoritative max SP redeemable for an item = FLOOR(price × category.sp_spending_cap_percent / 100), bounded by categories.sp_redemption_cap (or admin_config.sp_redemption_cap_global fallback). Category % overrides the global 50% default.';

-- ---------------------------------------------------------------------------
-- BLOCK 2 — R6: get_subscription_summary (grace can spend, adds can_earn_sp)
--   BP-12: RETURNS TABLE signature changed -> DROP first.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_subscription_summary(UUID);

CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  can_earn_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER needed because: reads subscriptions which are scoped by RLS
-- to the row owner; the summary must resolve for the caller's own user_id.
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status,
    -- R6: grace period CAN spend existing SP (trial/active/paused/cancelled/
    -- grace_period all spend). Post-grace (expired) and free cannot.
    CASE
      WHEN s.status IN ('trial', 'active', 'paused', 'cancelled', 'canceled', 'grace_period') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    -- R6: only trial/paid members earn NEW SP (grace/expired cannot earn).
    CASE
      WHEN s.status IN ('trial', 'active') THEN TRUE
      ELSE FALSE
    END AS can_earn_sp,
    s.trial_end_date,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_subscription_summary(UUID)
  IS 'R6: latest-row subscription summary. can_spend_sp TRUE for trial/active/paused/cancelled/grace_period; can_earn_sp TRUE only for trial/active.';

-- ---------------------------------------------------------------------------
-- BLOCK 3 — R6: shared entitlement resolver (used by create-trade-offer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_sp_entitlement(p_user_id UUID)
RETURNS TABLE (
  can_earn_sp BOOLEAN,
  can_spend_sp BOOLEAN,
  wallet_state TEXT,
  subscription_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- SECURITY DEFINER needed because: reads subscriptions + sp_wallets which are
-- RLS-scoped; the entitlement must resolve for the caller's own user_id.
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_wallet_state TEXT;
BEGIN
  SELECT s.status
  INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
  LIMIT 1;

  SELECT w.state
  INTO v_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id
  LIMIT 1;

  v_status := COALESCE(v_status, 'free');
  v_wallet_state := COALESCE(v_wallet_state, 'inactive');

  RETURN QUERY SELECT
    (v_status IN ('trial','active') AND v_wallet_state IN ('active','grace_period')) AS can_earn_sp,
    (v_status IN ('trial','active','paused','cancelled','canceled','grace_period')
       AND v_wallet_state IN ('active','grace_period')) AS can_spend_sp,
    v_wallet_state,
    v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_sp_entitlement(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_sp_entitlement(UUID)
  IS 'R6: single source of truth for SP earn/spend entitlement given subscription status + wallet state. Called by create-trade-offer before any SP redemption is allowed.';

-- ---------------------------------------------------------------------------
-- BLOCK 4 — R11 + R6: fn_reserve_sp_on_offer (grace can spend + cap invariant)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- BLOCK 5 — R6: fn_transfer_sp_on_accept — gate platform bonus on active/trial
--   The buyer's SP transfer (existing SP) still flows; only the NEWLY-CREATED
--   platform bonus ((m-1)×S) is gated, so grace/expired sellers cannot EARN new
--   SP (R6) while still receiving the buyer's existing SP.
-- ---------------------------------------------------------------------------
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
  v_seller_is_subscriber boolean := false;
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

  -- R6: platform bonus (net-new SP = (m-1)×S) requires an active/trial
  -- subscription. Grace/expired sellers receive buyer SP only — no new SP.
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = NEW.seller_id
      AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1
  ) INTO v_seller_is_subscriber;

  -- Platform bonus = sp_amount × (multiplier - 1), floored to integer
  -- e.g., multiplier=1.10 → bonus = 10% of sp_amount
  v_platform_bonus := CASE
    WHEN v_seller_is_subscriber THEN FLOOR(v_sp_amount * (v_category_multiplier - 1))
    ELSE 0
  END;

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

-- ---------------------------------------------------------------------------
-- BLOCK 6 — R6: downgrade_trial_to_grace — wallet becomes 'grace_period'
--   (spendable) instead of 'frozen', so grace-period users can spend existing
--   SP per R6. Earning new SP remains blocked (BLOCK 5 + subscription gating).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.downgrade_trial_to_grace(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_grace_days INTEGER := 90;
  v_config_value TEXT;
  v_tier_grace_days INTEGER;
  v_grace_ends_at TIMESTAMPTZ;
BEGIN
  SELECT s.*
  INTO v_subscription
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SUBSCRIPTION_NOT_FOUND',
      'message', 'No subscription found for user'
    );
  END IF;

  IF v_subscription.status <> 'trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Subscription is not in trial status',
      'current_status', v_subscription.status
    );
  END IF;

  -- Primary config source: admin_config.key/value
  SELECT ac.value
  INTO v_config_value
  FROM public.admin_config ac
  WHERE ac.key = 'grace_period_days'
    AND ac.is_active = TRUE
  LIMIT 1;

  IF v_config_value IS NULL THEN
    -- Legacy fallback: admin_config.config_key/config_value
    SELECT ac.config_value
    INTO v_config_value
    FROM public.admin_config ac
    WHERE ac.config_key = 'grace_period_days'
      AND ac.is_active = TRUE
    LIMIT 1;
  END IF;

  IF v_config_value IS NOT NULL THEN
    v_grace_days := GREATEST(COALESCE(NULLIF(TRIM(v_config_value), '')::INTEGER, 90), 0);
  ELSIF v_subscription.tier_id IS NOT NULL THEN
    -- Tier-level fallback if admin_config value is not set
    SELECT st.grace_period_days
    INTO v_tier_grace_days
    FROM public.subscription_tiers st
    WHERE st.id = v_subscription.tier_id
    LIMIT 1;

    IF v_tier_grace_days IS NOT NULL THEN
      v_grace_days := GREATEST(v_tier_grace_days, 0);
    END IF;
  END IF;

  v_grace_ends_at := NOW() + make_interval(days => v_grace_days);

  UPDATE public.subscriptions s
  SET
    status = 'grace_period',
    tier_id = NULL,
    has_used_trial = TRUE,
    grace_started_at = NOW(),
    grace_ends_at = v_grace_ends_at,
    updated_at = NOW()
  WHERE s.user_id = p_user_id;

  -- R6: grace wallet is SPENDABLE ('grace_period'), not frozen. Post-grace the
  -- grace-period cron freezes it (rpc_set_sp_wallet_state -> 'frozen').
  UPDATE public.sp_wallets w
  SET
    state = 'grace_period',
    grace_period_ends_at = v_grace_ends_at,
    frozen_at = NULL,
    updated_at = NOW()
  WHERE w.user_id = p_user_id;

  INSERT INTO public.subscription_events (
    user_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'trial_not_converted',
    jsonb_build_object(
      'subscription_id', v_subscription.id,
      'status_from', 'trial',
      'status_to', 'grace_period',
      'trial_end_date', v_subscription.trial_end_date,
      'grace_days', v_grace_days,
      'grace_ends_at', v_grace_ends_at,
      'downgraded_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'status', 'grace_period',
    'grace_days', v_grace_days,
    'grace_ends_at', v_grace_ends_at,
    'message', 'Trial downgraded to grace period, SP wallet spendable (R6)'
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    -- Guard against malformed admin_config values.
    v_grace_ends_at := NOW() + INTERVAL '90 days';

    UPDATE public.subscriptions s
    SET
      status = 'grace_period',
      tier_id = NULL,
      has_used_trial = TRUE,
      grace_started_at = NOW(),
      grace_ends_at = v_grace_ends_at,
      updated_at = NOW()
    WHERE s.user_id = p_user_id;

    UPDATE public.sp_wallets w
    SET
      state = 'grace_period',
      grace_period_ends_at = v_grace_ends_at,
      frozen_at = NULL,
      updated_at = NOW()
    WHERE w.user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'subscription_id', v_subscription.id,
      'status', 'grace_period',
      'grace_days', 90,
      'grace_ends_at', v_grace_ends_at,
      'warning', 'Invalid admin_config grace_period_days value. Used fallback 90 days.'
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- BLOCK 7 — R6: rpc_set_sp_wallet_state — first-party freeze/unfreeze/grace
--   Replaces the external SP_SUBSCRIPTION_UNFREEZE_URL dependency so
--   resubscribe-restores-frozen-SP is deterministic and testable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_set_sp_wallet_state(p_user_id UUID, p_state TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER needed because: called from Edge Functions (service role) to
-- transition a user's own wallet; must bypass user-scoped RLS on sp_wallets.
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_state NOT IN ('active', 'frozen', 'grace_period', 'suspended') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE', 'state', p_state);
  END IF;

  SELECT w.id INTO v_wallet_id
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    PERFORM public.initialize_sp_wallet(p_user_id);
    SELECT w.id INTO v_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_user_id
    FOR UPDATE;
  END IF;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  UPDATE public.sp_wallets w
  SET
    state = p_state,
    frozen_at = CASE WHEN p_state = 'frozen' THEN NOW() ELSE NULL END,
    grace_period_ends_at = CASE WHEN p_state = 'active' THEN NULL ELSE w.grace_period_ends_at END,
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'state', p_state,
    'message', CASE
      WHEN p_state = 'active' THEN 'SP wallet unfrozen and spendable again (R6)'
      WHEN p_state = 'frozen' THEN 'SP wallet frozen (post-grace) — can neither earn nor spend'
      WHEN p_state = 'grace_period' THEN 'SP wallet in grace period — can spend existing SP, cannot earn new'
      ELSE 'SP wallet state updated'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_set_sp_wallet_state(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_set_sp_wallet_state(UUID, TEXT)
  IS 'R6: first-party wallet state transition (active/frozen/grace_period/suspended). Used by renew-subscription / create-subscription-from-payment-method on resubscribe, and by grace-period-cron on expiry (freeze, not delete).';

-- ---------------------------------------------------------------------------
-- BLOCK 8 — R6: can_user_spend_sp — grace-period users can spend existing SP
--   (legacy RPC used by subscription E2E + some client checks). Only post-grace
--   'frozen' / 'suspended' wallets block spending.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_spend_sp(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_wallet_state TEXT;
BEGIN
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- R6: trial/active/paused/cancelled/grace_period can spend existing SP.
  IF v_status IS NULL OR v_status NOT IN ('trial', 'active', 'paused', 'cancelled', 'canceled', 'grace_period') THEN
    RETURN FALSE;
  END IF;

  SELECT w.state INTO v_wallet_state
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  -- R6: 'grace_period' wallets remain spendable (existing SP only). Only
  -- 'frozen' (post-grace) and 'suspended' wallets block spending.
  IF v_wallet_state IN ('frozen', 'suspended') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_spend_sp(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_user_spend_sp(UUID)
  IS 'R6: grace-period users can spend existing SP; only frozen/suspended wallets block spending.';

-- ============================================================================
-- VERIFICATION (run one statement at a time — result-granularity rule)
--  1) Cap helper:
--     SELECT public.fn_item_effective_sp_cap('<listing_id>');
--     -- Expected: FLOOR(price × cap%/100), bounded by absolute caps.
--  2) Subscription summary (grace can spend):
--     SELECT * FROM public.get_subscription_summary('<user_id>');
--     -- Expected: grace_period → can_spend_sp = true, can_earn_sp = false.
--  3) Entitlement resolver:
--     SELECT * FROM public.fn_get_sp_entitlement('<user_id>');
--  4) Reserve trigger allows grace spend + rejects over-cap:
--     -- Insert a pending trade with sp_amount > fn_item_effective_sp_cap(...)
--     -- for a grace-period buyer → expect the reserve trigger to RAISE.
--  5) Reconcile any legacy frozen-during-grace wallets (optional, R6):
--     UPDATE public.sp_wallets w
--     SET state = 'grace_period', frozen_at = NULL
--     FROM public.subscriptions s
--     WHERE s.user_id = w.user_id
--       AND s.status = 'grace_period'
--       AND w.state = 'frozen';
-- ============================================================================
