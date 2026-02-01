-- File: supabase/migrations/20260129000001_check_referral_code_exists.sql
-- Mode B (idempotent): Add RPC to check if a referral code exists without applying it.
-- This allows the frontend to validate the code BEFORE attempting a potentially irreversible auth.signUp call.

CREATE OR REPLACE FUNCTION public.check_referral_code_exists(p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.referral_codes rc 
    WHERE LOWER(rc.code) = LOWER(TRIM(p_code))
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification query
-- SELECT public.check_referral_code_exists('anycode');
