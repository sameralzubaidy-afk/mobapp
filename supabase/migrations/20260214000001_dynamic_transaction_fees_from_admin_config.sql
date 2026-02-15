-- Migration: Make Transaction Fees Dynamic (Read from admin_config)
-- Purpose: Transaction fees ($0.99 for subscribers, $2.99 for non-subscribers) are now configurable
-- Date: 2025-02-14
-- Issue: TC-SUB002-008 - Fees must be fetched from admin dashboard, not hardcoded

-- ============================================================================
-- BLOCK 1: Add Transaction Fee Configuration to admin_config
-- ============================================================================

-- Add subscriber transaction fee configuration (99¢ default)
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'transaction_fee_subscriber_cents',
  '99',
  'Transaction fee for Kids Club+ subscribers in cents ($0.99)',
  'fees',
  'number',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- Add non-subscriber transaction fee configuration (299¢ default)
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'transaction_fee_non_subscriber_cents',
  '299',
  'Transaction fee for free users in cents ($2.99)',
  'fees',
  'number',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- BLOCK 2: Update get_user_transaction_fee() RPC to Query admin_config
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_transaction_fee(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_subscriber_fee_cents INTEGER;
  v_non_subscriber_fee_cents INTEGER;
BEGIN
  -- Get user's subscription status
  SELECT s.status INTO v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Fetch dynamic fee configuration from admin_config
  -- If config key doesn't exist, use fallback defaults
  SELECT COALESCE((SELECT (value::INTEGER) FROM public.admin_config 
    WHERE key = 'transaction_fee_subscriber_cents' AND is_active = TRUE LIMIT 1), 99)
  INTO v_subscriber_fee_cents;
  
  SELECT COALESCE((SELECT (value::INTEGER) FROM public.admin_config 
    WHERE key = 'transaction_fee_non_subscriber_cents' AND is_active = TRUE LIMIT 1), 299)
  INTO v_non_subscriber_fee_cents;
  
  -- Return appropriate fee based on subscription status
  -- Subscriber status: trial, active, paused
  -- Non-subscriber status: free, grace_period, expired, cancelled, or NULL
  IF v_status IS NOT NULL AND v_status IN ('trial', 'active', 'paused') THEN
    RETURN v_subscriber_fee_cents;
  ELSE
    RETURN v_non_subscriber_fee_cents;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_transaction_fee(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_transaction_fee IS 'V2.1: Get dynamic transaction fee from admin_config. Reads subscriber vs non-subscriber rates.';

-- ============================================================================
-- BLOCK 3: Verification Queries
-- ============================================================================

-- Query 1: Verify admin_config keys exist
SELECT 
  key,
  value,
  description,
  category,
  is_active
FROM public.admin_config
WHERE key IN ('transaction_fee_subscriber_cents', 'transaction_fee_non_subscriber_cents')
ORDER BY key;

-- Query 2: Verify function reads from config
-- Test subscriber fee (should read 99 from admin_config)
-- SELECT public.get_user_transaction_fee('<TEST_SUBSCRIBER_UUID>');

-- Query 3: Verify function reads for non-subscriber
-- Test non-subscriber fee (should read 299 from admin_config)
-- SELECT public.get_user_transaction_fee('<TEST_FREE_USER_UUID>');

-- Query 4: Check if admin_config is working
SELECT 
  COUNT(*) as total_config_keys,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_keys
FROM public.admin_config;
