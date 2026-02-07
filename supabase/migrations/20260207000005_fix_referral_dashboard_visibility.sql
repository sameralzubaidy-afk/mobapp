-- Fix Referral Dashboard Visibility and Sync
-- Mode: Idempotent Rerunnable Migration
-- Problem: RLS was blocking referrers from seeing their referral history, 
--          and profiles.referred_by didn't always have a matching row in referrals table.

-- 1. Fix Referral Visibility
-- Allow referrers to see their own referral history (for dashboard stats/list)
DROP POLICY IF EXISTS "Referrers can view their referrals" ON public.referrals;
CREATE POLICY "Referrers can view their referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id);

-- Allow referees to view their own entry
DROP POLICY IF EXISTS "Referees can view their own referral" ON public.referrals;
CREATE POLICY "Referees can view their own referral"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referred_user_id);

-- Ensure service role can do everything (standard project rule)
DROP POLICY IF EXISTS "referrals_service_role" ON public.referrals;
CREATE POLICY "referrals_service_role"
  ON public.referrals FOR ALL
  TO service_role
  USING (true);

-- 2. Automatic Dashboard Sync Trigger
-- This ensures that if a profile has 'referred_by' set (legacy or new), 
-- the dashboard 'referrals' table ALWAYS has a matching row.
CREATE OR REPLACE FUNCTION public.sync_referral_table_on_profile_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if referred_by is being set for the first time or changed
    IF (NEW.referred_by IS NOT NULL) AND (OLD.referred_by IS NULL OR NEW.referred_by <> OLD.referred_by) THEN
        INSERT INTO public.referrals (
            referrer_user_id, 
            referred_user_id, 
            referral_code, 
            status,
            created_at
        )
        VALUES (
            NEW.referred_by, 
            NEW.user_id, 
            COALESCE(NEW.referred_by_code, 'unknown'), 
            'pending',
            now()
        )
        ON CONFLICT (referrer_user_id, referred_user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_referral_table ON public.profiles;
CREATE TRIGGER trigger_sync_referral_table
    AFTER INSERT OR UPDATE OF referred_by ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_referral_table_on_profile_update();

-- 3. Immediate Backfill for the missing UI rows
-- This captures any existing mismatches where profile says referred_by is X, 
-- but referrals table doesn't have the record.
INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
SELECT referred_by, user_id, referred_by_code, 'pending'
FROM public.profiles
WHERE referred_by IS NOT NULL 
  AND referred_by_code IS NOT NULL
ON CONFLICT (referrer_user_id, referred_user_id) DO NOTHING;

-- Verification queries
-- 1. Check if the specific user from the request (alice.w2test) now has a referral record
-- SELECT * FROM public.referrals WHERE referred_user_id = '56496d9d-6d97-45d4-9de0-2c92a47e6cdb';
