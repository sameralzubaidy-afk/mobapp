-- =============================================================================
-- Migration: 20260830220000_dev_task_66_grace_aware_subscriber.sql
-- Mode: B (idempotent rerunnable migration — CREATE OR REPLACE only, no DDL drops)
--
-- DEV-TASK-66 item 1 (PRIORITY): is_active_subscriber() grace-period semantics.
--
-- DECISION (documented, R6-consistent): a user in the grace window
--   (status 'grace_period'/'grace', OR status 'active' with a lapsed
--   current_period_end but a future grace_ends_at) RETAINS spend-side membership
--   benefits (cart "Up to N SP" badge, member fee tiering, SP redemption) but
--   does NOT retain earn-side entitlements (starter pack, referral bonuses).
--   This mirrors the existing R6 model (grace CAN spend, CANNOT earn; wallet
--   freezes only AFTER grace expires at grace_ends_at).
--
-- Implementation:
--   1) is_active_subscriber()  -> grace-AWARE membership predicate
--        (drives rpc_cart_get_items.is_subscriber + any general member display)
--   2) is_earning_subscriber() -> NEW strict earn-side predicate (no grace)
--        (drives starter pack + referral reward awards)
--   3) issue_starter_pack(), award_referral_sp(), award_listing_referral_sp()
--        -> their internal subscriber check swapped to is_earning_subscriber()
--        so a grace user can never earn starter pack / referral bonuses.
--
-- rpc_cart_get_items keeps calling is_active_subscriber() (now grace-aware) —
-- the cart "Up to N SP" badge therefore appears for genuine grace users.
--
-- Status literal note (BP-76): edge functions write the canonical 'grace_period'
--   status (stripe-webhook-subscriptions, cancel-subscription, grace-period-cron).
--   This function accepts BOTH 'grace' and 'grace_period' so legacy rows are safe.
-- =============================================================================

-- =============================================================================
-- 1) is_active_subscriber() — grace-aware membership predicate
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_active_subscriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- DEV-TASK-66: grace-aware. A user inside the grace window (grace_ends_at in
  -- the future) counts as an active member for spend-side benefits.
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trial', 'trialing', 'grace', 'grace_period')
      AND (
        (s.status IN ('trial', 'trialing') AND (s.trial_end_date IS NULL OR s.trial_end_date > NOW()))
        OR
        (s.status = 'active' AND (
            s.current_period_end IS NULL
            OR s.current_period_end > NOW()
            -- lapsed period but still inside the grace window -> still a member
            OR s.grace_ends_at > NOW()
        ))
        OR
        -- canonical grace statuses: member while grace_ends_at is in the future
        (s.status IN ('grace', 'grace_period') AND s.grace_ends_at > NOW())
      )
  );
END;
$$;

-- =============================================================================
-- 2) is_earning_subscriber() — NEW strict earn-side predicate (no grace)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_earning_subscriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- DEV-TASK-66: STRICT earn-side check. Grace users may spend but NOT earn
  -- (R6-consistent), so grace statuses are deliberately excluded here.
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trial', 'trialing')
      AND (
        (s.status IN ('trial', 'trialing') AND (s.trial_end_date IS NULL OR s.trial_end_date > NOW()))
        OR
        (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
      )
  );
END;
$$;

-- =============================================================================
-- 3) issue_starter_pack() — swapped to the strict earning predicate
--    (single-line change vs 20260821000004_fix_issue_starter_pack_jsonb_cast.sql)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.issue_starter_pack(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_wallet_id UUID;
  v_starter_pack_issued BOOLEAN;
  v_sp_amount INTEGER;
  v_batch_id UUID;
  v_ledger_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_subscriber BOOLEAN;
BEGIN
  -- 1. Check if user is an EARNING subscriber (strict — grace cannot earn)
  SELECT public.is_earning_subscriber(p_user_id) INTO v_is_subscriber;

  IF NOT v_is_subscriber THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kids Club+ subscription required to earn Swap Points'
    );
  END IF;

  -- 2. Get wallet and check if starter pack already issued
  SELECT w.id, w.starter_pack_issued
    INTO v_wallet_id, v_starter_pack_issued
  FROM public.sp_wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    -- Attempt to initialize wallet (idempotent) then re-fetch.
    PERFORM public.initialize_sp_wallet(p_user_id);
    SELECT w.id, w.starter_pack_issued
      INTO v_wallet_id, v_starter_pack_issued
    FROM public.sp_wallets w
    WHERE w.user_id = p_user_id;

    IF v_wallet_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'SP wallet not found'
      );
    END IF;
  END IF;

  IF COALESCE(v_starter_pack_issued, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Starter pack already issued for this user'
    );
  END IF;

  -- 3. Get starter pack config via the canonical safe reader (handles JSONB
  --    string OR number forms; NULL when missing -> fallback below still applies).
  --    FIX 20260821000004: was `(c.config_value)::INTEGER` which crashed on a
  --    JSONB string value ("cannot cast jsonb string to type integer").
  v_sp_amount := public.sp_config_int('starter_pack_amount');

  IF v_sp_amount IS NULL OR v_sp_amount <= 0 THEN
    v_sp_amount := 10; -- Default fallback
  END IF;

  -- 4. Get expiration config via the canonical safe reader.
  v_expiration_days := public.sp_config_int('expiration_period_days');

  IF v_expiration_days IS NULL THEN
    v_expiration_days := 365; -- Default 1 year
  END IF;

  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 5. Create SP batch
  INSERT INTO public.sp_batches (
    wallet_id,
    user_id,
    initial_sp,
    remaining_sp,
    source_type,
    source_id,
    expires_at
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    v_sp_amount,
    v_sp_amount,
    'starter_pack',
    p_listing_id,
    v_expires_at
  )
  RETURNING id INTO v_batch_id;

  -- 6. Update wallet balance
  UPDATE public.sp_wallets w
  SET
    available_balance = w.available_balance + v_sp_amount,
    lifetime_earned = w.lifetime_earned + v_sp_amount,
    starter_pack_issued = TRUE,
    starter_pack_issued_at = NOW(),
    updated_at = NOW()
  WHERE w.id = v_wallet_id;

  -- 7. Create ledger entry
  INSERT INTO public.sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_listing_id,
    related_batch_id,
    idempotency_key
  )
  SELECT
    v_wallet_id,
    p_user_id,
    'earn_starter_pack',
    v_sp_amount,
    w.available_balance - v_sp_amount,
    w.available_balance,
    'Starter Pack: First listing approved',
    p_listing_id,
    v_batch_id,
    'starter_pack_' || p_user_id::TEXT
  FROM public.sp_wallets w
  WHERE w.id = v_wallet_id
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'sp_awarded', v_sp_amount,
    'batch_id', v_batch_id,
    'ledger_entry_id', v_ledger_id,
    'expires_at', v_expires_at
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- 4) award_referral_sp() — swapped to the strict earning predicate
--    (single-line change vs 20260803000001_fix_referral_sp_config_jsonb_casts.sql)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.award_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_wallet_id UUID;
  v_referee_wallet_id UUID;
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_referrer_batch_id UUID;
  v_referee_batch_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_referrer_subscriber BOOLEAN;
  v_is_referee_subscriber BOOLEAN;
  v_idempotency_base TEXT;
  v_idempotency_referrer TEXT;
  v_idempotency_referee TEXT;
  v_already_processed BOOLEAN;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
BEGIN
  v_idempotency_base := 'referral_trade_' || p_referral_id::TEXT;
  v_idempotency_referrer := v_idempotency_base || '_referrer';
  v_idempotency_referee := v_idempotency_base || '_referee';

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1
    FROM public.sp_ledger sl
    WHERE sl.idempotency_key IN (v_idempotency_referrer, v_idempotency_referee)
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral reward already processed'
    );
  END IF;

  -- Subscriber status — DEV-TASK-66: strict earn predicate (grace cannot earn)
  SELECT public.is_earning_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_earning_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Amounts from config — FAIL LOUD if a required key is missing (no fallback).
  v_referrer_sp := public.sp_config_int('referral_reward_referrer_sp');
  IF v_referrer_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referrer_sp');
  END IF;

  v_referee_sp := public.sp_config_int('referral_reward_referee_sp');
  IF v_referee_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referee_sp');
  END IF;

  -- Expiration config
  v_expiration_days := public.sp_config_int('expiration_period_days');
  IF v_expiration_days IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'expiration_period_days');
  END IF;

  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- Award to referrer
  IF v_is_referrer_subscriber AND v_referrer_sp > 0 THEN
    SELECT w.id INTO v_referrer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referrer_id;

    IF v_referrer_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referrer_wallet_id, p_referrer_id, v_referrer_sp, v_referrer_sp,
        'referral', p_referral_id, v_expires_at
      ) RETURNING id INTO v_referrer_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referrer_sp,
        lifetime_earned = lifetime_earned + v_referrer_sp,
        updated_at = NOW()
      WHERE id = v_referrer_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key
      )
      SELECT
        v_referrer_wallet_id,
        p_referrer_id,
        'earn_referral',
        v_referrer_sp,
        w.available_balance - v_referrer_sp,
        w.available_balance,
        'Referral Reward: Friend completed first trade',
        v_referrer_batch_id,
        v_idempotency_referrer
      FROM public.sp_wallets w
      WHERE w.id = v_referrer_wallet_id;

      v_referrer_awarded := v_referrer_sp;
    END IF;
  END IF;

  -- Award to referee
  IF v_is_referee_subscriber AND v_referee_sp > 0 THEN
    SELECT w.id INTO v_referee_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referee_id;

    IF v_referee_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referee_wallet_id, p_referee_id, v_referee_sp, v_referee_sp,
        'referral', p_referral_id, v_expires_at
      ) RETURNING id INTO v_referee_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referee_sp,
        lifetime_earned = lifetime_earned + v_referee_sp,
        updated_at = NOW()
      WHERE id = v_referee_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key
      )
      SELECT
        v_referee_wallet_id,
        p_referee_id,
        'earn_referral',
        v_referee_sp,
        w.available_balance - v_referee_sp,
        w.available_balance,
        'Referral Reward: Welcome bonus (first trade)',
        v_referee_batch_id,
        v_idempotency_referee
      FROM public.sp_wallets w
      WHERE w.id = v_referee_wallet_id;

      v_referee_awarded := v_referee_sp;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', v_referrer_awarded,
    'referee_sp_awarded', v_referee_awarded,
    'referrer_batch_id', v_referrer_batch_id,
    'referee_batch_id', v_referee_batch_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- 5) award_listing_referral_sp() — swapped to the strict earning predicate
-- =============================================================================
CREATE OR REPLACE FUNCTION public.award_listing_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID,
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_wallet_id UUID;
  v_referee_wallet_id UUID;
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_referrer_batch_id UUID;
  v_referee_batch_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_referrer_subscriber BOOLEAN;
  v_is_referee_subscriber BOOLEAN;
  v_idempotency_base TEXT;
  v_idempotency_referrer TEXT;
  v_idempotency_referee TEXT;
  v_already_processed BOOLEAN;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
  v_feature_enabled BOOLEAN;
BEGIN
  -- FEATURE TOGGLE CHECK — FAIL LOUD if the toggle key is missing (no default).
  v_feature_enabled := public.sp_config_bool('referral_first_listing_enabled');
  IF v_feature_enabled IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_first_listing_enabled');
  END IF;
  IF NOT v_feature_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral listing bonus feature is disabled');
  END IF;

  v_idempotency_base := 'referral_listing_' || p_item_id::TEXT;
  v_idempotency_referrer := v_idempotency_base || '_referrer';
  v_idempotency_referee := v_idempotency_base || '_referee';

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1
    FROM public.sp_ledger sl
    WHERE sl.idempotency_key IN (v_idempotency_referrer, v_idempotency_referee)
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral listing bonus already processed for this item'
    );
  END IF;

  -- Subscriber status — DEV-TASK-66: strict earn predicate (grace cannot earn)
  SELECT public.is_earning_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_earning_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Amounts from config — FAIL LOUD if a required key is missing (no fallback).
  v_referrer_sp := public.sp_config_int('referral_reward_referrer_listing_sp');
  IF v_referrer_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referrer_listing_sp');
  END IF;

  v_referee_sp := public.sp_config_int('referral_reward_referee_listing_sp');
  IF v_referee_sp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'referral_reward_referee_listing_sp');
  END IF;

  -- Expiration config
  v_expiration_days := public.sp_config_int('expiration_period_days');
  IF v_expiration_days IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SP_CONFIG_MISSING', 'details', 'expiration_period_days');
  END IF;
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- Award to referrer
  IF v_is_referrer_subscriber AND v_referrer_sp > 0 THEN
    SELECT w.id INTO v_referrer_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referrer_id;

    IF v_referrer_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referrer_wallet_id, p_referrer_id, v_referrer_sp, v_referrer_sp,
        'referral', p_item_id, v_expires_at
      ) RETURNING id INTO v_referrer_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referrer_sp,
        lifetime_earned = lifetime_earned + v_referrer_sp,
        updated_at = NOW()
      WHERE id = v_referrer_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key, related_listing_id
      )
      SELECT
        v_referrer_wallet_id,
        p_referrer_id,
        'earn_referral',
        v_referrer_sp,
        w.available_balance - v_referrer_sp,
        w.available_balance,
        'Referral Bonus: Friend approved first listing',
        v_referrer_batch_id,
        v_idempotency_referrer,
        p_item_id
      FROM public.sp_wallets w
      WHERE w.id = v_referrer_wallet_id;

      v_referrer_awarded := v_referrer_sp;
    END IF;
  END IF;

  -- Award to referee
  IF v_is_referee_subscriber AND v_referee_sp > 0 THEN
    SELECT w.id INTO v_referee_wallet_id
    FROM public.sp_wallets w
    WHERE w.user_id = p_referee_id;

    IF v_referee_wallet_id IS NOT NULL THEN
      INSERT INTO public.sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      ) VALUES (
        v_referee_wallet_id, p_referee_id, v_referee_sp, v_referee_sp,
        'referral', p_item_id, v_expires_at
      ) RETURNING id INTO v_referee_batch_id;

      UPDATE public.sp_wallets
      SET
        available_balance = available_balance + v_referee_sp,
        lifetime_earned = lifetime_earned + v_referee_sp,
        updated_at = NOW()
      WHERE id = v_referee_wallet_id;

      INSERT INTO public.sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key, related_listing_id
      )
      SELECT
        v_referee_wallet_id,
        p_referee_id,
        'earn_referral',
        v_referee_sp,
        w.available_balance - v_referee_sp,
        w.available_balance,
        'Referral Bonus: First listing approved',
        v_referee_batch_id,
        v_idempotency_referee,
        p_item_id
      FROM public.sp_wallets w
      WHERE w.id = v_referee_wallet_id;

      v_referee_awarded := v_referee_sp;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', v_referrer_awarded,
    'referee_sp_awarded', v_referee_awarded,
    'referrer_batch_id', v_referrer_batch_id,
    'referee_batch_id', v_referee_batch_id
  );
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES (SQL-3 / SQL-10)
-- =============================================================================

-- 1. Confirm both predicates exist and no earning function still calls the
--    grace-aware predicate (all three must be TRUE below):
-- SELECT
--   EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--           WHERE n.nspname='public' AND p.proname='is_earning_subscriber') AS has_earning_pred,
--   NOT (pg_get_functiondef('public.issue_starter_pack(UUID,UUID)'::regprocedure) LIKE '%is_active_subscriber%') AS starter_pack_swapped,
--   NOT (pg_get_functiondef('public.award_referral_sp(UUID,UUID,UUID)'::regprocedure) LIKE '%is_active_subscriber%') AS refer_swapped,
--   NOT (pg_get_functiondef('public.award_listing_referral_sp(UUID,UUID,UUID,UUID)'::regprocedure) LIKE '%is_active_subscriber%') AS listing_swapped;

-- 2. Behavior matrix — expected: grace_period+future grace => (true,false);
--    active+lapsed period+future grace => (true,false); active+future period => (true,true);
--    free => (false,false); trial+future trial_end => (true,true).
--   (Run against a scratch user row you create and delete, or assert with a CTE
--    using NOW() offsets — do NOT mutate real subscriptions during verification.)
-- SELECT
--   public.is_active_subscriber(u_id) AS active_member,
--   public.is_earning_subscriber(u_id) AS earning
-- FROM (VALUES ('00000000-0000-0000-0000-000000000001'::uuid)) t(u_id);

-- 3. Cart flag stays grace-aware (source-level):
-- SELECT pg_get_functiondef('public.rpc_cart_get_items(uuid)'::regprocedure) LIKE '%is_active_subscriber%' AS cart_uses_grace_aware;
