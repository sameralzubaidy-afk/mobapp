-- Debug Pending SP Mismatch
-- User sees 11 SP on Review Offer screen but 13 SP in wallet
-- This script helps identify where the 13 SP is coming from

-- ====================================================================
-- PART 1: Check which migration is currently active
-- ====================================================================

-- Check if the corrected formula (20260607) has been applied
SELECT 
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc 
WHERE proname = 'fn_release_all_sp_on_complete';
-- Look for: "FLOOR(v_buyer_sp * v_category_multiplier)" (CORRECT)
-- vs:       "FLOOR(((v_item_price_cents::numeric / 100) * 0.25) * v_category_multiplier)" (WRONG)

-- ====================================================================
-- PART 2: Find the test user from the screenshots
-- ====================================================================

-- Assumption: The seller is logged in and viewing their wallet
-- Look for users with 13 SP pending
SELECT 
  u.id AS user_id,
  u.email,
  w.pending_balance,
  w.available_balance,
  w.lifetime_earned,
  w.lifetime_spent
FROM auth.users u
JOIN sp_wallets w ON w.user_id = u.id
WHERE w.pending_balance = 13
ORDER BY w.updated_at DESC;

-- ====================================================================
-- PART 3: Find trades contributing to the 13 SP pending
-- ====================================================================

-- Find completed trades with pending SP for this user
-- Replace <user-id> with actual user_id from Part 2
SELECT 
  t.id AS trade_id,
  t.status,
  t.sp_amount AS buyer_used_sp,
  t.sp_earned_at_completion,
  t.sp_category_multiplier,
  t.completed_at,
  t.pending_sp_release_at,
  i.price AS item_price,
  i.title AS item_title
FROM trades t
JOIN items i ON i.id = t.listing_id
WHERE t.seller_id = '<user-id>'  -- Replace with actual user_id
  AND t.status = 'completed'
  AND t.sp_earned_at_completion > 0
  AND t.pending_sp_release_at IS NOT NULL
ORDER BY t.completed_at DESC;

-- ====================================================================
-- PART 4: Check sp_ledger to see the formula used
-- ====================================================================

-- Check ledger entries for this user's pending SP
SELECT 
  l.id,
  l.transaction_type,
  l.amount,
  l.description,
  l.created_at,
  l.balance_before,
  l.balance_after
FROM sp_ledger l
WHERE l.user_id = '<user-id>'  -- Replace with actual user_id
  AND l.transaction_type = 'earn_reward'
ORDER BY l.created_at DESC
LIMIT 10;

-- Look for descriptions like:
-- "Trade reward: 13 SP (buyer 10 SP × 1.10 multiplier)" → CORRECT formula gives 11 SP, not 13
-- "Trade reward: 11 SP (buyer 10 SP × 1.10 multiplier)" → CORRECT

-- ====================================================================
-- PART 5: Verify the current offer (not yet accepted)
-- ====================================================================

-- Find pending offers for the $15 item shown in screenshot
SELECT 
  t.id AS trade_id,
  t.status,
  t.sp_amount AS buyer_offers_sp,
  i.price AS item_price,
  i.title AS item_title,
  i.category_id,
  c.sp_earning_multiplier,
  -- Calculate what SP SHOULD be if accepted:
  CASE 
    WHEN t.sp_amount > 0 THEN 
      FLOOR(t.sp_amount * COALESCE(c.sp_earning_multiplier, 1.10))
    ELSE 
      FLOOR((i.price::numeric) * COALESCE(c.sp_earning_multiplier, 1.10))
  END AS expected_sp_if_accepted
FROM trades t
JOIN items i ON i.id = t.listing_id
LEFT JOIN categories c ON c.id = i.category_id
WHERE t.seller_id = '<user-id>'  -- Replace with actual user_id
  AND t.status = 'pending'
  AND i.price = 15.00  -- From screenshot: $15 item
ORDER BY t.created_at DESC
LIMIT 5;

-- Expected: buyer offers 10 SP, multiplier 1.10
-- Expected SP if accepted: FLOOR(10 × 1.10) = 11 SP ✅

-- ====================================================================
-- DIAGNOSIS:
-- ====================================================================
-- If Part 3 shows sp_earned_at_completion = 13 for a previous trade:
--   → Old formula was used (price × 0.25 × multiplier)
--   → Migration 20260607 fixes FUTURE trades but doesn't correct past data
--
-- If Part 3 shows sp_earned_at_completion = 11:
--   → Then 13 SP pending might be from MULTIPLE trades
--
-- If Part 4 descriptions show wrong formula:
--   → Migration 20260607 not yet applied
--
-- SOLUTION:
-- Option A: Reset test data (DELETE from sp_ledger, sp_wallets, trades)
-- Option B: Apply corrective script to recalculate past trades
-- Option C: Document as "test data from old formula" and proceed
