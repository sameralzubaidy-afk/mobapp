-- Migration: Fix Referral Constraints and Re-run Repair
-- Mode: Idempotent Rerunnable
-- Description: Adds the missing unique constraint to allow ON CONFLICT to work, 
--              hardens apply_referral_code, and repairs users with meta-data but no referral record.

-- 1. Ensure the unique constraint exists on referrals table
-- This fixes the error: "no unique or exclusion constraint matching the ON CONFLICT specification"
DO $$
BEGIN
    -- Drop potential conflicting naming variations
    ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS unique_referral_pair;
    ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referrer_user_id_referred_user_id_key;
    
    -- Ensure columns exist (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referrer_user_id') THEN
        ALTER TABLE public.referrals ADD COLUMN referrer_user_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='referred_user_id') THEN
        ALTER TABLE public.referrals ADD COLUMN referred_user_id UUID REFERENCES auth.users(id);
    END IF;

    -- Force the constraint we need for ON CONFLICT
    ALTER TABLE public.referrals ADD CONSTRAINT unique_referral_pair UNIQUE (referrer_user_id, referred_user_id);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint unique_referral_pair might already exist or duplicates exist that need manual cleanup.';
END $$;

-- 2. Update apply_referral_code to be fully robust and match the constraint
CREATE OR REPLACE FUNCTION public.apply_referral_code(
    p_user_id UUID,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_referee_sp INTEGER := 20;
    v_referrer_sp INTEGER := 50;
    v_already_referred BOOLEAN;
    v_clean_code TEXT;
    v_program_enabled BOOLEAN := true;
    v_first_trade_enabled BOOLEAN := true;
    v_status TEXT := 'pending';
BEGIN
    v_clean_code := LOWER(TRIM(p_code));

    -- Check master toggle
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_program_enabled FROM sp_config WHERE config_key = 'referral_program_enabled';
    IF NOT v_program_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Referral program is disabled');
    END IF;

    -- [BP-3] Check if already referred
    SELECT (referred_by IS NOT NULL) INTO v_already_referred FROM profiles WHERE user_id = p_user_id;
    IF v_already_referred THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already applied');
    END IF;

    -- Find referrer - Try profiles first (primary source for active codes)
    SELECT user_id INTO v_referrer_id
    FROM public.profiles 
    WHERE LOWER(referral_code) = v_clean_code
    LIMIT 1;

    -- Fallback to referral_codes table
    IF v_referrer_id IS NULL THEN
        SELECT user_id INTO v_referrer_id
        FROM public.referral_codes
        WHERE LOWER(code) = v_clean_code
        LIMIT 1;
    END IF;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
    END IF;

    IF v_referrer_id = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;

    -- Get values from sp_config (BP-3)
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 20) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 50) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_first_trade_enabled FROM sp_config WHERE config_key = 'referral_first_trade_enabled';

    -- Apply to profile
    UPDATE public.profiles 
    SET 
        referred_by = v_referrer_id, 
        referred_by_code = v_clean_code,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Determine status - if first trade is enabled, reward is PENDING until trade
    IF v_first_trade_enabled THEN
        v_status := 'pending';
    ELSE
        v_status := 'completed';
    END IF;

    -- [CRITICAL] Upsert into referrals table using the fixed constraint
    INSERT INTO public.referrals (
        referrer_user_id, 
        referred_user_id, 
        referral_code, 
        status,
        created_at
    )
    VALUES (
        v_referrer_id, 
        p_user_id, 
        v_clean_code, 
        v_status,
        now()
    )
    ON CONFLICT (referrer_user_id, referred_user_id) DO NOTHING;

    -- Credits - ONLY if NOT waiting for first trade
    IF NOT v_first_trade_enabled THEN
        PERFORM public.adjust_sp_wallet(p_user_id, v_referee_sp, 'referral_bonus', 'Referral bonus from ' || p_code);
        PERFORM public.adjust_sp_wallet(v_referrer_id, v_referrer_sp, 'referral_reward', 'Referral reward for ' || p_code);
    END IF;

    -- [BP-4] Log success
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'Success', jsonb_build_object(
        'referee_id', p_user_id,
        'referrer_id', v_referrer_id,
        'code', v_clean_code,
        'status', v_status
    ));

    RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'status', v_status);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', p_user_id, 'code', p_code));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Harden handle_new_user to be safer and capture metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_exists BOOLEAN;
    v_dob DATE;
    v_age INTEGER;
    v_meta_ref_code TEXT;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = NEW.id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
        IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
            BEGIN
                v_dob := (NEW.raw_user_meta_data->>'dob')::date;
                v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
                IF v_age < 5 OR v_age > 17 THEN v_age := NULL; END IF;
            EXCEPTION WHEN OTHERS THEN
                v_dob := NULL; v_age := NULL;
            END;
        END IF;

        INSERT INTO public.profiles (user_id, name, dob, age, referral_code)
        VALUES (
            NEW.id, 
            COALESCE(
                NEW.raw_user_meta_data->>'display_name', 
                NEW.raw_user_meta_data->>'name', 
                NEW.raw_user_meta_data->>'full_name', 
                split_part(NEW.email, '@', 1)
            ),
            v_dob,
            v_age,
            LOWER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
        );
    END IF;

    -- Ensure SP Wallet
    INSERT INTO public.sp_wallets (user_id, available_balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Capture referral code from metadata and apply it
    v_meta_ref_code := LOWER(TRIM(NEW.raw_user_meta_data->>'referral_code'));
    IF v_meta_ref_code IS NOT NULL AND v_meta_ref_code <> '' THEN
        -- Wrap in a safe block so it doesn't break signup if referral logic is buggy
        BEGIN
            PERFORM public.apply_referral_code(NEW.id, v_meta_ref_code);
            
            INSERT INTO debug_logs (process_name, message, payload)
            VALUES ('handle_new_user', 'Auto-applied referral from metadata', jsonb_build_object('user_id', NEW.id, 'code', v_meta_ref_code));
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (process_name, message, payload)
            VALUES ('handle_new_user', 'Referral auto-apply FAILED', jsonb_build_object('user_id', NEW.id, 'error', SQLERRM));
        END;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Run Repair specifically for users with referral_code in metadata but null in profiles
DO $$
DECLARE
    v_rec RECORD;
    v_result JSONB;
BEGIN
    FOR v_rec IN 
        SELECT u.id, u.raw_user_meta_data->>'referral_code' as ref_code
        FROM auth.users u
        JOIN public.profiles p ON u.id = p.user_id
        WHERE p.referred_by IS NULL
        AND u.raw_user_meta_data->>'referral_code' IS NOT NULL
        AND u.raw_user_meta_data->>'referral_code' <> ''
    LOOP
        v_result := public.apply_referral_code(v_rec.id, v_rec.ref_code);
        
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_repair_v3', 'Attempted repair from metadata', jsonb_build_object('user_id', v_rec.id, 'code', v_rec.ref_code, 'result', v_result));
    END LOOP;
END $$;
