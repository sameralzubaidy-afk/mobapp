-- ================================================================
-- CORRECT FIX: All 3 Issues with RIGHT column names
-- ================================================================

-- Drop all existing policies
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

-- CREATE SELECT POLICIES
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

-- CREATE UPDATE POLICIES (CRITICAL FOR DELETE TO WORK!)
CREATE POLICY "Sellers can update own items" ON items
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can update items" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- CREATE DELETE POLICIES
CREATE POLICY "Sellers can delete own items" ON items
  FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can delete items" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- ================================================================
-- FIX SELLER NAMES
-- ================================================================
-- The profiles table has a "name" column and a "user_id" foreign key
-- to get email, we need to join with auth.users table

-- Option 1: Populate name from email via user_id join
UPDATE profiles p
SET name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.name IS NULL OR p.name = '' OR p.name = 'Unknown');

-- Option 2: If names are already populated, just verify
SELECT COUNT(*) as profiles_with_names FROM profiles WHERE name IS NOT NULL AND name != '';
