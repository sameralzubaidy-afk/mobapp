-- File: supabase/migrations/095_fix_sp_wallet_column_rename.sql
-- MODULE-09 SP-001: Fix SP Wallet Column Name in initialize_sp_wallet RPC
-- Mode: Idempotent rerunnable migration
-- Purpose: Fix initialize_sp_wallet RPC to use 'state' column instead of 'status'
--
-- PROBLEM ANALYSIS:
-- - Migration 093 renamed sp_wallets.status → sp_wallets.state
-- - Migration 20251227 (fix_trial_enrollment_idempotency.sql) still references 'status' column
-- - When users upgrade from free to Kids Club+, initialize_sp_wallet RPC fails with:
--   "column 'status' of relation 'sp_wallets' does not exist"
--
-- SOLUTION:
-- Update initialize_sp_wallet RPC to use 'state' column (correct name after migration 093)

-- =============================================================================
-- 1. DROP AND RECREATE initialize_sp_wallet with correct column name
-- =============================================================================

DROP FUNCTION IF EXISTS initialize_sp_wallet(p_user_id UUID) CASCADE;

CREATE FUNCTION initialize_sp_wallet(p_user_id UUID)
RETURNS sp_wallets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet sp_wallets;
BEGIN
  -- Check if wallet already exists
  SELECT * INTO v_wallet FROM sp_wallets WHERE user_id = p_user_id;
  
  IF FOUND THEN
    -- Just return existing wallet instead of failing
    RETURN v_wallet;
  END IF;

  -- Create SP wallet with zero balance
  -- NOTE: 'state' is the correct column name (renamed in migration 093)
  INSERT INTO sp_wallets (
    user_id,
    state,
    available_balance,
    pending_balance,
    lifetime_earned,
    lifetime_spent,
    starter_pack_issued,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'active',
    0,
    0,
    0,
    0,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_sp_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_sp_wallet(uuid) TO anon;
GRANT EXECUTE ON FUNCTION initialize_sp_wallet(uuid) TO service_role;

COMMENT ON FUNCTION initialize_sp_wallet IS 'MODULE-09 SP-001: Initializes Swap Points wallet for new trial subscribers. Fixed to use correct column name (state)';

-- =============================================================================
-- 2. VERIFICATION QUERY
-- =============================================================================
-- Test that the function works correctly:
-- SELECT initialize_sp_wallet('test-user-id'::UUID);
--
-- Expected: Returns a row from sp_wallets table with:
--   - user_id = 'test-user-id'
--   - state = 'active'
--   - available_balance = 0
--   - pending_balance = 0
--   - created_at = now()
--
-- To verify column names exist:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'sp_wallets' AND column_name IN ('state', 'available_balance', 'pending_balance');
