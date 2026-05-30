-- DIRECT FIX FOR SUPABASE: Update the get_recommendations RPC function
-- Apply this directly in Supabase SQL Editor
-- No need to use migrations - just execute this raw SQL

-- Drop the old function first
DROP FUNCTION IF EXISTS get_recommendations(UUID, INT) CASCADE;

-- Create the corrected function with proper SP prioritization scoring
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
  score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_sp_balance INT DEFAULT 0;
  v_available_points INT DEFAULT 0;
  v_subscription_tier TEXT DEFAULT NULL;
  v_can_spend_sp BOOLEAN DEFAULT FALSE;
BEGIN
  -- ==========================================================================
  -- STEP 1: Get user subscription status (CRITICAL for SP scoring)
  -- ==========================================================================
  
  -- Query subscriptions table directly to get subscriber status
  SELECT s.status
  INTO v_subscription_tier
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  LIMIT 1;
  
  -- Default to 'free' if no subscription found
  v_subscription_tier := COALESCE(v_subscription_tier, 'free');
  
  -- Determine if user can spend SP (is a subscriber)
  -- Subscribers: 'trial', 'active', 'grace'
  -- Non-subscribers: 'free', NULL, or no record
  v_can_spend_sp := (v_subscription_tier IN ('trial', 'active', 'grace'));
  
  -- ==========================================================================
  -- STEP 2: Get user SP wallet balance (optional, for affordability scoring)
  -- ==========================================================================
  
  -- Try to get SP wallet info (may not exist for new users)
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
    --
    -- CRITICAL: SP-eligible bonus (100) is applied regardless of wallet balance
    -- A new subscriber with 0 SP should see SP items scored at 110+
    -- They WILL EARN SP on purchases, so prioritization encourages adoption
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
    ) AS score
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

-- =============================================================================
-- VERIFICATION QUERIES (run after applying this fix)
-- =============================================================================

-- 1. Verify function exists with correct signature:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_recommendations';

-- 2. Test with a SUBSCRIBER user (replace with actual user_id):
-- SELECT 
--   id, 
--   title, 
--   accepts_swap_points, 
--   price, 
--   score
-- FROM get_recommendations('dbd3f8f8-a6ea-4289-8fe4-902b0a1dbff5'::UUID, 5)
-- ORDER BY score DESC
-- EXPECT: SP-eligible items have score >= 110, cash-only items have score = 10

-- 3. Test with a FREE user (replace with actual user_id):
-- SELECT 
--   id, 
--   title, 
--   accepts_swap_points, 
--   price, 
--   score
-- FROM get_recommendations('free-user-id'::UUID, 5)
-- EXPECT: all items have score = 10 (randomized order)

-- 4. Check subscription status for debugging:
-- SELECT user_id, status FROM subscriptions WHERE user_id = 'dbd3f8f8-a6ea-4289-8fe4-902b0a1dbff5'::UUID;

-- 5. Check items that accept SP:
-- SELECT id, title, accepts_swap_points, price FROM items WHERE accepts_swap_points = true LIMIT 5;
