-- Diagnose user d4bf68d4-763c-4a1d-a9ec-ac7bf94ace41
-- Run this in Supabase SQL Editor

-- 1. Check basic profile data
SELECT '1. Profile Check' as section;
SELECT user_id, referral_code, referred_by, created_at, updated_at 
FROM public.profiles 
WHERE user_id = 'd4bf68d4-763c-4a1d-a9ec-ac7bf94ace41';

-- 2. Check the logs for this user
SELECT '2. Trigger Logs' as section;
SELECT created_at, process_name, message, payload, error_message
FROM public.debug_logs 
WHERE user_id = 'd4bf68d4-763c-4a1d-a9ec-ac7bf94ace41'
   OR payload::text LIKE '%d4bf68d4-763c-4a1d-a9ec-ac7bf94ace41%'
ORDER BY created_at ASC;

-- 3. Check RLS Policies on profiles (to see if mobile app could even read the code)
SELECT '3. RLS Policies' as section;
SELECT policyname, substring(qual::text from 1 for 50) as qual_snippet 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Check if referral code exists in the lookup table
SELECT '4. Loopup Table' as section;
SELECT * FROM public.referral_codes WHERE user_id = 'd4bf68d4-763c-4a1d-a9ec-ac7bf94ace41';
