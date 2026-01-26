-- File: supabase/migrations/098_items_enforce_pending_for_starter_pack.sql
-- MODULE-04 LISTING-V2-006: Server-side enforcement for approval workflow
-- Mode: Idempotent rerunnable migration
-- Purpose:
--   Ensure any newly created listing that is Starter Pack eligible is created in 'pending'
--   status (so the Admin Approve button and notifications work even if a client hardcodes
--   status='available').

-- =============================================================================
-- 1) BEFORE INSERT trigger to enforce pending status
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_items_enforce_pending_for_starter_pack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_eligible BOOLEAN;
BEGIN
  -- Only apply to listings that accept swap points.
  -- This avoids forcing approval for cash-only listings.
  IF COALESCE(NEW.accepts_swap_points, FALSE) = TRUE THEN
    SELECT public.is_eligible_for_starter_pack(NEW.seller_id) INTO v_is_eligible;

    IF COALESCE(v_is_eligible, FALSE) = TRUE THEN
      NEW.status := 'pending';
      NEW.eligible_for_starter_pack := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_items_enforce_pending_for_starter_pack ON public.items;
CREATE TRIGGER tr_items_enforce_pending_for_starter_pack
  BEFORE INSERT
  ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_items_enforce_pending_for_starter_pack();

-- =============================================================================
-- Verification (run manually)
-- =============================================================================
/*
-- Confirm trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'tr_items_enforce_pending_for_starter_pack';

-- Create a listing for an eligible seller with accepts_swap_points=true and status='available'
-- Expected: row is inserted with status='pending' and eligible_for_starter_pack=true
*/
