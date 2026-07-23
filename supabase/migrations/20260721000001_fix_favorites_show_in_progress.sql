-- Migration: 20260721000001_fix_favorites_show_in_progress.sql
-- Module: MODULE-15.2 Cart System
-- Description: Fix rpc_favorites_get to show items with in_progress trades
--              as unavailable on the Favorites screen (TC-M15).
--
-- The RPC previously returned i.status directly from the items table.
-- When a trade is in_progress, the item's status is still 'available' —
-- it only changes to 'sold' on completion. This caused favorited items
-- with active trades to appear as available.
--
-- Fix: Compute a derived status that checks both the item's own status
-- AND whether any in_progress trade exists on the item.
-- ======================================================================

-- ======================================================================
-- 1. Recreate rpc_favorites_get with derived status
-- ======================================================================
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
      -- Derived status: if an in_progress trade exists on this item,
      -- report it as unavailable (triggers "No longer available" UI).
      -- The item's own status stays 'available' until the trade completes,
      -- but the item is effectively unavailable while a trade is active.
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.trades t
          WHERE t.listing_id = i.id AND t.status = 'in_progress'
        ) THEN 'in_progress_trade'
        ELSE i.status
      END AS status,
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

-- ======================================================================
-- 2. Re-grant execute permission
-- ======================================================================
GRANT EXECUTE ON FUNCTION public.rpc_favorites_get() TO authenticated;

-- ======================================================================
-- Verification Queries
-- ======================================================================
-- 1. Confirm function exists
-- SELECT proname FROM pg_proc WHERE proname = 'rpc_favorites_get';
--
-- 2. Test with an item that has an in_progress trade
-- (replace with actual listing_id that has an in_progress trade)
-- SELECT public.rpc_favorites_get();
--
-- 3. Verify status shows 'in_progress_trade' for items with active trades
-- SELECT i.id, i.title, i.status, t.status as trade_status
-- FROM public.items i
-- JOIN public.trades t ON t.item_id = i.id
-- WHERE t.status = 'in_progress' AND i.status = 'available'
-- LIMIT 5;
