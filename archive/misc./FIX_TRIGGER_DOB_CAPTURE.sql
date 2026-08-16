-- ============================================================================
-- FIX: Ensure DOB and Age are captured for NEW signups
-- ============================================================================
-- Problem: 
-- 1. New users' DOB is not being captured in profiles (dob=null)
-- 2. Age field is null for all users (this is OK for adults, but kids should have it)
--
-- Solution: 
-- 1. Recreate and verify the trigger is active
-- 2. Create a manual fix function to backfill new users
-- 3. Test the complete flow

-- ============================================================================
-- STEP 1: Verify and recreate the trigger (CRITICAL)
-- ============================================================================

-- First, drop any existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with explicit DOB extraction
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

  -- Extract raw DOB value from metadata
  dob_raw := TRIM(COALESCE(NEW.raw_user_meta_data->>'dob', ''));
  
  -- Debug logging
  RAISE NOTICE '============ handle_new_user TRIGGER FIRING ============';
  RAISE NOTICE 'User ID: %', NEW.id;
  RAISE NOTICE 'Display Name: %', display_name_value;
  RAISE NOTICE 'Raw metadata: %', NEW.raw_user_meta_data;
  RAISE NOTICE 'Raw DOB value: %', dob_raw;

  -- Extract and parse DOB from metadata (YYYY-MM-DD format)
  user_dob := NULL;
  IF dob_raw IS NOT NULL AND dob_raw <> '' AND dob_raw !~ '^\s*$' THEN
    BEGIN
      user_dob := TO_DATE(dob_raw, 'YYYY-MM-DD');
      RAISE NOTICE 'Successfully parsed DOB: % -> %', dob_raw, user_dob;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to parse DOB % : %', dob_raw, SQLERRM;
      user_dob := NULL;
    END;
  ELSE
    RAISE NOTICE 'DOB is empty or not provided in metadata';
  END IF;

  -- Calculate age if DOB is provided
  calculated_age := NULL;
  IF user_dob IS NOT NULL THEN
    calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER;
    RAISE NOTICE 'Calculated age: %', calculated_age;
    
    -- Only keep age if within valid range (5-17) per constraint
    IF calculated_age < 5 OR calculated_age > 17 THEN
      RAISE NOTICE 'Age %s is outside valid range (5-17), setting to NULL', calculated_age;
      calculated_age := NULL;
    END IF;
  END IF;

  -- Insert profile with DOB and age
  RAISE NOTICE 'Inserting profile: user_id=%, name=%, dob=%, age=%', NEW.id, display_name_value, user_dob, calculated_age;
  
  INSERT INTO public.profiles (user_id, name, dob, age, phone_verified)
  VALUES (
    NEW.id,
    display_name_value,
    user_dob,
    calculated_age,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE '============ handle_new_user COMPLETED ============';
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ERROR in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (MUST be AFTER INSERT)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ============================================================================
-- STEP 2: Create a function to manually sync DOB from auth to profiles
-- ============================================================================
-- Use this if a user's DOB is in auth.users but missing from profiles

CREATE OR REPLACE FUNCTION public.sync_profile_dob_from_auth(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_auth_dob TEXT;
  v_parsed_dob DATE;
  v_calculated_age INTEGER;
  v_rows_updated INTEGER;
BEGIN
  -- Get DOB from auth
  SELECT raw_user_meta_data->>'dob' INTO v_auth_dob
  FROM auth.users
  WHERE id = p_user_id;

  IF v_auth_dob IS NULL OR v_auth_dob = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No DOB found in auth metadata',
      'dob', NULL
    );
  END IF;

  -- Parse DOB
  BEGIN
    v_parsed_dob := TO_DATE(TRIM(v_auth_dob), 'YYYY-MM-DD');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Failed to parse DOB: ' || SQLERRM,
      'dob_raw', v_auth_dob
    );
  END;

  -- Calculate age
  v_calculated_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_parsed_dob))::INTEGER;
  
  -- Only set age if in valid range (5-17)
  IF v_calculated_age < 5 OR v_calculated_age > 17 THEN
    v_calculated_age := NULL;
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET 
    dob = v_parsed_dob,
    age = v_calculated_age,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Profile updated with DOB and age',
      'dob', v_parsed_dob,
      'age', v_calculated_age,
      'rows_updated', v_rows_updated
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found',
      'user_id', p_user_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_profile_dob_from_auth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_dob_from_auth(UUID) TO anon;

-- ============================================================================
-- STEP 3: Fix your new user (example - use actual user_id)
-- ============================================================================
-- Replace '4128a27d-77b3-4dd3-b4e7-6186502e22eb' with your new user's ID

SELECT public.sync_profile_dob_from_auth('4128a27d-77b3-4dd3-b4e7-6186502e22eb'::UUID);

-- Verify the fix
SELECT id, user_id, name, dob, age, phone_verified
FROM public.profiles
WHERE user_id = '4128a27d-77b3-4dd3-b4e7-6186502e22eb'::UUID;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check trigger status
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created' AND event_object_table = 'users';

-- Check function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Check profiles with DOB
SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN dob IS NOT NULL THEN 1 END) as profiles_with_dob,
       COUNT(CASE WHEN age IS NOT NULL THEN 1 END) as profiles_with_age
FROM public.profiles;

-- Check profiles missing DOB but auth has it
SELECT u.id, u.email, 
       u.raw_user_meta_data->>'dob' as dob_in_auth,
       p.dob as dob_in_profile,
       p.age,
       p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.dob IS NULL 
  AND (u.raw_user_meta_data->>'dob') IS NOT NULL
LIMIT 10;
