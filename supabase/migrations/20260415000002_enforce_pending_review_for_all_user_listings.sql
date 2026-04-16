-- Migration: 20260415000002_enforce_pending_review_for_all_user_listings.sql
-- Purpose: Enforce admin review for every user-created listing.
-- Mode B: Idempotent rerunnable migration
--
-- Change summary:
-- 1) Force all authenticated user inserts on public.items to status='pending'.
-- 2) Tighten insert RLS so authenticated users can only insert their own items in pending status.
-- 3) Keep service_role bypass intact for admin/system workflows.
--
-- Common failure modes:
-- - Legacy permissive insert policy ('items_insert_authenticated' WITH CHECK true) bypasses business rules.
-- - Client-side status hardcoding ('available') skips moderation if server-side enforcement is missing.

-- BLOCK 1 — Schema + Trigger Enforcement

-- Align default for new rows.
ALTER TABLE public.items
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.fn_items_enforce_pending_for_starter_pack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_eligible BOOLEAN;
BEGIN
  -- All user-created listings must start as pending for admin review.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.seller_id THEN
    NEW.status := 'pending';
  END IF;

  -- Preserve starter-pack eligibility tagging for downstream workflows.
  IF COALESCE(NEW.accepts_swap_points, FALSE) = TRUE THEN
    BEGIN
      SELECT public.is_eligible_for_starter_pack(NEW.seller_id)
      INTO v_is_eligible;
    EXCEPTION WHEN OTHERS THEN
      v_is_eligible := FALSE;
    END;

    IF COALESCE(v_is_eligible, FALSE) = TRUE THEN
      NEW.eligible_for_starter_pack := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_items_enforce_pending_for_starter_pack ON public.items;
CREATE TRIGGER tr_items_enforce_pending_for_starter_pack
BEFORE INSERT ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.fn_items_enforce_pending_for_starter_pack();

-- BLOCK 2 — Security + Performance

-- Remove permissive insert policies that allow bypassing moderation status.
DROP POLICY IF EXISTS "items_insert_authenticated" ON public.items;
DROP POLICY IF EXISTS "Users can insert own items" ON public.items;

-- Recreate strict insert policy for authenticated users.
CREATE POLICY "items_insert_pending_review" ON public.items
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = seller_id
  AND status = 'pending'
);

-- Verification Queries
-- 1) Confirm default status is pending.
-- SELECT column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'status';

-- 2) Confirm trigger exists.
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'tr_items_enforce_pending_for_starter_pack';

-- 3) Confirm insert policy requires pending status.
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'items' AND policyname = 'items_insert_pending_review';
