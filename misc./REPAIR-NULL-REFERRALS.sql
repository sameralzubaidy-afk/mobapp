-- Fix broken users who have NULL referral codes
-- Run this in Supabase SQL Editor

-- 1. Identify users with NULL referral_code
SELECT id, email, created_at 
FROM auth.users 
WHERE id IN (SELECT user_id FROM profiles WHERE referral_code IS NULL);

-- 2. Force-generate codes for everyone missing one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT user_id FROM profiles WHERE referral_code IS NULL) LOOP
    PERFORM public.create_referral_code(r.user_id);
  END LOOP;
END;
$$;

-- 3. Verify repairs
SELECT user_id, referral_code FROM profiles WHERE referral_code IS NULL;
