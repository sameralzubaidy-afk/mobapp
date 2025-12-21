-- File: supabase/migrations/20251215100001_auth_v2_rpc_functions.sql
-- MODULE-03 AUTH-V2-002: RPC Functions for Trial Subscription and SP Wallet Initialization

-- =============================================================================
-- 1. RPC: create_trial_subscription
-- =============================================================================
-- Creates a 30-day no-card trial subscription for new users

CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
BEGIN
  -- Check if subscription already exists
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
  END IF;

  -- Create trial subscription
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
    NOW() + INTERVAL '30 days',
    NULL, -- No Stripe customer during no-card trial
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION create_trial_subscription IS 'MODULE-03 AUTH-V2-002: Creates 30-day Kids Club+ trial subscription for new users';

-- =============================================================================
-- 2. RPC: initialize_sp_wallet
-- =============================================================================
-- Initializes Swap Points wallet for trial subscribers

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
    RAISE EXCEPTION 'SP wallet already exists for user %', p_user_id;
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
    0, -- Starting balance
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

COMMENT ON FUNCTION initialize_sp_wallet IS 'MODULE-03 AUTH-V2-002: Initializes Swap Points wallet for new trial subscribers';

-- =============================================================================
-- 3. RPC: get_subscription_summary
-- =============================================================================
-- Returns subscription summary for session enrichment (MODULE-11 integration)

CREATE OR REPLACE FUNCTION get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.status,
    CASE 
      WHEN s.status IN ('trial', 'active') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_subscription_summary IS 'MODULE-03 AUTH-V2-003: Returns subscription summary for session enrichment';

-- =============================================================================
-- 4. RPC: get_user_sp_wallet_summary
-- =============================================================================
-- Returns SP wallet summary for session enrichment (MODULE-09 integration)

CREATE OR REPLACE FUNCTION get_user_sp_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  available_points INTEGER,
  pending_points INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  wallet_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.available_balance AS available_points,
    w.pending_balance AS pending_points,
    w.lifetime_earned,
    w.lifetime_spent,
    w.status AS wallet_status
  FROM sp_wallets w
  WHERE w.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_sp_wallet_summary IS 'MODULE-03 AUTH-V2-003: Returns SP wallet summary for session enrichment';

-- =============================================================================
-- 5. RPC: send_parental_consent_email (stub for email service integration)
-- =============================================================================
-- Sends parental consent verification email for users under 13 (COPPA compliance)

CREATE OR REPLACE FUNCTION send_parental_consent_email(
  p_user_id UUID,
  p_parent_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- TODO: Integrate with SendGrid or email service
  -- For now, just log the request
  RAISE NOTICE 'Parental consent email requested for user % to parent email %', p_user_id, p_parent_email;
  
  -- Update profile to track that email was sent
  UPDATE profiles 
  SET updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION send_parental_consent_email IS 'MODULE-03 AUTH-V2-002: Sends parental consent email for COPPA compliance';
