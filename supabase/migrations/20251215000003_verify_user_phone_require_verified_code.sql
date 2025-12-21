-- Add stricter verification requirement: only mark profile verified when
-- there exists a verified row in phone_verification_codes for this user/phone
-- created within the last 24 hours.

CREATE OR REPLACE FUNCTION verify_user_phone(
  p_user_id UUID,
  p_phone TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_rows_updated INTEGER := 0;
  v_verified_count INTEGER := 0;
BEGIN
  -- Ensure there is a verified code for this user and phone within the last 24 hours
  SELECT COUNT(*) INTO v_verified_count
  FROM phone_verification_codes pvc
  WHERE pvc.user_id = p_user_id
    AND pvc.phone = p_phone
    AND pvc.verified = true
    AND pvc.created_at >= (NOW() - INTERVAL '24 hours');

  IF v_verified_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No recent verified code found for this phone',
      'verified_count', v_verified_count
    );
  END IF;

  -- Update the profile
  UPDATE profiles
  SET 
    phone_verified = true,
    phone_verified_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone verified successfully',
      'rows_updated', v_rows_updated,
      'verified_count', v_verified_count
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No profile found for user_id',
      'rows_updated', 0,
      'verified_count', v_verified_count
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_user_phone(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_user_phone(UUID, TEXT) TO anon;
