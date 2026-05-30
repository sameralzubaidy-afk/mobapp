-- ================================================================
-- FIX: Seller Names + Delete/Pause Issues
-- ================================================================

-- ISSUE 1: Seller names showing as "Unknown"
-- Root cause: profiles.name is NULL or empty in database
-- Solution: Populate from auth.users.email and show name in junction query

-- Step 1: First, check what names actually exist
SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as with_names,
       COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as missing_names
FROM profiles;

-- Step 2: Populate any missing names from auth.users email
UPDATE profiles p
SET name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.name IS NULL OR p.name = '');

-- Step 3: Verify update worked
SELECT COUNT(*) as profiles_with_names FROM profiles 
WHERE name IS NOT NULL AND name != '';

-- ================================================================
-- ISSUE 2: Delete/Pause buttons not working
-- Root cause: Component checks 'if (error)' but RPC returns success JSON
-- Solution: Component needs to check response data and verify admin flag
-- ================================================================

-- First verify admin flag is set for your account
SELECT id, email, raw_user_meta_data->>'is_admin' as is_admin
FROM auth.users 
WHERE email = 'samer@younestai.com' OR email LIKE '%@%' LIMIT 5;

-- Step 1: Verify the RPC functions exist and are callable
SELECT proname, prokind FROM pg_proc 
WHERE proname IN ('admin_force_delete_listing', 'admin_pause_listing')
ORDER BY proname;

-- Step 2: Check if admin_listing_actions table exists (needed for audit logging)
SELECT tablename FROM pg_tables 
WHERE tablename = 'admin_listing_actions' 
AND schemaname = 'public';

-- Step 3: Test if you can see items table with new policies
SELECT id, title, status FROM items LIMIT 3;

-- Step 4: Check for any items that are paused or pending status
SELECT DISTINCT status FROM items ORDER BY status;

-- ================================================================
-- Manual Test: Try to delete/pause an item
-- ================================================================
-- Uncomment to test (replace with real item_id):
-- SELECT admin_force_delete_listing('00000000-0000-0000-0000-000000000000'::uuid, 'Test delete');
-- SELECT admin_pause_listing('00000000-0000-0000-0000-000000000000'::uuid, 'Test pause');
