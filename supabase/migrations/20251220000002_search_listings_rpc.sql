-- ================================================================
-- Migration: 20251220000002_search_listings_rpc.sql
-- Module: MODULE-05-DISCOVERY-V2 - Full-Text Search Index
-- Task: DISCOVERY-V2-001
-- Description: RPC function for searching listings with relevance ranking
--              and SP-eligible filtering
-- ================================================================

-- =============================================================================
-- FUNCTION: search_listings
-- =============================================================================

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

COMMENT ON FUNCTION search_listings IS 'Search items by substring query with optional SP-eligible filter. Returns ranked results by relevance.';

-- =============================================================================
-- FUNCTION: search_listings_by_category
-- =============================================================================

CREATE OR REPLACE FUNCTION search_listings_by_category(
  p_category_id UUID,
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
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
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
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
    i.updated_at
  FROM items i
  WHERE
    -- Only search active listings
    i.status = 'available'
    -- Match category
    AND i.category_id = p_category_id
    -- Optional filter: only SP-eligible items
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    -- Newest items first
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_listings_by_category IS 'Browse items by category with optional SP-eligible filter. Returns paginated results.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify functions were created:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('search_listings', 'search_listings_by_category');

-- Test basic search (run after adding test data):
-- SELECT id, title, relevance FROM search_listings('toy', false, 5);

-- Test SP-only search:
-- SELECT id, title, accepts_swap_points FROM search_listings('toy', true, 5);

-- Test category browse:
-- SELECT id, title FROM search_listings_by_category(
--   '550e8400-e29b-41d4-a716-446655440000'::uuid, false, 10
-- );
