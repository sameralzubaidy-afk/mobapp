-- ================================================================
-- Migration: 076_enforce_minimum_withdrawal_in_rpc.sql
-- Description: Enforce minimum withdrawal amount validation SERVER-SIDE
-- Security Fix: Prevent bypassing client-side validation
-- ================================================================

-- Drop and recreate the RPC function with minimum withdrawal enforcement
CREATE OR REPLACE FUNCTION request_seller_payout(
  p_user_id UUID,
  p_amount_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_primary_method RECORD;
  v_payout_id UUID;
  v_payout_fee_cents INTEGER;
  v_net_amount_cents INTEGER;
  v_minimum_withdrawal_cents INTEGER;
  v_config_value TEXT;
BEGIN
  -- ============================================================================
  -- NEW: Fetch minimum withdrawal amount from admin_config (CRITICAL SECURITY)
  -- ============================================================================
  
  SELECT value INTO v_config_value 
  FROM admin_config 
  WHERE key = 'minimum_withdrawal_amount_cents' 
  AND is_active = TRUE
  LIMIT 1;
  
  -- Default to 500 cents ($5.00) if not configured
  IF v_config_value IS NULL OR v_config_value = '' THEN
    v_minimum_withdrawal_cents := 500;
  ELSE
    v_minimum_withdrawal_cents := v_config_value::INTEGER;
  END IF;
  
  -- ============================================================================
  -- NEW: Validate minimum withdrawal amount (if minimum > 0)
  -- ============================================================================
  
  IF v_minimum_withdrawal_cents > 0 AND p_amount_cents < v_minimum_withdrawal_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Minimum withdrawal amount is $' || (v_minimum_withdrawal_cents / 100.0)::TEXT,
      'minimum_required', v_minimum_withdrawal_cents,
      'requested', p_amount_cents
    );
  END IF;
  
  -- ============================================================================
  -- EXISTING VALIDATION (unchanged)
  -- ============================================================================
  
  -- 1. Get seller balance
  SELECT * INTO v_balance FROM seller_balance WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No balance found for this seller'
    );
  END IF;
  
  -- 2. Verify sufficient balance
  IF v_balance.available_balance_cents < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available', v_balance.available_balance_cents,
      'requested', p_amount_cents
    );
  END IF;
  
  -- 3. Get primary payout method
  SELECT * INTO v_primary_method 
  FROM seller_payout_methods 
  WHERE user_id = p_user_id AND is_primary = TRUE
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No primary payout method configured',
      'action_required', 'add_payout_method'
    );
  END IF;
  
  -- 4. Verify payout method is verified
  IF NOT v_primary_method.is_verified THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Primary payout method is not verified',
      'action_required', 'verify_payout_method'
    );
  END IF;
  
  -- 5. Calculate payout fee based on method type
  CASE v_primary_method.method_type
    WHEN 'stripe_connect' THEN
      -- Stripe: $0.25 + 0.25%
      v_payout_fee_cents := 25 + ROUND(p_amount_cents * 0.0025);
    WHEN 'paypal', 'venmo' THEN
      -- PayPal/Venmo: 2% capped at $20
      v_payout_fee_cents := LEAST(ROUND(p_amount_cents * 0.02), 2000);
    WHEN 'bank_ach' THEN
      -- Bank ACH: $0.25 flat (placeholder for Post-MVP)
      v_payout_fee_cents := 25;
    ELSE
      v_payout_fee_cents := 0;
  END CASE;
  
  -- 6. Calculate net amount
  v_net_amount_cents := p_amount_cents - v_payout_fee_cents;
  
  IF v_net_amount_cents <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout amount too small after fees',
      'minimum_required', v_payout_fee_cents + 100
    );
  END IF;
  
  -- 7. Create payout record
  INSERT INTO seller_payouts (
    user_id,
    trade_id,
    payout_method_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    payout_fee_cents,
    net_amount_cents,
    status,
    provider,
    idempotency_key,
    initiated_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    NULL, -- This is a manual withdrawal, not tied to a single trade
    v_primary_method.id,
    'usd',
    p_amount_cents,
    0, -- Platform transaction fee is $0 per fee policy
    v_payout_fee_cents,
    v_net_amount_cents,
    'pending',
    CASE v_primary_method.method_type
      WHEN 'stripe_connect' THEN 'stripe'
      WHEN 'paypal' THEN 'paypal'
      WHEN 'venmo' THEN 'paypal'
      WHEN 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    'manual_withdrawal:' || p_user_id::TEXT || ':' || EXTRACT(EPOCH FROM NOW())::TEXT,
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_payout_id;
  
  -- 8. Deduct from available balance
  UPDATE seller_balance
  SET 
    available_balance_cents = available_balance_cents - p_amount_cents,
    last_payout_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 9. Return success with payout details
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount_cents', p_amount_cents,
    'payout_fee_cents', v_payout_fee_cents,
    'net_amount_cents', v_net_amount_cents,
    'method_type', v_primary_method.method_type,
    'status', 'pending',
    'message', 'Payout request created successfully'
  );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION request_seller_payout(UUID, INTEGER) IS 
'Request seller payout with SERVER-SIDE validation of minimum withdrawal amount from admin_config. 
If minimum_withdrawal_amount_cents is set to 0, validation is skipped (effectively disabled).
Client-side validation should match but cannot be trusted for security.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Test with amount below minimum (should fail)
-- SELECT request_seller_payout(auth.uid(), 100); -- Should fail if minimum > 100

-- Test with amount at/above minimum (should succeed if balance exists)
-- SELECT request_seller_payout(auth.uid(), 500); -- Should work if minimum = 500

-- Verify minimum is being read from admin_config
-- SELECT value FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents';

-- =============================================================================
-- ROLLBACK PLAN (if needed)
-- =============================================================================

-- Restore original function without minimum check:
-- CREATE OR REPLACE FUNCTION request_seller_payout(p_user_id UUID, p_amount_cents INTEGER)
-- RETURNS JSONB AS $$ ... original implementation ... $$;
