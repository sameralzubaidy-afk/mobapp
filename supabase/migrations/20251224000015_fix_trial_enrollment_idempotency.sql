-- File: supabase/migrations/20251227_fix_trial_enrollment_idempotency.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Make trial enrollment and wallet initialization idempotent to prevent "already exists" errors.

-- 1. Update create_trial_subscription to be idempotent for free/expired/active
CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_days INTEGER;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  -- Get configurable trial duration
  v_trial_days := get_trial_duration_days();

  IF FOUND THEN
    -- If it's free or expired, we can "activate" it as a trial
    IF v_subscription.status IN ('free', 'expired') THEN
      UPDATE subscriptions
      SET 
        status = 'trial',
        trial_start_date = NOW(),
        trial_end_date = NOW() + (v_trial_days || ' days')::INTERVAL,
        updated_at = NOW()
      WHERE id = v_subscription.id
      RETURNING * INTO v_subscription;
      
      RETURN v_subscription;
    ELSE
      -- If it's already trial or active, just return it (idempotent)
      RETURN v_subscription;
    END IF;
  END IF;

  -- Create new trial subscription
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    NULL,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

-- 2. Update upgrade_free_subscription_to_trial to also handle expired
CREATE OR REPLACE FUNCTION upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Just delegate to the now-idempotent create_trial_subscription
  RETURN create_trial_subscription(p_user_id);
END;
$$;

-- 3. Make initialize_sp_wallet idempotent
CREATE OR REPLACE FUNCTION initialize_sp_wallet(p_user_id UUID)
RETURNS sp_wallets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet sp_wallets;
BEGIN
  -- Check if wallet already exists
  SELECT * INTO v_wallet FROM sp_wallets WHERE user_id = p_user_id;
  
  IF FOUND THEN
    -- Just return existing wallet instead of failing
    RETURN v_wallet;
  END IF;

  -- Create SP wallet with zero balance
  INSERT INTO sp_wallets (
    user_id,
    status,
    available_balance,
    pending_balance,
    lifetime_earned,
    lifetime_spent,
    last_activity_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'active',
    0,
    0,
    0,
    0,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

-- 4. Verification query
-- SELECT create_trial_subscription('79919419-47dc-43af-a55c-e58597096026');
-- SELECT initialize_sp_wallet('79919419-47dc-43af-a55c-e58597096026');
