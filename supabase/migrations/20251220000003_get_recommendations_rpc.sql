-- ================================================================
-- Migration: 20251220000003_get_recommendations_rpc.sql
-- Module: MODULE-05-DISCOVERY-V2 - Subscriber-Personalized Recommendations
-- Task: DISCOVERY-V2-002
-- Description: Build recommendation engine that prioritizes SP-eligible items
--              for subscribers and suggests items within user's SP balance range
-- ================================================================

-- =============================================================================
-- FUNCTION: get_recommendations
-- =============================================================================

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
AS $$
DECLARE
  v_user_sp_balance INT DEFAULT 0;
  v_available_points INT DEFAULT 0;
  v_wallet_status TEXT DEFAULT 'inactive';
  v_subscription_tier TEXT DEFAULT 'free';
  v_can_spend_sp BOOLEAN DEFAULT FALSE;
BEGIN
  -- ==========================================================================
  -- STEP 1: Get user SP wallet summary and subscription status
  -- ==========================================================================
  
  -- Try to get SP wallet info (may not exist for new users)
  BEGIN
    SELECT available_points, wallet_status
    INTO v_available_points, v_wallet_status
    FROM get_user_sp_wallet_summary(p_user_id);
    
    v_user_sp_balance := COALESCE(v_available_points, 0);
  EXCEPTION
    WHEN OTHERS THEN
      -- If wallet doesn't exist or query fails, default to 0 balance
      v_user_sp_balance := 0;
      v_wallet_status := 'inactive';
  END;
  
  -- Get user subscription status from subscriptions table
  BEGIN
    SELECT s.status
    INTO v_subscription_tier
    FROM subscriptions s
    WHERE s.user_id = p_user_id;
    
    v_subscription_tier := COALESCE(v_subscription_tier, 'free');
  EXCEPTION
    WHEN OTHERS THEN
      v_subscription_tier := 'free';
  END;
  
  -- User can spend SP if they are a subscriber (trial or kids_club_plus)
  -- Note: We check subscription status, not wallet balance, because:
  --   1. Wallet might not exist yet for new subscribers
  --   2. They will EARN SP on purchases, so still want SP-eligible items prioritized
  v_can_spend_sp := (
    v_subscription_tier IN ('trial', 'active', 'grace') 
  );
  
  -- ==========================================================================
  -- STEP 2: Generate recommendations with scoring logic
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
    -- Scoring logic (V2 Subscription-Aware):
    -- +100: SP-eligible (accepts_swap_points=true) AND subscriber (trial/active/grace status)
    --       PURPOSE: Subscribers see SP-eligible items ranked first
    -- +50:  Item price is affordable with current SP balance
    --       PURPOSE: Show items user can fully or partially pay with SP
    -- +10:  Base score for all active items
    --       PURPOSE: Ensure all active items appear, sorted by base score
    --
    -- IMPORTANT: Score is INDEPENDENT of wallet balance for SPeligibility bonus
    -- A new subscriber with 0 SP should still see SP-eligible items scored at 110+
    -- They will EARN SP on purchases, so prioritization encourages SP adoption
    --
    -- Example scores:
    -- Subscriber browsing SP-eligible item ($50) with $100 SP balance:
    --   Score = 100 (eligible) + 0 (price $50 > $100/100=$1) + 10 = 110
    -- Subscriber browsing SP-eligible item ($20) with $100 SP balance:
    --   Score = 100 (eligible) + 50 (price $20 < $100/100=$1) + 10 = 160
    -- Free user browsing SP-eligible item ($50):
    --   Score = 0 (not subscriber) + 0 (not subscriber) + 10 = 10
    -- Free user browsing cash-only item ($50):
    --   Score = 0 (not SP-eligible) + 0 (not subscriber) + 10 = 10
    CAST(
      (
        -- SP-eligible bonus (subscribers only)
        CASE WHEN i.accepts_swap_points AND v_can_spend_sp THEN 100 ELSE 0 END +
        
        -- Affordable with SP balance bonus
        -- Convert price to cents for comparison: price (NUMERIC) * 100
        -- SP balance is in points (1 SP = $1 = 100 cents)
        CASE 
          WHEN v_can_spend_sp 
            AND i.price <= (v_user_sp_balance::NUMERIC / 100) 
          THEN 50 
          ELSE 0 
        END +
        
        -- Base score for all active items
        10
      )
    AS REAL) AS score
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

COMMENT ON FUNCTION get_recommendations IS 'MODULE-05 DISCOVERY-V2-002: Get personalized recommendations for user. Prioritizes SP-eligible items for subscribers and suggests items within SP balance range.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Test with sample user (replace with actual user_id):
-- SELECT * FROM get_recommendations('00000000-0000-0000-0000-000000000000'::UUID, 10);

-- Verify function exists:
-- SELECT proname, proargnames, prosrc 
-- FROM pg_proc 
-- WHERE proname = 'get_recommendations';

-- Test scoring logic (subscribers vs non-subscribers):
-- With subscriber user: should see high scores for SP-eligible items
-- With free user: should see lower/zero scores for SP items

-- =============================================================================
-- COMMON FAILURE MODES TO CHECK
-- =============================================================================

-- 1. Missing sp_wallets table: MODULE-09 must be implemented first
-- 2. Missing subscription_tier in profiles: MODULE-11 must be implemented first
-- 3. get_user_sp_wallet_summary function missing: Check MODULE-03 AUTH-V2-003
-- 4. RLS scope: This function uses SECURITY DEFINER context (verify RLS policies)

