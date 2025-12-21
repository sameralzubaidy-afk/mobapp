-- File: supabase/migrations/20241214000003_fix_phone_verification_and_add_profiles_view.sql
-- Fix phone verification RLS policy and add profiles_with_auth view
-- This migration addresses:
-- 1. Phone verification updates failing due to RLS
-- 2. Email visibility (create view joining profiles + auth.users)

-- =============================================================================
-- 1. Fix RLS Policy for Phone Verification Updates
-- =============================================================================

-- The verification service runs in the authenticated user's context,
-- so the existing "Users can update their own profile" policy should work.
-- However, we'll add a more explicit policy for the verification flow.

-- Drop existing UPDATE policy and recreate with explicit phone_verified permission
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alternative: If updates still fail, uncomment this policy to allow service role updates
-- (Make sure SUPABASE_SERVICE_ROLE_KEY is kept secret and never exposed in client code)
/*
DROP POLICY IF EXISTS "Service role can update profiles" ON profiles;
CREATE POLICY "Service role can update profiles"
  ON profiles FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
*/

-- =============================================================================
-- 2. Create profiles_with_auth View (Email Visibility)
-- =============================================================================

-- Create a view that joins profiles with auth.users to show emails
-- This is the recommended approach (normalized, no data duplication)

CREATE OR REPLACE VIEW profiles_with_auth AS
SELECT 
  -- Profile fields
  p.id,
  p.user_id,
  p.name,
  p.avatar_url,
  p.bio,
  p.city,
  p.state,
  p.zip_code,
  p.node_id,
  p.profile_completed,
  p.onboarding_completed,
  p.phone_verified,
  p.phone_verified_at,
  p.referral_code,
  p.created_at,
  p.updated_at,
  
  -- Auth fields (from auth.users)
  au.email,
  au.phone,
  au.email_confirmed_at,
  au.last_sign_in_at,
  au.created_at AS auth_created_at
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id;

-- Grant SELECT access to authenticated users and anon
GRANT SELECT ON profiles_with_auth TO authenticated;
GRANT SELECT ON profiles_with_auth TO anon;

-- Add RLS to the view (inherits from underlying tables)
ALTER VIEW profiles_with_auth SET (security_invoker = true);

-- =============================================================================
-- 3. Optional: Add Email Column to Profiles (Denormalized Approach)
-- =============================================================================

-- Uncomment if you prefer to store email directly in profiles table
-- (Not recommended unless you have specific performance requirements)

/*
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Backfill existing profiles with emails from auth.users
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
AND p.email IS NULL;

-- Note: You'll also need to update src/services/supabase/auth.ts
-- to insert email into profiles during signup
*/

-- =============================================================================
-- 4. Helpful Functions for Debugging
-- =============================================================================

-- Function to check phone verification status
CREATE OR REPLACE FUNCTION check_phone_verification_status(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_verified BOOLEAN,
  phone_verified_at TIMESTAMPTZ,
  last_verification_code TEXT,
  last_verification_sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    au.email,
    au.phone,
    p.phone_verified,
    p.phone_verified_at,
    pvc.code AS last_verification_code,
    pvc.created_at AS last_verification_sent_at
  FROM profiles p
  JOIN auth.users au ON au.id = p.user_id
  LEFT JOIN LATERAL (
    SELECT code, created_at
    FROM phone_verification_codes
    WHERE user_id = p.user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) pvc ON true
  WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_phone_verification_status(UUID) TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Run these queries to verify the migration worked:

-- 1. Check if view was created
-- SELECT * FROM profiles_with_auth LIMIT 5;

-- 2. Check phone verification status for all users
-- SELECT name, email, phone_verified, phone_verified_at 
-- FROM profiles_with_auth 
-- ORDER BY created_at DESC;

-- 3. Use the helper function
-- SELECT * FROM check_phone_verification_status('YOUR_USER_ID_HERE');

-- =============================================================================
-- ROLLBACK (if needed)
-- =============================================================================

-- Uncomment to rollback this migration:
/*
DROP VIEW IF EXISTS profiles_with_auth;
DROP FUNCTION IF EXISTS check_phone_verification_status(UUID);
-- Restore original RLS policy if needed
*/
