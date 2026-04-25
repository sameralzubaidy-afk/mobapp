-- ================================================================
-- Migration: 20260425000002_admin_listing_search_category_fields.sql
-- Module: MODULE-04 Listings / Admin tooling
-- Description:
--   Extend admin_search_listings_v2 to return listing category details,
--   requested custom category text, and a derived custom-category flag.
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
  p_items_per_page INTEGER DEFAULT 20
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
   WHERE (p_status = 'all' OR i.status = v_status_db)
     AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
     AND (p_query = '' OR i.title ILIKE '%' || p_query || '%');

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
        (i.requested_category_name IS NOT NULL AND btrim(i.requested_category_name) <> '') AS is_custom_category,
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
      LEFT JOIN public.profiles p ON i.seller_id = p.user_id
      LEFT JOIN auth.users au ON i.seller_id = au.id
      WHERE (p_status = 'all' OR i.status = v_status_db)
        AND (NOT p_sp_eligible OR i.accepts_swap_points = TRUE)
        AND (p_query = '' OR i.title ILIKE '%' || p_query || '%')
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

-- 1) Verify function exists
-- SELECT proname FROM pg_proc WHERE proname = 'admin_search_listings_v2';

-- 2) Verify response shape includes category fields
-- SELECT public.admin_search_listings_v2('', 'all', false, 1, 5);

-- 3) Validate custom-category indicators for one listing
-- SELECT i.id, i.category_id, c.name AS category_name, i.requested_category_name
-- FROM public.items i
-- LEFT JOIN public.categories c ON c.id = i.category_id
-- WHERE i.requested_category_name IS NOT NULL
-- ORDER BY i.created_at DESC
-- LIMIT 5;

-- Common failure modes:
-- 1) Missing categories row for category_id -> category_name returns NULL.
-- 2) Empty-string requested_category_name should not be treated as custom.
-- 3) Stale RPC definition if migration not applied in target environment.