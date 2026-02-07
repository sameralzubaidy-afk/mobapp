-- Migration: 20260204000000_fix_get_admin_payout_config_safe_parsing.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Prevent trade completion failures caused by unsafe casts in payout admin config parsing.
--          Some environments may store admin_config values as JSON/JSONB (e.g., '"500"'),
--          which can throw: "cannot cast jsonb string to type integer".
--          This migration replaces get_admin_payout_config() with a safe parser that:
--            - always converts config values to TEXT first
--            - strips JSON quotes
--            - validates numeric strings before casting
--            - falls back to safe defaults when invalid

-- =============================================================================
-- BLOCK 1 — Schema (RPC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_payout_config()
RETURNS TABLE (
  enable_automatic_seller_payout BOOLEAN,
  minimum_withdrawal_amount_cents INTEGER,
  stripe_payout_fee_fixed_cents INTEGER,
  stripe_payout_fee_percentage DECIMAL,
  paypal_payout_fee_percentage DECIMAL,
  paypal_payout_fee_cap_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_payout_raw TEXT;
  v_min_withdrawal_raw TEXT;
  v_stripe_fixed_raw TEXT;
  v_stripe_pct_raw TEXT;
  v_paypal_pct_raw TEXT;
  v_paypal_cap_raw TEXT;

  v_auto_payout TEXT;
  v_min_withdrawal TEXT;
  v_stripe_fixed TEXT;
  v_stripe_pct TEXT;
  v_paypal_pct TEXT;
  v_paypal_cap TEXT;
BEGIN
  -- Fetch raw config values and normalize to TEXT.
  -- Using ::TEXT avoids jsonb->integer direct casts in environments where column types drift.
  SELECT ac.value::TEXT INTO v_auto_payout_raw
  FROM public.admin_config ac
  WHERE ac.key = 'enable_automatic_seller_payout' AND ac.is_active = TRUE
  LIMIT 1;

  SELECT ac.value::TEXT INTO v_min_withdrawal_raw
  FROM public.admin_config ac
  WHERE ac.key = 'minimum_withdrawal_amount_cents' AND ac.is_active = TRUE
  LIMIT 1;

  SELECT ac.value::TEXT INTO v_stripe_fixed_raw
  FROM public.admin_config ac
  WHERE ac.key = 'payout_fee_stripe_fixed_cents' AND ac.is_active = TRUE
  LIMIT 1;

  SELECT ac.value::TEXT INTO v_stripe_pct_raw
  FROM public.admin_config ac
  WHERE ac.key = 'payout_fee_stripe_percentage' AND ac.is_active = TRUE
  LIMIT 1;

  SELECT ac.value::TEXT INTO v_paypal_pct_raw
  FROM public.admin_config ac
  WHERE ac.key = 'payout_fee_paypal_percentage' AND ac.is_active = TRUE
  LIMIT 1;

  SELECT ac.value::TEXT INTO v_paypal_cap_raw
  FROM public.admin_config ac
  WHERE ac.key = 'payout_fee_paypal_cap_cents' AND ac.is_active = TRUE
  LIMIT 1;

  -- Normalize: trim whitespace and strip JSON string quotes if present.
  v_auto_payout := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_auto_payout_raw, ''))), '');
  v_min_withdrawal := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_min_withdrawal_raw, ''))), '');
  v_stripe_fixed := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_stripe_fixed_raw, ''))), '');
  v_stripe_pct := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_stripe_pct_raw, ''))), '');
  v_paypal_pct := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_paypal_pct_raw, ''))), '');
  v_paypal_cap := NULLIF(TRIM(BOTH '"' FROM TRIM(COALESCE(v_paypal_cap_raw, ''))), '');

  RETURN QUERY
  SELECT
    CASE
      WHEN LOWER(COALESCE(v_auto_payout, '')) IN ('true', '1', 'yes', 'y', 'on') THEN TRUE
      WHEN LOWER(COALESCE(v_auto_payout, '')) IN ('false', '0', 'no', 'n', 'off') THEN FALSE
      ELSE FALSE
    END AS enable_automatic_seller_payout,

    COALESCE(
      CASE WHEN v_min_withdrawal ~ '^-?\\d+$' THEN v_min_withdrawal::INTEGER END,
      500
    ) AS minimum_withdrawal_amount_cents,

    COALESCE(
      CASE WHEN v_stripe_fixed ~ '^-?\\d+$' THEN v_stripe_fixed::INTEGER END,
      25
    ) AS stripe_payout_fee_fixed_cents,

    COALESCE(
      CASE WHEN v_stripe_pct ~ '^-?\\d+(\\.\\d+)?$' THEN v_stripe_pct::DECIMAL END,
      0.25
    ) AS stripe_payout_fee_percentage,

    COALESCE(
      CASE WHEN v_paypal_pct ~ '^-?\\d+(\\.\\d+)?$' THEN v_paypal_pct::DECIMAL END,
      2.0
    ) AS paypal_payout_fee_percentage,

    COALESCE(
      CASE WHEN v_paypal_cap ~ '^-?\\d+$' THEN v_paypal_cap::INTEGER END,
      2000
    ) AS paypal_payout_fee_cap_cents;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_payout_config() TO anon, authenticated;

-- =============================================================================
-- BLOCK 2 — Verification
-- =============================================================================

-- 1) Should return exactly 1 row with sane defaults even if keys are missing/malformed
-- SELECT * FROM public.get_admin_payout_config();

-- 2) If you suspect JSON-ish values exist, this helps find them:
-- SELECT key, value
-- FROM public.admin_config
-- WHERE key IN (
--   'enable_automatic_seller_payout',
--   'minimum_withdrawal_amount_cents',
--   'payout_fee_stripe_fixed_cents',
--   'payout_fee_stripe_percentage',
--   'payout_fee_paypal_percentage',
--   'payout_fee_paypal_cap_cents'
-- )
-- ORDER BY key;
