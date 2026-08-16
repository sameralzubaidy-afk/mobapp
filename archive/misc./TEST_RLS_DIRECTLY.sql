-- Test if anon key can update admin_config directly
-- Run this in Supabase SQL Editor to verify RLS policies allow updates

-- First check current RLS policies
SELECT policyname, cmd, permissive, qual 
FROM pg_policies 
WHERE tablename = 'admin_config' 
ORDER BY policyname;

-- Now try to update directly as anon user (this simulates what the API does)
-- This will fail if RLS policies don't allow it
UPDATE admin_config 
SET value = '12.00', updated_at = NOW() 
WHERE key = 'subscription_price_monthly';

-- Verify the update
SELECT key, value, updated_at 
FROM admin_config 
WHERE key = 'subscription_price_monthly';
