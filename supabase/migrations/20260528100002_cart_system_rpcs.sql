-- ============================================================================
-- MODULE-15.2 CART SYSTEM — PR 1 / RPCs
-- Tasks: CART-003 .. CART-010 (cart RPCs + favorites RPCs)
--
-- All RPCs:
--   - SECURITY DEFINER (bypass RLS using auth.uid()) — needed because we read
--     cross-user data (e.g. items.seller_id) for validation.
--   - Return JSONB with { success, data | error: { code, message, details } }.
--   - p_ for params, v_ for variables, table-qualified columns (BP-3).
--
-- Schema adaptations to actual DB:
--   - items.seller_id (NOT user_id), items.price DECIMAL → cents = (price*100)::int
--   - items.accepts_swap_points BOOLEAN → derive payment_preference snapshot
--   - items.status = 'available' (NOT 'active')
--   - profiles.node_id TEXT (NOT active_node_id)
--   - First image from public.item_images (ORDER BY display_order LIMIT 1)
--   - Subscriber check: public.is_active_subscriber(p_user_id)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: snapshot helper (inline LATERAL not extracted; keep functions self-contained)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- CART-003: rpc_cart_add_item
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_add_item(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id            uuid := auth.uid();
  v_buyer_node         text;
  v_item               record;
  v_seller_node        text;
  v_seller_name        text;
  v_first_image        text;
  v_current_cart_id    uuid;
  v_current_seller_id  uuid;
  v_current_seller_name text;
  v_payment_pref       text;
  v_price_cents        integer;
  v_cart_item_id       uuid;
  v_cart_count         integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required')
    );
  END IF;

  -- Load item + seller info
  SELECT i.id, i.seller_id, i.title, i.price, i.accepts_swap_points, i.status
    INTO v_item
  FROM public.items i
  WHERE i.id = p_listing_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','ITEM_NOT_FOUND','message','Listing does not exist')
    );
  END IF;

  IF v_item.status <> 'available' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','ITEM_UNAVAILABLE','message','Listing is not available')
    );
  END IF;

  IF v_item.seller_id = v_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','CANNOT_BUY_OWN_ITEM','message','You cannot add your own listing to cart')
    );
  END IF;

  -- Node match via profiles.node_id (items has no node_id column)
  SELECT p.node_id INTO v_buyer_node FROM public.profiles p WHERE p.user_id = v_user_id;
  SELECT p.node_id, p.name INTO v_seller_node, v_seller_name
    FROM public.profiles p WHERE p.user_id = v_item.seller_id;

  IF v_buyer_node IS NULL OR v_seller_node IS NULL OR v_buyer_node <> v_seller_node THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','NODE_MISMATCH','message','Listing is in a different node')
    );
  END IF;

  -- Already in active cart?
  IF EXISTS (
    SELECT 1 FROM public.cart_items ci
    WHERE ci.user_id = v_user_id
      AND ci.listing_id = p_listing_id
      AND ci.cart_status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code','ALREADY_IN_CART','message','Listing already in your cart')
    );
  END IF;

  -- Different-seller check (R-01 single-seller cart)
  SELECT ci.cart_id, ci.seller_id INTO v_current_cart_id, v_current_seller_id
  FROM public.cart_items ci
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
  LIMIT 1;

  IF v_current_seller_id IS NOT NULL AND v_current_seller_id <> v_item.seller_id THEN
    SELECT p.name INTO v_current_seller_name
      FROM public.profiles p WHERE p.user_id = v_current_seller_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code','DIFFERENT_SELLER',
        'message','Your cart has items from a different seller',
        'details', jsonb_build_object(
          'current_seller_id', v_current_seller_id,
          'current_seller_name', COALESCE(v_current_seller_name,''),
          'new_seller_id', v_item.seller_id,
          'new_seller_name', COALESCE(v_seller_name,'')
        )
      )
    );
  END IF;

  -- Snapshot first image
  SELECT ii.url INTO v_first_image
  FROM public.item_images ii
  WHERE ii.item_id = p_listing_id
  ORDER BY ii.display_order ASC, ii.created_at ASC
  LIMIT 1;

  v_payment_pref := CASE WHEN v_item.accepts_swap_points THEN 'accept_sp' ELSE 'cash_only' END;
  v_price_cents  := (v_item.price * 100)::integer;

  -- Use existing active cart_id or create new
  IF v_current_cart_id IS NULL THEN
    v_current_cart_id := gen_random_uuid();
  END IF;

  INSERT INTO public.cart_items (
    user_id, listing_id, seller_id, bundle_id, cart_id, cart_status,
    item_title, item_price_cents, item_image_url, item_payment_preference
  ) VALUES (
    v_user_id, p_listing_id, v_item.seller_id, v_current_cart_id, v_current_cart_id, 'active',
    v_item.title, v_price_cents, v_first_image, v_payment_pref
  )
  RETURNING id INTO v_cart_item_id;

  SELECT COUNT(*) INTO v_cart_count
  FROM public.cart_items
  WHERE user_id = v_user_id AND cart_status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'cart_item_id', v_cart_item_id,
      'cart_id', v_current_cart_id,
      'cart_item_count', v_cart_count
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-004: rpc_cart_remove_item (idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_remove_item(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_removed integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  DELETE FROM public.cart_items
  WHERE user_id = v_user_id
    AND listing_id = p_listing_id
    AND cart_status = 'active';

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('removed', v_removed));
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-005: rpc_cart_clear (soft delete a cart by cart_id; NULL clears active)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_clear(p_cart_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_cart_id uuid := p_cart_id;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  IF v_target_cart_id IS NULL THEN
    -- Clear the active cart
    DELETE FROM public.cart_items
    WHERE user_id = v_user_id AND cart_status = 'active';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    -- Soft delete a saved cart
    UPDATE public.cart_items
       SET cart_status = 'deleted'
     WHERE user_id = v_user_id
       AND cart_id  = v_target_cart_id
       AND cart_status IN ('active','saved');
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('cleared_items', v_count));
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-006: rpc_cart_get_items
-- Returns active cart + saved carts + per-item live status + max_sp_available.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_get_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_subscriber boolean;
  v_active jsonb;
  v_saved jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  v_is_subscriber := COALESCE(public.is_active_subscriber(v_user_id), false);

  -- Active cart items (with live data)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.added_at DESC), '[]'::jsonb)
    INTO v_active
  FROM (
    SELECT
      ci.id              AS cart_item_id,
      ci.cart_id,
      ci.listing_id,
      ci.seller_id,
      ci.added_at,
      ci.item_title      AS snapshot_title,
      ci.item_price_cents AS snapshot_price_cents,
      ci.item_image_url   AS snapshot_image_url,
      ci.item_payment_preference AS snapshot_payment_preference,
      -- Live item data
      i.title            AS live_title,
      (i.price * 100)::integer AS live_price_cents,
      i.status           AS live_status,
      i.accepts_swap_points AS live_accepts_sp,
      sp.name            AS seller_name,
      -- max_sp_available = subscriber AND seller accepts SP → 50% of price cents
      CASE
        WHEN v_is_subscriber AND i.accepts_swap_points
        THEN ((i.price * 100)::integer / 2)
        ELSE 0
      END AS max_sp_available
    FROM public.cart_items ci
    JOIN public.items i ON i.id = ci.listing_id
    LEFT JOIN public.profiles sp ON sp.user_id = ci.seller_id
    WHERE ci.user_id = v_user_id
      AND ci.cart_status = 'active'
  ) t;

  -- Saved cart summaries
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.last_updated DESC), '[]'::jsonb)
    INTO v_saved
  FROM (
    SELECT
      ci.cart_id,
      -- uuid MIN aggregate is unavailable in some Postgres environments.
      (array_agg(ci.seller_id ORDER BY ci.updated_at DESC NULLS LAST, ci.added_at DESC NULLS LAST))[1]::uuid AS seller_id,
      MAX(sp.name)               AS seller_name,
      COUNT(*)                   AS item_count,
      SUM(ci.item_price_cents)::integer AS total_price_cents,
      MAX(ci.updated_at)         AS last_updated
    FROM public.cart_items ci
    LEFT JOIN public.profiles sp ON sp.user_id = ci.seller_id
    WHERE ci.user_id = v_user_id
      AND ci.cart_status = 'saved'
    GROUP BY ci.cart_id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'active_cart_items', v_active,
      'saved_carts', v_saved,
      'is_subscriber', v_is_subscriber
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-007: rpc_cart_save_current
-- Saves the current active cart for later (RAISES if >= 3 saved carts).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_save_current()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_active_cart_id uuid;
  v_saved_count integer;
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  SELECT ci.cart_id INTO v_active_cart_id
  FROM public.cart_items ci
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active'
  LIMIT 1;

  IF v_active_cart_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','NO_ACTIVE_CART','message','No active cart to save'));
  END IF;

  SELECT COUNT(DISTINCT cart_id) INTO v_saved_count
  FROM public.cart_items
  WHERE user_id = v_user_id AND cart_status = 'saved';

  IF v_saved_count >= 3 THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object(
        'code','SAVED_CART_LIMIT_REACHED',
        'message','You already have 3 saved carts. Delete one to save a new one.',
        'details', jsonb_build_object('saved_count', v_saved_count)
      ));
  END IF;

  UPDATE public.cart_items
     SET cart_status = 'saved'
   WHERE user_id = v_user_id
     AND cart_id  = v_active_cart_id
     AND cart_status = 'active';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('saved_cart_id', v_active_cart_id, 'items_saved', v_updated));
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-008: rpc_cart_switch_to_saved
-- Atomically: save current active cart (if any) → switch named saved cart to active.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_switch_to_saved(p_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_active_cart_id uuid;
  v_target_exists boolean;
  v_saved_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  -- Verify target saved cart belongs to user
  SELECT EXISTS (
    SELECT 1 FROM public.cart_items
    WHERE user_id = v_user_id AND cart_id = p_cart_id AND cart_status = 'saved'
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','SAVED_CART_NOT_FOUND','message','Saved cart not found'));
  END IF;

  -- Save current active cart first (if any) — must respect 3-saved-cart limit
  SELECT cart_id INTO v_active_cart_id
  FROM public.cart_items
  WHERE user_id = v_user_id AND cart_status = 'active'
  LIMIT 1;

  IF v_active_cart_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT cart_id) INTO v_saved_count
    FROM public.cart_items
    WHERE user_id = v_user_id AND cart_status = 'saved';

    -- After moving target to active we'd have v_saved_count-1 saved carts, then
    -- the active one becomes saved → v_saved_count again. Must be <= 3.
    -- The limit is reached only if current saved_count > 3 (impossible) so safe.
    UPDATE public.cart_items SET cart_status = 'saved'
    WHERE user_id = v_user_id AND cart_id = v_active_cart_id AND cart_status = 'active';
  END IF;

  -- Activate the target saved cart
  UPDATE public.cart_items SET cart_status = 'active'
  WHERE user_id = v_user_id AND cart_id = p_cart_id AND cart_status = 'saved';

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('active_cart_id', p_cart_id,
                               'previously_active_cart_id', v_active_cart_id));
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-009: rpc_cart_validate_for_checkout
-- Reads admin_config.cart_settings → min_cart_value_cents.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_cart_validate_for_checkout()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_min_cents integer;
  v_item_count integer;
  v_total_cents integer;
  v_seller_count integer;
  v_unavailable_count integer;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  SELECT COALESCE(ac.value::integer, 0)
    INTO v_min_cents
  FROM public.admin_config ac
  WHERE ac.key = 'cart_min_value_cents' AND ac.is_active = true
  LIMIT 1;
  v_min_cents := COALESCE(v_min_cents, 0);

  SELECT COUNT(*)::integer,
         COALESCE(SUM((i.price * 100)::integer), 0)::integer,
         COUNT(DISTINCT ci.seller_id)::integer,
         COUNT(*) FILTER (WHERE i.status <> 'available')::integer
    INTO v_item_count, v_total_cents, v_seller_count, v_unavailable_count
  FROM public.cart_items ci
  JOIN public.items i ON i.id = ci.listing_id
  WHERE ci.user_id = v_user_id AND ci.cart_status = 'active';

  IF v_item_count = 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','CART_EMPTY','message','Your cart is empty'));
  END IF;

  IF v_seller_count > 1 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','MULTIPLE_SELLERS','message','Cart contains items from multiple sellers'));
  END IF;

  IF v_unavailable_count > 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','UNAVAILABLE_ITEMS','message','One or more items are no longer available',
      'details', jsonb_build_object('count', v_unavailable_count)));
  END IF;

  IF v_total_cents < v_min_cents THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code','MIN_CART_VALUE_NOT_MET',
      'message','Cart total is below the minimum required',
      'details', jsonb_build_object('min_cart_value_cents', v_min_cents,
                                    'cart_total_cents', v_total_cents)));
  END IF;

  RETURN jsonb_build_object(
    'success', jsonb_array_length(v_errors) = 0,
    'data', jsonb_build_object(
      'cart_total_cents', v_total_cents,
      'item_count', v_item_count,
      'seller_count', v_seller_count,
      'min_cart_value_cents', v_min_cents,
      'errors', v_errors
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- CART-010: Favorites RPCs (add / remove / get)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_favorites_add(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists boolean;
  v_fav_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.items i WHERE i.id = p_listing_id)
    INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','ITEM_NOT_FOUND','message','Listing does not exist'));
  END IF;

  -- Insert or reactivate (idempotent)
  INSERT INTO public.favorites (user_id, item_id)
  VALUES (v_user_id, p_listing_id)
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
  v_user_id uuid := auth.uid();
  v_removed integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
  END IF;

  UPDATE public.favorites
     SET deleted_at = NOW()
   WHERE user_id = v_user_id
     AND item_id = p_listing_id
     AND deleted_at IS NULL;
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
  v_user_id uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', jsonb_build_object('code','UNAUTHENTICATED','message','Sign in required'));
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
    WHERE f.user_id = v_user_id
      AND f.deleted_at IS NULL
  ) t;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('favorites', v_rows));
END;
$$;

-- ---------------------------------------------------------------------------
-- GRANTS — allow authenticated users to call all cart/favorite RPCs
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.rpc_cart_add_item(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_remove_item(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_clear(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_get_items()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_save_current()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_switch_to_saved(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cart_validate_for_checkout()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_add(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_remove(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_favorites_get()                   TO authenticated;

-- ============================================================================
-- END OF RPCS
-- ============================================================================
