-- Quick diagnostic: Check admin_config RLS policies in Supabase Dashboard
-- Copy this entire query and run it in SQL Editor

-- Show all policies on admin_config table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'admin_config'
ORDER BY policyname;

-- Also check if RLS is enabled on the table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_class
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE tablename = 'admin_config';
