-- Migration 100: Require re-approval when seller edits an approved listing
-- Mode: Idempotent rerunnable migration
-- Purpose:
--   If a seller edits a listing that is currently `available`, the listing must return to `pending`
--   and require admin re-approval.
--
-- Common failure modes:
-- - Ambiguous columns inside triggers: always qualify table columns when selecting from joins.
-- - Seller edits accidentally forced to pending on system/admin updates: guarded by auth.uid() = OLD.seller_id.

-- BLOCK 1 — Schema (trigger function)
CREATE OR REPLACE FUNCTION public.fn_items_require_reapproval_on_seller_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only enforce for authenticated seller updates
  IF auth.uid() IS NULL OR auth.uid() <> OLD.seller_id THEN
    RETURN NEW;
  END IF;

  -- Only when the listing is currently approved/visible
  IF OLD.status <> 'available' THEN
    RETURN NEW;
  END IF;

  -- If seller is explicitly changing status away from available (e.g., pausing/deleting), do not override.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;

  -- If any listing content changes, require re-approval.
  IF (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.category_id IS DISTINCT FROM OLD.category_id
    OR NEW.condition IS DISTINCT FROM OLD.condition
    OR NEW.accepts_swap_points IS DISTINCT FROM OLD.accepts_swap_points
  ) THEN
    NEW.status := 'pending';

    -- Clear approval metadata so admin UI reflects re-approval requirement.
    -- These columns are introduced by the listing approval workflow.
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_item_images_require_reapproval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  -- Only the authenticated seller can trigger re-approval.
  -- If auth.uid() is NULL (service job / admin task), do nothing.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- If the listing is currently visible, any image change requires re-approval.
  UPDATE public.items i
  SET
    status = 'pending',
    approved_at = NULL,
    approved_by = NULL,
    updated_at = NOW()
  WHERE i.id = v_item_id
    AND i.seller_id = auth.uid()
    AND i.status = 'available';

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- BLOCK 2 — Security + Performance (trigger)
DROP TRIGGER IF EXISTS tr_items_require_reapproval_on_seller_edit ON public.items;
CREATE TRIGGER tr_items_require_reapproval_on_seller_edit
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_items_require_reapproval_on_seller_edit();

DROP TRIGGER IF EXISTS tr_item_images_require_reapproval ON public.item_images;
CREATE TRIGGER tr_item_images_require_reapproval
  AFTER INSERT OR UPDATE OR DELETE ON public.item_images
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_item_images_require_reapproval();

-- Verification (manual):
-- 1) Create + approve a listing so it becomes available.
-- 2) As the seller, update the title/price.
-- 3) Expected: items.status becomes 'pending' and approved_at/approved_by become NULL.
--
-- SELECT id, status, approved_at, approved_by, title, price, updated_at
-- FROM public.items
-- WHERE id = '<LISTING_ID>'::uuid;
