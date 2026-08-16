-- SQL to run in Supabase dashboard to fix admin_config RLS policies
-- This allows the anon key to update admin_config when using the admin API endpoint

-- Check current table structure
\d admin_config

-- Update RLS: Allow UPDATE through admin API (we verify admin secret server-side)
DROP POLICY IF EXISTS "Admin config: allow update via API" ON admin_config;

CREATE POLICY "Admin config: allow update via API"
  ON admin_config FOR UPDATE
  USING (TRUE)  -- Allow all for now, server-side auth checks will validate
  WITH CHECK (TRUE);

-- Drop old restrictive policies if they exist  
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
DROP POLICY IF EXISTS "Admins can update config" ON admin_config;

-- Allow public SELECT (config values are not sensitive)
DROP POLICY IF EXISTS "Admin config: public select" ON admin_config;
CREATE POLICY "Admin config: public select"
  ON admin_config FOR SELECT
  USING (TRUE);
