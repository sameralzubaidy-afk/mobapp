-- FIX: Ensure referral codes are generated in lowercase
-- This fixes the generate_referral_code() function to produce lowercase codes as per V2 spec

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  LOOP
    -- Generate 8-character lowercase alphanumeric code
    v_code := LOWER(
      SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8)
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Fix existing uppercase codes to lowercase
UPDATE referral_codes 
SET code = LOWER(code)
WHERE code ~ '[A-Z]';

-- Verify all codes are now lowercase
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM referral_codes
  WHERE code !~ '^[a-z0-9]+$' OR char_length(code) != 8;
  
  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % referral codes that do not match V2 spec (lowercase, 8 chars)', v_invalid_count;
  ELSE
    RAISE NOTICE '✅ All referral codes are now V2 compliant (lowercase, 8 chars)';
  END IF;
END $$;
