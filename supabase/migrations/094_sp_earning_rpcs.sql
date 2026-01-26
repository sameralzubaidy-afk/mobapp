-- File: supabase/migrations/094_sp_earning_rpcs.sql
-- MODULE-09 SP-002: SP Earning RPC Functions
-- Mode: Idempotent rerunnable migration
-- Purpose: Atomic SP earning operations with subscription checks and fraud prevention

-- =============================================================================
-- 1. HELPER FUNCTION: Check if user is active Kids Club+ subscriber
-- =============================================================================

CREATE OR REPLACE FUNCTION is_active_subscriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trial', 'trialing', 'grace')
      AND (
        (s.status IN ('trial', 'trialing') AND (s.trial_end_date IS NULL OR s.trial_end_date > NOW()))
        OR
        (s.status IN ('active', 'grace') AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
      )
  );
END;
$$;

-- =============================================================================
-- 2. RPC: Issue Starter Pack (One-time per subscription)
-- =============================================================================

CREATE OR REPLACE FUNCTION issue_starter_pack(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- 1. Check if user is active subscriber
  SELECT is_active_subscriber(p_user_id) INTO v_is_subscriber;
  
  IF NOT v_is_subscriber THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kids Club+ subscription required to earn Swap Points'
    );
  END IF;

  -- 2. Get wallet and check if starter pack already issued
  SELECT id, starter_pack_issued INTO v_wallet_id, v_starter_pack_issued
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    -- Attempt to initialize wallet (idempotent) then re-fetch.
    PERFORM initialize_sp_wallet(p_user_id);
    SELECT id, starter_pack_issued INTO v_wallet_id, v_starter_pack_issued
    FROM sp_wallets
    WHERE user_id = p_user_id;

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

  -- 3. Get starter pack config
  SELECT (config_value)::INTEGER INTO v_sp_amount
  FROM sp_config
  WHERE config_key = 'starter_pack_amount';

  IF v_sp_amount IS NULL OR v_sp_amount <= 0 THEN
    v_sp_amount := 10; -- Default fallback
  END IF;

  -- 4. Get expiration config
  SELECT (config_value)::INTEGER INTO v_expiration_days
  FROM sp_config
  WHERE config_key = 'expiration_period_days';

  IF v_expiration_days IS NULL THEN
    v_expiration_days := 365; -- Default 1 year
  END IF;

  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 5. Create SP batch
  INSERT INTO sp_batches (
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
  UPDATE sp_wallets
  SET 
    available_balance = available_balance + v_sp_amount,
    lifetime_earned = lifetime_earned + v_sp_amount,
    starter_pack_issued = TRUE,
    starter_pack_issued_at = NOW(),
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 7. Create ledger entry
  INSERT INTO sp_ledger (
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
  FROM sp_wallets w
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
-- 3. RPC: Award Referral Reward (Can be SP, cash, or both)
-- =============================================================================

CREATE OR REPLACE FUNCTION award_referral_sp(
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
  v_idempotency_key TEXT;
  v_existing_award RECORD;
BEGIN
  -- 1. Idempotency check
  v_idempotency_key := 'referral_' || p_referral_id::TEXT;
  
  SELECT * INTO v_existing_award
  FROM sp_ledger
  WHERE idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing_award IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral reward already processed'
    );
  END IF;

  -- 2. Check subscriber status
  SELECT is_active_subscriber(p_referrer_id) INTO v_is_referrer_subscriber;
  SELECT is_active_subscriber(p_referee_id) INTO v_is_referee_subscriber;

  -- 3. Get SP amounts from config
  SELECT (config_value)::INTEGER INTO v_referrer_sp
  FROM sp_config
  WHERE config_key = 'referral_reward_referrer_sp';

  SELECT (config_value)::INTEGER INTO v_referee_sp
  FROM sp_config
  WHERE config_key = 'referral_reward_referee_sp';

  -- Defaults if not configured
  v_referrer_sp := COALESCE(v_referrer_sp, 50);
  v_referee_sp := COALESCE(v_referee_sp, 25);

  -- 4. Get expiration config
  SELECT (config_value)::INTEGER INTO v_expiration_days
  FROM sp_config
  WHERE config_key = 'expiration_period_days';
  
  v_expiration_days := COALESCE(v_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 5. Award to referrer (if subscriber and SP > 0)
  IF v_is_referrer_subscriber AND v_referrer_sp > 0 THEN
    SELECT id INTO v_referrer_wallet_id
    FROM sp_wallets
    WHERE user_id = p_referrer_id;

    IF v_referrer_wallet_id IS NOT NULL THEN
      -- Create batch
      INSERT INTO sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      )
      VALUES (
        v_referrer_wallet_id, p_referrer_id, v_referrer_sp, v_referrer_sp,
        'referral', p_referral_id, v_expires_at
      )
      RETURNING id INTO v_referrer_batch_id;

      -- Update wallet
      UPDATE sp_wallets
      SET 
        available_balance = available_balance + v_referrer_sp,
        lifetime_earned = lifetime_earned + v_referrer_sp,
        updated_at = NOW()
      WHERE id = v_referrer_wallet_id;

      -- Create ledger entry
      INSERT INTO sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key
      )
      SELECT
        v_referrer_wallet_id, p_referrer_id, 'earn_referral', v_referrer_sp,
        w.available_balance - v_referrer_sp, w.available_balance,
        'Referral Reward: Friend joined',
        v_referrer_batch_id, v_idempotency_key || '_referrer'
      FROM sp_wallets w
      WHERE w.id = v_referrer_wallet_id;
    END IF;
  END IF;

  -- 6. Award to referee (if subscriber and SP > 0)
  IF v_is_referee_subscriber AND v_referee_sp > 0 THEN
    SELECT id INTO v_referee_wallet_id
    FROM sp_wallets
    WHERE user_id = p_referee_id;

    IF v_referee_wallet_id IS NOT NULL THEN
      -- Create batch
      INSERT INTO sp_batches (
        wallet_id, user_id, initial_sp, remaining_sp,
        source_type, source_id, expires_at
      )
      VALUES (
        v_referee_wallet_id, p_referee_id, v_referee_sp, v_referee_sp,
        'referral', p_referral_id, v_expires_at
      )
      RETURNING id INTO v_referee_batch_id;

      -- Update wallet
      UPDATE sp_wallets
      SET 
        available_balance = available_balance + v_referee_sp,
        lifetime_earned = lifetime_earned + v_referee_sp,
        updated_at = NOW()
      WHERE id = v_referee_wallet_id;

      -- Create ledger entry
      INSERT INTO sp_ledger (
        wallet_id, user_id, transaction_type, amount,
        balance_before, balance_after, description,
        related_batch_id, idempotency_key
      )
      SELECT
        v_referee_wallet_id, p_referee_id, 'earn_referral', v_referee_sp,
        w.available_balance - v_referee_sp, w.available_balance,
        'Referral Reward: Welcome bonus',
        v_referee_batch_id, v_idempotency_key || '_referee'
      FROM sp_wallets w
      WHERE w.id = v_referee_wallet_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', CASE WHEN v_is_referrer_subscriber THEN v_referrer_sp ELSE 0 END,
    'referee_sp_awarded', CASE WHEN v_is_referee_subscriber THEN v_referee_sp ELSE 0 END,
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
-- 4. RPC: Award Challenge Completion Reward
-- =============================================================================

CREATE OR REPLACE FUNCTION award_challenge_sp(
  p_user_id UUID,
  p_challenge_id UUID,
  p_sp_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_batch_id UUID;
  v_ledger_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_is_subscriber BOOLEAN;
  v_idempotency_key TEXT;
  v_existing_award RECORD;
BEGIN
  -- 1. Idempotency check
  v_idempotency_key := 'challenge_' || p_challenge_id::TEXT || '_' || p_user_id::TEXT;
  
  SELECT * INTO v_existing_award
  FROM sp_ledger
  WHERE idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing_award IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Challenge reward already claimed'
    );
  END IF;

  -- 2. Check subscriber status
  SELECT is_active_subscriber(p_user_id) INTO v_is_subscriber;
  
  IF NOT v_is_subscriber THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kids Club+ subscription required to earn Swap Points'
    );
  END IF;

  -- 3. Validate SP amount
  IF p_sp_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid SP amount'
    );
  END IF;

  -- 4. Get wallet
  SELECT id INTO v_wallet_id
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SP wallet not found'
    );
  END IF;

  -- 5. Get expiration config
  SELECT (config_value)::INTEGER INTO v_expiration_days
  FROM sp_config
  WHERE config_key = 'expiration_period_days';
  
  v_expiration_days := COALESCE(v_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 6. Create SP batch
  INSERT INTO sp_batches (
    wallet_id, user_id, initial_sp, remaining_sp,
    source_type, source_id, expires_at
  )
  VALUES (
    v_wallet_id, p_user_id, p_sp_amount, p_sp_amount,
    'challenge', p_challenge_id, v_expires_at
  )
  RETURNING id INTO v_batch_id;

  -- 7. Update wallet
  UPDATE sp_wallets
  SET 
    available_balance = available_balance + p_sp_amount,
    lifetime_earned = lifetime_earned + p_sp_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 8. Create ledger entry
  INSERT INTO sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_batch_id, idempotency_key
  )
  SELECT
    v_wallet_id, p_user_id, 'earn_challenge', p_sp_amount,
    w.available_balance - p_sp_amount, w.available_balance,
    'Challenge Reward: Completed challenge',
    v_batch_id, v_idempotency_key
  FROM sp_wallets w
  WHERE w.id = v_wallet_id
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'sp_awarded', p_sp_amount,
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
-- 5. RPC: Refund SP for cancelled trade
-- =============================================================================

CREATE OR REPLACE FUNCTION refund_sp_for_cancelled_trade(
  p_user_id UUID,
  p_trade_id UUID,
  p_sp_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_batch_id UUID;
  v_ledger_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiration_days INTEGER;
  v_idempotency_key TEXT;
  v_existing_refund RECORD;
BEGIN
  -- 1. Idempotency check
  v_idempotency_key := 'refund_' || p_trade_id::TEXT;
  
  SELECT * INTO v_existing_refund
  FROM sp_ledger
  WHERE idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing_refund IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Refund already processed for this trade'
    );
  END IF;

  -- 2. Validate SP amount
  IF p_sp_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid SP amount'
    );
  END IF;

  -- 3. Get wallet
  SELECT id INTO v_wallet_id
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SP wallet not found'
    );
  END IF;

  -- 4. Get expiration config
  SELECT (config_value)::INTEGER INTO v_expiration_days
  FROM sp_config
  WHERE config_key = 'expiration_period_days';
  
  v_expiration_days := COALESCE(v_expiration_days, 365);
  v_expires_at := NOW() + (v_expiration_days || ' days')::INTERVAL;

  -- 5. Create SP batch for refund
  INSERT INTO sp_batches (
    wallet_id, user_id, initial_sp, remaining_sp,
    source_type, source_id, expires_at
  )
  VALUES (
    v_wallet_id, p_user_id, p_sp_amount, p_sp_amount,
    'refund', p_trade_id, v_expires_at
  )
  RETURNING id INTO v_batch_id;

  -- 6. Update wallet
  UPDATE sp_wallets
  SET 
    available_balance = available_balance + p_sp_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 7. Create ledger entry
  INSERT INTO sp_ledger (
    wallet_id, user_id, transaction_type, amount,
    balance_before, balance_after, description,
    related_transaction_id, related_batch_id, idempotency_key
  )
  SELECT
    v_wallet_id, p_user_id, 'earn_refund', p_sp_amount,
    w.available_balance - p_sp_amount, w.available_balance,
    'Refund: Trade cancelled',
    p_trade_id, v_batch_id, v_idempotency_key
  FROM sp_wallets w
  WHERE w.id = v_wallet_id
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'sp_refunded', p_sp_amount,
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
-- 6. Seed additional SP config for earning
-- =============================================================================

INSERT INTO sp_config (config_key, config_value, value_type, description, category) VALUES
  ('referral_reward_referrer_sp', '50', 'number', 'SP awarded to referrer when referee subscribes', 'referral'),
  ('referral_reward_referee_sp', '25', 'number', 'SP awarded to referee when they subscribe', 'referral'),
  ('referral_reward_referrer_cash', '0', 'number', 'Cash bonus (in cents) for referrer', 'referral'),
  ('referral_reward_referee_cash', '0', 'number', 'Cash bonus (in cents) for referee', 'referral'),
  ('max_referral_rewards_per_day', '10', 'number', 'Max referral rewards per user per day (fraud prevention)', 'fraud_prevention'),
  ('challenge_max_sp_per_day', '500', 'number', 'Max SP from challenges per user per day', 'fraud_prevention')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Query 1: Test starter pack
-- SELECT issue_starter_pack(
--   'YOUR_USER_ID'::UUID,
--   'YOUR_LISTING_ID'::UUID
-- );
--
-- Query 2: Test referral reward
-- SELECT award_referral_sp(
--   'REFERRER_USER_ID'::UUID,
--   'REFEREE_USER_ID'::UUID,
--   'REFERRAL_ID'::UUID
-- );
--
-- Query 3: Test challenge reward
-- SELECT award_challenge_sp(
--   'YOUR_USER_ID'::UUID,
--   'CHALLENGE_ID'::UUID,
--   100
-- );
--
-- Query 4: Test refund
-- SELECT refund_sp_for_cancelled_trade(
--   'YOUR_USER_ID'::UUID,
--   'TRADE_ID'::UUID,
--   50
-- );
--
-- Query 5: Verify config
-- SELECT config_key, config_value FROM sp_config WHERE category IN ('referral', 'fraud_prevention');
