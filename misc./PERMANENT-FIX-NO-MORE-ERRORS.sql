-- ================================================================
-- PERMANENT FIX: All 3 Issues - No More Permission Errors
-- ================================================================
-- This creates a secure helper function to check admin status
-- Then uses it in RLS policies so ANON KEY can access
-- ================================================================

-- Step 1: Drop the parameterless version we just created (use existing is_admin(uuid) instead)
DROP FUNCTION IF EXISTS is_admin();

-- Step 2: Note - we'll use the existing is_admin(uuid) function that's already in the system
-- It's already being used by 13+ other tables successfully

-- Step 3: Drop all existing policies on items table
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

-- Step 4: Create SELECT policies
CREATE POLICY "Public can view available items" ON items
  FOR SELECT USING (status = 'available');

CREATE POLICY "Sellers can view own items" ON items
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Admins can view all items" ON items
  FOR SELECT USING (is_admin(auth.uid()));

-- Step 5: Create UPDATE policies (needed for delete function to work)
CREATE POLICY "Sellers can update own items" ON items
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (is_admin(auth.uid()));

-- Step 6: Create DELETE policies
CREATE POLICY "Sellers can delete own items" ON items
  FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (is_admin(auth.uid()));

-- Step 7: Fix seller names - populate from auth.users.email
UPDATE profiles p
SET name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.name IS NULL OR p.name = '' OR p.name = 'Unknown');

-- ================================================================
-- VERIFICATION QUERIES (Run these to verify everything works)
-- ================================================================

-- Verify helper function exists
SELECT proname FROM pg_proc WHERE proname = 'is_admin';

-- Verify policies were created
SELECT policyname FROM pg_policies WHERE tablename = 'items' ORDER BY policyname;

-- Test if you can see deleted items now
SELECT COUNT(*) as deleted_count FROM items WHERE status = 'deleted';

-- Verify profiles have names
SELECT COUNT(*) as with_names FROM profiles WHERE name IS NOT NULL AND name != '';
