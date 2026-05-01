-- File: supabase/migrations/20260501000001_phone_otp_hashing_rpcs.sql
-- RPC functions for OTP hashing and verification using pgcrypto bcrypt
-- Required for AUTH-V3-006 (PhoneService + PasswordService)

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== FUNCTION 1: hash_otp_code =====
-- Hash OTP code using bcrypt (called from send-phone-otp Edge Function)

CREATE OR REPLACE FUNCTION public.hash_otp_code(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hash using bcrypt with automatic salt generation
  RETURN crypt(p_code, gen_salt('bf'));
END;
$$;

COMMENT ON FUNCTION public.hash_otp_code IS 
'Hash OTP code using bcrypt for secure storage. Called by send-phone-otp Edge Function.';

-- ===== FUNCTION 2: verify_otp_code =====
-- Verify OTP code by comparing with stored hash, increment attempts counter

CREATE OR REPLACE FUNCTION public.verify_otp_code(
  p_verification_id UUID,
  p_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_is_valid BOOLEAN;
BEGIN
  -- 1. Fetch verification record
  SELECT * INTO v_record
  FROM phone_verification_codes
  WHERE id = p_verification_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Verification code not found';
    RETURN;
  END IF;

  -- 2. Check if expired
  IF v_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Verification code expired';
    RETURN;
  END IF;

  -- 3. Check attempts limit
  IF v_record.attempts >= 3 THEN
    RETURN QUERY SELECT FALSE, 'Maximum attempts exceeded';
    RETURN;
  END IF;

  -- 4. Verify code using bcrypt comparison
  -- crypt(input, stored_hash) = stored_hash if match
  v_is_valid := (crypt(p_code, v_record.code_hash) = v_record.code_hash);

  -- 5. Increment attempts counter
  UPDATE phone_verification_codes
  SET attempts = attempts + 1
  WHERE id = p_verification_id;

  -- 6. Return result
  IF v_is_valid THEN
    RETURN QUERY SELECT TRUE, 'Code verified'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Invalid code'::TEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.verify_otp_code IS
'Verify OTP code using bcrypt comparison. Increments attempts counter. Max 3 attempts.';

-- ===== GRANTS =====

GRANT EXECUTE ON FUNCTION public.hash_otp_code TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_otp_code TO authenticated;

-- ===== VERIFICATION QUERIES =====

-- Verify functions exist
-- Expected: 2 rows
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('hash_otp_code', 'verify_otp_code')
ORDER BY proname;

-- Test hash function (service role only)
-- Expected: returns bcrypt hash starting with $2a$ or $2b$
-- SELECT hash_otp_code('123456');

-- Test verify function (requires existing verification record)
-- Expected: returns table with (success, message)
-- SELECT * FROM verify_otp_code('<uuid>', '123456');
