-- File: supabase/migrations/20260820000001_fix_phone_otp_pgcrypto_search_path.sql
-- Mode B: idempotent rerunnable migration (CREATE OR REPLACE FUNCTION is safe to re-run).
--
-- FIX (P1): send-phone-otp returned HTTP 500 on every real send attempt:
--   "Failed to hash OTP: function gen_salt(unknown) does not exist"
--
-- Root cause: pgcrypto's gen_salt()/crypt() live in the `extensions` schema on
-- Supabase, but hash_otp_code()/verify_otp_code() were created with
-- `SET search_path = public`, so the unqualified pgcrypto calls could not be
-- resolved. The dev SMS bypass path masked this in every QA run because it
-- never performs a real send.
--
-- Fix: add `extensions` to each function's search_path so pgcrypto functions
-- resolve. Function signatures are unchanged (no DROP required; BP-12 only
-- applies to signature changes). Bodies are otherwise byte-identical.

-- ===== FUNCTION 1: hash_otp_code =====
CREATE OR REPLACE FUNCTION public.hash_otp_code(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Hash using bcrypt with automatic salt generation
  RETURN crypt(p_code, gen_salt('bf'));
END;
$$;

COMMENT ON FUNCTION public.hash_otp_code IS
'Hash OTP code using bcrypt for secure storage. Called by send-phone-otp Edge Function.';

-- ===== FUNCTION 2: verify_otp_code =====
CREATE OR REPLACE FUNCTION public.verify_otp_code(
  p_verification_id UUID,
  p_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- ===== GRANTS (preserved) =====
GRANT EXECUTE ON FUNCTION public.hash_otp_code TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_otp_code TO authenticated;

-- ===== VERIFICATION QUERY =====
-- 1) Confirm both functions now resolve pgcrypto:
--    Expected: a bcrypt hash starting with $2b$ (previously: "function
--    gen_salt(unknown) does not exist").
--    SELECT public.hash_otp_code('123456');
--
-- 2) Confirm the search_path includes extensions:
--    SELECT proname, proconfig
--    FROM pg_proc
--    WHERE proname IN ('hash_otp_code', 'verify_otp_code')
--    ORDER BY proname;
--    Expected: proconfig contains {search_path=public, extensions}.
