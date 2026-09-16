-- ================================================================
-- Migration: 20260429000012_admin_listing_search_category_email_filters.sql
-- Module: MODULE-04 Listings / Admin tooling
-- Description:
--   Extend admin_search_listings_v2 with server-side filters for:
--   1) category name
--   2) seller email
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- ================================================================
-- BLOCK 1 — Function definition
-- ================================================================

CREATE OR REPLACE FUNCTION admin_search_listings_v2(
  p_query TEXT DEFAULT '',
  p_status TEXT DEFAULT 'all',
  p_sp_eligible BOOLEAN DEFAULT false,
  p_page INTEGER DEFAULT 1,
  p_items_per_page INTEGER DEFAULT 20,
  p_category TEXT DEFAULT 'all',
  p_seller_email TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id UUID;
  v_results JSONB;
  v_total_count INTEGER;
  v_offset INTEGER;
  v_status_db TEXT;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM auth.users au
     WHERE au.id = v_admin_id
       AND (
         au.raw_user_meta_data->>'is_admin' = 'true'
         OR au.raw_user_meta_data->>'role' = 'admin'
       )
  ) THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.user_id = v_admin_id
         AND p.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin privileges required' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_offset := (p_page - 1) * p_items_per_page;

  v_status_db := CASE
    WHEN p_status = 'active' THEN 'available'
    ELSE p_status
  END;

  SELECT COUNT(*)
    INTO v_total_count
    FROM public.items i
    LEFT JOIN public.categories c ON c.id = i.category_id
    LEFT JOIN auth.users au ON au.id = i.seller_id
   WHERE (p_status = 'all' OR i.status = v_status_db)
     AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
     AND (p_query = '' OR i.title ILIKE '%' || p_query || '%')
     AND (
       p_category = 'all'
       OR (p_category = 'uncategorized' AND c.name IS NULL)
       OR (p_category <> 'uncategorized' AND lower(c.name) = lower(p_category))
     )
     AND (p_seller_email = '' OR COALESCE(au.email, '') ILIKE '%' || p_seller_email || '%');

  SELECT jsonb_build_object(
    'listings', COALESCE(jsonb_agg(t), '[]'::jsonb),
    'total_count', v_total_count
  )
    INTO v_results
    FROM (
      SELECT
        i.id,
        i.title,
        i.price,
        i.status,
        i.accepts_swap_points,
        i.seller_id,
        i.created_at,
        i.eligible_for_starter_pack,
        i.starter_pack_claimed,
        i.approved_at,
        i.category_id,
        c.name AS category_name,
        i.requested_category_name,
        (i.requested_category_name IS NOT NULL
          AND btrim(i.requested_category_name) <> '') AS is_custom_category,
        i.description,
        i.condition,
        i.brand,
        i.color,
        i.age_group,
        i.gender,
        jsonb_build_object(
          'name', COALESCE(p.name, 'Unknown'),
          'email', au.email
        ) AS seller,
        (
          SELECT COUNT(*)::INTEGER
            FROM public.items i2
           WHERE i2.seller_id = i.seller_id
             AND i2.status = 'available'
        ) AS seller_items_count,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('url', img.url, 'thumbnail_url', img.thumbnail_url)),
            '[]'::jsonb
          )
            FROM public.item_images img
           WHERE img.item_id = i.id
        ) AS images
      FROM public.items i
      LEFT JOIN public.categories c ON c.id = i.category_id
      LEFT JOIN public.profiles p ON p.user_id = i.seller_id
      LEFT JOIN auth.users au ON au.id = i.seller_id
      WHERE (p_status = 'all' OR i.status = v_status_db)
        AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
        AND (p_query = '' OR i.title ILIKE '%' || p_query || '%')
        AND (
          p_category = 'all'
          OR (p_category = 'uncategorized' AND c.name IS NULL)
          OR (p_category <> 'uncategorized' AND lower(c.name) = lower(p_category))
        )
        AND (p_seller_email = '' OR COALESCE(au.email, '') ILIKE '%' || p_seller_email || '%')
      ORDER BY i.created_at DESC
      LIMIT p_items_per_page
      OFFSET v_offset
    ) t;

  RETURN v_results;
END;
$$;

-- ================================================================
-- BLOCK 2 — Permissions
-- ================================================================

GRANT EXECUTE ON FUNCTION admin_search_listings_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION admin_search_listings_v2 TO anon;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- 1) Function exists
-- SELECT proname FROM pg_proc WHERE proname = 'admin_search_listings_v2';

-- 2) Category filter (exact category)
-- SELECT public.admin_search_listings_v2('', 'all', false, 1, 10, 'Toys', '');

-- 3) Seller email filter (partial match)
-- SELECT public.admin_search_listings_v2('', 'all', false, 1, 10, 'all', '@gmail.com');

-- 4) Combined filters
-- SELECT public.admin_search_listings_v2('bike', 'pending', false, 1, 10, 'Sports', 'seller@');

-- Common failure modes:
-- 1) Unauthorized: caller not admin (auth metadata/profile role missing)
-- 2) empty category options in UI: categories table has no rows or user has no read access
-- 3) stale SQL function cache in SQL editor session: run DISCARD ALL and retry
