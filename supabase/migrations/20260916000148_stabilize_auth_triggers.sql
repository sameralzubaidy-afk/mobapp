-- =====================================================
-- FILE: supabase/migrations/202_stabilize_auth_triggers.sql
-- MODULE: MODULE-03-AUTH-V2 / MODULE-14-NOTIFICATIONS-V2
-- TASK: Fix Signup Failure & Consolidate Auth Triggers
-- DESCRIPTION:
--   1. Drop redundant notification preference trigger from migration 201.
--   2. Redefine handle_new_user() as the single canonical auth trigger.
--   3. Handle Profiles, Wallets, and Notification Preferences in one atomic transaction.
--   4. Add robust logging to debug_logs to identify future failures.
-- =====================================================

-- 1. CLEANUP: Drop standalone trigger and function from migration 201
DROP TRIGGER IF EXISTS trigger_initialize_notification_preferences ON auth.users;
DROP FUNCTION IF EXISTS public.initialize_notification_preferences();

-- 2. ENSURE debug_logs EXISTS (BP-4)
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name TEXT NOT NULL,
    message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. REDEFINE handle_new_user as the "Super Trigger"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_exists BOOLEAN;
    v_dob DATE;
    v_age INTEGER;
    v_display_name TEXT;
    v_referral_code TEXT;
    v_referral_input TEXT;
BEGIN
    -- [LOG] Start process
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'START', jsonb_build_object(
        'user_id', NEW.id, 
        'email', NEW.email,
        'metadata', NEW.raw_user_meta_data
    ));

    -- 1. EXTRACT METADATA
    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name', 
        NEW.raw_user_meta_data->>'name', 
        NEW.raw_user_meta_data->>'full_name', 
        split_part(NEW.email, '@', 1)
    );

    IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
        BEGIN
            v_dob := (NEW.raw_user_meta_data->>'dob')::date;
            v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
            -- Safety check: don't store nonsense ages
            IF v_age < 0 OR v_age > 120 THEN
                v_age := NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_dob := NULL;
            v_age := NULL;
        END;
    END IF;

    v_referral_input := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');

    -- 2. ENSURE V2 REFERRAL CODE
    -- We try to use the public.create_referral_code RPC if it exists, otherwise fallback
    BEGIN
        SELECT (public.create_referral_code(NEW.id)->>'code') INTO v_referral_code;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to random 8-char if RPC fails
        v_referral_code := LOWER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES ('handle_new_user', 'WARNING', jsonb_build_object('msg', 'create_referral_code failed, using random fallback', 'error', SQLERRM));
    END;

    -- 3. UPSERT PROFILE
    INSERT INTO public.profiles (
        user_id, 
        name, 
        email, 
        phone, 
        dob, 
        age, 
        referral_code,
        phone_verified
    )
    VALUES (
        NEW.id, 
        v_display_name,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
        v_dob,
        v_age,
        v_referral_code,
        false
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        dob = COALESCE(EXCLUDED.dob, public.profiles.dob),
        age = COALESCE(EXCLUDED.age, public.profiles.age),
        referral_code = COALESCE(v_referral_code, public.profiles.referral_code);
        
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'PROFILE_UPSERTED', jsonb_build_object('user_id', NEW.id, 'name', v_display_name));

    -- 4. APPLY INITIAL REFERRAL (Best-effort / Idempotent)
    IF v_referral_input IS NOT NULL THEN
        BEGIN
            PERFORM public.apply_referral_code(NEW.id, v_referral_input);
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.debug_logs (process_name, message, payload)
            VALUES ('handle_new_user', 'WARNING', jsonb_build_object('msg', 'apply_referral_code failed', 'error', SQLERRM));
        END;
    END IF;

    -- 5. INITIALIZE SP WALLET
    INSERT INTO public.sp_wallets (user_id, available_balance, lifetime_earned)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'WALLET_INITIALIZED', jsonb_build_object('user_id', NEW.id));

    -- 6. INITIALIZE NOTIFICATION PREFERENCES
    INSERT INTO public.notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
    VALUES
        (NEW.id, 'subscription', true, true, true),
        (NEW.id, 'sp_events', true, true, false),
        (NEW.id, 'badges', true, true, false),
        (NEW.id, 'trades', true, true, false),
        (NEW.id, 'system', true, true, false)
    ON CONFLICT (user_id, category) DO NOTHING;
    
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'PREFERENCES_INITIALIZED', jsonb_build_object('user_id', NEW.id));

    -- [LOG] Success
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'SUCCESS', jsonb_build_object('user_id', NEW.id));

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- BP-4: Critical Fail-Safe logging
    -- If profiling fails, we still want the user to exist in auth.users
    BEGIN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES ('handle_new_user', 'FATAL_ERROR', jsonb_build_object(
            'error', SQLERRM, 
            'state', SQLSTATE, 
            'user_id', NEW.id,
            'email', NEW.email
        ));
    EXCEPTION WHEN OTHERS THEN
        -- If even logging fails, we just return NEW to ensure auth.signUp doesn't hang
        NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. ENSURE TRIGGER ATTACHMENT
-- Use simple drop/create to ensure we have the latest version attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RECOVERY FOR PARTIALLY CREATED USERS
-- =====================================================

-- Ensure all profiles have email if they were missing it
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Ensure all users have notification preferences initialized
INSERT INTO public.notification_preferences (user_id, category, push_enabled, in_app_enabled, email_enabled)
SELECT u.id, c.cat, true, true, false
FROM auth.users u
CROSS JOIN (
    SELECT unnest(enum_range(NULL::notification_category)) as cat
) c
ON CONFLICT (user_id, category) DO NOTHING;

-- Grant permissions (if needed for debugging)
GRANT SELECT ON public.debug_logs TO authenticated;
GRANT SELECT ON public.debug_logs TO service_role;
