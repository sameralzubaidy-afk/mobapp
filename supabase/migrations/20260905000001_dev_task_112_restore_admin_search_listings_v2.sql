-- ================================================================
-- Migration: 20260905000001_dev_task_112_restore_admin_search_listings_v2.sql
-- Module: MODULE-04 Listings / Admin tooling (DEV-TASK-112, item 1)
-- Description:
--   Restore the 7-arg admin_search_listings_v2 signature (p_query, p_status,
--   p_sp_eligible, p_page, p_items_per_page, p_category, p_seller_email).
--
--   DEV-TASK-97 (20260903000001) silently redefined this function back to its
--   legacy 5-arg form while migrating the inline admin check to the canonical
--   admin_has_role() guard. The admin UI still calls the 7-arg form, so every
--   category/seller-filtered search silently fell back to client-side filtering
--   of only the current <=20-row page AND reported that page's row count as the
--   total (QA Task 31T evidence: Category "Toys" showed "Results (9)" vs the
--   real 1,078; a seller filter showed 20 vs the real 274).
--
--   This migration keeps the DT-97 admin_has_role() SECURITY DEFINER guard and
--   field shape, and adds back p_category / p_seller_email plus their predicates
--   on BOTH the COUNT(*) and the page SELECT (the COUNT query therefore gains
--   the categories + auth.users LEFT JOINs those predicates require).
-- Mode: A (one-time migration — applied once against staging/prod; safe because
--        the 5-arg signature is dropped first per BP-12).
-- ================================================================

-- ----------------------------------------------------------------------------
-- BLOCK 1 — Drop the legacy 5-arg form (BP-12: DROP before changing signature)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_search_listings_v2(text, text, boolean, integer, integer);

-- ----------------------------------------------------------------------------
-- BLOCK 2 — Restore the 7-arg function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_listings_v2(
  p_query TEXT DEFAULT ''::text,
  p_status TEXT DEFAULT 'all'::text,
  p_sp_eligible BOOLEAN DEFAULT false,
  p_page INTEGER DEFAULT 1,
  p_items_per_page INTEGER DEFAULT 20,
  p_category TEXT DEFAULT 'all'::text,
  p_seller_email TEXT DEFAULT ''::text
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

  -- Verify admin status (canonical admin_has_role: rbac-first superset).
  IF v_admin_id IS NULL OR NOT public.admin_has_role(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required' USING ERRCODE = '42501';
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
        -- Category fields (from 20260425000002)
        i.category_id,
        c.name                                                             AS category_name,
        i.requested_category_name,
        (i.requested_category_name IS NOT NULL
          AND btrim(i.requested_category_name) <> '')                     AS is_custom_category,
        -- Item detail fields (new in 20260425000003)
        i.description,
        i.condition,
        i.brand,
        i.color,
        i.age_group,
        i.gender,
        -- Seller info
        jsonb_build_object(
          'name',  COALESCE(p.name, 'Unknown'),
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
      LEFT JOIN public.categories c        ON c.id = i.category_id
      LEFT JOIN public.profiles p          ON i.seller_id = p.user_id
      LEFT JOIN auth.users au              ON i.seller_id = au.id
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

-- ----------------------------------------------------------------------------
-- BLOCK 3 — Re-grant EXECUTE on the restored 7-arg signature.
--     The DT-61 event trigger (dt61_guard_revoke_fn_public) revokes
--     PUBLIC/anon/authenticated on every public-schema CREATE [OR REPLACE]
--     FUNCTION above, so these explicit grants are REQUIRED (BP-79 / BP-78).
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_search_listings_v2(text, text, boolean, integer, integer, text, text) TO anon, authenticated, service_role;

-- ================================================================
-- VERIFICATION QUERIES (run after apply)
-- ================================================================

-- 1) Function signature restored (expect 7 args: text,text,boolean,integer,integer,text,text)
-- SELECT p.oid::regprocedure AS signature
--   FROM pg_proc p
--  WHERE p.proname = 'admin_search_listings_v2';

-- 2) Grants present (BP-78: audit via live aclexplode, not greps)
-- SELECT p.proname,
--        coalesce(array_agg(DISTINCT g.grantee::text ORDER BY 1), '{}'::text[]) AS grantees
--   FROM pg_proc p
--   CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) g
--  WHERE p.proname = 'admin_search_listings_v2'
--  GROUP BY p.proname;

-- 3) Category filter count must equal the direct DB count (e.g. Toys ~1078 on staging)
-- SELECT admin_search_listings_v2('', 'active', false, 1, 20, 'Toys', '') -> 'total_count';
-- SELECT count(*) FROM items i
--   LEFT JOIN categories c ON c.id = i.category_id
--  WHERE i.status = 'available' AND lower(c.name) = 'toys';

-- 4) Seller email filter count must equal the direct DB count (e.g. test-seller ~274)
-- SELECT admin_search_listings_v2('', 'all', false, 1, 20, 'all', 'test-seller@') -> 'total_count';
-- SELECT count(*) FROM items i
--   LEFT JOIN auth.users au ON au.id = i.seller_id
--  WHERE COALESCE(au.email, '') ILIKE '%test-seller@%';

-- 5) Uncategorized filter
-- SELECT admin_search_listings_v2('', 'all', false, 1, 20, 'uncategorized', '') -> 'total_count';
