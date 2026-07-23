-- ================================================================
-- Migration: 20260720000001_enable_cart_realtime.sql
-- Module: MODULE-15.2 CART-016 — Enable realtime for cart + items
-- Mode: B (Idempotent rerunnable migration)
--
-- Problem: subscribeToCartChanges() in cartService.ts subscribes to
-- postgres_changes on cart_items and items, but neither table is in
-- the supabase_realtime publication. Subscriptions silently do nothing.
--
-- Fix:
--   1) Add cart_items to supabase_realtime publication.
--   2) Add items to supabase_realtime publication (needed for other
--      potential realtime consumers, even if RLS may filter).
--   3) Add a trigger on items.status that updates cart_items.updated_at
--      when item "available" status changes. This bypasses the RLS
--      filtering problem: the buyer's RLS blocks the items-table
--      realtime event when an item becomes unavailable (because the
--      SELECT policy requires status = 'available'), but the
--      cart_items subscription works because the buyer CAN always
--      SELECT their own cart_items.
-- ================================================================

-- ================================================================
-- BLOCK 1 — Add tables to supabase_realtime publication
-- ================================================================

DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication p WHERE p.pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Publication supabase_realtime does not exist';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY['cart_items', 'items']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table_name
        AND c.relkind = 'r'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables ppt
        WHERE ppt.pubname = 'supabase_realtime'
          AND ppt.schemaname = 'public'
          AND ppt.tablename = v_table_name
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
          'public',
          v_table_name
        );
        RAISE NOTICE 'Added %.% to supabase_realtime', 'public', v_table_name;
      ELSE
        RAISE NOTICE '%.% already in supabase_realtime', 'public', v_table_name;
      END IF;
    ELSE
      RAISE NOTICE 'Skipping %.% (table not found)', 'public', v_table_name;
    END IF;
  END LOOP;
END;
$$;

-- ================================================================
-- BLOCK 2 — Trigger: touch cart_items when item status changes
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_touch_cart_on_item_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an item's status changes, update updated_at on cart_items rows
  -- belonging to active carts that contain this item.
  -- This triggers the buyer's realtime subscription on cart_items,
  -- bypassing the RLS filtering that would block a direct items-table event.
  UPDATE public.cart_items
  SET updated_at = NOW()
  WHERE listing_id = NEW.id
    AND cart_status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_cart_on_item_status_change ON public.items;
CREATE TRIGGER tr_touch_cart_on_item_status_change
  AFTER UPDATE OF status ON public.items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_touch_cart_on_item_status_change();

-- ================================================================
-- BLOCK 3 — Verification queries
-- ================================================================

-- 1) Verify cart_items is in realtime publication
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename IN ('cart_items', 'items');

-- 2) Verify trigger exists
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'items' AND trigger_name = 'tr_touch_cart_on_item_status_change';

-- 3) Manual smoke: UPDATE items SET status = 'sold' WHERE id = '<listing-in-cart>';
-- Then check cart_items.updated_at for the affected row changed.
