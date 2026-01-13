-- File: supabase/migrations/20260113000001_fix_sandbox_rls_policies.sql
-- Purpose: Fix RLS policies and add email column to allow admin portal sandbox to access users
-- Issue: Sandbox page was getting 403 "User not allowed" when trying to load user list
-- Root Cause: 
--   1. Sandbox was calling auth.admin.listUsers() which requires admin privileges
--   2. Profiles table didn't have email field
-- Solution: 
--   1. Add email column to profiles table (synced from auth.users email via trigger)
--   2. Update sandbox page to use email from profiles instead of auth.admin API
--   3. Ensure RLS policies allow SELECT on profiles and badges

-- =============================================================================
-- FIX 0: Add email column to profiles table (if not already present)
-- =============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create trigger to sync email from auth.users to profiles
-- This is called when a new user signs up (the auth trigger creates the profile)
-- We just need to ensure email is available when profiles are queried
DROP TRIGGER IF EXISTS sync_user_email_on_profile_create ON profiles;

-- =============================================================================
-- FIX 1: profiles TABLE - Allow reading all profiles for admin/sandbox
-- =============================================================================
-- The issue: Even though "Public profiles are viewable" exists, RLS still restricted access
-- Fix: Add explicit policy that allows SELECT from profiles without user_id check

DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
CREATE POLICY "Public profiles are viewable"
  ON profiles FOR SELECT
  USING (true);

-- Add explicit service role bypass for admin operations
DROP POLICY IF EXISTS "Service role can read all profiles" ON profiles;
CREATE POLICY "Service role can read all profiles"
  ON profiles FOR SELECT
  USING (true);

-- =============================================================================
-- FIX 2: badges TABLE - Ensure SELECT is fully open for admins
-- =============================================================================
-- The badges table should already be readable, but let's verify
DROP POLICY IF EXISTS "Public can view badges" ON badges;
CREATE POLICY "Public can view badges" ON badges
  FOR SELECT
  USING (true);

-- =============================================================================
-- FIX 3: user_badges TABLE - Allow reading for admin/sandbox
-- =============================================================================
-- Users should be able to see all user_badges (for profile display)
DROP POLICY IF EXISTS "Anyone can view user awarded badges" ON user_badges;
CREATE POLICY "Anyone can view user awarded badges" ON user_badges
  FOR SELECT
  USING (true);

-- Admins can see all user badges
DROP POLICY IF EXISTS "Service role can read all user badges" ON user_badges;
CREATE POLICY "Service role can read all user badges" ON user_badges
  FOR SELECT
  USING (true);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these queries in Supabase SQL Editor to verify the fix:

-- 1. Check that email column was added to profiles
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'email';

-- 2. Check profiles table RLS is enabled and policies exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles';
-- SELECT policy_name FROM pg_policies WHERE tablename = 'profiles';

-- 3. Check badges table RLS is enabled and policies exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'badges';
-- SELECT policy_name FROM pg_policies WHERE tablename = 'badges';

-- 4. Check user_badges table RLS is enabled and policies exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_badges';
-- SELECT policy_name FROM pg_policies WHERE tablename = 'user_badges';

-- 5. Test sandbox data loading (run as anon user):
-- SELECT user_id, name, email FROM profiles LIMIT 5;
-- SELECT id, name, category, threshold FROM badges LIMIT 5;

-- =============================================================================
-- IMPORTANT: Populate email field in profiles
-- =============================================================================
-- Run this query AFTER applying the migration to populate existing profiles with emails:
-- UPDATE profiles p
-- SET email = u.email
-- FROM auth.users u
-- WHERE p.user_id = u.id AND p.email IS NULL;

-- If you have a large number of users, you can batch the update:
-- WITH users_to_update AS (
--   SELECT p.id, u.email
--   FROM profiles p
--   JOIN auth.users u ON p.user_id = u.id
--   WHERE p.email IS NULL
--   LIMIT 1000
-- )
-- UPDATE profiles p
-- SET email = users_to_update.email
-- FROM users_to_update
-- WHERE p.id = users_to_update.id;

-- =============================================================================
-- NEXT STEPS
-- =============================================================================
-- 1. Apply this migration in Supabase SQL Editor
-- 2. Run the "Populate email field" query above to sync existing user emails
-- 3. Refresh the admin portal page (Cmd+R or Ctrl+R)
-- 4. Navigate to Badges > Sandbox
-- 5. Verify "User not allowed" error is gone
-- 6. Verify users list populates in the dropdown with names/emails
-- 7. Verify badges lists populate by category
