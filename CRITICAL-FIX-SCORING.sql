-- ================================================================
-- CRITICAL FIX: 20251220000003_get_recommendations_rpc.sql (REVISED)
-- Issue: Items with accepts_swap_points=true are NOT being prioritized
-- Root Cause: SP eligibility bonus is not being applied to subscriber items
-- ================================================================

-- DROP AND RECREATE the function with DEBUGGING
DROP FUNCTION IF EXISTS get_recommendations(UUID, INT) CASCADE;

CREATE OR REPLACE FUNCTION get_recommendations(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price NUMERIC,
  accepts_swap_points BOOLEAN,
  status TEXT,
  seller_id UUID,
  category_id UUID,
  condition TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  score REAL,
  -- DEBUG columns (remove in production)
  debug_subscription_status TEXT,
  debug_can_spend_sp BOOLEAN,
  debug_sp_bonus INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_sp_balance INT DEFAULT 0;
  v_available_points INT DEFAULT 0;
  v_wallet_status TEXT DEFAULT 'inactive';
  v_subscription_tier TEXT DEFAULT NULL;
  v_can_spend_sp BOOLEAN DEFAULT FALSE;
BEGIN
  -- ==========================================================================
  -- STEP 1: Get user subscription status (CRITICAL - required for SP scoring)
  -- ==========================================================================
  
  -- Query the subscriptions table directly to get status
  -- This user MUST exist in subscriptions table for SP features to work
  SELECT s.status
  INTO v_subscription_tier
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  LIMIT 1;  -- IMPORTANT: Add LIMIT to handle multiple rows (take latest)
  
  -- Default to 'free' if no subscription found
  v_subscription_tier := COALESCE(v_subscription_tier, 'free');
  
  -- Determine if user can spend SP (is a subscriber)
  -- Subscribers: 'trial', 'active', 'grace' (post-cancel grace period)
  -- Non-subscribers: 'free', NULL, or no record
  v_can_spend_sp := (v_subscription_tier IN ('trial', 'active', 'grace'));
  
  -- ==========================================================================
  -- STEP 2: Get user SP wallet balance (optional, for affordability scoring)
  -- ==========================================================================
  
  -- Try to get SP wallet info (may not exist for free users)
  BEGIN
    SELECT available_balance
    INTO v_available_points
    FROM sp_wallets
    WHERE user_id = p_user_id;
    
    v_user_sp_balance := COALESCE(v_available_points, 0);
  EXCEPTION
    WHEN OTHERS THEN
      -- If wallet doesn't exist, default to 0 balance
      v_user_sp_balance := 0;
  END;
  
  -- ==========================================================================
  -- STEP 3: Generate recommendations with subscription-aware scoring
  -- ==========================================================================
  
  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.price,
    i.accepts_swap_points,
    i.status,
    i.seller_id,
    i.category_id,
    i.condition,
    i.created_at,
    i.updated_at,
    -- SCORING LOGIC (Subscription-Aware):
    -- For SUBSCRIBERS (trial/active/grace):
    --   - SP-eligible items (accepts_swap_points=true): +100 bonus
    --   - Purpose: Prioritize SP items for subscribers to encourage adoption
    --   - Additional +50 if item price is affordable with current SP balance
    --
    -- For FREE USERS:
    --   - All items: no SP bonus (score = 10)
    --   - Randomized order within tier
    --
    -- Base +10 score: ensures all active items appear in results
    CAST(
      (
        -- SP-ELIGIBLE BONUS: +100 for subscribers browsing SP-eligible items
        -- This is the PRIMARY differentiator between SP and cash-only items
        CASE 
          WHEN i.accepts_swap_points AND v_can_spend_sp 
          THEN 100 
          ELSE 0 
        END +
        
        -- AFFORDABILITY BONUS: +50 if item price <= user's current SP balance
        -- Only for subscribers with sufficient balance
        -- Formula: price (in dollars) <= balance (in SP points, where 1 SP = $1)
        CASE 
          WHEN v_can_spend_sp 
            AND v_user_sp_balance > 0
            AND i.price <= v_user_sp_balance::NUMERIC
          THEN 50 
          ELSE 0 
        END +
        
        -- BASE SCORE: +10 for all active items
        -- Ensures all items appear in results with minimum priority
        10
      ) AS REAL
    ) AS score,
    
    -- DEBUG INFO (for troubleshooting, remove in production)
    v_subscription_tier::TEXT AS debug_subscription_status,
    v_can_spend_sp AS debug_can_spend_sp,
    CASE WHEN i.accepts_swap_points AND v_can_spend_sp THEN 100 ELSE 0 END AS debug_sp_bonus
    
  FROM items i
  WHERE 
    -- Only recommend active listings
    i.status = 'available'
    -- Exclude user's own listings
    AND i.seller_id != p_user_id
  ORDER BY 
    -- Primary: score (highest first)
    score DESC,
    -- Secondary: randomize within same score tier for variety
    RANDOM()
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_recommendations IS 'MODULE-05 DISCOVERY-V2-002: Get personalized recommendations. Prioritizes SP-eligible items for subscribers.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- 1. Check function exists and has correct signature:
-- SELECT proname FROM pg_proc WHERE proname = 'get_recommendations';

-- 2. Test with a SUBSCRIBER (should see high scores for SP-eligible items):
-- SELECT * FROM get_recommendations('dbd3f8f8-a6ea-4289-8fe4-902b0a1dbff5'::UUID, 5)
-- WHERE accepts_swap_points = true
-- EXPECT: score > 100 for SP-eligible items

-- 3. Test with a FREE USER (all items should score 10):
-- SELECT * FROM get_recommendations('free-user-id'::UUID, 5)
-- EXPECT: all scores = 10

-- 4. Debug: See the subscription status lookup:
-- SELECT status FROM subscriptions WHERE user_id = 'user-id'::UUID;

-- =============================================================================
-- COMMON FAILURE MODES
-- =============================================================================

-- 1. Function returns NULL results:
--    → Check: Is the subscriptions table populated?
--    → Check: Does the test user have ANY subscription record?

-- 2. All items show score=10 (no SP bonus applied):
--    → Check: Is the user's subscription_status actually 'trial'/'active'/'grace'?
--    → Check: Does accepts_swap_points match reality in items table?

-- 3. Score calculation is wrong:
--    → Check: SP balance value (is it in points or cents?)
--    → Check: Price comparison logic (price <= balance or price <= balance/100?)

-- 4. RLS policies preventing results:
--    → Check: Is function using SECURITY DEFINER?
--    → Check: Are items table RLS policies allowing reads?
