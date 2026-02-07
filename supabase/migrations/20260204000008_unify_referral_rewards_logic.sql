-- File: supabase/migrations/20260204000008_unify_referral_rewards_logic.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Unify referral reward defaults across all RPCs and triggers
-- 2) Remove hardcoded fallbacks from triggers (use config or RPC result)
-- 3) Ensure "First Trade" and "First Listing" bonuses are correctly pulls from sp_config

-- =============================================================================
-- 1) Standardize award_referral_sp (First Trade Bonus)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.award_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Subscriber status
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Amounts from config (Standardized Defaults: Referrer=50, Referee=25)
  SELECT (sc.config_value)::INTEGER INTO v_referrer_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referrer_sp';

  SELECT (sc.config_value)::INTEGER INTO v_referee_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referee_sp';

  v_referrer_sp := COALESCE(v_referrer_sp, 50);
  v_referee_sp := COALESCE(v_referee_sp, 25);

  -- Expiration config
  SELECT (sc.config_value)::INTEGER INTO v_expiration_days
  FROM public.sp_config sc
  WHERE sc.config_key = 'expiration_period_days';

  v_expiration_days := COALESCE(v_expiration_days, 365);
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
$$ SET search_path = public;

-- =============================================================================
-- 2) Standardize award_listing_referral_sp (First Listing Bonus)
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

  -- Subscriber status
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- Amounts from config (Standardized Defaults: Referrer=25, Referee=10)
  SELECT (sc.config_value)::INTEGER INTO v_referrer_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referrer_listing_sp';

  SELECT (sc.config_value)::INTEGER INTO v_referee_sp
  FROM public.sp_config sc
  WHERE sc.config_key = 'referral_reward_referee_listing_sp';

  v_referrer_sp := COALESCE(v_referrer_sp, 25);
  v_referee_sp := COALESCE(v_referee_sp, 10);

  -- Expiration config
  SELECT (sc.config_value)::INTEGER INTO v_expiration_days
  FROM public.sp_config sc
  WHERE sc.config_key = 'expiration_period_days';

  v_expiration_days := COALESCE(v_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- Award to Referrer
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

  -- Award to Referee
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
    'referee_sp_awarded', v_referee_awarded
  );
END;
$$ SET search_path = public;

-- =============================================================================
-- 3) Clean up First Trade Trigger logic
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_trade_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_has_user_cols BOOLEAN;
  v_has_profile_cols BOOLEAN;

  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_result JSONB;

  v_candidate_user_id UUID;
  v_is_first_trade BOOLEAN;
BEGIN
  IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed')) THEN

    -- Detect referrals schema
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_user_id') INTO v_has_user_cols;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_id') INTO v_has_profile_cols;

    FOREACH v_candidate_user_id IN ARRAY ARRAY[NEW.buyer_id, NEW.seller_id]
    LOOP
      IF v_candidate_user_id IS NULL THEN CONTINUE; END IF;

      -- Find referral
      IF v_has_user_cols THEN
        SELECT r.id, r.referrer_user_id, r.referred_user_id
        FROM public.referrals r
        WHERE r.status = 'pending' AND r.referred_user_id = v_candidate_user_id
        ORDER BY r.created_at DESC LIMIT 1
        INTO v_referral_id, v_referrer_user_id, v_referee_user_id;
      ELSIF v_has_profile_cols THEN
        SELECT r.id, p_ref.user_id, p_ree.user_id
        FROM public.referrals r
        JOIN public.profiles p_ref ON p_ref.id = r.referrer_id
        JOIN public.profiles p_ree ON p_ree.id = r.referee_id
        WHERE r.status = 'pending' AND p_ree.user_id = v_candidate_user_id
        ORDER BY r.created_at DESC LIMIT 1
        INTO v_referral_id, v_referrer_user_id, v_referee_user_id;
      END IF;

      IF v_referral_id IS NULL THEN CONTINUE; END IF;

      -- First completed trade check
      SELECT NOT EXISTS (
        SELECT 1 FROM public.trades t
        WHERE (t.buyer_id = v_referee_user_id OR t.seller_id = v_referee_user_id)
          AND t.status = 'completed' AND t.id <> NEW.id
      ) INTO v_is_first_trade;

      IF NOT v_is_first_trade THEN CONTINUE; END IF;

      -- Award (v_result will contain awarded amounts from sp_config)
      SELECT public.award_referral_sp(v_referrer_user_id, v_referee_user_id, v_referral_id) INTO v_result;

      -- Update referral record using the ACTUAL amounts awarded
      UPDATE public.referrals r
      SET
        status = 'completed',
        claimed_at = NOW(),
        bonus_claimed_at = NOW(),
        bonus_claimed_referrer_at = NOW(),
        bonus_points = COALESCE((v_result->>'referee_sp_awarded')::INTEGER, 0),
        bonus_points_referrer = COALESCE((v_result->>'referrer_sp_awarded')::INTEGER, 0)
      WHERE r.id = v_referral_id;

      EXIT; -- Stop after first match
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 4) Clean up First Listing Trigger logic
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_listing_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_is_first_listing BOOLEAN;
  v_result JSONB;
BEGIN
  IF (NEW.status = 'available' AND (OLD.status IS NULL OR OLD.status <> 'available')) THEN
    v_referee_user_id := NEW.seller_id;

    -- Check if user was referred
    SELECT referred_by INTO v_referrer_user_id
    FROM public.profiles WHERE user_id = v_referee_user_id;

    IF v_referrer_user_id IS NULL THEN RETURN NEW; END IF;

    -- Find referral record
    SELECT id INTO v_referral_id
    FROM public.referrals
    WHERE (referred_user_id = v_referee_user_id OR (SELECT id FROM profiles WHERE user_id = v_referee_user_id) = referee_id)
    ORDER BY created_at DESC LIMIT 1;

    IF v_referral_id IS NULL THEN RETURN NEW; END IF;

    -- First approved listing check
    SELECT NOT EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.seller_id = v_referee_user_id
        AND i.status IN ('available', 'pending', 'sold')
        AND i.id <> NEW.id
        AND i.approved_at IS NOT NULL
    ) INTO v_is_first_listing;

    IF NOT v_is_first_listing THEN RETURN NEW; END IF;

    -- Award rewards
    SELECT public.award_listing_referral_sp(
      v_referrer_user_id,
      v_referee_user_id,
      v_referral_id,
      NEW.id
    ) INTO v_result;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 5) Clean up Admin Backfill RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.grant_referral_rewards_for_trade_v2(
  p_trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade RECORD;
  v_has_user_cols BOOLEAN;
  v_has_profile_cols BOOLEAN;

  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_result JSONB;

  v_candidate_user_id UUID;
  v_is_first_trade BOOLEAN;
BEGIN
  SELECT * INTO v_trade
  FROM public.trades t
  WHERE t.id = p_trade_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF v_trade.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade must be completed');
  END IF;

  -- Detect schema shape
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_user_id') INTO v_has_user_cols;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referrer_id') INTO v_has_profile_cols;

  -- Try buyer then seller
  FOREACH v_candidate_user_id IN ARRAY ARRAY[v_trade.buyer_id, v_trade.seller_id]
  LOOP
    IF v_candidate_user_id IS NULL THEN CONTINUE; END IF;

    IF v_has_user_cols THEN
      SELECT r.id, r.referrer_user_id, r.referred_user_id
      FROM public.referrals r
      WHERE r.status IN ('pending', 'claimed', 'completed') AND r.referred_user_id = v_candidate_user_id
      ORDER BY r.created_at DESC LIMIT 1
      INTO v_referral_id, v_referrer_user_id, v_referee_user_id;
    ELSIF v_has_profile_cols THEN
      SELECT r.id, p_ref.user_id, p_ree.user_id
      FROM public.referrals r
      JOIN public.profiles p_ref ON p_ref.id = r.referrer_id
      JOIN public.profiles p_ree ON p_ree.id = r.referee_id
      WHERE r.status IN ('pending', 'claimed', 'completed') AND p_ree.user_id = v_candidate_user_id
      ORDER BY r.created_at DESC LIMIT 1
      INTO v_referral_id, v_referrer_user_id, v_referee_user_id;
    END IF;

    IF v_referral_id IS NULL THEN CONTINUE; END IF;

    -- First trade check
    SELECT NOT EXISTS (
      SELECT 1 FROM public.trades t
      WHERE (t.buyer_id = v_referee_user_id OR t.seller_id = v_referee_user_id)
        AND t.status = 'completed' AND t.id <> v_trade.id
    ) INTO v_is_first_trade;

    IF NOT v_is_first_trade THEN
      RETURN jsonb_build_object('success', false, 'error', 'Referee already has a completed trade (not first trade)');
    END IF;

    -- Award
    SELECT public.award_referral_sp(v_referrer_user_id, v_referee_user_id, v_referral_id) INTO v_result;

    IF (v_result->>'success')::BOOLEAN THEN
      UPDATE public.referrals r
      SET
        status = 'completed',
        claimed_at = NOW(),
        bonus_claimed_at = NOW(),
        bonus_claimed_referrer_at = NOW(),
        bonus_points = COALESCE((v_result->>'referee_sp_awarded')::INTEGER, 0),
        bonus_points_referrer = COALESCE((v_result->>'referrer_sp_awarded')::INTEGER, 0)
      WHERE r.id = v_referral_id;
    END IF;

    RETURN v_result;
  END LOOP;

  RETURN jsonb_build_object('success', false, 'error', 'No matching referral found for trade');
END;
$$ SET search_path = public;
