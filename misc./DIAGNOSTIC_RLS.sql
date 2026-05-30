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
FROM pg_tables
WHERE tablename = 'admin_config';

-- Check current values and categories
SELECT key, value, category, updated_at FROM admin_config WHERE key LIKE 'referral%';

-- Check for triggers that might be reverting changes
SELECT trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'admin_config';
