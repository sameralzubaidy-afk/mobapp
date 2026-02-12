-- ================================================================
-- Migration: 207_discovery_seller_info.sql
-- Module: MODULE-05-DISCOVERY-V2 - Trust Signals
-- Description: Updates discovery RPCs to include seller verification status
-- ================================================================

-- DROP existing functions before recreating with new return types
DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);
DROP FUNCTION IF EXISTS search_listings_by_category(UUID, BOOLEAN, INT, INT);
DROP FUNCTION IF EXISTS search_listings_by_category_and_query(UUID, TEXT, BOOLEAN, INT, INT);
DROP FUNCTION IF EXISTS get_recommendations(UUID, INT);

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
  relevance REAL,
  seller_name TEXT,
  seller_avatar_url TEXT,
  seller_verification_status TEXT
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
    AS REAL) AS relevance,
    p.name as seller_name,
    p.avatar_url as seller_avatar_url,
    COALESCE(v.status, 'none') as seller_verification_status
  FROM items i
  LEFT JOIN profiles p ON i.seller_id = p.user_id
  LEFT JOIN (
    SELECT user_id, status, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM id_badge_verification_requests
  ) v ON i.seller_id = v.user_id AND v.rn = 1
  WHERE
    -- Only search active listings
    i.status = 'available'
    AND (
      i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    -- Optional filter: only SP-eligible items
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    relevance DESC,
    i.created_at DESC
  LIMIT p_limit;
END;
$$;

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
  updated_at TIMESTAMPTZ,
  seller_name TEXT,
  seller_avatar_url TEXT,
  seller_verification_status TEXT
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
    i.updated_at,
    p.name as seller_name,
    p.avatar_url as seller_avatar_url,
    COALESCE(v.status, 'none') as seller_verification_status
  FROM items i
  LEFT JOIN profiles p ON i.seller_id = p.user_id
  LEFT JOIN (
    SELECT user_id, status, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM id_badge_verification_requests
  ) v ON i.seller_id = v.user_id AND v.rn = 1
  WHERE
    -- Only search active listings
    i.status = 'available'
    AND i.category_id = p_category_id
    -- Optional filter: only SP-eligible items
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================================================
-- FUNCTION: search_listings_by_category_and_query
-- =============================================================================

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
  relevance REAL,
  seller_name TEXT,
  seller_avatar_url TEXT,
  seller_verification_status TEXT
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
    i.created_at,
    i.updated_at,
    CAST(
      CASE 
        WHEN v_search_query = '' THEN 1.0
        WHEN i.title ILIKE '%' || v_search_query || '%' THEN 2.0
        WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
        ELSE 0.5
      END
    AS REAL) AS relevance,
    p.name as seller_name,
    p.avatar_url as seller_avatar_url,
    COALESCE(v.status, 'none') as seller_verification_status
  FROM items i
  LEFT JOIN profiles p ON i.seller_id = p.user_id
  LEFT JOIN (
    SELECT user_id, status, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM id_badge_verification_requests
  ) v ON i.seller_id = v.user_id AND v.rn = 1
  WHERE
    i.status = 'available'
    AND i.category_id = p_category_id
    AND (
      v_search_query = ''
      OR i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
  ORDER BY 
    relevance DESC,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

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
  description TEXT,
  price NUMERIC,
  accepts_swap_points BOOLEAN,
  status TEXT,
  seller_id UUID,
  category_id UUID,
  condition TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  score REAL,
  seller_name TEXT,
  seller_avatar_url TEXT,
  seller_verification_status TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_is_subscriber BOOLEAN;
BEGIN
  -- Check if user is subscriber (Kids Club+)
  SELECT (subscription_tier = 'kids_club_plus') INTO v_is_subscriber
  FROM profiles WHERE user_id = p_user_id;

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
    CAST(
      (CASE WHEN v_is_subscriber AND i.accepts_swap_points THEN 1.5 ELSE 1.0 END) *
      (random()) -- Random factor for diversity in MVP
    AS REAL) as score,
    p.name as seller_name,
    p.avatar_url as seller_avatar_url,
    COALESCE(v.status, 'none') as seller_verification_status
  FROM items i
  LEFT JOIN profiles p ON i.seller_id = p.user_id
  LEFT JOIN (
    SELECT user_id, status, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM id_badge_verification_requests
  ) v ON i.seller_id = v.user_id AND v.rn = 1
  WHERE
    i.status = 'available'
    AND i.seller_id != p_user_id -- Don't recommend own items
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;
