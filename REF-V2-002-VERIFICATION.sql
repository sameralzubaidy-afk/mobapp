-- File: REF-V2-002-VERIFICATION.sql
-- MODULE-11 REF-V2-002: SQL Verification Queries
-- Run these queries in Supabase SQL Editor BEFORE asking user to test

-- =============================================================================
-- SECTION 1: VERIFY DATABASE SETUP
-- =============================================================================

-- 1.1: Check if award_referral_sp RPC exists
SELECT 
  proname AS function_name,
  pronargs AS arg_count,
  provolatile AS volatility,
  prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'award_referral_sp';

-- Expected output: 1 row with function_name='award_referral_sp', arg_count=3

-- 1.2: Check if trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname = 'trigger_process_referral_bonus_on_trade';

-- Expected output: trigger_name='trigger_process_referral_bonus_on_trade', enabled='O'

-- 1.3: Verify SP config values
SELECT 
  config_key,
  config_value,
  value_type,
  category
FROM sp_config
WHERE config_key IN ('referral_reward_referrer_sp', 'referral_reward_referee_sp')
ORDER BY config_key;

-- Expected output:
-- referral_reward_referrer_sp | 25 | number | referral
-- referral_reward_referee_sp  | 10 | number | referral

-- 1.4: Check referrals table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'referrals'
  AND column_name IN ('referrer_user_id', 'referred_user_id', 'status', 'bonus_points', 'bonus_points_referrer')
ORDER BY column_name;

-- Expected: All 5 columns exist

-- =============================================================================
-- SECTION 2: CHECK FOR PENDING REFERRALS (TEST DATA AVAILABILITY)
-- =============================================================================

-- 2.1: List pending referrals with user info
SELECT 
  r.id AS referral_id,
  r.referrer_id,
  r.referee_id,
  r.referral_code,
  r.status,
  ref_profile.name AS referrer_name,
  ree_profile.name AS referee_name,
  ref_sub.status AS referrer_sub_status,
  ree_sub.status AS referee_sub_status
FROM referrals r
LEFT JOIN profiles ref_profile ON ref_profile.user_id = r.referrer_id
LEFT JOIN profiles ree_profile ON ree_profile.user_id = r.referee_id
LEFT JOIN subscriptions ref_sub ON ref_sub.user_id = r.referrer_id
LEFT JOIN subscriptions ree_sub ON ree_sub.user_id = r.referee_id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC
LIMIT 5;

-- If this returns 0 rows, you need to create test referrals:
-- INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status)
-- VALUES ('<referrer_id>', '<referee_id>', 'TESTCODE', 'pending');

-- 2.2: Check referee trade history
-- Replace <REFEREE_ID> with an actual referee user ID from 2.1 (r.referee_id)
SELECT 
  id,
  buyer_id,
  seller_id,
  status,
  total_price_cents,
  created_at
FROM trades
WHERE (buyer_id = '<REFEREE_ID>' OR seller_id = '<REFEREE_ID>')
ORDER BY created_at DESC
LIMIT 5;

-- Expected: 0 completed trades for a valid test referee

-- =============================================================================
-- SECTION 3: VERIFY SP WALLETS EXIST FOR TEST USERS
-- =============================================================================

-- 3.1: Check if SP wallets exist for referrers
-- Replace <REFERRER_ID> with actual IDs from 2.1
/*
SELECT 
  user_id,
  available_balance,
  lifetime_earned,
  starter_pack_issued,
  created_at
FROM sp_wallets
WHERE user_id = '<REFERRER_ID>';
*/

-- If wallet doesn't exist, create it:
-- SELECT initialize_sp_wallet('<USER_ID>');

-- =============================================================================
-- SECTION 4: SMOKE TEST THE RPC FUNCTION (OPTIONAL)
-- =============================================================================

-- 4.1: Test award_referral_sp with fake IDs (should fail gracefully)
/*
SELECT award_referral_sp(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, -- fake referrer
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID, -- fake referee
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID  -- fake referral
);
*/

-- Expected: { "success": false, "error": "..." }

-- =============================================================================
-- SECTION 5: POST-TEST VERIFICATION (RUN AFTER USER COMPLETES MANUAL TESTING)
-- =============================================================================

-- 5.1: Check if rewards were granted
-- Replace <REFERRAL_ID> with the ID used in testing
/*
SELECT 
  id,
  status,
  bonus_points_referrer,
  bonus_points,
  claimed_at,
  bonus_claimed_referrer_at,
  bonus_claimed_at
FROM referrals
WHERE id = '<REFERRAL_ID>';
*/

-- Expected after successful test:
-- status='completed', bonus_points_referrer=25, bonus_points=10

-- 5.2: Verify SP ledger entries
-- Replace <REFERRER_ID> and <REFEREE_ID> with actual IDs
/*
SELECT 
  user_id,
  transaction_type,
  amount,
  description,
  balance_before,
  balance_after,
  created_at
FROM sp_ledger
WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
  AND transaction_type = 'earn_referral'
ORDER BY created_at DESC;
*/

-- Expected: 2 rows (one for referrer=25, one for referee=10)

-- 5.3: Verify SP wallet balances updated
/*
SELECT 
  user_id,
  available_balance,
  lifetime_earned
FROM sp_wallets
WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>');
*/

-- Expected: Balances increased by 25 and 10 respectively

-- 5.4: Verify SP batches created
/*
SELECT 
  user_id,
  initial_sp,
  remaining_sp,
  source_type,
  expires_at,
  created_at
FROM sp_batches
WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
  AND source_type = 'referral'
ORDER BY created_at DESC
LIMIT 2;
*/

-- Expected: 2 batches (one for referrer=25, one for referee=10)

-- =============================================================================
-- SECTION 6: ADMIN CONFIG UPDATE TEST QUERIES
-- =============================================================================

-- 6.1: Update SP reward amounts (TEST ONLY - revert after testing)
/*
UPDATE sp_config 
SET config_value = '50' 
WHERE config_key = 'referral_reward_referrer_sp';

UPDATE sp_config 
SET config_value = '20' 
WHERE config_key = 'referral_reward_referee_sp';
*/

-- 6.2: Revert to defaults
/*
UPDATE sp_config 
SET config_value = '25' 
WHERE config_key = 'referral_reward_referrer_sp';

UPDATE sp_config 
SET config_value = '10' 
WHERE config_key = 'referral_reward_referee_sp';
*/

-- =============================================================================
-- SECTION 7: TROUBLESHOOTING QUERIES
-- =============================================================================

-- 7.1: Check for duplicate referral rewards (should be 0)
SELECT 
  user_id,
  COUNT(*) AS reward_count
FROM sp_ledger
WHERE transaction_type = 'earn_referral'
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)

-- 7.2: Check for referrals stuck in 'pending' status with completed trades
SELECT 
  r.id AS referral_id,
  r.status AS referral_status,
  r.referred_user_id,
  COUNT(t.id) AS completed_trades
FROM referrals r
LEFT JOIN trades t ON (t.buyer_id = r.referred_user_id OR t.seller_id = r.referred_user_id)
  AND t.status = 'completed'
WHERE r.status = 'pending'
GROUP BY r.id, r.status, r.referred_user_id
HAVING COUNT(t.id) > 0;

-- Expected: 0 rows (no stuck referrals)
-- If rows exist, trigger might not be firing correctly

-- 7.3: Check trigger function source
SELECT prosrc
FROM pg_proc
WHERE proname = 'process_referral_bonus_on_trade_v2';

-- Verify the function contains: award_referral_sp call

-- =============================================================================
-- SECTION 8: CLEANUP (USE WITH CAUTION)
-- =============================================================================

-- 8.1: Reset a referral to 'pending' for re-testing (ONLY IN TEST ENV)
/*
UPDATE referrals 
SET 
  status = 'pending',
  claimed_at = NULL,
  bonus_claimed_at = NULL,
  bonus_claimed_referrer_at = NULL
WHERE id = '<REFERRAL_ID>';
*/

-- 8.2: Delete test SP ledger entries (ONLY IN TEST ENV)
/*
DELETE FROM sp_ledger
WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>')
  AND transaction_type = 'earn_referral'
  AND created_at > NOW() - INTERVAL '1 hour';
*/

-- 8.3: Revert SP wallet balances (ONLY IN TEST ENV - calculate manually)
/*
UPDATE sp_wallets
SET 
  available_balance = available_balance - <AMOUNT>,
  lifetime_earned = lifetime_earned - <AMOUNT>
WHERE user_id IN ('<REFERRER_ID>', '<REFEREE_ID>');
*/

-- =============================================================================
-- EXPECTED RESULTS SUMMARY
-- =============================================================================

/*
BEFORE TESTING:
✅ award_referral_sp RPC exists
✅ trigger_process_referral_bonus_on_trade exists and enabled
✅ sp_config has referrer=25, referee=10
✅ At least 1 pending referral with subscribed users
✅ Referee has 0 completed trades
✅ SP wallets exist for both users

AFTER SUCCESSFUL TEST:
✅ Referral status = 'completed'
✅ bonus_points_referrer = 25
✅ bonus_points = 10
✅ 2 sp_ledger entries (transaction_type='earn_referral')
✅ Referrer balance increased by 25
✅ Referee balance increased by 10
✅ 2 sp_batches created (source_type='referral')
✅ No duplicate rewards on second trade (idempotency verified)
*/
