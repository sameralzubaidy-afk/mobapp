-- ================================================================
-- Migration: 20260420000002_update_search_listings_rpc.sql
-- Module: MODULE-05-DISCOVERY-V3-FILTERS
-- Task: DISCOVERY-V3-002
-- Description: Replace V2 3-param search_listings with 13-param version
--              Add get_popular_brands RPC for brand autocomplete
-- Dependencies: 20260420000001 (filter columns must exist)
-- ================================================================

-- =============================================================================
-- STEP 1: DROP OLD V2 FUNCTION
-- =============================================================================

-- Drop the V2 3-param version
DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);

-- =============================================================================
-- STEP 2: CREATE NEW V3 ENHANCED SEARCH FUNCTION (13 params)
-- =============================================================================

CREATE OR REPLACE FUNCTION search_listings(
  p_query            TEXT    DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit            INT     DEFAULT 20,
  p_offset           INT     DEFAULT 0,
  -- NEW FILTER PARAMS (V3):
  p_category_ids     UUID[]  DEFAULT NULL,
  p_condition        TEXT    DEFAULT NULL,
  p_min_price        NUMERIC DEFAULT NULL,
  p_max_price        NUMERIC DEFAULT NULL,
  p_age_group        TEXT    DEFAULT NULL,
  p_gender           TEXT    DEFAULT NULL,
  p_brand            TEXT    DEFAULT NULL,
  p_colors           TEXT[]  DEFAULT NULL,
  -- SORT OPTION:
  p_sort_by          TEXT    DEFAULT 'relevance'
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
  age_group TEXT,
  gender TEXT,
  brand TEXT,
  color TEXT[],
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
    i.age_group,
    i.gender,
    i.brand,
    i.color,
    i.created_at,
    i.updated_at,
    -- Relevance scoring (FTS > title ILIKE > description ILIKE > fallback)
    CAST(
      CASE 
        WHEN v_search_query = '' THEN 1.0
        WHEN to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
             @@ plainto_tsquery('english', v_search_query) THEN 2.0
        WHEN i.title ILIKE '%' || v_search_query || '%' THEN 1.5
        WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
        ELSE 0.5
      END
    AS REAL) AS relevance
  FROM items i
  WHERE
    -- Only active listings
    i.status = 'available'
    
    -- FULL-TEXT SEARCH (if query provided)
    AND (
      v_search_query = '' 
      OR to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
         @@ plainto_tsquery('english', v_search_query)
      OR i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    
    -- FILTER: SP eligible
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
    
    -- FILTER: Multi-category (array) - NULL means no filter
    AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
    
    -- FILTER: Condition - NULL means no filter
    AND (p_condition IS NULL OR i.condition = p_condition)
    
    -- FILTER: Price range - NULL means no bound
    AND (p_min_price IS NULL OR i.price >= p_min_price)
    AND (p_max_price IS NULL OR i.price <= p_max_price)
    
    -- FILTER: Age group - NULL means no filter
    AND (p_age_group IS NULL OR i.age_group = p_age_group)
    
    -- FILTER: Gender - NULL means no filter
    AND (p_gender IS NULL OR i.gender = p_gender)
    
    -- FILTER: Brand (case-insensitive) - NULL means no filter
    AND (p_brand IS NULL OR LOWER(i.brand) = LOWER(p_brand))
    
    -- FILTER: Color (array overlap - item has ANY of the selected colors)
    -- Uses && operator for array overlap
    AND (p_colors IS NULL OR i.color && p_colors)
    
  ORDER BY 
    -- Sort by p_sort_by parameter (relevance | newest | price_asc | price_desc)
    CASE p_sort_by
      WHEN 'relevance' THEN relevance
      ELSE 0
    END DESC,
    CASE p_sort_by
      WHEN 'newest' THEN i.created_at
      ELSE NULL
    END DESC NULLS LAST,
    CASE p_sort_by
      WHEN 'price_asc' THEN i.price
      ELSE NULL
    END ASC NULLS LAST,
    CASE p_sort_by
      WHEN 'price_desc' THEN i.price
      ELSE NULL
    END DESC NULLS LAST,
    -- Final fallback: newest first
    i.created_at DESC
    
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_listings IS 'V3 enhanced search with 9 filters (category, condition, price, age, gender, brand, color, SP) + 4 sort options (relevance, newest, price_asc, price_desc). Returns paginated results with relevance scoring.';

-- =============================================================================
-- STEP 3: CREATE BRAND AUTOCOMPLETE RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION get_popular_brands(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  brand TEXT,
  item_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.brand,
    COUNT(*) AS item_count
  FROM items i
  WHERE 
    i.status = 'available'
    AND i.brand IS NOT NULL
    AND i.brand != ''
  GROUP BY i.brand
  ORDER BY item_count DESC, i.brand ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_popular_brands IS 'Returns top N brands by item count (active listings only) for brand autocomplete dropdown.';

-- =============================================================================
-- VERIFICATION QUERIES (COPY TO SUPABASE SQL EDITOR FOR SMOKE TEST)
-- =============================================================================

-- Verify new function signature (should show 13 params):
-- 
-- SELECT proname, pg_get_function_arguments(oid) AS signature
-- FROM pg_proc 
-- WHERE proname = 'search_listings' AND pronamespace = 'public'::regnamespace;
--
-- Expected output includes all 13 params with defaults

-- Verify get_popular_brands exists:
--
-- SELECT proname, pg_get_function_arguments(oid) AS signature
-- FROM pg_proc 
-- WHERE proname = 'get_popular_brands' AND pronamespace = 'public'::regnamespace;

-- Test 1: Basic search with no filters (should return results sorted by relevance)
--
-- SELECT id, title, price, relevance 
-- FROM search_listings('bike') 
-- LIMIT 5;

-- Test 2: Multi-category filter (replace with actual category UUIDs from your DB)
--
-- SELECT id, title, category_id 
-- FROM search_listings(
--   p_query := '',
--   p_category_ids := ARRAY['<uuid1>'::UUID, '<uuid2>'::UUID]
-- ) 
-- LIMIT 5;

-- Test 3: Color filter (array overlap)
--
-- SELECT id, title, color 
-- FROM search_listings(
--   p_query := '',
--   p_colors := ARRAY['blue', 'red']
-- ) 
-- LIMIT 5;

-- Test 4: Price range + sort by price ascending
--
-- SELECT id, title, price 
-- FROM search_listings(
--   p_query := '',
--   p_min_price := 10,
--   p_max_price := 50,
--   p_sort_by := 'price_asc'
-- ) 
-- LIMIT 5;

-- Test 5: Brand filter (case-insensitive)
--
-- SELECT id, title, brand 
-- FROM search_listings(
--   p_query := '',
--   p_brand := 'lego'
-- ) 
-- LIMIT 5;

-- Test 6: Sort by newest
--
-- SELECT id, title, created_at 
-- FROM search_listings(
--   p_query := '',
--   p_sort_by := 'newest'
-- ) 
-- LIMIT 5;

-- Test 7: Get popular brands
--
-- SELECT brand, item_count 
-- FROM get_popular_brands(10);
--
-- Expected: Top 10 brands ordered by item count DESC

-- =============================================================================
-- COMMON FAILURE MODES & TROUBLESHOOTING
-- =============================================================================

-- ISSUE: "function search_listings(text, boolean, integer) does not exist"
-- SOLUTION: Old V2 callers must be updated to use new V3 signature with named params

-- ISSUE: Color filter returns no results when colors exist
-- SOLUTION: Verify color column is TEXT[] not TEXT. Check query uses ARRAY['blue','red'] not '{blue,red}'

-- ISSUE: Brand filter case-sensitive
-- SOLUTION: Verified - uses LOWER() on both sides

-- ISSUE: Relevance score always 0.5
-- SOLUTION: Check FTS index exists on items. May need to rebuild:
--   CREATE INDEX IF NOT EXISTS idx_items_search_vector 
--   ON items USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ISSUE: Performance degradation with many filters
-- SOLUTION: Verify partial indexes exist (from migration 20260420000001)
--   SELECT indexname FROM pg_indexes WHERE tablename = 'items' AND indexname LIKE 'idx_items_%';
