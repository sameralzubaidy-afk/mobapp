-- DEBUG: Test the recommendation scoring logic
-- Run this in Supabase SQL Editor directly

-- Step 1: Get a subscriber user from our test data
SELECT id, email FROM auth.users WHERE email LIKE '%@example.com' LIMIT 1;

-- Step 2: Check their subscription status
SELECT * FROM subscriptions WHERE user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d';

-- Step 3: Check their SP wallet
SELECT * FROM sp_wallets WHERE user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d';

-- Step 4: Check if get_user_sp_wallet_summary is working
SELECT * FROM get_user_sp_wallet_summary('5861bf0e-a925-4f2e-8e36-5db45e10608d');

-- Step 5: Check subscription summary
SELECT * FROM get_subscription_summary('5861bf0e-a925-4f2e-8e36-5db45e10608d');

-- Step 6: Test the recommendation function directly with debug output
-- Add some test items to check
SELECT 
  i.id,
  i.title,
  i.accepts_swap_points,
  i.price,
  -- Manually calculate scoring to debug:
  CASE 
    WHEN i.accepts_swap_points THEN 'SP-eligible'
    ELSE 'Cash-only'
  END as sp_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d'
      AND s.status IN ('trial', 'active', 'grace')
    )
    THEN 'Subscriber'
    ELSE 'Free'
  END as user_tier,
  -- Expected score calculation:
  CASE 
    WHEN i.accepts_swap_points AND EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.user_id = '5861bf0e-a925-4f2e-8e36-5db45e10608d'
      AND s.status IN ('trial', 'active', 'grace')
    )
    THEN 100 + 10
    ELSE 10
  END as expected_score
FROM items i
WHERE i.status = 'available'
  AND i.seller_id != '5861bf0e-a925-4f2e-8e36-5db45e10608d'
LIMIT 5;

-- Step 7: Call the actual recommendation function and see the real scores
SELECT 
  id,
  title,
  accepts_swap_points,
  price,
  score
FROM get_recommendations('5861bf0e-a925-4f2e-8e36-5db45e10608d'::UUID, 5)
ORDER BY score DESC;
