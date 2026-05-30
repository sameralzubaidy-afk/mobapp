-- ============================================================================
-- PERMANENT FIX: Ensure DOB is captured even via verify_user_phone fallback
-- ============================================================================
-- Problem: verify_user_phone creates a fallback profile WITHOUT DOB
-- This prevents the trigger from populating DOB because the profile already exists
--
-- Solution: Modify verify_user_phone to extract and include DOB when creating fallback profile

-- ============================================================================
-- CRITICAL FIX: Update verify_user_phone to include DOB in fallback profile
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_user_phone(
  p_user_id UUID,
  p_phone TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_rows_updated INTEGER := 0;
  v_verified_count INTEGER := 0;
  v_profile_exists BOOLEAN;
  v_auth_dob TEXT;
  v_parsed_dob DATE;
  v_calculated_age INTEGER;
  v_display_name TEXT;
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = p_user_id
  ) INTO v_profile_exists;

  -- If profile doesn't exist, create it with ALL data from auth user (including DOB)
  IF NOT v_profile_exists THEN
    -- Extract data from auth user
    SELECT 
      COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', ''),
      TRIM(COALESCE(raw_user_meta_data->>'dob', ''))
    INTO v_display_name, v_auth_dob
    FROM auth.users
    WHERE id = p_user_id;

    -- Parse DOB if provided
    v_parsed_dob := NULL;
    v_calculated_age := NULL;
    
    IF v_auth_dob IS NOT NULL AND v_auth_dob <> '' AND v_auth_dob !~ '^\s*$' THEN
      BEGIN
        v_parsed_dob := TO_DATE(v_auth_dob, 'YYYY-MM-DD');
        v_calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_parsed_dob))::INTEGER;
        
        -- Only set age if within valid range (5-17)
        IF v_calculated_age < 5 OR v_calculated_age > 17 THEN
          v_calculated_age := NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to parse DOB in verify_user_phone: %', SQLERRM;
        v_parsed_dob := NULL;
        v_calculated_age := NULL;
      END;
    END IF;

    -- Create profile WITH DOB and age
    INSERT INTO profiles (user_id, name, dob, age, phone_verified, phone_verified_at)
    VALUES (
      p_user_id,
      v_display_name,
      v_parsed_dob,
      v_calculated_age,
      true,
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

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

  -- Update the profile to mark phone as verified
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

-- ============================================================================
-- STEP 2: Fix the handle_new_user trigger to be simpler and more robust
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_dob DATE;
  calculated_age INTEGER;
  display_name_value TEXT;
  dob_raw TEXT;
BEGIN
  -- Extract display name
  display_name_value := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    ''
  );

  -- Extract and parse DOB
  dob_raw := TRIM(COALESCE(NEW.raw_user_meta_data->>'dob', ''));
  user_dob := NULL;
  calculated_age := NULL;
  
  IF dob_raw IS NOT NULL AND dob_raw <> '' THEN
    BEGIN
      user_dob := TO_DATE(dob_raw, 'YYYY-MM-DD');
      calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER;
      
      -- Only keep age if within valid range (5-17)
      IF calculated_age < 5 OR calculated_age > 17 THEN
        calculated_age := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      user_dob := NULL;
      calculated_age := NULL;
    END;
  END IF;

  -- Insert profile (if doesn't exist, it will be upserted by verify_user_phone later)
  INSERT INTO public.profiles (user_id, name, dob, age, phone_verified)
  VALUES (
    NEW.id,
    display_name_value,
    user_dob,
    calculated_age,
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    dob = COALESCE(EXCLUDED.dob, profiles.dob),
    age = COALESCE(EXCLUDED.age, profiles.age),
    name = COALESCE(EXCLUDED.name, profiles.name);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the trigger
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: Backfill all profiles missing DOB with data from auth
-- ============================================================================

UPDATE public.profiles p
SET 
  dob = CASE 
    WHEN (u.raw_user_meta_data->>'dob') IS NOT NULL 
      AND (u.raw_user_meta_data->>'dob') <> ''
      AND (u.raw_user_meta_data->>'dob') !~ '^\s*$'
    THEN TO_DATE(TRIM(u.raw_user_meta_data->>'dob'), 'YYYY-MM-DD')
    ELSE NULL
  END,
  age = CASE 
    WHEN (u.raw_user_meta_data->>'dob') IS NOT NULL 
      AND (u.raw_user_meta_data->>'dob') <> ''
      AND (u.raw_user_meta_data->>'dob') !~ '^\s*$'
    THEN (
      CASE 
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(TRIM(u.raw_user_meta_data->>'dob'), 'YYYY-MM-DD')))::INTEGER BETWEEN 5 AND 17
        THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(TRIM(u.raw_user_meta_data->>'dob'), 'YYYY-MM-DD')))::INTEGER
        ELSE NULL
      END
    )
    ELSE NULL
  END,
  updated_at = NOW()
FROM auth.users u
WHERE p.user_id = u.id
  AND p.dob IS NULL
  AND (u.raw_user_meta_data->>'dob') IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN dob IS NOT NULL THEN 1 END) as profiles_with_dob,
       COUNT(CASE WHEN age IS NOT NULL THEN 1 END) as profiles_with_age
FROM public.profiles;

-- Check recent profiles to see if DOB is now captured
SELECT id, user_id, name, dob, age, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- Check if any profiles still missing DOB
SELECT COUNT(*) as missing_dob_count
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.dob IS NULL AND (u.raw_user_meta_data->>'dob') IS NOT NULL;
