-- =====================================================
-- FILE: supabase/migrations/301_items_flagged_rejected_statuses.sql
-- MODULE: MODULE-13-SAFETY-COMPLIANCE
-- TASK: SAFETY-P003 - Extend items.status + Add Seller Notification
-- DESCRIPTION:
--   1. Extend items.status CHECK constraint to include 'flagged', 'rejected'
--   2. Add audit columns: flagged_at, rejected_at, rejection_reason, appeal_count
--   3. Create trigger to notify seller when item is flagged/rejected
--   4. Update RLS policies: flagged/rejected items visible to seller + admins only
-- =====================================================

-- =============================================================================
-- STEP 1: ADD NEW COLUMNS TO ITEMS TABLE
-- =============================================================================

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS appeal_count INTEGER DEFAULT 0;

-- =============================================================================
-- STEP 2: UPDATE STATUS CHECK CONSTRAINT TO INCLUDE NEW STATUSES
-- =============================================================================

-- Drop existing constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;

-- Recreate with new statuses
ALTER TABLE items 
ADD CONSTRAINT items_status_check 
CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted', 'paused', 'flagged', 'rejected'));

-- =============================================================================
-- STEP 3: CREATE INDEXES FOR NEW COLUMNS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_items_flagged_at ON items(flagged_at) WHERE status = 'flagged';
CREATE INDEX IF NOT EXISTS idx_items_rejected_at ON items(rejected_at) WHERE status = 'rejected';

-- =============================================================================
-- STEP 4: UPDATE RLS POLICIES
-- =============================================================================

-- Drop existing SELECT policies to replace them (supports reruns)
DROP POLICY IF EXISTS "Anyone can view available items" ON items;
DROP POLICY IF EXISTS "Items visibility based on status" ON items;

-- New SELECT policy: available items are public, flagged/rejected only visible to seller + admins
CREATE POLICY "Items visibility based on status" ON items
  FOR SELECT USING (
    CASE 
      WHEN status = 'available' THEN TRUE
      WHEN status IN ('flagged', 'rejected') THEN (
        auth.uid() = seller_id 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() 
          AND role = 'admin'
        )
      )
      ELSE auth.uid() = seller_id
    END
  );

-- =============================================================================
-- STEP 5: CREATE NOTIFICATION TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_seller_item_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_notification_type TEXT;
BEGIN
  -- Only trigger for status changes to 'flagged' or 'rejected'
  IF NEW.status IN ('flagged', 'rejected') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Update audit timestamps
    IF NEW.status = 'flagged' AND NEW.flagged_at IS NULL THEN
      NEW.flagged_at := NOW();
    END IF;
    
    IF NEW.status = 'rejected' AND NEW.rejected_at IS NULL THEN
      NEW.rejected_at := NOW();
    END IF;
    
    -- Set notification content based on status
    IF NEW.status = 'flagged' THEN
      v_notification_title := 'Item Under Review 🔍';
      v_notification_body := 'Your listing "' || NEW.title || '" is under safety review.';
      v_notification_type := 'item_flagged';
    ELSIF NEW.status = 'rejected' THEN
      v_notification_title := 'Item Rejected ❌';
      v_notification_body := 'Your listing "' || NEW.title || '" has been rejected.';
      IF NEW.rejection_reason IS NOT NULL THEN
        v_notification_body := v_notification_body || ' Reason: ' || NEW.rejection_reason;
      END IF;
      v_notification_type := 'item_rejected';
    END IF;
    
    -- Insert notification using existing helper function
    PERFORM create_notification(
      NEW.seller_id,
      v_notification_type,
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'item_id', NEW.id,
        'item_title', NEW.title,
        'rejection_reason', NEW.rejection_reason
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: CREATE TRIGGER
-- =============================================================================

DROP TRIGGER IF EXISTS on_item_status_change_notify_seller ON items;

CREATE TRIGGER on_item_status_change_notify_seller
  BEFORE UPDATE ON items
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION notify_seller_item_status_change();

-- =============================================================================
-- VERIFICATION QUERIES (Run these after migration)
-- =============================================================================

/*
-- 1. Verify new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name IN ('flagged_at', 'rejected_at', 'rejection_reason', 'appeal_count');

-- 2. Verify CHECK constraint includes new statuses
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'items'::regclass 
AND conname = 'items_status_check';

-- 3. Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_item_status_change_notify_seller';

-- 4. Verify RLS policy updated
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'items' 
AND policyname = 'Items visibility based on status';

-- 5. Test notification trigger (as authenticated user)
UPDATE items SET status = 'flagged' WHERE id = '<test_item_id>';
SELECT * FROM user_notifications WHERE data->>'item_id' = '<test_item_id>';
*/

-- =============================================================================
-- ACCEPTANCE CRITERIA
-- =============================================================================

-- ✓ items.status CHECK constraint includes 'flagged', 'rejected'
-- ✓ New audit columns added: flagged_at, rejected_at, rejection_reason, appeal_count
-- ✓ Indexes created for performance
-- ✓ RLS updated: flagged/rejected items visible only to seller + admins
-- ✓ Trigger creates notification when item is flagged/rejected
-- ✓ Notification includes rejection reason (if provided)
-- ✓ Trigger sets flagged_at/rejected_at timestamps automatically
