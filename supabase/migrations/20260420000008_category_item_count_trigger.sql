-- FILE: supabase/migrations/20260420000008_category_item_count_trigger.sql
-- ADMIN-V3-001: Create update_category_item_count() trigger + backfill
-- Module: MODULE-12-ADMIN-V3-CATEGORIES
-- Dependencies: categories, items

-- ===========================================================================
-- STEP 1: Create Trigger Function
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.update_category_item_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_category_id UUID;
  v_new_category_id UUID;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Handle INSERT operation
  IF (TG_OP = 'INSERT') THEN
    -- Only count items with status 'available'
    IF NEW.category_id IS NOT NULL AND NEW.status = 'available' THEN
      UPDATE public.categories
      SET item_count = item_count + 1
      WHERE id = NEW.category_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE operation
  IF (TG_OP = 'UPDATE') THEN
    v_old_category_id := OLD.category_id;
    v_new_category_id := NEW.category_id;
    v_old_status := OLD.status;
    v_new_status := NEW.status;

    -- Case 1: Category changed (and status is 'available')
    IF v_old_category_id IS DISTINCT FROM v_new_category_id THEN
      -- Decrement old category if old status was 'available'
      IF v_old_category_id IS NOT NULL AND v_old_status = 'available' THEN
        UPDATE public.categories
        SET item_count = GREATEST(0, item_count - 1)
        WHERE id = v_old_category_id;
      END IF;

      -- Increment new category if new status is 'available'
      IF v_new_category_id IS NOT NULL AND v_new_status = 'available' THEN
        UPDATE public.categories
        SET item_count = item_count + 1
        WHERE id = v_new_category_id;
      END IF;
    
    -- Case 2: Category same but status changed
    ELSIF v_old_status IS DISTINCT FROM v_new_status AND v_new_category_id IS NOT NULL THEN
      -- Status changed from 'available' to something else
      IF v_old_status = 'available' AND v_new_status != 'available' THEN
        UPDATE public.categories
        SET item_count = GREATEST(0, item_count - 1)
        WHERE id = v_new_category_id;
      END IF;

      -- Status changed to 'available' from something else
      IF v_old_status != 'available' AND v_new_status = 'available' THEN
        UPDATE public.categories
        SET item_count = item_count + 1
        WHERE id = v_new_category_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE operation
  IF (TG_OP = 'DELETE') THEN
    -- Decrement count if item was 'available'
    IF OLD.category_id IS NOT NULL AND OLD.status = 'available' THEN
      UPDATE public.categories
      SET item_count = GREATEST(0, item_count - 1)
      WHERE id = OLD.category_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.update_category_item_count() IS 
  'Trigger function to maintain categories.item_count based on items INSERT/UPDATE/DELETE';

-- ===========================================================================
-- STEP 2: Create Trigger
-- ===========================================================================

DROP TRIGGER IF EXISTS update_category_item_count_trigger ON public.items;

CREATE TRIGGER update_category_item_count_trigger
  AFTER INSERT OR UPDATE OF category_id, status OR DELETE
  ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_category_item_count();

-- ===========================================================================
-- STEP 3: Backfill Initial Counts
-- ===========================================================================

-- Calculate and update item_count for all categories based on current items
UPDATE public.categories c
SET item_count = COALESCE(
  (
    SELECT COUNT(*)
    FROM public.items i
    WHERE i.category_id = c.id
      AND i.status = 'available'
  ),
  0
);

-- ===========================================================================
-- VERIFICATION QUERIES (Commented)
-- ===========================================================================

/*
-- Verify function exists
SELECT proname, prosrc, prosecdef
FROM pg_proc
WHERE proname = 'update_category_item_count';

-- Verify trigger exists on items table
SELECT tgname, tgrelid::regclass, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.items'::regclass
  AND tgname = 'update_category_item_count_trigger';

-- Verify item_count is correctly backfilled
SELECT 
  c.name,
  c.item_count AS current_count,
  (
    SELECT COUNT(*)
    FROM public.items i
    WHERE i.category_id = c.id
      AND i.status = 'available'
  ) AS actual_count
FROM public.categories c
ORDER BY c.name;

-- Test trigger behavior (INSERT)
/*
-- This test requires a valid seller_id, node_id, etc.
-- Replace with actual test values
INSERT INTO public.items (
  title, description, price, seller_id, node_id, category_id, status
) VALUES (
  'Test Item for Trigger',
  'Testing category count trigger',
  10.00,
  (SELECT id FROM auth.users LIMIT 1),  -- Replace with actual seller
  (SELECT id FROM public.geographic_nodes LIMIT 1),  -- Replace with actual node
  (SELECT id FROM public.categories WHERE name = 'Toys' LIMIT 1),
  'available'
);

-- Verify count increased
SELECT name, item_count FROM public.categories WHERE name = 'Toys';

-- Clean up test
DELETE FROM public.items WHERE title = 'Test Item for Trigger';
*/

-- Test trigger behavior (UPDATE status)
/*
UPDATE public.items
SET status = 'sold'
WHERE id = (SELECT id FROM public.items WHERE status = 'available' LIMIT 1);

-- Verify count decreased (check relevant category)
SELECT name, item_count FROM public.categories;

-- Restore test item status
UPDATE public.items
SET status = 'available'
WHERE title = 'Test Item';
*/
*/
