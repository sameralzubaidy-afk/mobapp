-- ============================================================================
-- Migration: 20260903000003_dev_task_100_badges_email_default_on.sql
-- Task: DEV-TASK-100 item 2 — badges email preference default -> ON for NEW users
-- Mode B: Idempotent / rerunnable.
--
-- Problem: ID-verification confirmation emails are gated on the user's
-- notification_preferences row for category='badges' with email_enabled=true
-- (see supabase/functions/id-badge-notifications + id-badge-submission-notification).
-- The signup path (public.handle_new_user) and the self-heal RPC
-- (public.initialize_user_preferences) both created the 'badges' row with
-- email_enabled = FALSE, so new users never received ID-submission confirmations
-- unless they happened to opt in.
--
-- Fix: change the default for NEWLY-CREATED preference rows only — badges
-- email_enabled TRUE. This migration re-emits the two creators with the badges
-- literal flipped. It does NOT UPDATE any existing notification_preferences
-- rows, so no existing user's preference is retroactively changed (ON CONFLICT
-- DO NOTHING keeps any pre-existing row untouched).
--
-- Base body for public.handle_new_user is the canonical fail-safe trigger from
-- 20260415000001_auth_signup_trigger_stabilization_hotfix.sql (guarded against
-- schema drift; never aborts auth user creation), reproduced verbatim except for
-- the single 'badges' email_enabled literal.
-- ============================================================================

-- 1) Ensure debug_logs exists for trigger diagnostics (idempotent, mirrors hotfix).
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Remove legacy duplicate auth trigger/function if present (idempotent).
DROP TRIGGER IF EXISTS trigger_initialize_notification_preferences ON auth.users;
DROP FUNCTION IF EXISTS public.initialize_notification_preferences();
DROP FUNCTION IF EXISTS initialize_notification_preferences();

-- 3) Canonical, fail-safe auth trigger — DEV-TASK-100: badges email default ON.
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
        -- DEV-TASK-100 item 2: badges email default TRUE so ID-verification
        -- confirmation emails go out for new users unless they explicitly opt out.
        (NEW.id, 'badges', TRUE, TRUE, TRUE),
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

-- 4) Re-attach canonical trigger (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 5) DEV-TASK-100 item 2: self-heal RPC that creates missing preference rows
--    (mobile getNotificationPreferences calls this when a user has no rows) must
--    also default badges email to ON. Re-emitted from 203 with badges flipped.
CREATE OR REPLACE FUNCTION public.initialize_user_preferences(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
    VALUES
        (p_user_id, 'subscription', true, true, true),
        (p_user_id, 'sp_events', true, true, false),
        -- DEV-TASK-100 item 2: badges email default TRUE (new rows only).
        (p_user_id, 'badges', true, true, true),
        (p_user_id, 'trades', true, true, false),
        (p_user_id, 'system', true, true, false)
    ON CONFLICT (user_id, category) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Verification queries (run after applying this migration).
-- A) New-signup default: create a throwaway user, then read back the badges row:
--      SELECT category, email_enabled FROM public.notification_preferences
--      WHERE user_id = '<NEW_USER_ID>' AND category = 'badges';
--    Expected: email_enabled = true.
-- B) No retroactive flip — existing rows are untouched (there is no UPDATE in
--    this migration; ON CONFLICT DO NOTHING never touches an existing row):
--      SELECT COUNT(*) FROM public.notification_preferences
--      WHERE category = 'badges' AND email_enabled = false;
--    Expected: > 0 if any pre-existing user had opted out (unchanged).
-- C) Trigger attachment:
--      SELECT t.tgname AS trigger_name, p.proname AS function_name
--      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--      WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal;
-- ============================================================================
