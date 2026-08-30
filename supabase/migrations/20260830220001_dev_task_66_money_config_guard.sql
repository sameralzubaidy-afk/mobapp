-- =============================================================================
-- Migration: 20260830220001_dev_task_66_money_config_guard.sql
-- Mode: B (idempotent rerunnable migration)
--
-- DEV-TASK-66 item 3: server-side validation for money/rate admin_config keys.
--
-- Finding (QA Task 9, N02): upsert_admin_config_setting() accepted a NEGATIVE
--   cart_min_value_cents ("-5") — the "cannot be negative" guard was admin-UI
--   ONLY (p2p-kids-admin/src/app/settings/cart/page.tsx). The RPC/DB layer had
--   no enforcement for cart_min_value_cents nor for sibling money/rate keys.
--
-- Fix (defense in depth):
--   1) fn_validate_admin_config_money(p_key, p_value) — shared validator:
--        whitelisted money/rate keys MUST parse as NUMERIC and be >= 0.
--        Raises INVALID_CONFIG_VALUE (22023) or NEGATIVE_MONEY_VALUE (23514).
--   2) upsert_admin_config_setting() — calls the validator before the upsert
--        (BP-48: admin config writes go through this shared RPC).
--   3) BEFORE INSERT OR UPDATE trigger on admin_config — last line of defense
--        covering direct writes / seed / secure_upsert_admin_config() paths.
--
-- NOT covered (documented gap): sp_config (separate jsonb key/value table) and
--   the trade-timing integer keys (offer_timeout_hours etc.) which already have
--   their own CHECKs + relationship trigger (20260528000001_admin_config_trade_timing.sql).
-- =============================================================================

-- =============================================================================
-- 1) Shared validator
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_admin_config_money(
  p_key TEXT,
  p_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_numeric_value NUMERIC;
  -- Money / rate keys that must be a valid number >= 0. Trade-timing integer
  -- keys (offer_timeout_hours, auto_complete_hours, ...) are intentionally
  -- absent — they already have their own CHECKs + relationship trigger.
  v_money_keys TEXT[] := ARRAY[
    'cart_min_value_cents',
    'min_listing_price',
    'subscription_price_monthly',
    'subscription_price_yearly',
    'trial_period_days',
    'grace_period_days',
    'transaction_fee_subscriber_cents',
    'transaction_fee_non_subscriber_cents',
    'transaction_fee_member_cents',
    'transaction_fee_non_member_cents',
    'buyer_fee_active_member_cents',
    'buyer_fee_first_trade_cents',
    'buyer_fee_subsequent_fixed_cents',
    'buyer_fee_subsequent_max_cents',
    'payout_fee_stripe_fixed_cents',
    'payout_fee_paypal_cap_cents',
    'payout_fee_venmo_cap_cents',
    'payout_fee_bank_ach_cents',
    'dispute_fee_cents',
    'dispute_recovery_rate',
    'sp_earn_multiplier',
    'sp_max_percentage_per_purchase',
    'sp_pending_days',
    'sp_expiration_days',
    'sp_min_balance_for_redemption',
    'sp_redemption_multiplier',
    'sp_redemption_cap_global',
    'default_sales_tax_rate',
    'default_tax_rate'
  ];
BEGIN
  IF p_key = ANY (v_money_keys) THEN
    BEGIN
      v_numeric_value := p_value::NUMERIC;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'INVALID_CONFIG_VALUE: key=% must be a valid number, got %', p_key, p_value
          USING ERRCODE = '22023';
    END;

    IF v_numeric_value < 0 THEN
      RAISE EXCEPTION 'NEGATIVE_MONEY_VALUE: key=% must be >= 0, got %', p_key, p_value
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;

-- =============================================================================
-- 2) upsert_admin_config_setting() — add the validator call
--    (unchanged signature/body from 20260830000012_dev_task_59_identity_fixes.sql
--     except the added guard after the identity check)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_admin_config_setting(
  p_key TEXT,
  p_value TEXT,
  p_category public.admin_config_category,
  p_data_type TEXT DEFAULT 'string',
  p_is_secret BOOLEAN DEFAULT FALSE,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
  out_id BIGINT,
  out_key TEXT,
  out_value TEXT,
  out_category public.admin_config_category,
  out_data_type TEXT,
  out_is_secret BOOLEAN,
  out_is_active BOOLEAN,
  out_updated_at TIMESTAMP WITH TIME ZONE,
  out_updated_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
BEGIN
  -- DT59: admin_config holds every money lever (fees, caps, payout enable,
  -- trial/grace, tax rates, min price). Only service_role (admin API routes,
  -- x-admin-secret-verified) or an authenticated admin (browser, real
  -- auth.uid()) may write. current_setting('role') — NOT request.jwt.claim.role
  -- (never set by this PostgREST, DT-57).
  v_actor_role := COALESCE(current_setting('role', true), '');
  IF v_actor_role <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.admin_has_role(auth.uid())) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only admins or service_role can update configuration';
  END IF;

  -- DEV-TASK-66 item 3: server-side money/rate guard (no negatives, must be numeric).
  PERFORM public.fn_validate_admin_config_money(p_key, p_value);

  RETURN QUERY
  INSERT INTO public.admin_config (
    key,
    value,
    category,
    data_type,
    is_secret,
    is_active,
    updated_at,
    updated_by
  )
  VALUES (
    p_key,
    p_value,
    p_category,
    p_data_type,
    p_is_secret,
    p_is_active,
    NOW(),
    p_admin_id
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = EXCLUDED.value,
    category = EXCLUDED.category,
    data_type = EXCLUDED.data_type,
    is_secret = EXCLUDED.is_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW(),
    -- Never wipe the recorded editor when p_admin_id is absent (e.g. a legacy
    -- 6-arg/system caller). COALESCE keeps the previous editor intact.
    updated_by = COALESCE(p_admin_id, admin_config.updated_by)
  RETURNING
    admin_config.id,
    admin_config.key,
    admin_config.value,
    admin_config.category,
    admin_config.data_type,
    admin_config.is_secret,
    admin_config.is_active,
    admin_config.updated_at,
    admin_config.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_admin_config_setting(text, text, public.admin_config_category, text, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_admin_config_setting(text, text, public.admin_config_category, text, boolean, boolean, uuid) TO authenticated, service_role;

-- =============================================================================
-- 3) BEFORE INSERT OR UPDATE trigger — last line of defense
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_admin_config_money_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_validate_admin_config_money(NEW.key, NEW.value);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_admin_config_money ON public.admin_config;
CREATE TRIGGER trigger_validate_admin_config_money
BEFORE INSERT OR UPDATE OF value ON public.admin_config
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_admin_config_money_trigger();

-- =============================================================================
-- VERIFICATION QUERIES (SQL-3 / SQL-10) — run AFTER applying to staging
-- =============================================================================

-- 1. Guard rejects a negative cart min value (expect error NEGATIVE_MONEY_VALUE):
-- SELECT public.fn_validate_admin_config_money('cart_min_value_cents', '-5');

-- 2. Guard rejects a non-numeric money value (expect INVALID_CONFIG_VALUE):
-- SELECT public.fn_validate_admin_config_money('cart_min_value_cents', 'abc');

-- 3. Guard accepts a valid value (expect no error):
-- SELECT public.fn_validate_admin_config_money('cart_min_value_cents', '0');

-- 4. Guard ignores non-money keys (expect no error):
-- SELECT public.fn_validate_admin_config_money('sales_tax_enabled', 'true');

-- 5. Trigger is attached:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.admin_config'::regclass
--   AND tgname = 'trigger_validate_admin_config_money';
