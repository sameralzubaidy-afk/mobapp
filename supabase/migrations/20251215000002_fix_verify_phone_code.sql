-- Migration: Fix ambiguous column reference in verify_phone_code function
-- Ensures all references to user_id column are qualified to avoid ambiguity with output column names

CREATE OR REPLACE FUNCTION verify_phone_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  user_id UUID
) AS $$
DECLARE
  v_record RECORD;
  v_attempts INTEGER;
BEGIN
  -- Find the verification code (qualify column references)
  SELECT * INTO v_record
  FROM phone_verification_codes
  WHERE phone_verification_codes.user_id = p_user_id
    AND phone_verification_codes.code = p_code
    AND phone_verification_codes.verified = false
    AND phone_verification_codes.expires_at > NOW()
  ORDER BY phone_verification_codes.created_at DESC
  LIMIT 1;

  -- Code not found or expired
  IF v_record IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Invalid or expired verification code'::TEXT,
      p_user_id;
    RETURN;
  END IF;

  -- Check attempts
  IF v_record.attempts >= 3 THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      'Too many attempts. Please request a new code.'::TEXT,
      p_user_id;
    RETURN;
  END IF;

  -- Mark as verified
  UPDATE phone_verification_codes
  SET verified = true
  WHERE phone_verification_codes.id = v_record.id;

  -- Update user profile
  UPDATE profiles
  SET 
    phone_verified = true,
    phone_verified_at = NOW()
  WHERE profiles.user_id = p_user_id;

  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Phone number verified successfully'::TEXT,
    p_user_id;
END;
$$ LANGUAGE plpgsql;
