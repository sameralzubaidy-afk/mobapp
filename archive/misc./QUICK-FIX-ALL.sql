-- ================================================================
-- STEP 1: RUN THIS FIRST - Diagnostic Check
-- ================================================================
-- Copy and run this to see what's wrong

SELECT 
  'Admin Status' as check_type,
  CASE 
    WHEN raw_user_meta_data->>'is_admin' = 'true' THEN '✅ You are admin'
    ELSE '❌ You are NOT admin - THIS IS THE PROBLEM'
  END as result
FROM auth.users 
WHERE id = auth.uid()
UNION ALL
SELECT 
  'Deleted Items Count' as check_type,
  CONCAT('Found ', COUNT(*), ' deleted items') as result
FROM items 
WHERE status = 'deleted';

-- ================================================================
-- STEP 2: RUN THIS - Complete Fix
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

-- Create SELECT policies
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

-- Create UPDATE policies (needed for delete function to work)
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

-- Create DELETE policies
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

-- Fix seller names - join with auth.users to get email
UPDATE profiles p
SET name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.name IS NULL OR p.name = '' OR p.name = 'Unknown');

-- ================================================================
-- STEP 3: RUN THIS - Verify Fix Worked
-- ================================================================

SELECT 
  'RLS Policies Created' as check_type,
  COUNT(*)::text || ' policies exist' as result
FROM pg_policies 
WHERE tablename = 'items'
UNION ALL
SELECT 
  'Can See Deleted Items' as check_type,
  COUNT(*)::text || ' deleted items visible' as result
FROM items 
WHERE status = 'deleted'
UNION ALL
SELECT 
  'Profiles With Names' as check_type,
  COUNT(*)::text || ' profiles have full_name' as result
FROM profiles 
WHERE full_name IS NOT NULL AND full_name != '';
