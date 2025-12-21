-- File: supabase/migrations/20251219000001_fix_dob_age_population.sql
-- Fix DOB and age population in profiles table during user signup
-- Updates the handle_new_user trigger to calculate age from DOB

-- Update trigger function to insert dob AND calculate age
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_dob DATE;
  calculated_age INTEGER;
  display_name_value TEXT;
BEGIN
  -- Extract display name from metadata, default to empty string
  display_name_value := COALESCE(NEW.raw_user_meta_data->>'display_name', '');
  
  -- Handle NULL case explicitly
  IF display_name_value IS NULL OR display_name_value = '' THEN
    display_name_value := '';
  END IF;

  -- Extract DOB from metadata
  user_dob := CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
    THEN (NEW.raw_user_meta_data->>'dob')::date
    ELSE NULL
  END;

  -- Calculate age if DOB is provided (only if age will be within valid range 5-17)
  calculated_age := CASE WHEN user_dob IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER
    ELSE NULL
  END;

  -- Validate age is within acceptable range if provided
  IF calculated_age IS NOT NULL AND (calculated_age < 5 OR calculated_age > 17) THEN
    calculated_age := NULL;
  END IF;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();