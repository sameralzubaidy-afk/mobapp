-- ================================================================
-- FIX: Add Admin View and Update Policies for Items Table
-- ================================================================
-- Problem: Admin portal cannot see or update deleted items due to RLS
-- Solution: Create helper function + policies that allow admins to access all items
-- ================================================================

-- Step 1: Create helper function to check admin status
-- Uses SECURITY DEFINER so anon key can call it
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'is_admin' = 'true'
  );
END;
$$;

-- Step 2: Drop ALL existing policies on items table
DROP POLICY IF EXISTS "Anyone can view available items" ON items;
DROP POLICY IF EXISTS "Public can view available items" ON items;
DROP POLICY IF EXISTS "Sellers can view own items" ON items;
DROP POLICY IF EXISTS "Admins can view all items" ON items;
DROP POLICY IF EXISTS "Users can update own items" ON items;
DROP POLICY IF EXISTS "Users can delete own items" ON items;
DROP POLICY IF EXISTS "Admins can update items" ON items;
DROP POLICY IF EXISTS "Admins can delete items" ON items;
DROP POLICY IF EXISTS "Sellers can update own items" ON items;
DROP POLICY IF EXISTS "Sellers can delete own items" ON items;

-- Step 3: Create SELECT policies

-- Public users can view available items
CREATE POLICY "Public can view available items" ON items
  FOR SELECT USING (status = 'available');

-- Sellers can view their own items (including drafts, deleted, etc.)
CREATE POLICY "Sellers can view own items" ON items
  FOR SELECT USING (seller_id = auth.uid());

-- Admins can view ALL items (including deleted)
CREATE POLICY "Admins can view all items" ON items
  FOR SELECT USING (is_admin());

-- Step 4: Create UPDATE policies (needed for delete function to work)

CREATE POLICY "Sellers can update own items" ON items
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (is_admin());

-- Step 5: Create DELETE policies

CREATE POLICY "Sellers can delete own items" ON items
  FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (is_admin());

-- Step 5: Fix seller names (populate missing names from auth.users.email)
UPDATE profiles p
SET name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.name IS NULL OR p.name = '' OR p.name = 'Unknown');

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Test 1: Verify policies exist
-- SELECT policyname, permissive FROM pg_policies WHERE tablename = 'items' AND schemaname = 'public' ORDER BY policyname;

-- Test 2: After applying fix, admin should be able to query:
-- SELECT COUNT(*) as deleted_count FROM items WHERE status = 'deleted';
-- Expected: Should return the count of deleted items (likely 1)

-- Test 3: Search for deleted item:
-- SELECT id, title, status, created_at FROM items WHERE status = 'deleted' LIMIT 5;
-- Expected: Should return the deleted item

