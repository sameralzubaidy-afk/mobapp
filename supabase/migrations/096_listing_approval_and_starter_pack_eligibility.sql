-- File: supabase/migrations/096_listing_approval_and_starter_pack_eligibility.sql
-- MODULE-04 LISTING-V2-006: Listing Approval & Starter Pack Eligibility Tracking
-- Mode: Idempotent rerunnable migration
-- Purpose: 
--   1. Add approval workflow for listings
--   2. Track starter pack eligibility per listing
--   3. Create admin approval RPC function
--   4. Create admin notification system

-- =============================================================================
-- 1. ALTER ITEMS TABLE FOR APPROVAL WORKFLOW
-- =============================================================================

-- Add approval fields if not exist
ALTER TABLE items 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'available', 'sold', 'deleted', 'paused')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add starter pack eligibility tracking
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS eligible_for_starter_pack BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS starter_pack_claimed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS starter_pack_claimed_at TIMESTAMPTZ;

-- Create indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_eligible_starter_pack ON items(eligible_for_starter_pack) WHERE eligible_for_starter_pack = TRUE AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_items_approved_at ON items(approved_at DESC);

-- =============================================================================
-- 2. CREATE ADMIN NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('listing_pending_approval', 'listing_starter_pack_eligible', 'listing_approved', 'listing_deleted')),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can only see their own notifications
DROP POLICY IF EXISTS "Admins can view own notifications" ON admin_notifications;
CREATE POLICY "Admins can view own notifications"
  ON admin_notifications FOR SELECT
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update own notifications" ON admin_notifications;
CREATE POLICY "Admins can update own notifications"
  ON admin_notifications FOR UPDATE
  USING (admin_id = auth.uid());

-- =============================================================================
-- 2b. CREATE ADMIN ACTIVITY LOG (AUDIT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action_type ON admin_activity_log(action_type);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin activity log" ON admin_activity_log;
CREATE POLICY "Admins can view admin activity log"
  ON admin_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
        AND rbac.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert own admin activity log" ON admin_activity_log;
CREATE POLICY "Admins can insert own admin activity log"
  ON admin_activity_log FOR INSERT
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
        AND rbac.role = 'admin'
    )
  );

-- =============================================================================
-- 3. RPC FUNCTION: DETERMINE STARTER PACK ELIGIBILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION is_eligible_for_starter_pack(p_seller_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if seller is an active Kids Club+ subscriber
  -- AND they haven't received their starter pack yet.
  -- Use LEFT JOIN so we still get a result even if wallet doesn't exist yet.
  RETURN EXISTS (
    SELECT 1 FROM subscriptions s
    LEFT JOIN sp_wallets w ON w.user_id = s.user_id
    WHERE s.user_id = p_seller_id
      AND s.status IN ('active', 'trial', 'trialing', 'grace')
      AND (w.starter_pack_issued IS NULL OR w.starter_pack_issued = FALSE)
  );
END;
$$;

-- =============================================================================
-- 4. RPC FUNCTION: ADMIN APPROVE LISTING
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_approve_listing(
  p_listing_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing RECORD;
  v_seller_id UUID;
  v_eligible_for_sp BOOLEAN;
  v_is_admin BOOLEAN;
  v_starter_pack_result JSONB;
  v_starter_pack_awarded BOOLEAN := FALSE;
BEGIN
  -- 1. Verify admin role
  SELECT EXISTS (
    SELECT 1 FROM role_based_access_control
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can approve listings'
    );
  END IF;

  -- 2. Get listing details
  SELECT * INTO v_listing FROM items WHERE id = p_listing_id;
  
  IF v_listing IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing not found'
    );
  END IF;

  v_seller_id := v_listing.seller_id;

  -- 3. Check if already approved
  IF v_listing.status = 'available' AND v_listing.approved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing is already approved'
    );
  END IF;

  -- 4. Check starter pack eligibility
  SELECT is_eligible_for_starter_pack(v_seller_id) INTO v_eligible_for_sp;

  -- 5. Approve listing
  UPDATE items
  SET 
    status = 'available',
    approved_at = NOW(),
    approved_by = p_admin_user_id,
    eligible_for_starter_pack = v_eligible_for_sp,
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- 5b. Award Starter Pack SP when eligible (do not block approval if awarding fails)
  IF v_eligible_for_sp AND COALESCE(v_listing.accepts_swap_points, FALSE) THEN
    SELECT issue_starter_pack(v_seller_id, p_listing_id) INTO v_starter_pack_result;
    IF COALESCE((v_starter_pack_result->>'success')::BOOLEAN, FALSE) THEN
      v_starter_pack_awarded := TRUE;
      UPDATE items
      SET
        starter_pack_claimed = TRUE,
        starter_pack_claimed_at = NOW(),
        updated_at = NOW()
      WHERE id = p_listing_id;
    END IF;
  END IF;

  -- 6. Log admin action
  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (
    p_admin_user_id,
    'approve_listing',
    'item',
    p_listing_id,
    jsonb_build_object(
      'seller_id', v_seller_id,
      'eligible_for_starter_pack', v_eligible_for_sp,
      'listing_title', v_listing.title
    ),
    p_reason
  );

  -- 7. Create admin notification if starter pack eligible
  IF v_eligible_for_sp THEN
    INSERT INTO admin_notifications (admin_id, notification_type, entity_type, entity_id, title, message)
    SELECT 
      au.id,
      'listing_starter_pack_eligible',
      'item',
      p_listing_id,
      'Listing Eligible for Starter Pack',
      FORMAT('Listing "%s" by seller %s is eligible for Starter Pack reward', v_listing.title, v_seller_id::TEXT)
    FROM role_based_access_control rbac
    JOIN auth.users au ON au.id = rbac.user_id
    WHERE rbac.role = 'admin'
      AND rbac.user_id != p_admin_user_id; -- Don't notify the approver

  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'status', 'available',
    'eligible_for_starter_pack', v_eligible_for_sp,
    'starter_pack_awarded', v_starter_pack_awarded,
    'approved_at', NOW(),
    'message', CASE 
      WHEN v_eligible_for_sp AND v_starter_pack_awarded THEN 'Listing approved! Starter Pack awarded to seller.'
      WHEN v_eligible_for_sp THEN 'Listing approved! Seller is eligible for Starter Pack reward.'
      ELSE 'Listing approved (seller not eligible for Starter Pack - check subscription status)'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =============================================================================
-- 5. RPC FUNCTION: MARK STARTER PACK AS CLAIMED
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_starter_pack_claimed(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE items
  SET 
    starter_pack_claimed = TRUE,
    starter_pack_claimed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_listing_id;
END;
$$;

-- =============================================================================
-- 6. RPC FUNCTION: GET ADMIN NOTIFICATIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_admin_notifications(
  p_admin_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_unread_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  notification_type TEXT,
  entity_id UUID,
  title TEXT,
  message TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    an.id,
    an.notification_type,
    an.entity_id,
    an.title,
    an.message,
    an.is_read,
    an.created_at
  FROM admin_notifications an
  WHERE an.admin_id = p_admin_id
    AND (NOT p_unread_only OR an.is_read = FALSE)
  ORDER BY an.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- 7. RPC FUNCTION: MARK NOTIFICATION AS READ
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_notifications
  SET 
    is_read = TRUE,
    read_at = NOW(),
    updated_at = NOW()
  WHERE id = p_notification_id
    AND admin_id = auth.uid();
END;
$$;

-- =============================================================================
-- 8. GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION admin_approve_listing(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_eligible_for_starter_pack(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_starter_pack_claimed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_notifications(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_as_read(UUID) TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

/*
-- Query 1: Check items table has approval columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'items' 
  AND column_name IN ('status', 'approved_at', 'approved_by', 'eligible_for_starter_pack', 'starter_pack_claimed');
-- Expected: 5 rows

-- Query 2: Check admin_notifications table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_notifications';
-- Expected: admin_notifications

-- Query 3: Check RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'admin_approve_listing',
  'is_eligible_for_starter_pack',
  'mark_starter_pack_claimed',
  'get_admin_notifications',
  'mark_notification_as_read'
);
-- Expected: 5 functions

-- Query 4: Test approve listing RPC (replace UUIDs)
SELECT admin_approve_listing(
  'LISTING_ID'::UUID,
  'ADMIN_USER_ID'::UUID,
  'Manual approval for testing'
);
-- Expected: {"success": true, ...}

-- Query 5: Check notifications created
SELECT * FROM admin_notifications WHERE entity_id = 'LISTING_ID'::UUID;
-- Expected: notification record if seller eligible for SP
*/
