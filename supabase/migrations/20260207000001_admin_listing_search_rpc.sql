-- File: supabase/migrations/20260207000001_admin_listing_search_rpc.sql
-- Description: RPC for efficient admin listing search with seller emails.
-- This RPC manages pagination, ordering, and email data retrieval (bypassing RLS for admins).

/**
 * RPC: admin_search_listings_v2
 * Bypasses RLS to see auth.users email by using SECURITY DEFINER.
 */
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
  -- 1. Security Check: Verify admin status
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id AND (
      raw_user_meta_data->>'is_admin' = 'true' OR 
      raw_user_meta_data->>'role' = 'admin'
    )
  ) THEN
    -- Fallback: check profiles table role column
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = v_admin_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Admin privileges required' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_offset := (p_page - 1) * p_items_per_page;
  
  -- Map UI status to DB status
  -- UI 'active' -> DB 'available'
  v_status_db := CASE 
    WHEN p_status = 'active' THEN 'available'
    ELSE p_status
  END;

  -- 2. Count total matches for pagination
  SELECT COUNT(*) INTO v_total_count
  FROM public.items i
  WHERE (p_status = 'all' OR i.status = v_status_db)
    AND (NOT p_sp_eligible OR i.accepts_swap_points = true)
    AND (p_query = '' OR i.title ILIKE '%' || p_query || '%');

  -- 3. Fetch paginated data with details
  SELECT jsonb_build_object(
    'listings', COALESCE(jsonb_agg(t), '[]'::jsonb),
    'total_count', v_total_count
  ) INTO v_results
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
      jsonb_build_object(
        'name', COALESCE(p.name, 'Unknown'),
        'email', au.email
      ) as seller,
      (SELECT COUNT(*)::INTEGER FROM public.items WHERE seller_id = i.seller_id AND status = 'available') as seller_items_count,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('url', img.url, 'thumbnail_url', img.thumbnail_url)), '[]'::jsonb)
        FROM public.item_images img
        WHERE img.item_id = i.id
      ) as images
    FROM public.items i
    LEFT JOIN public.profiles p ON i.seller_id = p.user_id
    LEFT JOIN auth.users au ON i.seller_id = au.id
    WHERE (p_status = 'all' OR i.status = v_status_db)
      AND (NOT p_sp_eligible OR i.accepts_swap_points = true)
      AND (p_query = '' OR i.title ILIKE '%' || p_query || '%')
    ORDER BY i.created_at DESC
    LIMIT p_items_per_page
    OFFSET v_offset
  ) t;

  RETURN v_results;
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION admin_search_listings_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION admin_search_listings_v2 TO anon;
