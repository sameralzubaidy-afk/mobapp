-- ============================================================================
-- Migration: Subscription Management RPC Functions (MODULE-11 TASK SUB-002)
-- Purpose: Core subscription helper functions for status management
-- Date: 2026-02-13
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: get_subscription_status (enhanced from existing stub)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  tier_id UUID,
  status TEXT,
  has_used_trial BOOLEAN,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  grace_started_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  paused_until TIMESTAMPTZ,
  auto_renew_enabled BOOLEAN,
  payment_retry_count INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_method_id TEXT
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
    s.tier_id,
    s.status,
    COALESCE(s.has_used_trial, FALSE) AS has_used_trial,
    s.trial_start_date AS trial_started_at,
    s.trial_end_date AS trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.next_billing_date,
    s.grace_started_at,
    s.grace_ends_at,
    s.cancelled_at,
    s.cancel_reason,
    s.paused_until,
    COALESCE(s.auto_renew_enabled, TRUE) AS auto_renew_enabled,
    COALESCE(s.payment_retry_count, 0) AS payment_retry_count,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.stripe_payment_method_id
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.get_subscription_status IS 'V2.1: Get complete subscription status for a user (MODULE-11 SUB-002)';

-- ============================================================================
-- FUNCTION 2: can_user_earn_sp (updated with new status rules)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_user_earn_sp(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Handle no subscription found (v_status is NULL)
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Only trial, active, and paused users can earn SP
  -- paused users keep access during pause period
  -- grace_period users cannot earn SP (wallet frozen)
  RETURN v_status IN ('trial', 'active', 'paused');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_earn_sp(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.can_user_earn_sp IS 'V2.1: Check if user can earn Swap Points (trial, active, paused only)';

-- ============================================================================
-- FUNCTION 3: can_user_spend_sp (updated with new status rules)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_user_spend_sp(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Handle no subscription found (v_status is NULL)
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Only trial and active users can spend SP
  -- paused users keep access during pause period
  -- grace_period users cannot spend SP (wallet frozen)
  RETURN v_status IN ('trial', 'active', 'paused');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_spend_sp(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.can_user_spend_sp IS 'V2.1: Check if user can spend Swap Points (trial, active, paused only)';

-- ============================================================================
-- FUNCTION 4: get_user_transaction_fee (updated with new price)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_transaction_fee(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Subscriber fee: $0.99 (99 cents) for trial, active, paused
  -- Non-subscriber fee: $2.99 (299 cents) for free, grace_period, expired, cancelled
  IF v_status IS NOT NULL AND v_status IN ('trial', 'active', 'paused') THEN
    RETURN 99;  -- $0.99 for Kids Club+ subscribers
  ELSE
    RETURN 299; -- $2.99 for non-subscribers
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_transaction_fee(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_transaction_fee IS 'V2.1: Get transaction fee in cents ($0.99 for subscribers, $2.99 for non-subscribers)';

-- ============================================================================
-- FUNCTION 5: is_user_trial_eligible
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_trial_eligible(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_used_trial BOOLEAN;
BEGIN
  SELECT s.has_used_trial INTO v_has_used_trial
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- If no subscription record exists, they are ELIGIBLE for trial
  IF v_has_used_trial IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- User is trial eligible if they haven't used their trial yet
  RETURN NOT v_has_used_trial;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_trial_eligible(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.is_user_trial_eligible IS 'V2.1: Check if user is eligible for 30-day free trial (one-time only)';

-- ============================================================================
-- FUNCTION 6: update_subscription_status (general status updater)
-- ============================================================================

-- Drop old signature to avoid confusion or overloading issues
DROP FUNCTION IF EXISTS public.update_subscription_status(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.update_subscription_status(
  p_user_id UUID,
  p_status TEXT DEFAULT NULL,
  p_tier_id UUID DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_has_used_trial BOOLEAN DEFAULT NULL,
  p_auto_renew_enabled BOOLEAN DEFAULT NULL,
  p_payment_retry_count INTEGER DEFAULT NULL,
  p_grace_started_at TIMESTAMPTZ DEFAULT NULL,
  p_grace_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_cancelled_at TIMESTAMPTZ DEFAULT NULL,
  p_cancel_reason TEXT DEFAULT NULL,
  p_next_billing_date TIMESTAMPTZ DEFAULT NULL,
  p_last_payment_date TIMESTAMPTZ DEFAULT NULL,
  p_last_payment_amount INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_old_status TEXT;
BEGIN
  -- Get current subscription
  SELECT id, status INTO v_subscription_id, v_old_status
  FROM public.subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;
  
  -- Update the subscription with new status
  UPDATE public.subscriptions
  SET 
    status = COALESCE(p_status, status),
    tier_id = COALESCE(p_tier_id, tier_id),
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    has_used_trial = COALESCE(p_has_used_trial, has_used_trial),
    auto_renew_enabled = COALESCE(p_auto_renew_enabled, auto_renew_enabled),
    payment_retry_count = COALESCE(p_payment_retry_count, payment_retry_count),
    grace_started_at = COALESCE(p_grace_started_at, grace_started_at),
    grace_ends_at = COALESCE(p_grace_ends_at, grace_ends_at),
    cancelled_at = COALESCE(p_cancelled_at, cancelled_at),
    cancel_reason = COALESCE(p_cancel_reason, cancel_reason),
    next_billing_date = COALESCE(p_next_billing_date, next_billing_date),
    last_payment_date = COALESCE(p_last_payment_date, last_payment_date),
    last_payment_amount = COALESCE(p_last_payment_amount, last_payment_amount),
    updated_at = NOW()
  WHERE id = v_subscription_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'old_status', v_old_status,
    'new_status', COALESCE(p_status, v_old_status),
    'updated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_subscription_status(UUID, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON FUNCTION public.update_subscription_status IS 'V2.1: Update subscription status (service role only for webhook/admin operations)';

-- ============================================================================
-- FUNCTION 7: record_payment_attempt (for retry logic tracking)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_payment_attempt(
  p_user_id UUID,
  p_success BOOLEAN,
  p_amount INTEGER DEFAULT NULL,
  p_charge_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_retry_count INTEGER;
BEGIN
  -- Get current subscription
  SELECT id, COALESCE(payment_retry_count, 0) INTO v_subscription_id, v_retry_count
  FROM public.subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;
  
  IF p_success THEN
    -- Payment succeeded - reset retry count and update last payment info
    UPDATE public.subscriptions
    SET 
      payment_retry_count = 0,
      payment_failed_at = NULL,
      last_payment_date = NOW(),
      last_payment_amount = p_amount,
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'payment_succeeded', true,
      'retry_count_reset', true
    );
  ELSE
    -- Payment failed - increment retry count
    v_retry_count := v_retry_count + 1;
    
    UPDATE public.subscriptions
    SET 
      payment_retry_count = v_retry_count,
      payment_failed_at = NOW(),
      status = CASE WHEN v_retry_count >= 3 THEN 'grace_period' ELSE status END,
      grace_started_at = CASE WHEN v_retry_count >= 3 THEN NOW() ELSE grace_started_at END,
      grace_ends_at = CASE WHEN v_retry_count >= 3 THEN NOW() + INTERVAL '90 days' ELSE grace_ends_at END,
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'payment_failed', true,
      'retry_count', v_retry_count,
      'max_retries_reached', v_retry_count >= 3
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_attempt(UUID, BOOLEAN, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION public.record_payment_attempt IS 'V2.1: Record payment attempt for retry logic tracking (service role only)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query 1: Verify all functions exist
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  d.description
FROM pg_proc p
LEFT JOIN pg_description d ON p.oid = d.objoid
WHERE p.proname IN (
  'get_subscription_status',
  'can_user_earn_sp',
  'can_user_spend_sp',
  'get_user_transaction_fee',
  'is_user_trial_eligible',
  'update_subscription_status',
  'record_payment_attempt'
)
AND p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;

-- Query 2: Test functions with a sample user (replace with actual user_id)
-- SELECT * FROM public.get_subscription_status('00000000-0000-0000-0000-000000000000');
-- SELECT public.can_user_earn_sp('00000000-0000-0000-0000-000000000000');
-- SELECT public.can_user_spend_sp('00000000-0000-0000-0000-000000000000');
-- SELECT public.get_user_transaction_fee('00000000-0000-0000-0000-000000000000');
-- SELECT public.is_user_trial_eligible('00000000-0000-0000-0000-000000000000');
