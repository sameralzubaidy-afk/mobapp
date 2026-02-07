-- File: supabase/migrations/20260204000003_referrals_trigger_hardening_and_rpc_fallback.sql
-- Mode B: Idempotent / rerunnable
-- Purpose:
-- 1) Ensure referral code generation always works and always syncs profiles.referral_code
-- 2) Ensure auth.users AFTER INSERT trigger is attached to public.handle_new_user()
-- 3) Make create_referral_code callable from the client as a fallback (GRANT EXECUTE)
-- 4) Repair debug_logs schema drift (created_at missing)
--
-- Root cause this addresses (observed):
-- - New users get profiles.referral_code = NULL
-- - referral_codes has no row
-- - debug_logs existed without created_at (schema drift), making diagnostics unusable

-- =============================================================================
-- BLOCK 1 — Schema + Debug Infra (safe patch)
-- =============================================================================

-- Ensure referral fields exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Ensure referral_codes exists and is constrained to one code per user
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT referral_codes_code_length CHECK (char_length(code) = 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes(LOWER(code));
CREATE INDEX IF NOT EXISTS referral_codes_user_idx ON public.referral_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_unique_idx ON public.referral_codes(user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Debug logs: repair drift (table may already exist with missing columns)
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  process_name TEXT NOT NULL,
  user_id UUID,
  message TEXT,
  payload JSONB,
  error_message TEXT
);

ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS process_name TEXT;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS debug_logs_created_at_idx ON public.debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS debug_logs_user_id_idx ON public.debug_logs(user_id);
CREATE INDEX IF NOT EXISTS debug_logs_process_name_idx ON public.debug_logs(process_name);

-- =============================================================================
-- BLOCK 2 — Functions (authoritative + idempotent)
-- =============================================================================

-- generate_referral_code(): stable lowercase 8-char
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(
      SELECT 1 FROM public.referral_codes rc WHERE LOWER(rc.code) = v_code
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- log_debug(): never break main flow
CREATE OR REPLACE FUNCTION public.log_debug(
  p_process_name TEXT,
  p_user_id UUID,
  p_message TEXT,
  p_payload JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.debug_logs (process_name, user_id, message, payload, error_message)
  VALUES (p_process_name, p_user_id, p_message, p_payload, p_error_message);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- create_referral_code(p_user_id):
-- - ensures referral_codes row exists
-- - ensures profiles.referral_code is synced
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  PERFORM public.log_debug('create_referral_code', p_user_id, 'Starting', jsonb_build_object('user_id', p_user_id));

  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NULL THEN
    v_code := public.generate_referral_code();

    INSERT INTO public.referral_codes (user_id, code)
    VALUES (p_user_id, v_code)
    ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code;

    PERFORM public.log_debug('create_referral_code', p_user_id, 'Inserted/Upserted referral_codes', jsonb_build_object('code', v_code));
  ELSE
    PERFORM public.log_debug('create_referral_code', p_user_id, 'Code already exists', jsonb_build_object('code', v_code));
  END IF;

  -- Sync into profiles (best-effort, but should succeed if profile exists)
  UPDATE public.profiles p
  SET referral_code = v_code
  WHERE p.user_id = p_user_id
    AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(v_code));

  PERFORM public.log_debug('create_referral_code', p_user_id, 'Synced profiles.referral_code', jsonb_build_object('code', v_code));

  RETURN jsonb_build_object('code', v_code, 'success', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_debug('create_referral_code', p_user_id, 'Failed', NULL, SQLERRM);
  RAISE;
END;
$$;

-- Ensure authenticated clients can call create_referral_code as a fallback
GRANT EXECUTE ON FUNCTION public.create_referral_code(UUID) TO authenticated;

-- handle_new_user(): create profile and guarantee referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_referral_code TEXT;
  v_referral_input TEXT;
BEGIN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger started', jsonb_build_object('email', NEW.email));

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);

  v_referral_input := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'referral_code',
        NEW.raw_user_meta_data->>'referralCode',
        NEW.raw_user_meta_data->>'referrer_code',
        NEW.raw_user_meta_data->>'referrerCode',
        ''
      )
    ),
    ''
  );

  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  -- Ensure a referral code exists and capture it
  BEGIN
    v_referral_code := (public.create_referral_code(NEW.id)->>'code');
  EXCEPTION WHEN OTHERS THEN
    v_referral_code := NULL;
    PERFORM public.log_debug('handle_new_user', NEW.id, 'create_referral_code failed', NULL, SQLERRM);
  END;

  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    dob,
    age,
    phone_verified,
    phone_verified_at,
    referral_code,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    v_dob,
    v_age,
    false,
    NULL,
    v_referral_code,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob,
    age = EXCLUDED.age,
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
    updated_at = NOW();

  PERFORM public.log_debug('handle_new_user', NEW.id, 'Profile upserted', jsonb_build_object('referral_code', v_referral_code));

  -- Apply referral code from metadata (best-effort)
  IF v_referral_input IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
      PERFORM public.log_debug('handle_new_user', NEW.id, 'apply_referral_code attempted', jsonb_build_object('input', v_referral_input));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_debug('handle_new_user', NEW.id, 'apply_referral_code failed', jsonb_build_object('input', v_referral_input), SQLERRM);
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_debug('handle_new_user', NEW.id, 'Trigger failed', NULL, SQLERRM);
  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 3 — Triggers (make sure they are attached)
-- =============================================================================

-- Remove known legacy/duplicate triggers that may conflict
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verification queries (run after deploy)
-- A) Confirm trigger is attached
-- SELECT tgname, pg_get_triggerdef(t.oid)
-- FROM pg_trigger t
-- WHERE t.tgrelid = 'auth.users'::regclass
--   AND NOT t.tgisinternal;
--
-- B) Confirm new user gets code
-- SELECT p.user_id, p.referral_code, rc.code
-- FROM public.profiles p
-- LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
-- ORDER BY p.created_at DESC
-- LIMIT 10;
