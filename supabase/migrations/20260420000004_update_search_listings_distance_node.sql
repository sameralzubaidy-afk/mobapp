-- ================================================================
-- Migration: DISCOVERY-V3-004-DISTANCE-SEARCH.sql
-- Module: MODULE-05-DISCOVERY-V3-FILTERS
-- Description: Add node_ids filter to search_listings RPC for distance searches
-- ================================================================

-- DROP existing
DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT, INT, UUID[], TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT[], TEXT);

-- V4 Enhanced search function (14 params)
CREATE OR REPLACE FUNCTION search_listings(
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
  -- NEW DISTANCE / NODE OVERRIDE PARAM:
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
    
    -- Filter by nodes if specified (V4 addition)
    AND (p_node_ids IS NULL OR p.node_id = ANY(p_node_ids))
    
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

COMMENT ON FUNCTION search_listings IS 'V4 search: Adds node_ids filter for distance scoping.';
