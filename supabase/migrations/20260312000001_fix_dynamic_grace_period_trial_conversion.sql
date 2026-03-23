-- File: supabase/migrations/20260312000001_fix_dynamic_grace_period_trial_conversion.sql
-- Purpose: Remove hardcoded 90-day grace window from trial conversion RPC.
-- Mode: B (idempotent rerunnable migration)

-- BLOCK 1: Function update
-- ============================================================================

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
  v_grace_days INTEGER := 90;
  v_config_value TEXT;
  v_tier_grace_days INTEGER;
  v_grace_ends_at TIMESTAMPTZ;
BEGIN
  SELECT s.*
  INTO v_subscription
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SUBSCRIPTION_NOT_FOUND',
      'message', 'No subscription found for user'
    );
  END IF;

  IF v_subscription.status <> 'trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Subscription is not in trial status',
      'current_status', v_subscription.status
    );
  END IF;

  -- Primary config source: admin_config.key/value
  SELECT ac.value
  INTO v_config_value
  FROM public.admin_config ac
  WHERE ac.key = 'grace_period_days'
    AND ac.is_active = TRUE
  LIMIT 1;

  IF v_config_value IS NULL THEN
    -- Legacy fallback: admin_config.config_key/config_value
    SELECT ac.config_value
    INTO v_config_value
    FROM public.admin_config ac
    WHERE ac.config_key = 'grace_period_days'
      AND ac.is_active = TRUE
    LIMIT 1;
  END IF;

  IF v_config_value IS NOT NULL THEN
    v_grace_days := GREATEST(COALESCE(NULLIF(TRIM(v_config_value), '')::INTEGER, 90), 0);
  ELSIF v_subscription.tier_id IS NOT NULL THEN
    -- Tier-level fallback if admin_config value is not set
    SELECT st.grace_period_days
    INTO v_tier_grace_days
    FROM public.subscription_tiers st
    WHERE st.id = v_subscription.tier_id
    LIMIT 1;

    IF v_tier_grace_days IS NOT NULL THEN
      v_grace_days := GREATEST(v_tier_grace_days, 0);
    END IF;
  END IF;

  v_grace_ends_at := NOW() + make_interval(days => v_grace_days);

  UPDATE public.subscriptions s
  SET
    status = 'grace_period',
    tier_id = NULL,
    has_used_trial = TRUE,
    grace_started_at = NOW(),
    grace_ends_at = v_grace_ends_at,
    updated_at = NOW()
  WHERE s.user_id = p_user_id;

  UPDATE public.sp_wallets w
  SET
    state = 'frozen',
    grace_period_ends_at = v_grace_ends_at,
    frozen_at = NOW(),
    updated_at = NOW()
  WHERE w.user_id = p_user_id;

  INSERT INTO public.subscription_events (
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
      'grace_days', v_grace_days,
      'grace_ends_at', v_grace_ends_at,
      'downgraded_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'status', 'grace_period',
    'grace_days', v_grace_days,
    'grace_ends_at', v_grace_ends_at,
    'message', 'Trial downgraded to grace period, SP wallet frozen'
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    -- Guard against malformed admin_config values.
    v_grace_ends_at := NOW() + INTERVAL '90 days';

    UPDATE public.subscriptions s
    SET
      status = 'grace_period',
      tier_id = NULL,
      has_used_trial = TRUE,
      grace_started_at = NOW(),
      grace_ends_at = v_grace_ends_at,
      updated_at = NOW()
    WHERE s.user_id = p_user_id;

    UPDATE public.sp_wallets w
    SET
      state = 'frozen',
      grace_period_ends_at = v_grace_ends_at,
      frozen_at = NOW(),
      updated_at = NOW()
    WHERE w.user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'subscription_id', v_subscription.id,
      'status', 'grace_period',
      'grace_days', 90,
      'grace_ends_at', v_grace_ends_at,
      'warning', 'Invalid admin_config grace_period_days value. Used fallback 90 days.'
    );
END;
$$;

COMMENT ON FUNCTION public.downgrade_trial_to_grace IS
'MODULE-11 SUB-005: Downgrade expired trial to grace period using dynamic admin_config grace_period_days';

-- BLOCK 2: Verification
-- ============================================================================

-- Verify function exists and was replaced.
SELECT p.proname
FROM pg_proc p
WHERE p.proname = 'downgrade_trial_to_grace';

-- Verify current grace config source value.
SELECT ac.key, ac.value, ac.is_active
FROM public.admin_config ac
WHERE ac.key = 'grace_period_days';

-- Sample RPC call (replace UUID).
-- SELECT public.downgrade_trial_to_grace('00000000-0000-0000-0000-000000000000'::uuid);

-- Common failure modes:
-- 1) admin_config value non-numeric -> function falls back to 90 and returns warning.
-- 2) Missing subscription row -> SUBSCRIPTION_NOT_FOUND.
-- 3) Non-trial status -> INVALID_STATUS.
