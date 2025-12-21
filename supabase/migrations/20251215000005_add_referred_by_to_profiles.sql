-- File: supabase/migrations/20251215000005_add_referred_by_to_profiles.sql
-- Add referred_by column to profiles to track referral relationships
-- This is a temporary workaround while we fix the Supabase schema cache issue with referrals table

ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- Add comment for documentation
COMMENT ON COLUMN profiles.referred_by IS 'User ID of the person who referred this user (temporary workaround for referrals table schema cache issue)';
