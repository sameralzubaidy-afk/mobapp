-- Fix trigger to use correct metadata key for name
-- The signup sends 'display_name' but trigger was looking for 'name'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_dob DATE;
  calculated_age INTEGER;
BEGIN
  -- Extract DOB from metadata
  user_dob := CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
    THEN (NEW.raw_user_meta_data->>'dob')::date
    ELSE NULL
  END;

  -- Calculate age if DOB is provided
  calculated_age := CASE WHEN user_dob IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))::INTEGER
    ELSE NULL
  END;

  INSERT INTO public.profiles (user_id, name, dob, age, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    user_dob,
    calculated_age,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;