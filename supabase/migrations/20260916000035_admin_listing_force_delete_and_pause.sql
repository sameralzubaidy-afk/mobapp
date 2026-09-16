-- File: supabase/migrations/042_admin_listing_force_delete_and_pause.sql
-- MODULE-04 LISTING-V2-006: Admin tools for listing management
-- Implements force-delete and pause with audit logging

-- TABLE: admin_listing_actions (audit trail for admin actions)
CREATE TABLE IF NOT EXISTS admin_listing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('force_delete', 'pause', 'unpause')),
  listing_id UUID NOT NULL REFERENCES items(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEX for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_listing_actions_listing_id ON admin_listing_actions(listing_id);
CREATE INDEX IF NOT EXISTS idx_admin_listing_actions_admin_id ON admin_listing_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_listing_actions_created_at ON admin_listing_actions(created_at);

-- RLS: Only admins can insert, anyone authenticated can view their own actions
ALTER TABLE admin_listing_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage listing actions" ON admin_listing_actions
  FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true'));

-- =====================================================
-- RPC FUNCTION: admin_force_delete_listing
-- =====================================================
-- Deletes a listing by setting status to 'deleted'
-- Logs action to audit table
-- Only callable by admins (enforced via SECURITY DEFINER)

CREATE OR REPLACE FUNCTION admin_force_delete_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status (check user metadata)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can force delete listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status before deletion
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- If already deleted, skip update but still log
  IF v_old_status != 'deleted' THEN
    -- Force delete by setting status to deleted
    UPDATE items
    SET 
      status = 'deleted',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'force_delete', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'force_delete',
    'old_status', v_old_status,
    'new_status', 'deleted',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC FUNCTION: admin_pause_listing
-- =====================================================
-- Pauses a listing by setting status to 'paused'
-- Logs action to audit table
-- Can be unpaused later

CREATE OR REPLACE FUNCTION admin_pause_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can pause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Pause listing if not already paused/deleted
  IF v_old_status NOT IN ('paused', 'deleted') THEN
    UPDATE items
    SET 
      status = 'paused',
      updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'pause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'pause',
    'old_status', v_old_status,
    'new_status', 'paused',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC FUNCTION: admin_unpause_listing
-- =====================================================
-- Unpauses a listing by setting status back to 'active'

CREATE OR REPLACE FUNCTION admin_unpause_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_old_status VARCHAR;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_admin_id 
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only admins can unpause listings' USING ERRCODE = '42501';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status FROM items WHERE id = p_listing_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '22000';
  END IF;

  -- Unpause listing if paused
  IF v_old_status = 'paused' THEN
    UPDATE items
    SET 
      status = 'active',
      last_edited_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Log admin action
  INSERT INTO admin_listing_actions (admin_id, action_type, listing_id, reason)
  VALUES (v_admin_id, 'unpause', p_listing_id, p_reason);

  v_result := jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'action', 'unpause',
    'old_status', v_old_status,
    'new_status', 'active',
    'timestamp', NOW()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$;

-- =====================================================
-- VIEW: listing_admin_analytics
-- =====================================================
-- Analytics for admin dashboard

CREATE OR REPLACE VIEW listing_admin_analytics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'available') as active_listings,
  COUNT(*) FILTER (WHERE status = 'deleted') as deleted_listings,
  COUNT(*) FILTER (WHERE status = 'pending') as paused_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true) as sp_eligible_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true AND status = 'available') as active_sp_listings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE accepts_swap_points = true) / NULLIF(COUNT(*), 0), 2) as sp_adoption_rate,
  AVG(CAST(price AS DECIMAL)) as avg_listing_price,
  MIN(price) as min_listing_price,
  MAX(price) as max_listing_price,
  COUNT(DISTINCT seller_id) as total_sellers,
  COUNT(DISTINCT DATE(created_at)) as days_active
FROM items
WHERE created_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- Verification: Run these queries to confirm setup
-- =====================================================

/*
-- Check table exists
SELECT tablename FROM pg_tables WHERE tablename = 'admin_listing_actions';

-- Check RPC functions exist
SELECT proname FROM pg_proc WHERE proname IN ('admin_force_delete_listing', 'admin_pause_listing', 'admin_unpause_listing');

-- Check view exists
SELECT viewname FROM pg_views WHERE viewname = 'listing_admin_analytics';
*/
