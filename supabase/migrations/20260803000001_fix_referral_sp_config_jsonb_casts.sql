-- =====================================================
-- FILE: supabase/migrations/20260803000001_fix_referral_sp_config_jsonb_casts.sql
-- TASK: REF-V2-007 fix — sp_config.config_value is JSONB. Direct casts like
--   (sc.config_value)::BOOLEAN or (sc.config_value)::INTEGER raise SQLSTATE 22023
--   ("cannot cast jsonb string to type boolean/integer") whenever a config value is
--   stored as a JSONB *string* (e.g. "true" or "40") rather than a JSONB
--   boolean/number. Admin writes via PostgREST (e.g. .update({ config_value: "40" }))
--   produce exactly those JSONB strings, so the reward RPCs crashed on every call.
--   Replace with the proven safe extraction used elsewhere in the codebase:
--   COALESCE((config_value #>> '{}')::BOOLEAN, true) / ::INTEGER.
--
-- Mode: Idempotent rerunnable migration (CREATE OR REPLACE FUNCTION).
-- =====================================================

-- =============================================================================
-- 0) Shared safe config readers — NO hardcoded fallback values.
--    Return NULL when a key is missing/unparseable. Callers MUST fail loud
--    (return SP_CONFIG_MISSING, RAISE, or log to debug_logs) instead of
--    inventing a default number. Admin edits these values in the admin portal:
--    p2p-kids-admin/src/app/referrals/configuration-tab.tsx → sp_config.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sp_config_int(p_key TEXT)
RETURNS INTEGER LANGUAGE sql STABLE
AS $$
  SELECT (config_value #>> '{}')::INTEGER
  FROM public.sp_config
  WHERE config_key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.sp_config_bool(p_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE
AS $$
  SELECT (config_value #>> '{}')::BOOLEAN
  FROM public.sp_config
  WHERE config_key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.sp_config_int(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sp_config_bool(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- 1) award_referral_sp — First Trade Bonus (safe config casts, FAIL LOUD)
--    Canonical source: 20260204000008_unify_referral_rewards_logic.sql
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

  -- Subscriber status
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

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
-- 2) award_listing_referral_sp — First Listing Bonus (safe config casts)
--    Canonical source: 20260205000003_ultimate_test_alignment_fix.sql
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

  -- Subscriber status (simplified for version alignment)
  SELECT public.is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT public.is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

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
        v_referrer_sp,
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
-- Grants (idempotent — re-applied to cover both redefined functions)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.award_referral_sp(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_listing_referral_sp(UUID, UUID, UUID, UUID) TO authenticated, service_role;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- 1) Both RPCs must resolve (no PGRST202):
--    SELECT pgrst_... ; or simply:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname IN ('award_referral_sp','award_listing_referral_sp');
--
-- 2) Sanity check the cast fix against a string-stored JSONB value:
--    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true)
--    FROM sp_config WHERE config_key = 'referral_first_listing_enabled';
--    -> should return TRUE/FALSE, never 22023.
--
-- 3) Full E2E: re-run REF-V2-007 admin-config suite with RUN_SUPABASE_E2E=true.
