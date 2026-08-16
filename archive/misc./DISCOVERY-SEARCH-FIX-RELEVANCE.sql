-- ================================================================
-- DISCOVERY-V2-001: Fix Search Filtering by Adding Relevance Threshold
-- ================================================================
-- Issue: Search results include items with minimal relevance to query
--        (e.g., "Winter" shows Soccer Ball, iPad)
-- Solution: Add minimum relevance threshold (> 0.01) to filter weak matches
-- ================================================================

-- Step 1: Update the search_listings function with relevance threshold
CREATE OR REPLACE FUNCTION search_listings(
  p_query TEXT,
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  accepts_swap_points BOOLEAN,
  status TEXT,
  seller_id UUID,
  category_id UUID,
  condition TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  relevance REAL
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_query TSQUERY;
BEGIN
  -- Convert search query to tsquery for matching
  v_search_query := plainto_tsquery('english', TRIM(p_query));
  
  -- Return early if query is empty after trimming
  IF v_search_query IS NULL OR v_search_query::TEXT = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.description,
    i.price,
    i.accepts_swap_points,
    i.status,
    i.seller_id,
    i.category_id,
    i.condition,
    i.created_at,
    i.updated_at,
    ts_rank(i.search_vector, v_search_query) AS relevance
  FROM items i
  WHERE
    -- Only search active listings
    i.status = 'available'
    -- Match against full-text search vector
    AND i.search_vector @@ v_search_query
    -- DISCOVERY-V2-001: Minimum relevance threshold (0.01 = ~1%)
    -- This filters out tangential matches that don't directly match the query
    AND ts_rank(i.search_vector, v_search_query) > 0.01
    -- Optional filter: only SP-eligible items
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    -- Primary: relevance score (highest first)
    relevance DESC,
    -- Secondary: newer items first
    i.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Verification: Check if function exists and has correct signature
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.routine_name = p.routine_name
WHERE r.routine_schema = 'public'
AND r.routine_name = 'search_listings'
LIMIT 5;
