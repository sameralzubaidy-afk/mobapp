-- File: supabase/migrations/20260312000000_sub_020_trial_limit_control.sql
-- TASK SUB-020: Trial Limit Control (Prevent Trial Reuse - Globally Configured)
-- Mode B: Idempotent rerunnable migration

-- BLOCK 1: Schema + Core Config

-- 1) Add per-user trial usage counter on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_uses_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_trial_uses_count_non_negative'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_trial_uses_count_non_negative
      CHECK (trial_uses_count >= 0);
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.trial_uses_count IS 'SUB-020: Lifetime number of successful trial starts for this user.';

-- 2) Ensure max_trial_uses exists in admin_config (key/value schema)
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES (
  'max_trial_uses',
  '1',
  'SUB-020: Lifetime free trial starts allowed per user. <= 0 means unlimited.',
  'subscription',
  'number',
  TRUE
)
ON CONFLICT (key) DO NOTHING;

-- Legacy schema fallback (config_key/config_value)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_config'
      AND column_name = 'config_key'
  ) THEN
    INSERT INTO public.admin_config (config_key, config_value, description, enabled)
    VALUES (
      'max_trial_uses',
      '1'::jsonb,
      'SUB-020: Lifetime free trial starts allowed per user. <= 0 means unlimited.',
      TRUE
    )
    ON CONFLICT (config_key) DO NOTHING;
  END IF;
END;
$$;

-- BLOCK 2: Security + Functions + Indexes

CREATE INDEX IF NOT EXISTS idx_profiles_trial_uses_count ON public.profiles (trial_uses_count);

-- Helper: get effective max_trial_uses from admin_config
CREATE OR REPLACE FUNCTION public.get_max_trial_uses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value_text TEXT;
  v_result INTEGER;
BEGIN
  SELECT ac.value
  INTO v_value_text
  FROM public.admin_config ac
  WHERE ac.key = 'max_trial_uses'
    AND ac.is_active = TRUE
  ORDER BY ac.updated_at DESC
  LIMIT 1;

  IF v_value_text IS NULL THEN
    RETURN 1;
  END IF;

  BEGIN
    v_result := v_value_text::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_result := 1;
  END;

  RETURN COALESCE(v_result, 1);
END;
$$;

COMMENT ON FUNCTION public.get_max_trial_uses IS 'SUB-020: Returns configured lifetime trial limit. <=0 means unlimited.';

-- Helper: get full trial-limit status for UI messaging
CREATE OR REPLACE FUNCTION public.get_trial_limit_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_uses_count INTEGER;
  v_max_trial_uses INTEGER;
  v_unlimited BOOLEAN;
  v_limit_reached BOOLEAN;
  v_remaining_uses INTEGER;
BEGIN
  SELECT p.trial_uses_count
  INTO v_trial_uses_count
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  v_trial_uses_count := COALESCE(v_trial_uses_count, 0);
  v_max_trial_uses := public.get_max_trial_uses();
  v_unlimited := v_max_trial_uses <= 0;
  v_limit_reached := (NOT v_unlimited) AND v_trial_uses_count >= v_max_trial_uses;
  v_remaining_uses := CASE
    WHEN v_unlimited THEN NULL
    ELSE GREATEST(v_max_trial_uses - v_trial_uses_count, 0)
  END;

  RETURN jsonb_build_object(
    'trial_uses_count', v_trial_uses_count,
    'max_trial_uses', v_max_trial_uses,
    'unlimited', v_unlimited,
    'limit_reached', v_limit_reached,
    'remaining_uses', v_remaining_uses,
    'can_start_trial', NOT v_limit_reached
  );
END;
$$;

COMMENT ON FUNCTION public.get_trial_limit_status IS 'SUB-020: Returns trial usage + limit status for the supplied user.';

-- Increment usage count only on successful trial start
CREATE OR REPLACE FUNCTION public.increment_trial_uses(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE public.profiles p
  SET trial_uses_count = COALESCE(p.trial_uses_count, 0) + 1,
      updated_at = NOW()
  WHERE p.user_id = p_user_id
  RETURNING p.trial_uses_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: profile missing for user %', p_user_id;
  END IF;

  INSERT INTO public.subscription_events (user_id, event_type, metadata, created_at)
  VALUES (
    p_user_id,
    'trial_uses_incremented',
    jsonb_build_object('trial_uses_count', v_new_count),
    NOW()
  );

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_trial_uses IS 'SUB-020: Increments profiles.trial_uses_count after successful trial start.';

-- Optional admin override: reset to zero for fairness/support recovery
CREATE OR REPLACE FUNCTION public.admin_reset_trial_uses(p_user_id UUID, p_reason TEXT DEFAULT 'support_reset')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_old_count INTEGER;
BEGIN
  v_actor_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  IF NOT (v_actor_role = 'service_role' OR auth.jwt() ->> 'role' = 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only admin/service_role can reset trial usage';
  END IF;

  SELECT p.trial_uses_count INTO v_old_count
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  IF v_old_count IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: profile missing for user %', p_user_id;
  END IF;

  UPDATE public.profiles p
  SET trial_uses_count = 0,
      updated_at = NOW()
  WHERE p.user_id = p_user_id;

  INSERT INTO public.subscription_events (user_id, event_type, metadata, created_at)
  VALUES (
    p_user_id,
    'trial_uses_reset',
    jsonb_build_object('old_count', v_old_count, 'new_count', 0, 'reason', p_reason),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'old_count', v_old_count,
    'new_count', 0,
    'reason', p_reason
  );
END;
$$;

COMMENT ON FUNCTION public.admin_reset_trial_uses IS 'SUB-020: Admin/service-role override to reset trial usage to zero.';

-- Enforce limit in existing eligibility RPC (extend, do not replace behavior with parallel function)
-- SUB-020: Add explicit status-based blocking (grace_period, expired, active, cancelled, trial)
CREATE OR REPLACE FUNCTION public.is_user_trial_eligible(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_has_used_trial BOOLEAN;
  v_trial_uses_count INTEGER;
  v_max_trial_uses INTEGER;
BEGIN
  -- Check current subscription status: block if user is NOT free or expired
  SELECT s.status
  INTO v_current_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- SUB-020: Status-based blocking — user must be in free or expired state to trial
  -- Reject: trial (already in trial), active (already subscribed), cancelled/grace_period (recovery states)
  IF v_current_status IS NOT NULL AND v_current_status NOT IN ('free', 'expired') THEN
    RETURN FALSE;
  END IF;

  SELECT s.has_used_trial
  INTO v_has_used_trial
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT p.trial_uses_count
  INTO v_trial_uses_count
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  v_trial_uses_count := COALESCE(v_trial_uses_count, 0);
  v_max_trial_uses := public.get_max_trial_uses();

  -- Preserve existing one-trial logic AND enforce global max_trial_uses
  IF COALESCE(v_has_used_trial, FALSE) THEN
    RETURN FALSE;
  END IF;

  -- <= 0 means unlimited
  IF v_max_trial_uses <= 0 THEN
    RETURN TRUE;
  END IF;

  RETURN v_trial_uses_count < v_max_trial_uses;
END;
$$;

-- Extend trial creation RPC to increment usage only when status transitions to trial
CREATE OR REPLACE FUNCTION public.create_trial_subscription(p_user_id UUID)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.subscriptions;
  v_trial_days INTEGER;
BEGIN
  SELECT s.* INTO v_subscription
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT public.is_user_trial_eligible(p_user_id) THEN
    RAISE EXCEPTION 'TRIAL_LIMIT_REACHED: User % has reached the configured trial limit', p_user_id;
  END IF;

  v_trial_days := public.get_trial_duration_days();

  IF FOUND THEN
    IF v_subscription.status IN ('free', 'expired') THEN
      UPDATE public.subscriptions s
      SET status = 'trial',
          trial_start_date = NOW(),
          trial_end_date = NOW() + (v_trial_days || ' days')::INTERVAL,
          trial_used_at = COALESCE(s.trial_used_at, NOW()),
          trial_reminder_day_23_sent = FALSE,
          trial_reminder_day_28_sent = FALSE,
          trial_reminder_day_29_sent = FALSE,
          updated_at = NOW()
      WHERE s.id = v_subscription.id
      RETURNING s.* INTO v_subscription;

      PERFORM public.increment_trial_uses(p_user_id);

      RETURN v_subscription;
    END IF;

    RETURN v_subscription;
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    trial_used_at,
    stripe_customer_id,
    trial_reminder_day_23_sent,
    trial_reminder_day_28_sent,
    trial_reminder_day_29_sent,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    NOW(),
    NULL,
    FALSE,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_subscription;

  PERFORM public.increment_trial_uses(p_user_id);

  RETURN v_subscription;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_free_subscription_to_trial(p_user_id UUID)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_trial_subscription(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_max_trial_uses() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trial_limit_status(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_trial_uses(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_trial_uses(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_trial_eligible(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_trial_subscription(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upgrade_free_subscription_to_trial(UUID) TO authenticated, service_role;

-- Verification queries
-- 1) Column verification
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_uses_count';

-- 2) RLS/policies verification
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
-- SELECT policyname, cmd, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- 3) Function verification
-- SELECT proname FROM pg_proc WHERE proname IN ('get_max_trial_uses', 'get_trial_limit_status', 'increment_trial_uses', 'admin_reset_trial_uses', 'is_user_trial_eligible', 'create_trial_subscription');

-- 4) Runtime sample call
-- SELECT public.get_trial_limit_status('<USER_UUID_HERE>'::uuid);
-- SELECT public.is_user_trial_eligible('<USER_UUID_HERE>'::uuid);
-- SELECT public.increment_trial_uses('<USER_UUID_HERE>'::uuid);

-- 5) Common failure modes
-- - Ambiguous columns: always qualify with aliases in SQL updates/selects.
-- - Missing profile row: increment/reset functions raise PROFILE_NOT_FOUND.
-- - Admin writes blocked: ensure service role key is used for admin reset RPC.
