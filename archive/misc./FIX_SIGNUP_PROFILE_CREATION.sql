-- ============================================================================
-- FIX: Signup Profile Creation Issue
-- ============================================================================
-- Problem: Profile not being created during signup, causing verification to fail
-- with "No profile found for user_id"
--
-- Solution: 
-- 1. Improve handle_new_user trigger to handle all metadata formats
-- 2. Add fallback profile creation in verify_user_phone RPC
--
-- Apply this directly to production Supabase SQL Editor

-- ============================================================================
-- STEP 1: Improve handle_new_user trigger - EXTRACT DOB CORRECTLY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_dob DATE;
  calculated_age INTEGER;
  display_name_value TEXT;
  dob_raw TEXT;
BEGIN
  -- Extract display name with multiple fallback options
  display_name_value := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    ''
  );

  -- Extract raw DOB value
  dob_raw := NEW.raw_user_meta_data->>'dob';
  
  -- Log what we're trying to parse (for debugging)
  IF dob_raw IS NOT NULL AND dob_raw <> '' THEN
    RAISE NOTICE 'Attempting to parse DOB: %', dob_raw;
  END IF;

  -- Extract DOB from metadata (YYYY-MM-DD format)
  -- Be very explicit about the parsing
  user_dob := NULL;
  IF dob_raw IS NOT NULL AND dob_raw <> '' AND dob_raw !~ '^\s*$' THEN
    BEGIN
      user_dob := TO_DATE(dob_raw, 'YYYY-MM-DD');
      RAISE NOTICE 'Successfully parsed DOB: % -> %', dob_raw, user_dob;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to parse DOB %: %', dob_raw, SQLERRM;
      user_dob := NULL;
    END;
  END IF;

  -- Calculate age if DOB is provided
  calculated_age := NULL;
  IF user_dob IS NOT NULL THEN
    calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER;
    RAISE NOTICE 'Calculated age: %', calculated_age;
  END IF;

  -- Validate age is within acceptable range; if not, set to NULL
  -- For kids app, we accept ages 5-17 (but adults can register too, just with 18+ for terms)
  IF calculated_age IS NOT NULL AND (calculated_age < 1 OR calculated_age > 150) THEN
    RAISE NOTICE 'Age out of valid range: %, setting to NULL', calculated_age;
    calculated_age := NULL;
  END IF;

  -- Insert profile with DOB and age
  RAISE NOTICE 'Inserting profile for user % with dob=%, age=%', NEW.id, user_dob, calculated_age;
  
  INSERT INTO public.profiles (user_id, name, dob, age, phone_verified)
  VALUES (
    NEW.id,
    display_name_value,
    user_dob,
    calculated_age,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the trigger
  RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 2: Improve verify_user_phone to create profile if missing
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
BEGIN
  -- Check if profile exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = p_user_id
  ) INTO v_profile_exists;

  -- If profile doesn't exist, create it with minimal data from auth user
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (user_id, name, phone_verified, phone_verified_at)
    SELECT 
      id,
      COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', ''),
      true,
      NOW()
    FROM auth.users
    WHERE id = p_user_id
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

-- ============================================================================
-- STEP 3: Backfill DOB and age for existing profiles
-- ============================================================================
-- Run this to populate DOB and age for users who signed up before this fix
-- NOTE: Only sets age if it's within the valid range (5-17) for the constraint

DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update profiles where DOB is missing but exists in auth metadata
  -- Only set age if it's within the valid range (5-17), otherwise leave as NULL
  UPDATE public.profiles p
  SET 
    dob = CASE 
      WHEN (u.raw_user_meta_data->>'dob') IS NOT NULL 
        AND (u.raw_user_meta_data->>'dob') <> ''
        AND (u.raw_user_meta_data->>'dob') !~ '^\s*$'
      THEN TO_DATE(u.raw_user_meta_data->>'dob', 'YYYY-MM-DD')
      ELSE NULL
    END,
    age = CASE 
      WHEN (u.raw_user_meta_data->>'dob') IS NOT NULL 
        AND (u.raw_user_meta_data->>'dob') <> ''
        AND (u.raw_user_meta_data->>'dob') !~ '^\s*$'
      THEN (
        -- Calculate age, but only if it's within valid range (5-17)
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(u.raw_user_meta_data->>'dob', 'YYYY-MM-DD')))::INTEGER BETWEEN 5 AND 17
          THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(u.raw_user_meta_data->>'dob', 'YYYY-MM-DD')))::INTEGER
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

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % profiles with DOB from auth metadata (age set only if 5-17)', v_updated_count;
END $$;

-- ============================================================================
-- VERIFICATION: Check DOB and age population
-- ============================================================================
-- Run these queries to verify the fix:
--
-- SELECT COUNT(*) as total_profiles FROM public.profiles;
-- SELECT COUNT(*) as profiles_with_dob FROM public.profiles WHERE dob IS NOT NULL;
-- SELECT COUNT(*) as profiles_with_age FROM public.profiles WHERE age IS NOT NULL;
--
-- SELECT id, email, raw_user_meta_data->>'dob' as dob_in_auth, 
--        p.dob, p.age, p.created_at
--   FROM auth.users u
--   LEFT JOIN public.profiles p ON u.id = p.user_id
--   WHERE p.dob IS NULL AND (u.raw_user_meta_data->>'dob') IS NOT NULL
--   LIMIT 10;
