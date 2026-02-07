-- File: supabase/migrations/20260204000004_referrals_fail_safe_profiles_trigger.sql
-- Mode B: Idempotent / rerunnable
-- Purpose: Make referral_code generation persistent and self-healing.
--
-- Observed symptom: new users end up with profiles.referral_code = NULL and no referral_codes row.
-- Likely causes include:
-- - auth.users trigger not attached in the target environment
-- - RLS/ownership differences causing inserts inside SECURITY DEFINER functions to fail
-- - multiple legacy trigger versions causing partial execution
--
-- This migration adds TWO layers of safety:
-- 1) Make create_referral_code() explicitly bypass RLS via SET row_security = off.
-- 2) Add a profiles trigger that backfills referral_code whenever a profile is inserted/updated with NULL.
--
-- IMPORTANT: This does NOT allow clients to write arbitrary referral codes.
-- The trigger calls the server-side generator.

-- =============================================================================
-- BLOCK 1 — Functions
-- =============================================================================

-- Ensure base tables/columns exist (safe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT referral_codes_code_length CHECK (char_length(code) = 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes(LOWER(code));

-- Legacy safety: if prior code created multiple codes per user, dedupe before enforcing uniqueness.
WITH ranked AS (
  SELECT
    rc.id,
    rc.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY rc.user_id
      ORDER BY rc.created_at ASC, rc.id ASC
    ) AS rn
  FROM public.referral_codes rc
)
DELETE FROM public.referral_codes rc
USING ranked r
WHERE rc.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_unique_idx ON public.referral_codes(user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

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

-- create_referral_code(p_user_id): guaranteed to insert and sync profile.
-- row_security=off ensures this works even if table ownership differs across environments.
CREATE OR REPLACE FUNCTION public.create_referral_code(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = p_user_id
  LIMIT 1;

  IF v_code IS NULL THEN
    v_code := public.generate_referral_code();

    INSERT INTO public.referral_codes (user_id, code)
    VALUES (p_user_id, v_code)
    ON CONFLICT (user_id) DO UPDATE
    SET code = EXCLUDED.code;
  END IF;

  UPDATE public.profiles p
  SET referral_code = v_code
  WHERE p.user_id = p_user_id
    AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(v_code));

  RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$$;

-- Allow authenticated users to invoke this as a fallback.
GRANT EXECUTE ON FUNCTION public.create_referral_code(UUID) TO authenticated;

-- Trigger helper: ensure profiles.referral_code is never left NULL.
CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Only backfill when missing
  IF NEW.referral_code IS NULL THEN
    PERFORM public.create_referral_code(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCK 2 — Triggers (profiles self-heal)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_profiles_ensure_referral_code_ins ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_referral_code_ins
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.ensure_profile_referral_code();

DROP TRIGGER IF EXISTS trg_profiles_ensure_referral_code_upd ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_referral_code_upd
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL AND OLD.referral_code IS NULL)
  EXECUTE FUNCTION public.ensure_profile_referral_code();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- 1) Confirm triggers exist on profiles
-- SELECT tgname, pg_get_triggerdef(t.oid)
-- FROM pg_trigger t
-- WHERE t.tgrelid = 'public.profiles'::regclass
--   AND NOT t.tgisinternal;
--
-- 2) Force-repair a known broken user
-- SELECT public.create_referral_code('00000000-0000-0000-0000-000000000000'::uuid);
--
-- 3) Confirm newest users have codes
-- SELECT p.user_id, p.referral_code, rc.code
-- FROM public.profiles p
-- LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
-- ORDER BY p.created_at DESC
-- LIMIT 10;
