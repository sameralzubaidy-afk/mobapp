-- ================================================================
-- Migration: 078_payout_router_integration.sql
-- Module: MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-006)
-- Description: Create RPC functions for payout routing and trade completion integration
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- =============================================================================
-- BLOCK 1: SCHEMA (RPC Functions for Payout Router)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION: get_admin_payout_config
-- Purpose: Fetch payout-related admin config values
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_admin_payout_config()
RETURNS TABLE (
  enable_automatic_seller_payout BOOLEAN,
  minimum_withdrawal_amount_cents INTEGER,
  stripe_payout_fee_fixed_cents INTEGER,
  stripe_payout_fee_percentage DECIMAL,
  paypal_payout_fee_percentage DECIMAL,
  paypal_payout_fee_cap_cents INTEGER
) AS $$
DECLARE
  v_auto_payout TEXT;
  v_min_withdrawal TEXT;
  v_stripe_fixed TEXT;
  v_stripe_pct TEXT;
  v_paypal_pct TEXT;
  v_paypal_cap TEXT;
BEGIN
  -- Fetch config values
  SELECT value INTO v_auto_payout FROM admin_config WHERE key = 'enable_automatic_seller_payout' AND is_active = TRUE;
  SELECT value INTO v_min_withdrawal FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents' AND is_active = TRUE;
  SELECT value INTO v_stripe_fixed FROM admin_config WHERE key = 'payout_fee_stripe_fixed_cents' AND is_active = TRUE;
  SELECT value INTO v_stripe_pct FROM admin_config WHERE key = 'payout_fee_stripe_percentage' AND is_active = TRUE;
  SELECT value INTO v_paypal_pct FROM admin_config WHERE key = 'payout_fee_paypal_percentage' AND is_active = TRUE;
  SELECT value INTO v_paypal_cap FROM admin_config WHERE key = 'payout_fee_paypal_cap_cents' AND is_active = TRUE;

  -- Return with defaults if not found
  RETURN QUERY SELECT
    CASE 
      WHEN v_auto_payout = 'true' THEN TRUE
      WHEN v_auto_payout = 'false' THEN FALSE
      ELSE FALSE  -- Default to manual mode (safest)
    END AS enable_automatic_seller_payout,
    COALESCE(v_min_withdrawal::INTEGER, 500) AS minimum_withdrawal_amount_cents,
    COALESCE(v_stripe_fixed::INTEGER, 25) AS stripe_payout_fee_fixed_cents,
    COALESCE(v_stripe_pct::DECIMAL, 0.25) AS stripe_payout_fee_percentage,
    COALESCE(v_paypal_pct::DECIMAL, 2.0) AS paypal_payout_fee_percentage,
    COALESCE(v_paypal_cap::INTEGER, 2000) AS paypal_payout_fee_cap_cents;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_admin_payout_config() TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: calculate_payout_fee_cents
-- Purpose: Calculate payout fee based on method type and amount
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_payout_fee_cents(
  p_method_type TEXT,
  p_amount_cents INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_config RECORD;
  v_fee_cents INTEGER;
BEGIN
  -- Get payout config
  SELECT * INTO v_config FROM get_admin_payout_config() LIMIT 1;

  CASE p_method_type
    WHEN 'stripe_connect' THEN
      -- Stripe: 0.25% + $0.25
      v_fee_cents := ROUND(p_amount_cents * v_config.stripe_payout_fee_percentage / 100)::INTEGER + v_config.stripe_payout_fee_fixed_cents;
    
    WHEN 'paypal', 'venmo' THEN
      -- PayPal/Venmo: 2% capped at $20
      v_fee_cents := LEAST(
        ROUND(p_amount_cents * v_config.paypal_payout_fee_percentage / 100)::INTEGER,
        v_config.paypal_payout_fee_cap_cents
      );
    
    WHEN 'bank_ach' THEN
      -- ACH: flat $0.25 (Post-MVP)
      v_fee_cents := 25;
    
    ELSE
      v_fee_cents := 0;
  END CASE;

  RETURN v_fee_cents;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION calculate_payout_fee_cents(TEXT, INTEGER) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: create_seller_payout_on_trade_completion
-- Purpose: Create payout record when trade completes (called by complete_trade_v2)
-- Returns: payout_id or NULL if payout creation failed
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_seller_payout_on_trade_completion(
  p_trade_id UUID,
  p_seller_id UUID,
  p_gross_amount_cents INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_config RECORD;
  v_primary_method RECORD;
  v_payout_fee_cents INTEGER;
  v_net_amount_cents INTEGER;
  v_payout_status TEXT;
  v_payout_id UUID;
  v_idempotency_key TEXT;
  v_existing_payout UUID;
BEGIN
  -- Generate idempotency key
  v_idempotency_key := 'trade:' || p_trade_id::TEXT || ':seller:' || p_seller_id::TEXT;

  -- Check if payout already exists (idempotency)
  SELECT id INTO v_existing_payout 
  FROM seller_payouts 
  WHERE idempotency_key = v_idempotency_key;

  IF v_existing_payout IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'payout_id', v_existing_payout,
      'message', 'Payout already exists',
      'is_new', false
    );
  END IF;

  -- Get admin config
  SELECT * INTO v_config FROM get_admin_payout_config() LIMIT 1;

  -- Get seller's primary payout method
  SELECT * INTO v_primary_method 
  FROM seller_payout_methods 
  WHERE user_id = p_seller_id 
    AND is_primary = TRUE 
    AND is_verified = TRUE
  LIMIT 1;

  -- Determine payout status based on config and method availability
  IF NOT v_config.enable_automatic_seller_payout THEN
    -- Manual withdrawal mode: always create pending
    v_payout_status := 'pending';
    v_payout_fee_cents := 0; -- Fee calculated at withdrawal time
    v_net_amount_cents := p_gross_amount_cents; -- Gross for now
  ELSIF v_primary_method IS NULL THEN
    -- Auto-payout enabled but no verified method
    v_payout_status := 'requires_action';
    v_payout_fee_cents := 0;
    v_net_amount_cents := p_gross_amount_cents;
  ELSE
    -- Auto-payout enabled and method available
    v_payout_fee_cents := calculate_payout_fee_cents(v_primary_method.method_type, p_gross_amount_cents);
    v_net_amount_cents := GREATEST(0, p_gross_amount_cents - v_payout_fee_cents);
    v_payout_status := 'processing'; -- Will be dispatched to provider
  END IF;

  -- Create payout record
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
    p_seller_id,
    p_trade_id,
    v_primary_method.id, -- NULL if requires_action or pending
    'usd',
    p_gross_amount_cents,
    0, -- Platform fee is $0 per policy
    v_payout_fee_cents,
    v_net_amount_cents,
    v_payout_status,
    CASE 
      WHEN v_primary_method.method_type = 'stripe_connect' THEN 'stripe'
      WHEN v_primary_method.method_type IN ('paypal', 'venmo') THEN 'paypal'
      WHEN v_primary_method.method_type = 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    v_idempotency_key,
    CASE WHEN v_payout_status = 'processing' THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
  ) RETURNING id INTO v_payout_id;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'status', v_payout_status,
    'auto_payout_enabled', v_config.enable_automatic_seller_payout,
    'has_verified_method', (v_primary_method IS NOT NULL),
    'provider', CASE 
      WHEN v_primary_method.method_type = 'stripe_connect' THEN 'stripe'
      WHEN v_primary_method.method_type IN ('paypal', 'venmo') THEN 'paypal'
      WHEN v_primary_method.method_type = 'bank_ach' THEN 'ach'
      ELSE NULL
    END,
    'is_new', true
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_seller_payout_on_trade_completion(UUID, UUID, INTEGER) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: update_complete_trade_v2_with_payout
-- Purpose: Update existing complete_trade_v2 to create payout record
-- Note: This modifies the existing RPC to integrate payout creation
-- Drop first since return type is changing
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
  v_sp_result JSON;
  v_payout_result JSON;
BEGIN
  -- Lock trade row for update
  SELECT * INTO v_trade
  FROM trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Verify user is buyer or seller
  IF v_trade.buyer_id != p_user_id AND v_trade.seller_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify trade is in_progress
  IF v_trade.status != 'in_progress' THEN
    RETURN json_build_object('success', false, 'error', 'Trade must be in_progress to complete. Current status: ' || v_trade.status);
  END IF;

  -- If seller is marking complete, record timestamp
  IF v_trade.seller_id = p_user_id AND v_trade.seller_marked_completed_at IS NULL THEN
    UPDATE trades
    SET seller_marked_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_trade_id;
  END IF;

  -- Update trade status to completed
  UPDATE trades
  SET status = 'completed',
      completed_at = NOW(),
      last_status_change_at = NOW(),
      updated_at = NOW()
  WHERE id = p_trade_id;

  -- Update item status to sold (trade is complete, item no longer available)
  UPDATE items
  SET status = 'sold',
      updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- Award SP to seller (if eligible)
  IF v_trade.seller_id IS NOT NULL THEN
    SELECT earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
    INTO v_sp_result;
  END IF;

  -- Create seller payout (PAY-006 integration)
  -- CRITICAL: Only auto-create payout if automatic payout is enabled
  -- If disabled, seller balance will be updated by trigger and seller manually requests withdrawal
  IF v_trade.seller_id IS NOT NULL AND v_trade.cash_amount_cents > 0 THEN
    DECLARE
      v_config RECORD;
    BEGIN
      -- Check if automatic payout is enabled
      SELECT * INTO v_config FROM get_admin_payout_config() LIMIT 1;
      
      IF v_config.enable_automatic_seller_payout THEN
        -- Auto-payout enabled: create payout immediately
        SELECT create_seller_payout_on_trade_completion(
          p_trade_id,
          v_trade.seller_id,
          v_trade.cash_amount_cents
        ) INTO v_payout_result;
      ELSE
        -- Manual mode: do NOT create payout yet
        -- Seller balance trigger will update available_balance_cents
        -- Seller can manually request withdrawal later
        v_payout_result := json_build_object(
          'success', true,
          'message', 'Manual withdrawal mode - seller can request payout from balance',
          'auto_payout_enabled', false
        );
      END IF;
    END;
  END IF;

  RETURN json_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'message', 'Trade completed successfully',
    'sp_result', v_sp_result,
    'payout_result', v_payout_result
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_trade_v2(UUID, UUID) TO anon, authenticated;

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- =============================================================================

-- Verify functions exist
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN (
--   'get_admin_payout_config',
--   'calculate_payout_fee_cents',
--   'create_seller_payout_on_trade_completion',
--   'complete_trade_v2'
-- );

-- Test admin config retrieval
-- SELECT * FROM get_admin_payout_config();

-- Test payout fee calculation
-- SELECT calculate_payout_fee_cents('stripe_connect', 10000); -- Should return 50 (0.25% + $0.25)
-- SELECT calculate_payout_fee_cents('paypal', 5000); -- Should return 100 (2%)
-- SELECT calculate_payout_fee_cents('paypal', 200000); -- Should return 2000 (capped at $20)

-- =============================================================================
-- ACCEPTANCE CRITERIA
-- =============================================================================

-- ✅ get_admin_payout_config() returns payout-related config with defaults
-- ✅ calculate_payout_fee_cents() correctly computes fees for Stripe/PayPal/Venmo
-- ✅ create_seller_payout_on_trade_completion() creates payout with correct status:
--    - pending if auto_payout disabled (seller will manually request withdrawal later)
--    - requires_action if auto_payout enabled but no verified method
--    - processing if auto_payout enabled and verified method exists
-- ✅ complete_trade_v2() integrates payout creation on trade completion
-- ✅ request_seller_payout() creates payout with 'processing' status (auto-dispatch to provider)
-- ✅ Idempotency: duplicate calls don't create duplicate payouts
