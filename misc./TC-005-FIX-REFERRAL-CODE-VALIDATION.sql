-- TC-005 FIX: Invalid Referral Code Handling
-- Ensures that invalid referral codes trigger proper error messages (not silent failures)
-- Date: January 29, 2026

-- ============================================================================
-- BLOCK 1: FIX apply_referral_code RPC TO RETURN PROPER ERROR RESPONSES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_user_id UUID;
  v_referrer_profile_id UUID;
  v_referee_profile_id UUID;
  v_existing_referral RECORD;
BEGIN
  -- Step 1: Normalize code to lowercase
  p_referral_code := LOWER(TRIM(p_referral_code));

  -- Step 2: Validate code format (must be 8 chars, alphanumeric)
  IF p_referral_code IS NULL OR p_referral_code = '' THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Invalid code: empty', jsonb_build_object('code', p_referral_code));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: code cannot be empty');
  END IF;

  IF LENGTH(p_referral_code) != 8 THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Invalid code: wrong length', jsonb_build_object('code', p_referral_code, 'length', LENGTH(p_referral_code)));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: must be exactly 8 characters');
  END IF;

  IF p_referral_code !~ '^[a-z0-9]+$' THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Invalid code: bad characters', jsonb_build_object('code', p_referral_code));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: must contain only letters and numbers');
  END IF;

  -- Step 3: Look up referrer by code
  SELECT rc.user_id INTO v_referrer_user_id
  FROM public.referral_codes rc
  WHERE LOWER(rc.code) = p_referral_code
  LIMIT 1;
  
  IF v_referrer_user_id IS NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Invalid code: code not found in database', jsonb_build_object('code', p_referral_code));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: this code does not exist');
  END IF;

  -- Step 4: Prevent self-referral
  IF v_referrer_user_id = p_referee_id THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Self-referral attempt', jsonb_build_object('user_id', p_referee_id));
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Step 5: Check if referee already has a referral
  SELECT * INTO v_existing_referral
  FROM public.referrals r
  WHERE r.referred_user_id = p_referee_id
  LIMIT 1;
  
  IF v_existing_referral.id IS NOT NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Referral already applied', jsonb_build_object('referred_user_id', p_referee_id));
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;

  -- Step 6: Get profile IDs
  SELECT id INTO v_referrer_profile_id FROM public.profiles WHERE user_id = v_referrer_user_id;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = p_referee_id;
  
  IF v_referrer_profile_id IS NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Referrer profile missing', jsonb_build_object('user_id', v_referrer_user_id));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: referrer profile not found');
  END IF;
  
  IF v_referee_profile_id IS NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Referee profile missing', jsonb_build_object('user_id', p_referee_id));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code: referee profile not found');
  END IF;

  -- Step 7: Insert referral record
  BEGIN
    INSERT INTO public.referrals (
      referrer_id, referee_id, 
      referrer_user_id, referred_user_id, 
      referral_code, status
    ) VALUES (
      v_referrer_profile_id, v_referee_profile_id,
      v_referrer_user_id, p_referee_id,
      p_referral_code, 'pending'
    );
    
    -- Update profiles.referred_by
    UPDATE public.profiles 
    SET referred_by = v_referrer_user_id
    WHERE user_id = p_referee_id;
    
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Success', jsonb_build_object('referred_user_id', p_referee_id, 'referrer_user_id', v_referrer_user_id));
    
    RETURN jsonb_build_object('success', true, 'message', 'Referral code applied successfully');

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'CRASH DURING INSERT', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
    RETURN jsonb_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
  END;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('apply_referral_code', 'FATAL ERROR', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
  RETURN jsonb_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test Query 1: Verify RPC exists and is correctly typed
SELECT proname, prorettype, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'apply_referral_code'
AND pg_get_functiondef(oid) LIKE '%RETURNS JSONB%';
-- Expected: 1 row confirming apply_referral_code returns JSONB

-- Test Query 2: Test with invalid code (empty)
-- SELECT public.apply_referral_code('550e8400-e29b-41d4-a716-446655440000', '');
-- Expected JSON: {"success":false,"error":"Invalid referral code: code cannot be empty"}

-- Test Query 3: Test with invalid code (wrong length)
-- SELECT public.apply_referral_code('550e8400-e29b-41d4-a716-446655440000', 'abc');
-- Expected JSON: {"success":false,"error":"Invalid referral code: must be exactly 8 characters"}

-- Test Query 4: Test with invalid code (bad characters)
-- SELECT public.apply_referral_code('550e8400-e29b-41d4-a716-446655440000', 'abc@123x');
-- Expected JSON: {"success":false,"error":"Invalid referral code: must contain only letters and numbers"}

-- Test Query 5: Test with non-existent code
-- SELECT public.apply_referral_code('550e8400-e29b-41d4-a716-446655440000', 'nonexist');
-- Expected JSON: {"success":false,"error":"Invalid referral code: this code does not exist"}

-- Check debug_logs to see what happened
-- SELECT log_time, process_name, message, payload 
-- FROM public.debug_logs 
-- WHERE process_name = 'apply_referral_code' 
-- ORDER BY log_time DESC 
-- LIMIT 20;
