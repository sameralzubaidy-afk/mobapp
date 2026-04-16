-- Migration: 20260415000001_auth_signup_trigger_stabilization_hotfix.sql
-- Purpose: Fix "Database error saving new user" during auth signup.
-- Mode B: Idempotent / rerunnable.
--
-- Root issue addressed:
-- - Hosted projects with migration drift can keep stale auth trigger definitions.
-- - A failing trigger on auth.users aborts auth.signUp and returns 500.
--
-- This migration enforces a single, fail-safe auth.users trigger and makes
-- handle_new_user resilient to schema drift.

-- 1) Ensure debug_logs exists for trigger diagnostics.
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Remove legacy duplicate auth trigger/function if present.
DROP TRIGGER IF EXISTS trigger_initialize_notification_preferences ON auth.users;
DROP FUNCTION IF EXISTS public.initialize_notification_preferences();
DROP FUNCTION IF EXISTS initialize_notification_preferences();

-- 3) Canonical, fail-safe auth trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_referral_input TEXT;
  v_dob DATE;
  v_age INTEGER;

  v_has_profiles BOOLEAN;
  v_has_subscriptions BOOLEAN;
  v_has_sp_wallets BOOLEAN;
  v_has_notification_preferences BOOLEAN;

  v_has_profile_email BOOLEAN;
  v_has_profile_phone BOOLEAN;
  v_has_profile_dob BOOLEAN;
  v_has_profile_age BOOLEAN;
  v_has_profile_phone_verified BOOLEAN;
BEGIN
  v_has_profiles := to_regclass('public.profiles') IS NOT NULL;
  v_has_subscriptions := to_regclass('public.subscriptions') IS NOT NULL;
  v_has_sp_wallets := to_regclass('public.sp_wallets') IS NOT NULL;
  v_has_notification_preferences := to_regclass('public.notification_preferences') IS NOT NULL;

  v_display_name := COALESCE(
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), ''),
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), ''),
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user'
  );

  v_referral_input := LOWER(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), ''));

  IF NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'dob', '')), '') IS NOT NULL THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::DATE;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;

      -- Keep compatibility with profiles.age CHECK (5..17) when present.
      IF v_age < 5 OR v_age > 17 THEN
        v_age := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES (
    'handle_new_user',
    'START',
    jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
  );

  IF v_has_profiles THEN
    BEGIN
      INSERT INTO public.profiles (user_id, name)
      VALUES (NEW.id, v_display_name)
      ON CONFLICT (user_id) DO UPDATE
      SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'handle_new_user',
        'WARNING_PROFILE_UPSERT',
        jsonb_build_object('user_id', NEW.id, 'error', SQLERRM, 'state', SQLSTATE)
      );

      BEGIN
        INSERT INTO public.profiles (user_id, name)
        SELECT NEW.id, v_display_name
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = NEW.id
        );
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_INSERT_FALLBACK',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM, 'state', SQLSTATE)
        );
      END;
    END;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'profiles'
        AND c.column_name = 'email'
    ) INTO v_has_profile_email;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'profiles'
        AND c.column_name = 'phone'
    ) INTO v_has_profile_phone;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'profiles'
        AND c.column_name = 'dob'
    ) INTO v_has_profile_dob;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'profiles'
        AND c.column_name = 'age'
    ) INTO v_has_profile_age;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'profiles'
        AND c.column_name = 'phone_verified'
    ) INTO v_has_profile_phone_verified;

    IF v_has_profile_email THEN
      BEGIN
        UPDATE public.profiles p
        SET email = COALESCE(p.email, NEW.email)
        WHERE p.user_id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_EMAIL_SYNC',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
        );
      END;
    END IF;

    IF v_has_profile_phone THEN
      BEGIN
        UPDATE public.profiles p
        SET phone = COALESCE(
          NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')), ''),
          p.phone
        )
        WHERE p.user_id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_PHONE_SYNC',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
        );
      END;
    END IF;

    IF v_has_profile_dob THEN
      BEGIN
        UPDATE public.profiles p
        SET dob = COALESCE(p.dob, v_dob)
        WHERE p.user_id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_DOB_SYNC',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
        );
      END;
    END IF;

    IF v_has_profile_age THEN
      BEGIN
        UPDATE public.profiles p
        SET age = COALESCE(p.age, v_age)
        WHERE p.user_id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_AGE_SYNC',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
        );
      END;
    END IF;

    IF v_has_profile_phone_verified THEN
      BEGIN
        UPDATE public.profiles p
        SET phone_verified = COALESCE(p.phone_verified, FALSE)
        WHERE p.user_id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_PROFILE_PHONE_VERIFIED_SYNC',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
        );
      END;
    END IF;
  END IF;

  IF v_has_subscriptions THEN
    BEGIN
      INSERT INTO public.subscriptions (user_id, status)
      VALUES (NEW.id, 'free')
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.subscriptions (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_SUBSCRIPTION_INIT',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM, 'state', SQLSTATE)
        );
      END;
    END;
  END IF;

  IF v_has_sp_wallets THEN
    BEGIN
      INSERT INTO public.sp_wallets (user_id)
      VALUES (NEW.id)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.sp_wallets (
          user_id,
          available_balance,
          pending_balance,
          lifetime_earned,
          lifetime_spent
        )
        VALUES (NEW.id, 0, 0, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'handle_new_user',
          'WARNING_SP_WALLET_INIT',
          jsonb_build_object('user_id', NEW.id, 'error', SQLERRM, 'state', SQLSTATE)
        );
      END;
    END;
  END IF;

  IF v_has_notification_preferences THEN
    BEGIN
      INSERT INTO public.notification_preferences (
        user_id,
        category,
        push_enabled,
        in_app_enabled,
        email_enabled
      )
      VALUES
        (NEW.id, 'subscription', TRUE, TRUE, TRUE),
        (NEW.id, 'sp_events', TRUE, TRUE, FALSE),
        (NEW.id, 'badges', TRUE, TRUE, FALSE),
        (NEW.id, 'trades', TRUE, TRUE, FALSE),
        (NEW.id, 'system', TRUE, TRUE, FALSE)
      ON CONFLICT (user_id, category) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'handle_new_user',
        'WARNING_NOTIFICATION_PREFS_INIT',
        jsonb_build_object('user_id', NEW.id, 'error', SQLERRM, 'state', SQLSTATE)
      );
    END;
  END IF;

  IF v_referral_input IS NOT NULL
     AND to_regprocedure('public.apply_referral_code(uuid,text)') IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_referral_code(NEW.id, v_referral_input);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'handle_new_user',
        'WARNING_REFERRAL_APPLY',
        jsonb_build_object('user_id', NEW.id, 'code', v_referral_input, 'error', SQLERRM)
      );
    END;
  END IF;

  INSERT INTO public.debug_logs (process_name, message, payload)
  VALUES (
    'handle_new_user',
    'SUCCESS',
    jsonb_build_object('user_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'handle_new_user',
      'FATAL_ERROR',
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error', SQLERRM,
        'state', SQLSTATE
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Never block auth signup; keep auth.users row creation successful.
  RETURN NEW;
END;
$$;

-- 4) Re-attach canonical trigger.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 5) Verification queries (run after applying this migration).
-- A) Check trigger attachment.
-- SELECT t.tgname AS trigger_name, p.proname AS function_name
-- FROM pg_trigger t
-- JOIN pg_proc p ON p.oid = t.tgfoid
-- WHERE t.tgrelid = 'auth.users'::regclass
--   AND NOT t.tgisinternal;
--
-- B) Check canonical function exists.
-- SELECT p.proname
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname = 'handle_new_user';
--
-- C) Inspect recent trigger logs.
-- SELECT dl.created_at, dl.process_name, dl.message, dl.payload
-- FROM public.debug_logs dl
-- WHERE dl.process_name = 'handle_new_user'
-- ORDER BY dl.created_at DESC
-- LIMIT 30;
