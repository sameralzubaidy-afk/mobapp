-- UNIFIED_AUTH_TRIGGER_FIX.sql
-- Goal: Fix duplicate key error on profiles and unify referral logic
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. DROP ALL COMPETING TRIGGERS ON auth.users
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS after_user_created ON auth.users;

-- ============================================================================
-- 2. RECREATE THE UNIFIED LOGGING TABLE (if needed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    log_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    process_name TEXT,
    message TEXT,
    payload JSONB
);
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.debug_logs TO postgres, service_role, authenticated, anon;

-- ============================================================================
-- 3. UNIFIED handle_new_user FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_profile_id UUID;
BEGIN
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'Trigger Start', jsonb_build_object('user_id', NEW.id, 'email', NEW.email));

  -- 1. Create Profile (with ON CONFLICT DO NOTHING to prevent crashes)
  -- We populate name and phone from raw_user_meta_data
  INSERT INTO public.profiles (
    user_id, 
    name, 
    email, 
    phone,
    dob
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'display_name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    (NEW.raw_user_meta_data->>'dob')::DATE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob
  RETURNING id INTO v_profile_id;

  -- 2. Generate and store user's own referral code
  v_referral_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  INSERT INTO public.referral_codes (user_id, code) 
  VALUES (NEW.id, v_referral_code)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update profile with the code if it was just created
  UPDATE public.profiles SET referral_code = v_referral_code 
  WHERE user_id = NEW.id AND (referral_code IS NULL OR referral_code = '');

  -- NOTE: We NO LONGER apply the incoming referral code here.
  -- We let the App handle it via the RPC apply_referral_code.
  -- This prevents race conditions and allows the app to show errors.

  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'Success', jsonb_build_object('profile_id', v_profile_id, 'code', v_referral_code));

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES ('handle_new_user', 'FATAL CRASH', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ATTACH THE SINGLE UNIFIED TRIGGER
-- ============================================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. VERIFY apply_referral_code RPC IS IDEMPOTENT
-- ============================================================================
-- (The RPC from TC-005 file is already good, but we ensure it is accessible)
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated, service_role, anon;

-- ============================================================================
-- 6. AUDIT EXISTING USERS (Optional fix for users stuck without codes)
-- ============================================================================
-- This backfills any users who might have missed a referral code
DO $$
DECLARE
    r RECORD;
    v_new_code TEXT;
BEGIN
    FOR r IN SELECT id, email FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.referral_codes) LOOP
        v_new_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        INSERT INTO public.referral_codes (user_id, code) VALUES (r.id, v_new_code) ON CONFLICT DO NOTHING;
        UPDATE public.profiles SET referral_code = v_new_code WHERE user_id = r.id;
    END LOOP;
END;
$$;
