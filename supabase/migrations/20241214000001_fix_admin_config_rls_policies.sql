-- Migration: Add UPDATE/INSERT policies for admin_config table
-- This allows authenticated users to update admin configuration values

-- Drop existing policies if needed (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can update admin config" ON admin_config;
DROP POLICY IF EXISTS "Authenticated users can insert admin config" ON admin_config;

-- Allow authenticated users to UPDATE admin_config
CREATE POLICY "Authenticated users can update admin config"
ON admin_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to INSERT admin_config (for future config items)
CREATE POLICY "Authenticated users can insert admin config"
ON admin_config
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'admin_config'
ORDER BY policyname;
