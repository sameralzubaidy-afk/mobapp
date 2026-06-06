-- Direct RPC test and verification queries
-- Run these in Supabase SQL Editor to diagnose the issue

-- ============================================================
-- STEP 1: Verify cancel_trade_v2 RPC exists and check its source
-- ============================================================
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS full_definition
FROM pg_proc 
WHERE proname = 'cancel_trade_v2';

-- ============================================================
-- STEP 2: Verify bundle_id column exists
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'trades' 
  AND column_name = 'bundle_id';

-- ============================================================
-- STEP 3: Check if credit_sp_for_cancelled_trade RPC exists
-- (cancel_trade_v2 depends on this)
-- ============================================================
SELECT proname, proargtypes, prosrc
FROM pg_proc 
WHERE proname = 'credit_sp_for_cancelled_trade';

-- ============================================================
-- STEP 4: Get the trade details for the failing trade
-- ============================================================
SELECT 
  id,
  status,
  buyer_id,
  seller_id,
  sp_debit_ledger_entry_id,
  created_at,
  updated_at
FROM trades 
WHERE id = '231f65ea-49f0-49a7-a0f9-1e337947affa';

-- ============================================================
-- STEP 5: Test the RPC directly with the actual trade ID and user ID
-- ============================================================
-- Replace the user_id with the actual buyer or seller ID from step 4
SELECT cancel_trade_v2(
  '231f65ea-49f0-49a7-a0f9-1e337947affa'::uuid,
  'e9b9bd3d-5754-46ef-9a6f-bbc7848845ee'::uuid,  -- User ID from the logs
  'Direct RPC test'
);
