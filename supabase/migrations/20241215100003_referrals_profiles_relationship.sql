-- File: supabase/migrations/20241215100003_referrals_profiles_relationship.sql
-- Add foreign key relationship to allow easier joins for referral history

-- 1. Ensure RLS is enabled on referrals (it should be)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 2. Add foreign key from referrals to profiles for joining names
-- This allows Supabase client to join profiles table on the referred_user_id column
ALTER TABLE public.referrals
DROP CONSTRAINT IF EXISTS referrals_referred_profile_fkey;

ALTER TABLE public.referrals
ADD CONSTRAINT referrals_referred_profile_fkey
FOREIGN KEY (referred_user_id) REFERENCES public.profiles(user_id);

-- 3. Add foreign key for referrer as well for completeness
ALTER TABLE public.referrals
DROP CONSTRAINT IF EXISTS referrals_referrer_profile_fkey;

ALTER TABLE public.referrals
ADD CONSTRAINT referrals_referrer_profile_fkey
FOREIGN KEY (referrer_user_id) REFERENCES public.profiles(user_id);

-- 4. Verification queries
-- SELECT 
--   r.*,
--   p.name as referred_user_name
-- FROM referrals r
-- JOIN profiles p ON r.referred_user_id = p.user_id
-- LIMIT 5;
