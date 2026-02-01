-- File: supabase/migrations/20260201000001_fix_referral_rewards_v2_trigger_and_backfill.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Make referral reward awarding idempotent correctly (fix award_referral_sp idempotency bug)
-- 2) Make the trade-completion referral trigger robust across legacy/new referral schemas
-- 3) Provide an admin-only backfill RPC to grant rewards for an already-completed trade
--
-- Notes:
-- - trades.buyer_id / trades.seller_id are auth user IDs (UUID)
-- - referrals may exist in one of two shapes across environments:
--   A) referrer_user_id/referred_user_id (auth user IDs)
--   B) referrer_id/referee_id (profiles.id)
--
-- This migration avoids hard dependency on either by using runtime column detection + dynamic SQL.

-- =============================================================================
-- 1) FIX award_referral_sp IDEMPOTENCY + RETURN ACTUAL AWARDED AMOUNTS
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
  v_idempotency_base := 'referral_' || p_referral_id::TEXT;
  v_idempotency_referrer := v_idempotency_base || '_referrer';
  v_idempotency_referee := v_idempotency_base || '_referee';

  -- Idempotency check (BUGFIX): the ledger entries use suffixed keys, so check those.
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

  -- Amounts from config
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
$$;

-- =============================================================================
-- 2) ROBUST TRIGGER: process_referral_bonus_on_trade_v2
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

    -- Detect referral schema shape at runtime
    SELECT EXISTS(
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'referrals'
        AND c.column_name IN ('referrer_user_id', 'referred_user_id')
      GROUP BY c.table_schema, c.table_name
      HAVING COUNT(*) = 2
    ) INTO v_has_user_cols;

    SELECT EXISTS(
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'referrals'
        AND c.column_name IN ('referrer_id', 'referee_id')
      GROUP BY c.table_schema, c.table_name
      HAVING COUNT(*) = 2
    ) INTO v_has_profile_cols;

    -- Try buyer then seller as the "referee" (either side can be the referred user)
    FOREACH v_candidate_user_id IN ARRAY ARRAY[NEW.buyer_id, NEW.seller_id]
    LOOP
      v_referral_id := NULL;
      v_referrer_user_id := NULL;
      v_referee_user_id := NULL;

      IF v_candidate_user_id IS NULL THEN
        CONTINUE;
      END IF;

      IF v_has_user_cols THEN
        EXECUTE '
          SELECT r.id, r.referrer_user_id, r.referred_user_id
          FROM public.referrals r
          WHERE r.status = ''pending''
            AND r.referred_user_id = $1
          ORDER BY r.created_at DESC NULLS LAST
          LIMIT 1
        '
        INTO v_referral_id, v_referrer_user_id, v_referee_user_id
        USING v_candidate_user_id;

      ELSIF v_has_profile_cols THEN
        -- Legacy shape: map profiles.id -> profiles.user_id
        EXECUTE '
          SELECT r.id, p_ref.user_id, p_ree.user_id
          FROM public.referrals r
          JOIN public.profiles p_ref ON p_ref.id = r.referrer_id
          JOIN public.profiles p_ree ON p_ree.id = r.referee_id
          WHERE r.status = ''pending''
            AND p_ree.user_id = $1
          ORDER BY r.created_at DESC NULLS LAST
          LIMIT 1
        '
        INTO v_referral_id, v_referrer_user_id, v_referee_user_id
        USING v_candidate_user_id;
      ELSE
        -- Unknown schema; nothing to do.
        CONTINUE;
      END IF;

      IF v_referral_id IS NULL OR v_referee_user_id IS NULL OR v_referrer_user_id IS NULL THEN
        CONTINUE;
      END IF;

      -- FIRST completed trade check for the referee
      SELECT NOT EXISTS (
        SELECT 1
        FROM public.trades t
        WHERE (t.buyer_id = v_referee_user_id OR t.seller_id = v_referee_user_id)
          AND t.status = 'completed'
          AND t.id <> NEW.id
      ) INTO v_is_first_trade;

      IF NOT v_is_first_trade THEN
        CONTINUE;
      END IF;

      -- Award rewards
      SELECT public.award_referral_sp(
        v_referrer_user_id,
        v_referee_user_id,
        v_referral_id
      ) INTO v_result;

      -- Mark referral completed to prevent repeats (existing behavior)
      UPDATE public.referrals r
      SET
        status = 'completed',
        claimed_at = NOW(),
        bonus_claimed_at = NOW(),
        bonus_claimed_referrer_at = NOW(),
        bonus_points = COALESCE((SELECT (config_value)::int FROM public.sp_config WHERE config_key = 'referral_reward_referee_sp'), 10),
        bonus_points_referrer = COALESCE((SELECT (config_value)::int FROM public.sp_config WHERE config_key = 'referral_reward_referrer_sp'), 25)
      WHERE r.id = v_referral_id;

      IF (v_result->>'success')::BOOLEAN THEN
        RAISE NOTICE 'Referral rewards granted for referral % (trade %)', v_referral_id, NEW.id;
      ELSE
        RAISE WARNING 'Referral % processed on trade %, but rewards not granted: %', v_referral_id, NEW.id, v_result->>'error';
      END IF;

      -- Stop after the first matching referral.
      EXIT;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_process_referral_bonus_on_trade ON public.trades;
CREATE TRIGGER trigger_process_referral_bonus_on_trade
  AFTER UPDATE OF status ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_bonus_on_trade_v2();

-- =============================================================================
-- 3) ADMIN-ONLY BACKFILL RPC: grant_referral_rewards_for_trade_v2(p_trade_id)
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
  SELECT EXISTS(
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'referrals'
      AND c.column_name IN ('referrer_user_id', 'referred_user_id')
    GROUP BY c.table_schema, c.table_name
    HAVING COUNT(*) = 2
  ) INTO v_has_user_cols;

  SELECT EXISTS(
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'referrals'
      AND c.column_name IN ('referrer_id', 'referee_id')
    GROUP BY c.table_schema, c.table_name
    HAVING COUNT(*) = 2
  ) INTO v_has_profile_cols;

  -- Try buyer then seller
  FOREACH v_candidate_user_id IN ARRAY ARRAY[v_trade.buyer_id, v_trade.seller_id]
  LOOP
    v_referral_id := NULL;
    v_referrer_user_id := NULL;
    v_referee_user_id := NULL;

    IF v_candidate_user_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_has_user_cols THEN
      EXECUTE '
        SELECT r.id, r.referrer_user_id, r.referred_user_id
        FROM public.referrals r
        WHERE r.status IN (''pending'', ''claimed'', ''completed'')
          AND r.referred_user_id = $1
        ORDER BY r.created_at DESC NULLS LAST
        LIMIT 1
      '
      INTO v_referral_id, v_referrer_user_id, v_referee_user_id
      USING v_candidate_user_id;

    ELSIF v_has_profile_cols THEN
      EXECUTE '
        SELECT r.id, p_ref.user_id, p_ree.user_id
        FROM public.referrals r
        JOIN public.profiles p_ref ON p_ref.id = r.referrer_id
        JOIN public.profiles p_ree ON p_ree.id = r.referee_id
        WHERE r.status IN (''pending'', ''claimed'', ''completed'')
          AND p_ree.user_id = $1
        ORDER BY r.created_at DESC NULLS LAST
        LIMIT 1
      '
      INTO v_referral_id, v_referrer_user_id, v_referee_user_id
      USING v_candidate_user_id;
    ELSE
      CONTINUE;
    END IF;

    IF v_referral_id IS NULL THEN
      CONTINUE;
    END IF;

    -- First trade check
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.trades t
      WHERE (t.buyer_id = v_referee_user_id OR t.seller_id = v_referee_user_id)
        AND t.status = 'completed'
        AND t.id <> v_trade.id
    ) INTO v_is_first_trade;

    IF NOT v_is_first_trade THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Referee already has a completed trade (not first trade)',
        'referral_id', v_referral_id,
        'referee_user_id', v_referee_user_id
      );
    END IF;

    -- Award (idempotent)
    SELECT public.award_referral_sp(v_referrer_user_id, v_referee_user_id, v_referral_id)
      INTO v_result;

    IF (v_result->>'success')::BOOLEAN THEN
      UPDATE public.referrals r
      SET
        status = 'completed',
        claimed_at = NOW(),
        bonus_claimed_at = NOW(),
        bonus_claimed_referrer_at = NOW(),
        bonus_points = COALESCE((SELECT (config_value)::int FROM public.sp_config WHERE config_key = 'referral_reward_referee_sp'), 10),
        bonus_points_referrer = COALESCE((SELECT (config_value)::int FROM public.sp_config WHERE config_key = 'referral_reward_referrer_sp'), 25)
      WHERE r.id = v_referral_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'trade_id', v_trade.id,
      'referral_id', v_referral_id,
      'referrer_user_id', v_referrer_user_id,
      'referee_user_id', v_referee_user_id,
      'award_result', v_result
    );
  END LOOP;

  RETURN jsonb_build_object('success', false, 'error', 'No matching referral found for trade');
END;
$$ SET search_path = public;

-- Lock down the backfill RPC (admin-only)
REVOKE ALL ON FUNCTION public.grant_referral_rewards_for_trade_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_referral_rewards_for_trade_v2(UUID) TO service_role;

-- =============================================================================
-- VERIFICATION QUERIES (manual)
-- =============================================================================
-- 1) Verify trigger function exists
-- SELECT proname FROM pg_proc WHERE proname IN ('process_referral_bonus_on_trade_v2', 'grant_referral_rewards_for_trade_v2');
--
-- 2) Verify trigger exists
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_process_referral_bonus_on_trade';
--
-- 3) Backfill for a specific completed trade
-- SELECT public.grant_referral_rewards_for_trade_v2('YOUR_TRADE_ID'::uuid);
