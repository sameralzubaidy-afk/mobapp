-- ================================================================
-- DISCOVERY-V2-001: Update Search to Support Partial Matching
-- ================================================================
-- Changes:
-- 1. Minimum 3 characters requirement (enforced in mobile app)
-- 2. Switch from full-text search (tsvector) to substring matching (ILIKE)
-- 3. This allows "win" to match "winter", "window", etc.
-- ================================================================

-- Step 1: Drop the old function and recreate with new logic
DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);

-- Step 2: Create new search_listings with ILIKE substring matching
CREATE FUNCTION search_listings(
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
  v_search_query TEXT;
BEGIN
  v_search_query := TRIM(p_query);
  
  -- Return early if query is empty after trimming
  IF v_search_query = '' THEN
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
    -- Relevance scoring: title matches weighted higher than description
    CAST(
      CASE 
        WHEN i.title ILIKE '%' || v_search_query || '%' THEN 2.0
        WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
        ELSE 0.5
      END
    AS REAL) AS relevance
  FROM items i
  WHERE
    -- Only search active listings
    i.status = 'available'
    -- DISCOVERY-V2-001: Substring matching with ILIKE (case-insensitive)
    -- Matches: "win" in "winter", "window", etc.
    AND (
      i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    -- Optional filter: only SP-eligible items
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    -- Primary: relevance score (title matches first)
    relevance DESC,
    -- Secondary: newer items first
    i.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Step 3: Verify the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'search_listings';

-- Step 4: Test the function (run this after adding test data)
-- SELECT id, title, relevance FROM search_listings('win', false, 10);
-- Expected: All items with "win" in title/description (winter, window, etc.)
