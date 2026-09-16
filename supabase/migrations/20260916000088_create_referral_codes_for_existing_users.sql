-- File: supabase/migrations/20260121000000_create_referral_codes_for_existing_users.sql
-- Create referral codes for existing users who don't have them

-- 1. Update the handle_new_user trigger to include referral code creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_age INTEGER;
BEGIN
  -- Extract name (check multiple common keys)
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  -- Extract phone (check metadata first, then fall back to auth column)
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone
  );

  -- Extract DOB from metadata
  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  -- Insert or Update profile
  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    dob,
    age,
    phone_verified,
    phone_verified_at
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    v_dob,
    v_age,
    false,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob,
    age = EXCLUDED.age;

  -- Create referral code for new user
  BEGIN
    PERFORM create_referral_code(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Log warning but don't fail user creation
    RAISE WARNING 'Referral code creation failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth process
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create referral codes for existing users who don't have them
DO $$
DECLARE
  user_record RECORD;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT p.user_id 
    FROM profiles p 
    LEFT JOIN referral_codes rc ON p.user_id = rc.user_id 
    WHERE rc.user_id IS NULL
  LOOP
    BEGIN
      PERFORM create_referral_code(user_record.user_id);
      success_count := success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to create referral code for user %: %', user_record.user_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Referral code backfill complete: % success, % errors', success_count, error_count;
END $$;

-- 3. Verification queries
-- Check that all users now have referral codes
SELECT 
  COUNT(*) as total_users,
  COUNT(rc.user_id) as users_with_codes,
  COUNT(*) - COUNT(rc.user_id) as users_missing_codes
FROM profiles p
LEFT JOIN referral_codes rc ON p.user_id = rc.user_id;

-- Show sample referral codes (lowercase display format)
SELECT 
  p.user_id,
  p.name,
  p.email,
  LOWER(rc.code) as referral_code
FROM profiles p
JOIN referral_codes rc ON p.user_id = rc.user_id
LIMIT 5;