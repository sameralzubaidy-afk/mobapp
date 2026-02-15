-- Migration: Add Subscription Initialization to User Signup
-- Purpose: Fix CRITICAL BUG where new users don't get subscription records created automatically
-- Date: 2025-02-14
-- Issue: Users registering would have NULL subscription_status in all RPCs
-- Solution: Update handle_new_user() trigger to create free subscription with trial eligibility

-- ============================================================================
-- BLOCK 1: Update handle_new_user() Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_exists BOOLEAN;
    v_dob DATE;
    v_age INTEGER;
    v_display_name TEXT;
    v_referral_code TEXT;
    v_referral_input TEXT;
    v_subscription_id UUID;
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

    -- 5. CREATE SUBSCRIPTION WITH FREE STATUS AND TRIAL ELIGIBILITY
    -- NEW STEP: Initialize subscription so users have proper status in all RPCs
    BEGIN
        INSERT INTO public.subscriptions (
            user_id,
            status,
            tier_id,
            has_used_trial,
            auto_renew_enabled,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            'free',
            NULL,
            FALSE,  -- User hasn't used trial yet
            TRUE,   -- Auto-renew enabled by default
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO v_subscription_id;
        
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES ('handle_new_user', 'SUBSCRIPTION_CREATED', jsonb_build_object(
            'user_id', NEW.id, 
            'subscription_id', v_subscription_id,
            'status', 'free',
            'has_used_trial', FALSE
        ));
    EXCEPTION WHEN OTHERS THEN
        -- Log subscription creation failure but don't fail the entire user creation
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES ('handle_new_user', 'WARNING', jsonb_build_object(
            'msg', 'Subscription creation failed',
            'user_id', NEW.id,
            'error', SQLERRM
        ));
    END;

    -- 6. INITIALIZE SP WALLET
    INSERT INTO public.sp_wallets (user_id, available_balance, lifetime_earned)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'WALLET_INITIALIZED', jsonb_build_object('user_id', NEW.id));

    -- 7. INITIALIZE NOTIFICATION PREFERENCES
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

-- ============================================================================
-- BLOCK 2: Backfill Subscriptions for Existing Users Without Subscriptions
-- ============================================================================

-- Create subscriptions for any existing users who don't have one yet
-- This ensures existing test/production users also get proper subscription records
INSERT INTO public.subscriptions (
    user_id,
    status,
    tier_id,
    has_used_trial,
    auto_renew_enabled,
    created_at,
    updated_at
)
SELECT 
    u.id,
    'free',
    NULL,
    FALSE,
    TRUE,
    NOW(),
    NOW()
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Log the backfill
INSERT INTO public.debug_logs (process_name, message, payload)
VALUES ('handle_new_user migration', 'BACKFILL_COMPLETED', jsonb_build_object(
    'message', 'Created subscriptions for all existing users without subscriptions'
));

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm the fix)
-- ============================================================================

-- Query 1: Confirm handle_new_user function updated
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) LIKE '%subscriptions%' AS has_subscription_logic
FROM pg_proc p
WHERE p.proname = 'handle_new_user'
LIMIT 1;

-- Query 2: Check backfill results - count users with subscriptions
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT s.user_id) as users_with_subscriptions,
  COUNT(DISTINCT s.user_id) = COUNT(DISTINCT u.id) AS all_users_have_subscriptions
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id;

-- Query 3: Verify subscription table has correct default values for new users
SELECT 
  status,
  tier_id IS NULL as tier_id_is_null,
  has_used_trial,
  auto_renew_enabled,
  COUNT(*) as count
FROM public.subscriptions
GROUP BY status, tier_id IS NULL, has_used_trial, auto_renew_enabled;

-- Query 4: Check debug logs for migration success
SELECT 
  process_name,
  message,
  payload,
  created_at
FROM public.debug_logs
WHERE process_name IN ('handle_new_user', 'handle_new_user migration')
ORDER BY created_at DESC
LIMIT 20;
