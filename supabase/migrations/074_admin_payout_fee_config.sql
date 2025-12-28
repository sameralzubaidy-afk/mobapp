-- ================================================================
-- Migration: 074_admin_payout_fee_config.sql
-- Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-002)
-- Description: Add dynamic payout fee configuration to admin_config
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- =============================================================================
-- BLOCK 1: SCHEMA (Admin Config for Payout Fees)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1.1: Add 'payout_fees' to admin_config_category enum (if not exists)
-- -----------------------------------------------------------------------------

ALTER TYPE admin_config_category ADD VALUE IF NOT EXISTS 'payout_fees';

-- -----------------------------------------------------------------------------
-- STEP 1.2: Insert payout fee config keys with default values
-- -----------------------------------------------------------------------------

-- Stripe Connect fees (standard)
INSERT INTO admin_config (key, value, description, category)
VALUES 
  ('payout_fee_stripe_fixed_cents', '25', 'Stripe Connect fixed fee in cents ($0.25)', 'payout_fees'),
  ('payout_fee_stripe_percentage', '0.25', 'Stripe Connect percentage fee (0.25%)', 'payout_fees'),
  ('payout_fee_paypal_percentage', '2.0', 'PayPal payout percentage fee (2%)', 'payout_fees'),
  ('payout_fee_paypal_cap_cents', '2000', 'PayPal payout fee cap in cents ($20)', 'payout_fees'),
  ('payout_fee_venmo_percentage', '2.0', 'Venmo payout percentage fee (2%)', 'payout_fees'),
  ('payout_fee_venmo_cap_cents', '2000', 'Venmo payout fee cap in cents ($20)', 'payout_fees'),
  ('payout_fee_bank_ach_cents', '25', 'Bank ACH payout fee in cents ($0.25 - Post-MVP)', 'payout_fees')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- STEP 1.2: Create RPC function to get payout fee config
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_payout_fee_config()
RETURNS TABLE (
  stripe_fixed_cents INTEGER,
  stripe_percentage DECIMAL,
  paypal_percentage DECIMAL,
  paypal_cap_cents INTEGER,
  venmo_percentage DECIMAL,
  venmo_cap_cents INTEGER,
  bank_ach_cents INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT value::INTEGER FROM admin_config WHERE key = 'payout_fee_stripe_fixed_cents'), 25) AS stripe_fixed_cents,
    COALESCE((SELECT value::DECIMAL FROM admin_config WHERE key = 'payout_fee_stripe_percentage'), 0.25) AS stripe_percentage,
    COALESCE((SELECT value::DECIMAL FROM admin_config WHERE key = 'payout_fee_paypal_percentage'), 2.0) AS paypal_percentage,
    COALESCE((SELECT value::INTEGER FROM admin_config WHERE key = 'payout_fee_paypal_cap_cents'), 2000) AS paypal_cap_cents,
    COALESCE((SELECT value::DECIMAL FROM admin_config WHERE key = 'payout_fee_venmo_percentage'), 2.0) AS venmo_percentage,
    COALESCE((SELECT value::INTEGER FROM admin_config WHERE key = 'payout_fee_venmo_cap_cents'), 2000) AS venmo_cap_cents,
    COALESCE((SELECT value::INTEGER FROM admin_config WHERE key = 'payout_fee_bank_ach_cents'), 25) AS bank_ach_cents;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_payout_fee_config() TO authenticated;
GRANT EXECUTE ON FUNCTION get_payout_fee_config() TO service_role;

-- -----------------------------------------------------------------------------
-- STEP 1.3: Create RPC function to calculate payout fees dynamically
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_payout_fee_cents(
  p_method_type TEXT,
  p_amount_cents INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_cents INTEGER;
  v_stripe_fixed INTEGER;
  v_stripe_pct DECIMAL;
  v_paypal_pct DECIMAL;
  v_paypal_cap INTEGER;
  v_venmo_pct DECIMAL;
  v_venmo_cap INTEGER;
  v_ach_fee INTEGER;
BEGIN
  -- Validate inputs
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN 0;
  END IF;

  -- Get current fee config
  SELECT * INTO v_stripe_fixed, v_stripe_pct, v_paypal_pct, v_paypal_cap, v_venmo_pct, v_venmo_cap, v_ach_fee
  FROM get_payout_fee_config();

  -- Calculate fee based on method type
  CASE p_method_type
    WHEN 'stripe_connect' THEN
      -- Stripe: 0.25% + $0.25
      v_fee_cents := ROUND(p_amount_cents * (v_stripe_pct / 100))::INTEGER + v_stripe_fixed;
    
    WHEN 'paypal' THEN
      -- PayPal: 2% capped at $20
      v_fee_cents := LEAST(ROUND(p_amount_cents * (v_paypal_pct / 100))::INTEGER, v_paypal_cap);
    
    WHEN 'venmo' THEN
      -- Venmo: 2% capped at $20
      v_fee_cents := LEAST(ROUND(p_amount_cents * (v_venmo_pct / 100))::INTEGER, v_venmo_cap);
    
    WHEN 'bank_ach' THEN
      -- ACH: flat fee (Post-MVP)
      v_fee_cents := v_ach_fee;
    
    ELSE
      v_fee_cents := 0;
  END CASE;

  RETURN v_fee_cents;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_payout_fee_cents(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_payout_fee_cents(TEXT, INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- STEP 1.4: Create RPC function to compute net payout
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION compute_net_payout_cents(
  p_gross_cents INTEGER,
  p_platform_fee_cents INTEGER,
  p_payout_fee_cents INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN GREATEST(0, p_gross_cents - p_platform_fee_cents - p_payout_fee_cents);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION compute_net_payout_cents(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_net_payout_cents(INTEGER, INTEGER, INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- STEP 1.5: Create RPC function to update admin config (upsert)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION upsert_admin_config(
  p_key TEXT,
  p_value TEXT
)
RETURNS TABLE (
  key TEXT,
  value TEXT,
  updated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_config
  SET 
    value = p_value,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE admin_config.key = p_key;

  -- If no row was updated, raise an error
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Config key not found: %', p_key;
  END IF;

  -- Return the updated row
  RETURN QUERY 
  SELECT admin_config.key, admin_config.value, TRUE::BOOLEAN
  FROM admin_config
  WHERE admin_config.key = p_key;
END;
$$;

-- Grant execute permission to service_role (used by Next.js API routes)
GRANT EXECUTE ON FUNCTION upsert_admin_config(TEXT, TEXT) TO service_role;

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- =============================================================================

-- Verify admin_config entries exist
-- SELECT key, value, description FROM admin_config WHERE key LIKE 'payout_fee_%' ORDER BY key;

-- Test get_payout_fee_config RPC
-- SELECT * FROM get_payout_fee_config();

-- Test calculate_payout_fee_cents RPC (Stripe: $100 = $0.25 + 0.25%)
-- SELECT calculate_payout_fee_cents('stripe_connect', 10000);
-- Expected: 50 cents ($0.25 fixed + $0.25 percentage)

-- Test calculate_payout_fee_cents RPC (PayPal: $500 = 2%)
-- SELECT calculate_payout_fee_cents('paypal', 50000);
-- Expected: 1000 cents ($10)

-- Test calculate_payout_fee_cents RPC (PayPal: $2000 hits cap)
-- SELECT calculate_payout_fee_cents('paypal', 200000);
-- Expected: 2000 cents ($20 cap)

-- Test compute_net_payout_cents RPC
-- SELECT compute_net_payout_cents(10000, 0, 50);
-- Expected: 9950 cents

-- Test compute_net_payout_cents RPC (prevent negative)
-- SELECT compute_net_payout_cents(1000, 900, 200);
-- Expected: 0 cents (not negative)

-- =============================================================================
-- ACCEPTANCE CRITERIA SUMMARY
-- =============================================================================

-- ✅ Admin config entries created for all payout fee types
-- ✅ get_payout_fee_config() RPC returns current fee configuration
-- ✅ calculate_payout_fee_cents() RPC computes fees dynamically from config
-- ✅ compute_net_payout_cents() RPC never returns negative values
-- ✅ All RPCs have proper security (SECURITY DEFINER where needed)
-- ✅ Permissions granted to authenticated and service_role

-- =============================================================================
-- ROLLBACK PLAN (if needed)
-- =============================================================================

-- DROP FUNCTION IF EXISTS compute_net_payout_cents(INTEGER, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS calculate_payout_fee_cents(TEXT, INTEGER);
-- DROP FUNCTION IF EXISTS get_payout_fee_config();
-- DELETE FROM admin_config WHERE key LIKE 'payout_fee_%';
