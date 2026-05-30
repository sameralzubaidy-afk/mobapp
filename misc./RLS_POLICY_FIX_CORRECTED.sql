-- Corrected SQL to update existing RLS policies on admin_config
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies first (use CASCADE if needed)
DROP POLICY IF EXISTS "admin_config_select_all" ON admin_config CASCADE;
DROP POLICY IF EXISTS "admin_config_update_all" ON admin_config CASCADE;
DROP POLICY IF EXISTS "Admins can view config" ON admin_config CASCADE;
DROP POLICY IF EXISTS "Admins can update config" ON admin_config CASCADE;
DROP POLICY IF EXISTS "Admin config: allow update via API" ON admin_config CASCADE;
DROP POLICY IF EXISTS "Admin config: public select" ON admin_config CASCADE;

-- Now create the new permissive policies
CREATE POLICY "admin_config_select_all"
  ON admin_config FOR SELECT
  USING (TRUE);

CREATE POLICY "admin_config_update_all"
  ON admin_config FOR UPDATE  
  USING (TRUE)
  WITH CHECK (TRUE);

-- Verify policies were created
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'admin_config' 
ORDER BY policyname;
