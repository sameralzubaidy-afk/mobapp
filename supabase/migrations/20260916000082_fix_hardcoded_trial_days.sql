-- File: supabase/migrations/20250117_fix_hardcoded_trial_days.sql
-- Fix hardcoded '30 days' in create_trial_subscription to use dynamic config

-- =============================================================================
-- 1. Update create_trial_subscription to use get_trial_duration_days()
-- =============================================================================

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
  
  IF FOUND THEN
    RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
  END IF;

  -- Get configurable trial duration (defaults to 30 if not found)
  v_trial_days := get_trial_duration_days();

  -- Create trial subscription with dynamic trial days from admin_config
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
    NULL, -- No Stripe customer during no-card trial
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION create_trial_subscription IS 'MODULE-03 AUTH-V2-002: Creates Kids Club+ trial subscription using configurable trial duration from admin_config';

-- =============================================================================
-- 2. Verification
-- =============================================================================

-- After migration runs, verify:
-- SELECT trial_end_date - NOW() as days_until_expiration FROM subscriptions ORDER BY created_at DESC LIMIT 1;
-- Should show approximately the configured trial days (e.g., 30 days, 14 days, etc.)
