-- Migration: 20260811000007_discover_count_listings_rpc.sql
-- Mode: B (idempotent rerunnable — DROP FUNCTION IF EXISTS + CREATE OR REPLACE)
-- Description: Live result count for the Discover Filters sheet's
-- "Show {n} Results" Apply button. Mirrors search_listings V4 filter semantics
-- EXACTLY (same WHERE clauses, minus sort/pagination) so the count always matches
-- the result set. Discovery search is intentionally NOT node-gated
-- (see 20260603000001) — p_node_ids is kept for signature parity but unused.
-- Backward compatible: ✅ additive — no existing object is altered or dropped.

-- =============================================================================
-- BLOCK 1 — Schema (run first, then run the verification queries below)
-- =============================================================================

DROP FUNCTION IF EXISTS public.count_listings(
  TEXT, BOOLEAN, UUID[], TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT[], UUID[]
);

CREATE OR REPLACE FUNCTION public.count_listings(
  p_query            TEXT    DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_category_ids     UUID[]  DEFAULT NULL,
  p_condition        TEXT    DEFAULT NULL,
  p_min_price        NUMERIC DEFAULT NULL,
  p_max_price        NUMERIC DEFAULT NULL,
  p_age_group        TEXT    DEFAULT NULL,
  p_gender           TEXT    DEFAULT NULL,
  p_brand            TEXT    DEFAULT NULL,
  p_colors           TEXT[]  DEFAULT NULL,
  p_node_ids         UUID[]  DEFAULT NULL
)
RETURNS TABLE (total_count BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_query TEXT;
BEGIN
  v_search_query := TRIM(p_query);

  RETURN QUERY
  SELECT COUNT(*) AS total_count
  FROM items i
  WHERE
    i.status = 'available'
    AND (
      v_search_query = ''
      OR to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
         @@ plainto_tsquery('english', v_search_query)
      OR i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
    AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
    AND (p_condition IS NULL OR i.condition = p_condition)
    AND (p_min_price IS NULL OR i.price >= p_min_price)
    AND (p_max_price IS NULL OR i.price <= p_max_price)
    AND (p_age_group IS NULL OR i.age_group = p_age_group)
    AND (p_gender IS NULL OR i.gender = p_gender)
    AND (p_brand IS NULL OR LOWER(i.brand) = LOWER(p_brand))
    AND (p_colors IS NULL OR i.color && p_colors)
    -- p_node_ids intentionally unused: discovery search is not node-gated
  ;
END;
$$;

COMMENT ON FUNCTION public.count_listings IS
  'Live result count for the Discover filters sheet — mirrors search_listings V4 filter semantics (no sort/pagination).';

-- =============================================================================
-- BLOCK 2 — Verification queries (run after BLOCK 1; one statement per call)
-- =============================================================================
-- SELECT * FROM public.count_listings();
-- SELECT * FROM public.count_listings(p_sp_eligible_only := TRUE);
-- SELECT * FROM public.count_listings(
--   p_category_ids := ARRAY['<uuid>'::UUID],
--   p_min_price := 10,
--   p_max_price := 50
-- );
-- Parity check (should be consistent):
-- SELECT * FROM public.count_listings(p_query := 'bike');
-- SELECT count(*) FROM search_listings('bike', FALSE, 1000, 0);
