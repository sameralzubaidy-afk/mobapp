-- ================================================================
-- Migration: 20251224000001_add_category_text_search_rpc.sql
-- Module: MODULE-05-DISCOVERY-V2
-- Task: DISCOVERY-V2-002 - Combined Category + Text Search
-- Description: Add RPC function for searching within a category
-- ================================================================

-- =============================================================================
-- FUNCTION: search_listings_by_category_and_query
-- =============================================================================
-- Combines category filtering with text search for full-featured filtering
CREATE OR REPLACE FUNCTION search_listings_by_category_and_query(
  p_category_id UUID,
  p_query TEXT,
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
  
  -- If no search query, just return category items (maintain backwards compat)
  IF v_search_query = '' THEN
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
      CAST(0.0 AS REAL) AS relevance
    FROM items i
    WHERE
      i.status = 'available'
      AND i.category_id = p_category_id
      AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
    ORDER BY 
      i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END IF;

  -- If search query provided, filter by category AND search
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
    -- Relevance scoring: title matches weighted higher
    CAST(
      CASE 
        WHEN i.title ILIKE '%' || v_search_query || '%' THEN 2.0
        WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
        ELSE 0.5
      END
    AS REAL) AS relevance
  FROM items i
  WHERE
    -- Category filter
    i.category_id = p_category_id
    -- Status filter
    AND i.status = 'available'
    -- Text search (title or description match)
    AND (
      i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    -- Optional SP filter
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    -- Primary: relevance score (title matches first)
    relevance DESC,
    -- Secondary: newer items first
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_listings_by_category_and_query IS 'Search items within a category by text query with optional SP-eligible filter. Combines category browsing with full-text search.';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify function was created:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name = 'search_listings_by_category_and_query';

-- Test: Search for "lego" in toys category with empty query (should return all category items):
-- SELECT id, title, relevance FROM search_listings_by_category_and_query(
--   (SELECT id FROM categories WHERE name = 'Toys' LIMIT 1),
--   '',
--   false,
--   10
-- );

-- Test: Search for "lego" in toys category:
-- SELECT id, title, relevance FROM search_listings_by_category_and_query(
--   (SELECT id FROM categories WHERE name = 'Toys' LIMIT 1),
--   'lego',
--   false,
--   10
-- );

-- Test: Search for "lego" in toys category, SP-eligible only:
-- SELECT id, title, accepts_swap_points FROM search_listings_by_category_and_query(
--   (SELECT id FROM categories WHERE name = 'Toys' LIMIT 1),
--   'lego',
--   true,
--   10
-- );
