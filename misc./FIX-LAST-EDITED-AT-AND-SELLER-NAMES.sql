-- ================================================================
-- FIX BOTH ISSUES: last_edited_at + Seller Names
-- ================================================================

-- ISSUE 1: RPC functions try to update 'last_edited_at' which doesn't exist
-- Actual column is 'updated_at'
-- Solution: Recreate RPC functions with correct column name

-- Step 1: Drop old functions that reference wrong column
DROP FUNCTION IF EXISTS admin_force_delete_listing(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_pause_listing(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_unpause_listing(UUID, TEXT);

-- Step 2: Recreate admin_force_delete_listing with CORRECT column (updated_at, not last_edited_at)
CREATE FUNCTION admin_force_delete_listing(
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

-- Step 3: Recreate admin_pause_listing with CORRECT column (updated_at, not last_edited_at)
CREATE FUNCTION admin_pause_listing(
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

-- Step 4: Recreate admin_unpause_listing with CORRECT column
CREATE FUNCTION admin_unpause_listing(
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

  -- Unpause listing if currently paused
  IF v_old_status = 'paused' THEN
    UPDATE items
    SET 
      status = 'available',
      updated_at = NOW()
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
    'new_status', 'available',
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

-- ================================================================
-- ISSUE 2: Seller names showing "Unknown"
-- Solution: Populate profiles.name from profiles table (which has the name)
-- ================================================================

-- Step 5: Populate any NULL or empty names in profiles
UPDATE profiles
SET name = COALESCE(
  NULLIF(TRIM(name), ''),  -- Keep if not null/empty
  split_part(
    (SELECT email FROM auth.users WHERE auth.users.id = profiles.user_id),
    '@',
    1
  )  -- Fallback to email prefix
)
WHERE name IS NULL OR name = '' OR name = 'Unknown';

-- Step 6: Verify the update worked
SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as profiles_with_names,
       COUNT(CASE WHEN name = 'Unknown' THEN 1 END) as still_unknown
FROM profiles;

-- Step 7: Verify RPC functions exist and are correct
SELECT proname FROM pg_proc 
WHERE proname IN ('admin_force_delete_listing', 'admin_pause_listing', 'admin_unpause_listing')
ORDER BY proname;

-- Step 8: Verify items table has correct columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'items' AND column_name IN ('updated_at', 'last_edited_at');
-- Expected: Should only return 'updated_at'
