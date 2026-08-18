-- ============================================================================
-- P3 — Restore Node-Scoped Discovery: search_listings + count_listings node filter
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Makes the two discovery RPCs HONOR p_node_ids instead of accepting-and-
--   ignoring it. When p_node_ids is provided, results are scoped to those
--   nodes (strict: NULL-node items are excluded — see product decision). When
--   p_node_ids is NULL, behavior is unchanged (global / all nodes) — backward
--   compatible, so existing callers that pass no node scope are unaffected.
--   Also adds node_id to search_listings RETURN columns (additive) so the
--   mobile client can render an "Other Node" indicator on cards when the
--   "Show All Nodes" toggle is on.
--
-- PRIOR STATE (root cause):
--   * search_listings V4 (20260603000001) — p_node_ids declared but unused;
--     WHERE comment "Node scope intentionally not applied at discovery-search
--     time." COMMENT: "discovery results are not node-gated."
--   * count_listings (20260811000007) — p_node_ids unused; comment
--     "p_node_ids intentionally unused: discovery search is not node-gated."
--
-- DESIGN:
--   * Filter added identically to both RPCs so the count always matches the
--     result set: AND (p_node_ids IS NULL OR i.node_id = ANY(p_node_ids)).
--   * NULL-safe: i.node_id = ANY(p_node_ids) is NULL for NULL node_id → row
--     excluded → strict scoping (NULL-node items only visible under "Show All
--     Nodes" = p_node_ids NULL).
--   * search_listings RETURNS TABLE changes → BP-12 requires DROP first; DROP
--     uses the FULL 14-arg input signature (note: the 20260603000001 DROP only
--     listed 13 types — a pre-existing quirk; we DROP the real 14-arg one).
--   * All other WHERE/ORDER/LIMIT logic preserved EXACTLY (no regression risk).
--
-- RULES: SQL-0 (Mode B), BP-12 (DROP before RETURNS TABLE change), BP-10
-- (verification queries), p_/v_ naming, qualified columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1 — search_listings (V5): DROP the 14-arg V4, recreate with node filter
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_listings(
  TEXT, BOOLEAN, INT, INT, UUID[], TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT[], TEXT, UUID[]
);

CREATE OR REPLACE FUNCTION public.search_listings(
  p_query            TEXT    DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit            INT     DEFAULT 20,
  p_offset           INT     DEFAULT 0,
  p_category_ids     UUID[]  DEFAULT NULL,
  p_condition        TEXT    DEFAULT NULL,
  p_min_price        NUMERIC DEFAULT NULL,
  p_max_price        NUMERIC DEFAULT NULL,
  p_age_group        TEXT    DEFAULT NULL,
  p_gender           TEXT    DEFAULT NULL,
  p_brand            TEXT    DEFAULT NULL,
  p_colors           TEXT[]  DEFAULT NULL,
  p_sort_by          TEXT    DEFAULT 'relevance',
  p_node_ids         UUID[]  DEFAULT NULL
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
  node_id UUID,
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
    i.node_id,
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
  LEFT JOIN profiles p ON i.seller_id = p.user_id
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

    -- P3 (2026-08-17): node scope applied when provided (strict — NULL-node
    -- items excluded). NULL p_node_ids = global / all nodes (backward compatible).
    AND (p_node_ids IS NULL OR i.node_id = ANY(p_node_ids))

  ORDER BY
    CASE p_sort_by
      WHEN 'relevance' THEN
        CASE
          WHEN v_search_query = '' THEN 1.0
          WHEN to_tsvector('english', i.title || ' ' || COALESCE(i.description, '')) @@ plainto_tsquery('english', v_search_query) THEN 2.0
          WHEN i.title ILIKE '%' || v_search_query || '%' THEN 1.5
          WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
          ELSE 0.5
        END
      ELSE 0
    END DESC,
    CASE p_sort_by WHEN 'newest' THEN i.created_at ELSE NULL END DESC NULLS LAST,
    CASE p_sort_by WHEN 'price_asc' THEN i.price ELSE NULL END ASC NULLS LAST,
    CASE p_sort_by WHEN 'price_desc' THEN i.price ELSE NULL END DESC NULLS LAST,
    i.created_at DESC

  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.search_listings IS
'V5 search (P3 2026-08-17): applies p_node_ids node scope when provided (strict, excludes NULL-node items); NULL p_node_ids = global. node_id returned on each row for "Other Node" UI.';

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont) — count_listings: DROP + recreate with identical node filter
-- ---------------------------------------------------------------------------
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
    -- P3 (2026-08-17): node scope applied when provided (strict). Must stay
    -- parity-exact with search_listings so the count matches the result set.
    AND (p_node_ids IS NULL OR i.node_id = ANY(p_node_ids))
  ;
END;
$$;

COMMENT ON FUNCTION public.count_listings IS
'Live result count for the Discover filters sheet — mirrors search_listings V5 filter semantics (P3: applies p_node_ids node scope when provided; NULL = global).';

-- ===========================================================================
-- BLOCK 2 — Verification queries (run one statement per call)
-- ===========================================================================
-- 1. Global (unchanged / backward compatible) — expect total available count:
--    SELECT * FROM public.count_listings();
--
-- 2. Node-scoped (Norwalk Central 550e8400-e29b-41d4-a716-446655440001) —
--    expect ONLY Norwalk available items (102 visible), NULL-node items excluded:
--    SELECT * FROM public.count_listings(p_node_ids := ARRAY['550e8400-e29b-41d4-a716-446655440001'::UUID]);
--
-- 3. Count/search parity — same scope must agree:
--    SELECT * FROM public.count_listings(p_node_ids := ARRAY['550e8400-e29b-41d4-a716-446655440001'::UUID]);
--    SELECT count(*) FROM public.search_listings('', FALSE, 1000, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'relevance', ARRAY['550e8400-e29b-41d4-a716-446655440001'::UUID]);
--
-- 4. node_id present on each returned row + strict exclusion visible:
--    SELECT node_id, count(*) FROM public.search_listings('', FALSE, 1000, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'relevance', ARRAY['550e8400-e29b-41d4-a716-446655440001'::UUID]) GROUP BY node_id;
--    (expect all node_id = the scoped node; no NULLs)
