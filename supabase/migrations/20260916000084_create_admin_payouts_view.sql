-- ================================================================
-- Migration: 20251230_create_admin_payouts_view.sql
-- Module: MODULE-12 ADMIN-V2
-- Description: Creates a function for payouts to support admin management
-- Uses SECURITY DEFINER to bypass RLS on auth.users table
-- ================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_admin_payouts(
  p_status TEXT,
  p_search TEXT,
  p_limit INT,
  p_offset INT
) CASCADE;

-- Create a function to get payouts with seller info
-- SECURITY DEFINER allows this to access auth.users without RLS restrictions
CREATE OR REPLACE FUNCTION get_admin_payouts(
  p_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  trade_id UUID,
  payout_method_id UUID,
  currency TEXT,
  gross_amount_cents INT,
  platform_fee_cents INT,
  payout_fee_cents INT,
  net_amount_cents INT,
  status TEXT,
  provider TEXT,
  provider_reference_id TEXT,
  idempotency_key TEXT,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  seller_name TEXT,
  seller_email TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
SELECT 
  sp.id,
  sp.user_id,
  sp.trade_id,
  sp.payout_method_id,
  sp.currency,
  sp.gross_amount_cents,
  sp.platform_fee_cents,
  sp.payout_fee_cents,
  sp.net_amount_cents,
  sp.status,
  sp.provider,
  sp.provider_reference_id,
  sp.idempotency_key,
  sp.initiated_at,
  sp.completed_at,
  sp.failure_reason,
  sp.created_at,
  sp.updated_at,
  p.name,
  au.email
FROM seller_payouts sp
LEFT JOIN profiles p ON sp.user_id = p.user_id
LEFT JOIN auth.users au ON au.id = sp.user_id
WHERE (p_status = 'all' OR sp.status = p_status)
  AND (p_search IS NULL OR 
       sp.user_id::text ILIKE '%' || p_search || '%' OR
       sp.trade_id::text ILIKE '%' || p_search || '%' OR
       p.name ILIKE '%' || p_search || '%' OR
       au.email ILIKE '%' || p_search || '%')
ORDER BY sp.created_at DESC
LIMIT p_limit
OFFSET p_offset;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION get_admin_payouts(TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_payouts(TEXT, TEXT, INT, INT) TO service_role;

-- Also create a view as a convenience for simple queries
DROP VIEW IF EXISTS admin_payouts_view CASCADE;

CREATE OR REPLACE VIEW admin_payouts_view AS
SELECT * FROM get_admin_payouts('all', NULL, 10000, 0);

-- Grant access to the view
GRANT SELECT ON admin_payouts_view TO authenticated;
GRANT SELECT ON admin_payouts_view TO service_role;

-- Verification Query:
-- SELECT * FROM get_admin_payouts('all', NULL, 10, 0);
-- SELECT * FROM admin_payouts_view LIMIT 10;
