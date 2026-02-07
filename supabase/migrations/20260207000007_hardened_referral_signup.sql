-- Migration: Hardened Referral Signup and Repair
-- Mode: Idempotent Rerunnable

-- 1. Ensure public.adjust_sp_wallet handles all referral types correctly
CREATE OR REPLACE FUNCTION public.adjust_sp_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER;
    v_wallet_id UUID;
    v_new_balance INTEGER;
BEGIN
    INSERT INTO public.sp_wallets (user_id, available_balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id, COALESCE(available_balance, 0) INTO v_wallet_id, v_current_balance 
    FROM public.sp_wallets 
    WHERE user_id = p_user_id;

    v_new_balance := GREATEST(0, v_current_balance + p_amount);

    UPDATE public.sp_wallets 
    SET 
        available_balance = v_new_balance,
        lifetime_earned = CASE WHEN p_amount > 0 AND p_type NOT IN ('refund', 'adjustment') THEN lifetime_earned + p_amount ELSE lifetime_earned END,
        updated_at = now()
    WHERE id = v_wallet_id;

    INSERT INTO public.sp_ledger (
        wallet_id, 
        user_id, 
        transaction_type, 
        amount, 
        balance_before, 
        balance_after, 
        description, 
        created_at
    )
    VALUES (
        v_wallet_id, 
        p_user_id, 
        CASE 
            WHEN p_type = 'earn' THEN 'earn_reward'
            WHEN p_type = 'referral_reward' THEN 'earn_referral' 
            WHEN p_type = 'referral_bonus' THEN 'earn_referral' 
            ELSE p_type 
        END, 
        p_amount, 
        v_current_balance, 
        v_new_balance, 
        p_description, 
        now()
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Harden handle_new_user to capture referral code from auth metadata
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

    -- [NEW] Capture referral code from metadata and apply it automatically
    v_meta_ref_code := LOWER(TRIM(NEW.raw_user_meta_data->>'referral_code'));
    IF v_meta_ref_code IS NOT NULL AND v_meta_ref_code <> '' THEN
        -- We wait 100ms or simply call it since we are in the same tx
        -- Using PERFORM public.apply_referral_code so we don't need to duplicate logic
        PERFORM public.apply_referral_code(NEW.id, v_meta_ref_code);
        
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('handle_new_user', 'Auto-applied referral from metadata', jsonb_build_object('user_id', NEW.id, 'code', v_meta_ref_code));
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('handle_new_user', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Repair existing users who have referral code in metadata but not in profile
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
        SELECT public.apply_referral_code(v_rec.id, v_rec.ref_code) INTO v_result;
        
        IF (v_result->>'success')::BOOLEAN THEN
            INSERT INTO debug_logs (process_name, message, payload)
            VALUES ('referral_repair', 'Linked user via metadata', jsonb_build_object('user_id', v_rec.id, 'code', v_rec.ref_code));
        END IF;
    END LOOP;
END $$;

-- Verification
-- SELECT * FROM profiles WHERE referred_by IS NOT NULL;
