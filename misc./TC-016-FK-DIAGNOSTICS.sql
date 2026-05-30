-- File: TC-016-FK-DIAGNOSTICS.sql
-- Diagnostic queries to identify the FK constraint error on trades.seller_id
-- Error: "Key is not present in table \"users\"" when creating a trade

-- ============================================================================
-- BLOCK 1: Diagnose the FK Error
-- ============================================================================

-- 1.1: Check if the referral exists and get both users
SELECT 
  r.id as referral_id,
  r.referrer_user_id,
  r.referred_user_id,
  r.status,
  -- Check if referrer exists in auth.users
  CASE WHEN (SELECT COUNT(*) FROM auth.users WHERE id = r.referrer_user_id) > 0 
       THEN 'EXISTS' ELSE 'MISSING' END as referrer_status,
  -- Check if referee exists in auth.users
  CASE WHEN (SELECT COUNT(*) FROM auth.users WHERE id = r.referred_user_id) > 0 
       THEN 'EXISTS' ELSE 'MISSING' END as referee_status
FROM referrals r
WHERE r.status = 'pending'
LIMIT 5;

-- 1.2: Check if there are any items with seller_id that don't exist in auth.users
SELECT COUNT(*) as items_with_bad_seller_id
FROM items i
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.seller_id);

-- 1.3: If issue found, list those items
SELECT 
  i.id as item_id,
  i.title,
  i.seller_id,
  CASE WHEN (SELECT COUNT(*) FROM auth.users WHERE id = i.seller_id) > 0 
       THEN 'EXISTS' ELSE 'MISSING' END as seller_status
FROM items i
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.seller_id)
LIMIT 10;

-- 1.4: Check the specific referral and its item being used in TC-016
-- (You need to fill in the referral_id and item_id from your test)
-- Example:
/*
SELECT 
  r.id as referral_id,
  r.referred_user_id as referee_id,
  i.id as item_id,
  i.seller_id,
  i.title,
  CASE WHEN (SELECT COUNT(*) FROM auth.users WHERE id = i.seller_id) > 0 
       THEN 'EXISTS' ELSE 'MISSING' END as seller_exists
FROM referrals r
JOIN items i ON i.seller_id = '<seller_id_from_your_test>' -- FILL THIS IN
WHERE r.id = '<referral_id>' -- FILL THIS IN;
*/

-- 1.5: Count users in auth.users (sanity check)
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 1.6: List all users (to verify test users exist)
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- ============================================================================
-- BLOCK 2: Check Foreign Key Constraints on trades table
-- ============================================================================

-- 2.1: List FK constraints on trades table
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'trades'::regclass
AND contype = 'f'  -- Foreign key only
ORDER BY conname;

-- 2.2: Verify seller_id and buyer_id FKs point to auth.users
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'trades'::regclass
  AND (conname LIKE '%seller%' OR conname LIKE '%buyer%');

-- ============================================================================
-- BLOCK 3: FIX RECOMMENDATIONS
-- ============================================================================

-- If you find items with seller_id not in auth.users, you can:
-- 
-- Option A: Delete those orphaned items (if they're test data)
-- DELETE FROM items WHERE seller_id NOT IN (SELECT id FROM auth.users);
--
-- Option B: Assign those items to a valid seller (if they're production data)
-- UPDATE items 
-- SET seller_id = '<valid_user_id>' 
-- WHERE seller_id NOT IN (SELECT id FROM auth.users);
--
-- Option C: Recreate the test with valid users from auth.users

-- ============================================================================
-- BLOCK 4: Verify TC-016 Test Setup
-- ============================================================================

-- 4.1: Get the most recent referral
SELECT 
  r.id,
  r.referrer_user_id,
  r.referred_user_id,
  r.created_at,
  r.status
FROM referrals r
ORDER BY r.created_at DESC
LIMIT 1;

-- 4.2: For that referral, get a valid item the referee can buy from another seller
SELECT 
  i.id,
  i.title,
  i.price,
  i.seller_id,
  i.status
FROM items i
JOIN auth.users u ON u.id = i.seller_id  -- Ensures seller exists
WHERE i.status = 'available'
  AND i.seller_id != '<referee_user_id>'  -- Not self-purchase
LIMIT 1;

-- 4.3: Verify the referee (buyer) exists
-- Replace <referee_user_id> with actual UUID
SELECT id, email FROM auth.users WHERE id = '<referee_user_id>';
