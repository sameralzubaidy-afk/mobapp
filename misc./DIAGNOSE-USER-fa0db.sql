-- Diagnose user fa0db18d-2544-42cc-8e19-0055e4521076
-- Run this in Supabase SQL Editor

SELECT '1. Check Profiles' as check_name;
SELECT user_id, referral_code, referred_by, created_at, updated_at 
FROM public.profiles 
WHERE user_id = 'fa0db18d-2544-42cc-8e19-0055e4521076';

SELECT '2. Check Referral Codes' as check_name;
SELECT * FROM public.referral_codes WHERE user_id = 'fa0db18d-2544-42cc-8e19-0055e4521076';

SELECT '3. Check Debug Logs (Trigger Activity)' as check_name;
SELECT process_name, message, payload, created_at 
FROM public.debug_logs 
WHERE payload::text LIKE '%fa0db18d-2544-42cc-8e19-0055e4521076%'
ORDER BY created_at ASC;

SELECT '4. Check Referrals' as check_name;
SELECT * FROM public.referrals WHERE referred_user_id = 'fa0db18d-2544-42cc-8e19-0055e4521076';

-- 5. Verify if the logging migration was even applied?
SELECT '5. Migration Check' as check_name;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'debug_logs'
) as debug_logs_exists;
