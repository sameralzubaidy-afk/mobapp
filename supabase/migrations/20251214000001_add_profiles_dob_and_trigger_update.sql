-- File: supabase/migrations/20251214000001_add_profiles_dob_and_trigger_update.sql
-- Add dob column to profiles and update user creation trigger to capture dob

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dob DATE;
CREATE INDEX IF NOT EXISTS idx_profiles_dob ON profiles(dob);

-- Update trigger function to insert dob from auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, dob, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
      THEN (NEW.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists; ensure it calls the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
