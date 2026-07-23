-- MODULE-15.2 hotfix: rpc_cart_get_items LEFT JOIN
--
-- Problem: The active cart items query used INNER JOIN on public.items, which
-- silently dropped cart_items rows when the associated listing was missing or
-- had an unexpected state (e.g., deleted_by admin, cascade-deleted between
-- add-to-cart and view-cart). This caused the CartScreen to show "Your cart
-- is empty" even though CartContext reported 1+ items.
--
-- Fix: Switch to LEFT JOIN and COALESCE live fields so cart items always
-- appear. Snapshot columns (snapshot_title, snapshot_price_cents, etc.) were
-- designed specifically for this scenario — they provide fallback data even
-- when the live item is gone.
--
-- Migration mode: B (idempotent — uses CREATE OR REPLACE FUNCTION)

BEGIN;

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

  -- Active cart items (with live data — LEFT JOIN so cart always shows even if
  -- listing was deleted or has unexpected state; snapshot columns provide fallback)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.added_at DESC), '[]'::jsonb)
    INTO v_active
  FROM (
    SELECT
      ci.id                AS cart_item_id,
      ci.cart_id,
      ci.listing_id,
      ci.seller_id,
      ci.added_at,
      ci.item_title        AS snapshot_title,
      ci.item_price_cents  AS snapshot_price_cents,
      ci.item_image_url    AS snapshot_image_url,
      ci.item_payment_preference AS snapshot_payment_preference,
      i.title              AS live_title,
      (i.price * 100)::integer AS live_price_cents,
      COALESCE(i.status, 'unavailable') AS live_status,
      COALESCE(i.accepts_swap_points, false) AS live_accepts_sp,
      sp.name              AS seller_name,
      CASE
        WHEN v_is_subscriber AND (i.accepts_swap_points IS TRUE) THEN ((i.price * 100)::integer / 2)
        ELSE 0
      END AS max_sp_available
    FROM public.cart_items ci
    LEFT JOIN public.items i ON i.id = ci.listing_id
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
      (array_agg(ci.seller_id ORDER BY ci.updated_at DESC NULLS LAST, ci.added_at DESC NULLS LAST))[1]::uuid AS seller_id,
      MAX(sp.name)                 AS seller_name,
      COUNT(*)                     AS item_count,
      SUM(ci.item_price_cents)::integer AS total_price_cents,
      MAX(ci.updated_at)           AS last_updated
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

GRANT EXECUTE ON FUNCTION public.rpc_cart_get_items() TO authenticated;

COMMIT;
