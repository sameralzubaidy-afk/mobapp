-- File: URGENT-FIX-REFERRED_BY-NULL.sql
-- Fix for: referred_by is NULL even though referral code was used
-- Root Cause: apply_referral_code() was idempotent but didn't force-update profiles.referred_by
-- Solution: Force update profiles.referred_by for all existing referrals that have NULL value

-- ============================================================================
-- STEP 1: Fix profiles.referred_by for existing referrals (IMMEDIATE)
-- ============================================================================

-- This backfills profiles.referred_by for all referred users whose profile still has NULL
UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;

-- Verify the fix
SELECT COUNT(*) as profiles_with_null_referred_by
FROM public.profiles
WHERE referred_by IS NULL 
  AND user_id IN (SELECT referred_user_id FROM public.referrals);

-- Show the recently fixed profiles
SELECT 
  p.user_id,
  p.name,
  p.referred_by,
  r.referrer_user_id,
  r.created_at as referral_created_at,
  r.status
FROM public.profiles p
JOIN public.referrals r ON r.referred_user_id = p.user_id
WHERE r.created_at > NOW() - INTERVAL '1 day'
ORDER BY r.created_at DESC;

-- ============================================================================
-- STEP 2: Verify your specific users are now fixed
-- ============================================================================

-- Check the two users you mentioned
SELECT 
  p.user_id,
  p.name,
  p.email,
  p.referred_by,
  r.referrer_user_id,
  r.status
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referred_user_id = p.user_id
WHERE p.email IN (
  '966bob.demo@example.com',
  '32211bob.demo@example.com'
);

-- ============================================================================
-- STEP 3: Update apply_referral_code() to be more aggressive (FORWARD-LOOKING)
-- ============================================================================
-- This ensures future signups always get referred_by set, even if referral 
-- was already created (prevents idempotency from blocking the update)

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  p_referral_code := LOWER(TRIM(p_referral_code));

  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  SELECT au.email INTO v_referee_email FROM auth.users au WHERE au.id = p_referee_id;
  SELECT au.email INTO v_referrer_email FROM auth.users au WHERE au.id = v_referrer_id;

  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;

  -- IMPORTANT FIX: Always update profiles.referred_by, even if referral already exists
  UPDATE public.profiles p
  SET referred_by = v_referrer_id
  WHERE p.user_id = p_referee_id
    AND (p.referred_by IS NULL OR p.referred_by != v_referrer_id);

  -- If already referred, return early after update above
  IF EXISTS(SELECT 1 FROM public.referrals r WHERE r.referred_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending');

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this script, check:
/*
SELECT 
  user_id,
  name,
  email,
  referred_by,
  created_at
FROM public.profiles
WHERE referred_by IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Should show your recent users with referred_by populated
*/
