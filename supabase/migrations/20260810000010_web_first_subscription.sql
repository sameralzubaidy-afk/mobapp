-- ============================================================================
-- R7 — Web-First Subscription Purchase + Status Sync (Option A)
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   Adds ONE atomic RPC (rpc_upsert_web_subscription) that the Stripe
--   subscription webhook and the account-linking flow use to create or refresh
--   the subscriptions row when a parent subscribes on the web (passitup.com):
--     - ties the web Stripe customer + subscription to the existing app account
--     - sets status 'trial' (Stripe trialing) or 'active'
--     - records period windows + has_used_trial + next_billing_date
--     - writes a subscription_events audit row (idempotent, audit trail)
--   R1 (fee engine) and R6 (SP gating) need NO code change here: both already
--   read subscriptions.status IN ('trial','active').
--
-- SECURITY (HP-3): SECURITY DEFINER so webhook/service-role writes bypass RLS,
-- but ONLY the account owner (auth.uid() = p_user_id) or service_role may run it.
--
-- BLOCKS:
--   BLOCK 1: RPC (function + grants)
--   BLOCK 2: verification queries
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: rpc_upsert_web_subscription
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_upsert_web_subscription(
  p_user_id UUID,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_tier_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_period_start TIMESTAMPTZ DEFAULT NULL,
  p_period_end TIMESTAMPTZ DEFAULT NULL,
  p_has_used_trial BOOLEAN DEFAULT NULL,
  p_cancel_at_period_end BOOLEAN DEFAULT NULL,
  p_trial_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_old_status TEXT;
  v_status TEXT;
BEGIN
  -- Authorization: account owner or service_role (webhook / admin / link flow).
  -- auth.uid()/auth.role() reflect the INVOKER even inside SECURITY DEFINER.
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: cannot modify another user''s subscription';
  END IF;

  v_status := COALESCE(p_status, 'active');

  IF v_status NOT IN
     ('free','trial','active','grace','canceled','expired','paused','grace_period','cancelled')
  THEN
    RAISE EXCEPTION 'INVALID_STATUS: % is not a valid subscription status', v_status;
  END IF;

  SELECT s.id, s.status INTO v_subscription_id, v_old_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, tier_id, status, stripe_customer_id, stripe_subscription_id,
      current_period_start, current_period_end, next_billing_date,
      has_used_trial, cancel_at_period_end, auto_renew_enabled, trial_end_date
    ) VALUES (
      p_user_id, p_tier_id, v_status, p_stripe_customer_id, p_stripe_subscription_id,
      p_period_start, p_period_end, p_period_end,
      COALESCE(p_has_used_trial, TRUE), COALESCE(p_cancel_at_period_end, FALSE), TRUE, p_trial_end
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions s
    SET
      tier_id = COALESCE(p_tier_id, s.tier_id),
      status = v_status,
      stripe_customer_id = COALESCE(p_stripe_customer_id, s.stripe_customer_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, s.stripe_subscription_id),
      current_period_start = COALESCE(p_period_start, s.current_period_start),
      current_period_end = COALESCE(p_period_end, s.current_period_end),
      next_billing_date = COALESCE(p_period_end, s.next_billing_date),
      has_used_trial = COALESCE(p_has_used_trial, s.has_used_trial, TRUE),
      cancel_at_period_end = COALESCE(p_cancel_at_period_end, s.cancel_at_period_end, FALSE),
      auto_renew_enabled = TRUE,
      trial_end_date = COALESCE(p_trial_end, s.trial_end_date),
      updated_at = NOW()
    WHERE s.id = v_subscription_id;
  END IF;

  INSERT INTO public.subscription_events (user_id, event_type, metadata)
  VALUES (
    p_user_id,
    'web_subscription_upsert',
    jsonb_build_object(
      'stripe_customer_id', p_stripe_customer_id,
      'stripe_subscription_id', p_stripe_subscription_id,
      'status', v_status,
      'old_status', v_old_status,
      'period_end', p_period_end,
      'source', 'web_first_subscription_r7'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'old_status', v_old_status,
    'new_status', v_status,
    'updated_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_upsert_web_subscription(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_web_subscription(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TIMESTAMPTZ) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_upsert_web_subscription IS
  'R7: Atomically upsert the subscriptions row from a web (Stripe Checkout) subscription event. Account owner or service_role only.';

-- ---------------------------------------------------------------------------
-- BLOCK 2: verification queries (run manually to confirm)
-- ---------------------------------------------------------------------------
-- 1. Columns referenced exist on subscriptions:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'subscriptions'
--   AND column_name IN ('stripe_customer_id','stripe_subscription_id','tier_id','status',
--                       'current_period_start','current_period_end','next_billing_date',
--                       'has_used_trial','cancel_at_period_end','auto_renew_enabled','trial_end_date');
--
-- 2. Function exists + grants:
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'rpc_upsert_web_subscription';
