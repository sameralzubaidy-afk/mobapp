-- Migration: Upgrade free subscription to trial RPC
-- Purpose: Safely upgrade a free subscription created at signup to trial status
-- Used by: enrollInTrialSubscription() when user upgrades mid-session

CREATE OR REPLACE FUNCTION upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
  v_trial_duration INTEGER;
  v_trial_end_date TIMESTAMPTZ;
BEGIN
  -- Get the user's subscription (must exist and be 'free')
  SELECT * INTO v_subscription FROM subscriptions WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;

  IF v_subscription.status != 'free' THEN
    -- Already upgraded, just return it
    RETURN v_subscription;
  END IF;

  -- Get trial duration from admin config
  v_trial_duration := get_trial_duration_days();
  v_trial_end_date := NOW() + (v_trial_duration || ' days')::INTERVAL;

  -- Update the free subscription to trial
  UPDATE subscriptions
  SET 
    status = 'trial',
    trial_start_date = NOW(),
    trial_end_date = v_trial_end_date,
    updated_at = NOW()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

COMMENT ON FUNCTION upgrade_free_subscription_to_trial IS 'MODULE-11: Upgrade existing free subscription to trial (for mid-session upgrades)';
