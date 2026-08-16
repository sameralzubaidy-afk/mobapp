-- ================================================================
-- COMPLETE FIX: All 3 Issues
-- ================================================================
-- Issue 1: Seller name showing "Unknown"
-- Issue 2: Deleted items not showing in search (0 results)
-- Issue 3: Delete button not actually deleting items
-- ================================================================

-- ================================================================
-- PART 1: DIAGNOSTIC QUERIES (Run these first to understand the problem)
-- ================================================================

-- Check 1: Are you logged in as an admin?
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'is_admin' as is_admin_flag,
  CASE 
    WHEN raw_user_meta_data->>'is_admin' = 'true' THEN '✅ YES - You are admin'
    ELSE '❌ NO - You are NOT admin'
  END as admin_status
FROM auth.users 
WHERE id = auth.uid();

-- Check 2: Do profiles have full_name populated?
SELECT 
  id,
  full_name,
  CASE 
    WHEN full_name IS NULL OR full_name = '' THEN '❌ Missing'
    ELSE '✅ Has name'
  END as name_status
FROM profiles 
LIMIT 5;

-- Check 3: How many deleted items exist?
SELECT 
  COUNT(*) as total_deleted_items,
  array_agg(id) as deleted_item_ids
FROM items 
WHERE status = 'deleted';

-- Check 4: What RLS policies exist on items table?
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'items' 
ORDER BY policyname;

-- Check 5: Does the admin_force_delete_listing function exist?
SELECT 
  proname as function_name,
  prosrc as function_code_snippet
FROM pg_proc 
WHERE proname = 'admin_force_delete_listing';

-- Check 6: Does admin_listing_actions table exist?
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status
FROM information_schema.tables 
WHERE table_name = 'admin_listing_actions';

-- ================================================================
-- PART 2: FIX ALL ISSUES
-- ================================================================

-- ================================================================
-- FIX ISSUE #2 & #3: RLS Policies (Deleted items + Delete function)
-- ================================================================

-- Drop ALL existing SELECT policies on items
DROP POLICY IF EXISTS "Anyone can view available items" ON items;
DROP POLICY IF EXISTS "Public can view available items" ON items;
DROP POLICY IF EXISTS "Sellers can view own items" ON items;
DROP POLICY IF EXISTS "Admins can view all items" ON items;

-- Drop existing UPDATE/DELETE policies that might block admin actions
DROP POLICY IF EXISTS "Users can update own items" ON items;
DROP POLICY IF EXISTS "Users can delete own items" ON items;
DROP POLICY IF EXISTS "Admins can update items" ON items;
DROP POLICY IF EXISTS "Admins can delete items" ON items;

-- Create new SELECT policies
CREATE POLICY "Public can view available items" ON items
  FOR SELECT USING (status = 'available');

CREATE POLICY "Sellers can view own items" ON items
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Admins can view all items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Create UPDATE policy for admins to modify items (needed for delete function)
CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Create DELETE policy for admins (if hard delete is ever needed)
CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- Keep existing seller policies for UPDATE/DELETE
CREATE POLICY "Sellers can update own items" ON items
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own items" ON items
  FOR DELETE USING (auth.uid() = seller_id);

-- ================================================================
-- FIX ISSUE #1: Populate missing seller names
-- ================================================================

-- Check if profiles are missing full_name
-- If they have email but no full_name, extract name from email
UPDATE profiles
SET full_name = COALESCE(
  full_name,
  split_part(email, '@', 1)  -- Use email username as fallback
)
WHERE full_name IS NULL OR full_name = '';

-- ================================================================
-- VERIFICATION QUERIES (Run after applying fixes)
-- ================================================================

-- Verify 1: Check RLS policies were created
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN policyname LIKE '%Admin%' THEN '✅ Admin policy'
    WHEN policyname LIKE '%Public%' THEN '✅ Public policy'
    WHEN policyname LIKE '%Seller%' THEN '✅ Seller policy'
    ELSE '❓ Other policy'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'items' 
ORDER BY policyname;

-- Verify 2: Test deleted items query as admin
SELECT 
  COUNT(*) as deleted_items_visible,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Can see deleted items'
    ELSE '❌ Still cannot see deleted items'
  END as status
FROM items 
WHERE status = 'deleted';

-- Verify 3: Check if profiles have names
SELECT 
  COUNT(*) as profiles_with_names,
  COUNT(*) FILTER (WHERE full_name IS NULL OR full_name = '') as profiles_missing_names
FROM profiles;

-- Verify 4: Test force delete function (replace 'YOUR_ITEM_ID' with real item ID)
-- SELECT admin_force_delete_listing('YOUR_ITEM_ID'::uuid, 'Testing delete function');

-- ================================================================
-- EXPECTED RESULTS AFTER FIX
-- ================================================================
/*
After running this SQL:

Issue 1 (Seller names):
  ✅ All profiles will have full_name populated
  ✅ Search results will show real names instead of "Unknown"

Issue 2 (Deleted items in search):
  ✅ Admin can see deleted items
  ✅ Search will show "Results (1)" for deleted status
  ✅ Analytics and search numbers will match

Issue 3 (Delete button):
  ✅ Delete button will actually update status to 'deleted'
  ✅ Success message will reflect actual deletion
  ✅ Item will appear in "Deleted" filter after deletion

IMPORTANT: After running this SQL:
1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Test all 3 issues
3. If still not working, check the diagnostic queries at the top
*/
