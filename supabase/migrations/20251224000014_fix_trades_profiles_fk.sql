-- Migration: Comprehensive Fix for Profiles, Trades, and Items
-- Description: 
-- 1. Adds email column to profiles for easier joining and display
-- 2. Keeps profiles.email in sync with auth.users
-- 3. Adds foreign keys from trades/items to profiles to enable PostgREST joins
-- Mode B: Idempotent rerunnable migration

-- 1. Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 2. Backfill existing emails
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
AND p.email IS NULL;

-- 3. Update handle_new_user to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, dob, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    CASE WHEN (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> ''
      THEN (NEW.raw_user_meta_data->>'dob')::date
      ELSE NULL
    END,
    false
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email; -- Ensure email is updated if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to sync email updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for email updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 6. Add foreign keys from trades to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trades_buyer_profile') THEN
        ALTER TABLE trades
        ADD CONSTRAINT fk_trades_buyer_profile 
        FOREIGN KEY (buyer_id) REFERENCES profiles(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trades_seller_profile') THEN
        ALTER TABLE trades
        ADD CONSTRAINT fk_trades_seller_profile 
        FOREIGN KEY (seller_id) REFERENCES profiles(user_id);
    END IF;
END $$;

-- 7. Add foreign key from items to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_items_seller_profile') THEN
        ALTER TABLE items
        ADD CONSTRAINT fk_items_seller_profile 
        FOREIGN KEY (seller_id) REFERENCES profiles(user_id);
    END IF;
END $$;

-- Verification queries
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email';
-- SELECT conname, confrelid::regclass FROM pg_constraint WHERE conname IN ('fk_trades_buyer_profile', 'fk_trades_seller_profile', 'fk_items_seller_profile');
