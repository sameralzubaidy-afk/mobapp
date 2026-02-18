-- File: supabase/migrations/20260215000001_trial_conversion_rpcs.sql
-- MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules
-- Creates RPC functions for trial conversion and downgrade logic

-- =============================================================================
-- BLOCK 1: Schema Verification & Trial Conversion RPC
-- =============================================================================

-- RPC: check_expired_trials
-- Returns all subscriptions with expired trials that need conversion
CREATE OR REPLACE FUNCTION public.check_expired_trials()
RETURNS TABLE (
  v_id UUID,
  v_user_id UUID,
  v_status TEXT,
  v_stripe_subscription_id TEXT,
  v_trial_end_date TIMESTAMPTZ,
  v_stripe_customer_id TEXT,
  v_has_payment_method BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.status,
    s.stripe_subscription_id,
    s.trial_end_date,
    s.stripe_customer_id,
    (s.stripe_payment_method_id IS NOT NULL) AS v_has_payment_method
  FROM subscriptions s
  WHERE s.status = 'trial'
    AND s.trial_end_date IS NOT NULL
    AND s.trial_end_date < NOW()
  ORDER BY s.trial_end_date ASC;
END;
$$;

COMMENT ON FUNCTION public.check_expired_trials IS 
'MODULE-11 SUB-005: Returns all expired trial subscriptions needing conversion';


-- RPC: convert_trial_to_active
-- Converts a trial subscription to active (user added payment method)
CREATE OR REPLACE FUNCTION public.convert_trial_to_active(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_tier_id UUID;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SUBSCRIPTION_NOT_FOUND',
      'message', 'No subscription found for user'
    );
  END IF;

  -- Verify trial status
  IF v_subscription.status != 'trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Subscription is not in trial status',
      'current_status', v_subscription.status
    );
  END IF;

  -- Verify payment method exists
  IF v_subscription.stripe_payment_method_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_PAYMENT_METHOD',
      'message', 'No payment method attached'
    );
  END IF;

  -- Get Kids Club+ tier ID
  SELECT id INTO v_tier_id
  FROM subscription_tiers
  WHERE name = 'kids_club_plus'
  LIMIT 1;

  -- Update subscription to active
  UPDATE subscriptions
  SET 
    status = 'active',
    tier_id = v_tier_id,
    has_used_trial = TRUE,
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log event (subscription_events schema: user_id, event_type, metadata, created_at)
  INSERT INTO subscription_events (
    user_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'trial_converted',
    jsonb_build_object(
      'subscription_id', v_subscription.id,
      'status_from', 'trial',
      'status_to', 'active',
      'trial_end_date', v_subscription.trial_end_date,
      'converted_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'status', 'active',
    'message', 'Trial successfully converted to active subscription'
  );
END;
$$;

COMMENT ON FUNCTION public.convert_trial_to_active IS 
'MODULE-11 SUB-005: Converts expired trial to active subscription when payment method exists';


-- RPC: downgrade_trial_to_grace
-- Downgrades expired trial to grace_period (user did not add payment)
CREATE OR REPLACE FUNCTION public.downgrade_trial_to_grace(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_grace_ends_at TIMESTAMPTZ;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SUBSCRIPTION_NOT_FOUND',
      'message', 'No subscription found for user'
    );
  END IF;

  -- Verify trial status
  IF v_subscription.status != 'trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Subscription is not in trial status',
      'current_status', v_subscription.status
    );
  END IF;

  -- Calculate grace period end (90 days from now per MODULE-11)
  v_grace_ends_at := NOW() + INTERVAL '90 days';

  -- Update subscription to grace_period
  UPDATE subscriptions
  SET 
    status = 'grace_period',
    tier_id = NULL,  -- Remove tier
    has_used_trial = TRUE,
    grace_started_at = NOW(),
    grace_ends_at = v_grace_ends_at,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Freeze SP wallet (MODULE-09 integration)
  -- Note: sp_wallets.state column holds the wallet state (renamed from 'status' in migration 093)
  -- Valid states: 'active', 'frozen', 'grace_period', 'suspended'
  UPDATE sp_wallets
  SET 
    state = 'frozen',
    grace_period_ends_at = v_grace_ends_at,
    frozen_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log event (subscription_events schema: user_id, event_type, metadata, created_at)
  INSERT INTO subscription_events (
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
      'grace_ends_at', v_grace_ends_at,
      'downgraded_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'status', 'grace_period',
    'grace_ends_at', v_grace_ends_at,
    'message', 'Trial downgraded to grace period, SP wallet frozen'
  );
END;
$$;

COMMENT ON FUNCTION public.downgrade_trial_to_grace IS 
'MODULE-11 SUB-005: Downgrades expired trial to grace period when no payment method';


-- =============================================================================
-- BLOCK 2: Verification Queries
-- =============================================================================

-- Verify functions exist
SELECT 
  proname AS function_name,
  prosrc IS NOT NULL AS has_definition
FROM pg_proc
WHERE proname IN ('check_expired_trials', 'convert_trial_to_active', 'downgrade_trial_to_grace')
ORDER BY proname;

-- Test query: Check for expired trials
-- SELECT * FROM check_expired_trials();

-- Expected: Returns list of expired trial subscriptions
