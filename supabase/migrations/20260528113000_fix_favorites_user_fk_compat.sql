-- MODULE-15.2 hotfix: Favorites FK compatibility
-- Fixes: insert/update on table "favorites" violates foreign key constraint "fk_favorites_user"
-- Mode: B (idempotent rerunnable migration)

BEGIN;

-- Resolve the value that favorites.user_id expects based on the current FK target.
-- SECURITY DEFINER is required so this helper can inspect pg_catalog consistently.
CREATE OR REPLACE FUNCTION public.rpc_favorites_resolve_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_fk_schema_name text;
  v_fk_table_name text;
  v_fk_column_name text;
  v_resolved_user_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT fk_ns.nspname, fk_tbl.relname, fk_col.attname
    INTO v_fk_schema_name, v_fk_table_name, v_fk_column_name
  FROM pg_constraint con
  JOIN pg_class src_tbl ON src_tbl.oid = con.conrelid
  JOIN pg_namespace src_ns ON src_ns.oid = src_tbl.relnamespace
  JOIN pg_class fk_tbl ON fk_tbl.oid = con.confrelid
  JOIN pg_namespace fk_ns ON fk_ns.oid = fk_tbl.relnamespace
  JOIN pg_attribute fk_col ON fk_col.attrelid = con.confrelid
                          AND fk_col.attnum = con.confkey[1]
  WHERE src_ns.nspname = 'public'
    AND src_tbl.relname = 'favorites'
    AND con.contype = 'f'
    AND con.conkey[1] = (
      SELECT src_col.attnum
      FROM pg_attribute src_col
      WHERE src_col.attrelid = con.conrelid
        AND src_col.attname = 'user_id'
        AND NOT src_col.attisdropped
      LIMIT 1
    )
  LIMIT 1;

  -- Legacy schema: favorites.user_id -> profiles.id
  IF v_fk_schema_name = 'public' AND v_fk_table_name = 'profiles' AND v_fk_column_name = 'id' THEN
    SELECT p.id
      INTO v_resolved_user_id
    FROM public.profiles p
    WHERE p.user_id = v_auth_user_id
    LIMIT 1;

    RETURN v_resolved_user_id;
  END IF;

  -- Default schema: favorites.user_id -> auth.users.id (or profiles.user_id)
  RETURN v_auth_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_favorites_add(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_favorites_user_id uuid;
  v_exists boolean;
  v_fav_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  v_favorites_user_id := public.rpc_favorites_resolve_user_id();
  IF v_favorites_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object(
        'code','PROFILE_NOT_FOUND',
        'message','Profile row is required before adding favorites',
        'details', jsonb_build_object('user_id', v_auth_user_id)
      )
    );
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.items i WHERE i.id = p_listing_id)
    INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','ITEM_NOT_FOUND','message','Listing does not exist'));
  END IF;

  INSERT INTO public.favorites (user_id, item_id)
  VALUES (v_favorites_user_id, p_listing_id)
  ON CONFLICT (user_id, item_id)
    DO UPDATE SET deleted_at = NULL
  RETURNING id INTO v_fav_id;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('favorite_id', v_fav_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_favorites_remove(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_favorites_user_id uuid;
  v_removed integer;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  v_favorites_user_id := public.rpc_favorites_resolve_user_id();
  IF v_favorites_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object(
        'code','PROFILE_NOT_FOUND',
        'message','Profile row is required before removing favorites',
        'details', jsonb_build_object('user_id', v_auth_user_id)
      )
    );
  END IF;

  UPDATE public.favorites f
     SET deleted_at = NOW()
   WHERE f.user_id = v_favorites_user_id
     AND f.item_id = p_listing_id
     AND f.deleted_at IS NULL;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('removed', v_removed));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_favorites_get()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_favorites_user_id uuid;
  v_rows jsonb;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  v_favorites_user_id := public.rpc_favorites_resolve_user_id();
  IF v_favorites_user_id IS NULL THEN
    RETURN jsonb_build_object('success', true,
      'data', jsonb_build_object('favorites', '[]'::jsonb));
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      f.id            AS favorite_id,
      f.item_id       AS listing_id,
      f.created_at,
      i.title,
      (i.price * 100)::integer AS price_cents,
      i.status,
      i.accepts_swap_points,
      i.seller_id,
      sp.name         AS seller_name,
      (
        SELECT ii.url FROM public.item_images ii
        WHERE ii.item_id = i.id
        ORDER BY ii.display_order ASC, ii.created_at ASC LIMIT 1
      ) AS image_url
    FROM public.favorites f
    JOIN public.items i ON i.id = f.item_id
    LEFT JOIN public.profiles sp ON sp.user_id = i.seller_id
    WHERE f.user_id = v_favorites_user_id
      AND f.deleted_at IS NULL
  ) t;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('favorites', v_rows));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_favorites_resolve_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_add(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_remove(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_get() TO authenticated;

COMMIT;
