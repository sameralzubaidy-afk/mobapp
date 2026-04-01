-- =====================================================
-- FILE: supabase/migrations/20260330000001_safety_008_request_edits_status.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-008 (Admin Review Workflow - Request Edits)
-- SQL-0 MODE: Mode B (idempotent rerunnable migration)
-- =====================================================

-- BLOCK 1 - Schema
-- 1) Extend items.status check constraint to include needs_edits
ALTER TABLE public.items
DROP CONSTRAINT IF EXISTS items_status_check;

ALTER TABLE public.items
ADD CONSTRAINT items_status_check
CHECK (
  status IN (
    'draft',
    'available',
    'pending',
    'sold',
    'deleted',
    'paused',
    'flagged',
    'rejected',
    'needs_edits'
  )
);

-- 2) Recreate status notification trigger function for flagged/rejected/needs_edits
CREATE OR REPLACE FUNCTION public.notify_seller_item_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_notification_type TEXT;
BEGIN
  IF NEW.status IN ('flagged', 'rejected', 'needs_edits')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    IF NEW.status = 'flagged' AND NEW.flagged_at IS NULL THEN
      NEW.flagged_at := NOW();
    END IF;

    IF NEW.status = 'rejected' AND NEW.rejected_at IS NULL THEN
      NEW.rejected_at := NOW();
    END IF;

    IF NEW.status = 'needs_edits' THEN
      NEW.rejected_at := NULL;
    END IF;

    IF NEW.status = 'flagged' THEN
      v_notification_title := 'Item Under Review';
      v_notification_body := 'Your listing "' || NEW.title || '" is under safety review.';
      v_notification_type := 'item_flagged';
    ELSIF NEW.status = 'rejected' THEN
      v_notification_title := 'Item Rejected';
      v_notification_body := 'Your listing "' || NEW.title || '" has been rejected.';
      IF NEW.rejection_reason IS NOT NULL THEN
        v_notification_body := v_notification_body || ' Reason: ' || NEW.rejection_reason;
      END IF;
      v_notification_type := 'item_rejected';
    ELSE
      v_notification_title := 'Edits Requested';
      v_notification_body := 'Please update your listing "' || NEW.title || '" and resubmit for review.';
      IF NEW.rejection_reason IS NOT NULL THEN
        v_notification_body := v_notification_body || ' Note: ' || NEW.rejection_reason;
      END IF;
      v_notification_type := 'item_needs_edits';
    END IF;

    PERFORM public.create_notification(
      NEW.seller_id,
      v_notification_type,
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'item_id', NEW.id,
        'item_title', NEW.title,
        'status', NEW.status,
        'reason', COALESCE(NEW.rejection_reason, '')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Ensure trigger points to latest function definition
DROP TRIGGER IF EXISTS on_item_status_change_notify_seller ON public.items;

CREATE TRIGGER on_item_status_change_notify_seller
BEFORE UPDATE ON public.items
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.notify_seller_item_status_change();

-- 4) Verification query for columns after schema changes
SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'items'
  AND c.column_name IN ('status', 'flagged_at', 'rejected_at', 'rejection_reason', 'appeal_count')
ORDER BY c.column_name;

-- BLOCK 2 - Security + Performance
-- 1) Verify RLS still enabled on items table
SELECT p.tablename, p.rowsecurity
FROM pg_tables p
WHERE p.schemaname = 'public'
  AND p.tablename = 'items';

-- 2) Verify policies still present
SELECT pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check
FROM pg_policies pol
WHERE pol.schemaname = 'public'
  AND pol.tablename = 'items'
ORDER BY pol.policyname;

-- 3) Verify status check includes needs_edits
SELECT con.conname, pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
WHERE con.conrelid = 'public.items'::regclass
  AND con.conname = 'items_status_check';

-- 4) Verify function and trigger
SELECT p.proname
FROM pg_proc p
WHERE p.proname = 'notify_seller_item_status_change';

SELECT t.trigger_name, t.event_manipulation, t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_schema = 'public'
  AND t.trigger_name = 'on_item_status_change_notify_seller';

-- 5) RPC/function verification call sample (BP-10 requirement)
-- SELECT public.create_notification(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'item_needs_edits',
--   'Edits Requested',
--   'Sample notification',
--   '{}'::jsonb
-- );

-- Common failure modes:
-- 1) Constraint conflicts during rerun: ensure DROP CONSTRAINT runs before ADD CONSTRAINT.
-- 2) Missing create_notification function: confirm migration 175_referral_notifications_v2.sql applied.
-- 3) Permission issues in trigger execution: SECURITY DEFINER with search_path=public is required.
