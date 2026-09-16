-- File: supabase/migrations/072_add_get_user_sp_wallet_summary_rpc.sql
-- MODULE-09 POINTS-GAMIFICATION: Add missing RPC for wallet summary
-- 
-- Mode B: Idempotent rerunnable migration
-- 
-- This RPC was being called by p2p-kids-marketplace/src/services/sp.ts
-- but was never created in the database, causing SP refunds to not appear
-- in the buyer dashboard after trade cancellation.

-- =============================================================================
-- RPC: Get user SP wallet summary
-- =============================================================================
-- 
-- Called by: p2p-kids-marketplace/src/services/sp.ts getSPWalletSummary()
-- Purpose: Calculate total SP balance from all ledger entries, including 
--          earned and refunded amounts
-- Returns: JSONB with available_points, pending_points, lifetime_earned, lifetime_spent
--
-- Note: This function calculates from sp_ledger table to ensure accuracy
--       after any credit_sp_for_cancelled_trade or earn_sp_for_trade operations

-- Drop existing function if it has a different signature
DROP FUNCTION IF EXISTS get_user_sp_wallet_summary(UUID);

CREATE FUNCTION get_user_sp_wallet_summary(p_user_id UUID)
RETURNS TABLE (
  available_points INTEGER,
  pending_points INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  wallet_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_status TEXT;
  v_available INTEGER := 0;
  v_pending INTEGER := 0;
  v_earned INTEGER := 0;
  v_spent INTEGER := 0;
BEGIN
  -- 1. Get the wallet for this user
  SELECT id, status INTO v_wallet_id, v_wallet_status FROM sp_wallets WHERE user_id = p_user_id;
  
  -- If no wallet exists, return all zeros with 'inactive' status
  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 'inactive'::TEXT;
    RETURN;
  END IF;

  -- 2. Calculate available balance from ledger
  -- Sum all transaction amounts (positive for earn/refund, negative for spend)
  SELECT COALESCE(SUM(amount), 0) INTO v_available
  FROM sp_ledger
  WHERE wallet_id = v_wallet_id
    AND transaction_type IN ('earn_reward', 'earn_refund', 'spend_purchase', 'spend_admin');

  -- 3. Calculate pending balance (if applicable - for now 0)
  -- In MVP, we don't track pending separately; all earned SP becomes available immediately
  v_pending := 0;

  -- 4. Calculate lifetime earned (sum of all positive earn transactions)
  SELECT COALESCE(SUM(amount), 0) INTO v_earned
  FROM sp_ledger
  WHERE wallet_id = v_wallet_id
    AND transaction_type IN ('earn_reward', 'earn_refund');

  -- 5. Calculate lifetime spent (sum of all negative spend transactions)
  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_spent
  FROM sp_ledger
  WHERE wallet_id = v_wallet_id
    AND transaction_type IN ('spend_purchase', 'spend_admin')
    AND amount < 0;

  -- 6. Return the calculated values with wallet status
  RETURN QUERY SELECT v_available, v_pending, v_earned, v_spent, v_wallet_status;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
--
-- Query 1: Verify the RPC exists and is callable
-- SELECT * FROM get_user_sp_wallet_summary('00000000-0000-0000-0000-000000000000'::UUID);
--
-- Expected result: 4 columns (available_points, pending_points, lifetime_earned, lifetime_spent)
--
-- Query 2: Test with actual user after force-cancel
-- SELECT 
--   u.id,
--   u.display_name,
--   w.available_points,
--   w.pending_points,
--   w.lifetime_earned,
--   w.lifetime_spent
-- FROM get_user_sp_wallet_summary(u.id) AS w(available_points, pending_points, lifetime_earned, lifetime_spent)
-- CROSS JOIN auth.users u
-- WHERE u.id = '<buyer_uuid>'
-- LIMIT 1;
--
-- Expected result: After force-cancel of a trade where buyer spent SP, 
--                  available_points should reflect the refunded amount
--
-- Query 3: Check ledger entries for the user
-- SELECT 
--   sl.id,
--   sl.transaction_type,
--   sl.amount,
--   sl.balance_before,
--   sl.balance_after,
--   sl.description,
--   sl.created_at
-- FROM sp_ledger sl
-- WHERE sl.user_id = '<buyer_uuid>'
-- ORDER BY sl.created_at DESC
-- LIMIT 10;
--
-- Expected result: Should show both spend_purchase and earn_refund entries
