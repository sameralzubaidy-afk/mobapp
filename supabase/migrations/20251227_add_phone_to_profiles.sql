-- Migration: Add phone to profiles and sync with auth.users
-- Description: 
-- 1. Adds phone column to profiles for easier joining and display
-- 2. Keeps profiles.phone in sync with auth.users
-- Mode B: Idempotent rerunnable migration

-- 1. Add phone column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 2. Backfill existing phones
UPDATE profiles p
SET phone = au.phone
FROM auth.users au
WHERE p.user_id = au.id
AND p.phone IS NULL;

-- 3. Update handle_new_user to include phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, phone, dob, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.phone,
    CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
      THEN (NEW.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END,
    false
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- 4. Update handle_user_update to include phone
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    email = NEW.email,
    phone = NEW.phone
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- 5. Ensure trigger exists for both email and phone updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
