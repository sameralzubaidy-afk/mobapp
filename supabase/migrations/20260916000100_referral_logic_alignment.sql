-- Migration: Align Referral Logic with Admin Settings (First Trade Bonus)
-- Mode: Idempotent Rerunnable
-- Description: Ensures apply_referral_code respects the 'referral_first_trade_enabled' toggle
--              and handle_referral_rewards_on_trade_completion prevents double-dipping.

-- 1. Update apply_referral_code to respect logic-gates
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
    v_first_listing_enabled BOOLEAN := true;
    v_status TEXT := 'pending';
BEGIN
    v_clean_code := LOWER(TRIM(p_code));

    -- Check master toggle
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_program_enabled FROM sp_config WHERE config_key = 'referral_program_enabled';
    IF NOT v_program_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Referral program is disabled');
    END IF;

    -- [BP-3] Check if already referred in profile
    SELECT (referred_by IS NOT NULL) INTO v_already_referred FROM profiles WHERE user_id = p_user_id;
    IF v_already_referred THEN
        -- Check if referral record exists, if not, we still need to create it for the dashboard
        IF NOT EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = p_user_id) THEN
            -- We'll proceed to create the record but skip points
            SELECT referred_by INTO v_referrer_id FROM profiles WHERE user_id = p_user_id;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Already applied');
        END IF;
    END IF;

    -- Find referrer if we don't have it yet
    IF v_referrer_id IS NULL THEN
        -- Try profiles first (primary source for active codes)
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
    END IF;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
    END IF;

    IF v_referrer_id = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;

    -- Get values from sp_config
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 20) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 50) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_first_trade_enabled FROM sp_config WHERE config_key = 'referral_first_trade_enabled';
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_first_listing_enabled FROM sp_config WHERE config_key = 'referral_first_listing_enabled';

    -- Apply to profile if not already set (case of auto-repairs)
    UPDATE public.profiles 
    SET 
        referred_by = v_referrer_id, 
        referred_by_code = v_clean_code,
        updated_at = now()
    WHERE user_id = p_user_id AND referred_by IS NULL;

    -- Determine status - if EITHER first trade OR first listing is enabled, reward is PENDING
    IF v_first_trade_enabled OR v_first_listing_enabled THEN
        v_status := 'pending';
    ELSE
        v_status := 'completed';
    END IF;

    -- [CRITICAL] Upsert into referrals table
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
    ON CONFLICT (referrer_user_id, referred_user_id) 
    DO UPDATE SET status = EXCLUDED.status, referral_code = EXCLUDED.referral_code
    WHERE referrals.status = 'pending'; -- Only update if still pending

    -- Credits - ONLY if NOT waiting for gates AND not already awarded
    IF v_status = 'completed' THEN
        -- Check if points were already awarded to avoid double-dipping during repairs/retries
        IF NOT EXISTS (
            SELECT 1 FROM public.sp_ledger 
            WHERE user_id = p_user_id AND transaction_type = 'earn_referral'
        ) THEN
            PERFORM public.adjust_sp_wallet(p_user_id, v_referee_sp, 'referral_bonus', 'Referral bonus from ' || p_code);
            PERFORM public.adjust_sp_wallet(v_referrer_id, v_referrer_sp, 'referral_reward', 'Referral reward for ' || p_code);
        END IF;
    END IF;

    -- [BP-4] Log success
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code_v2', 'Success', jsonb_build_object(
        'referee_id', p_user_id,
        'referrer_id', v_referrer_id,
        'code', v_clean_code,
        'status', v_status,
        'first_trade_enabled', v_first_trade_enabled
    ));

    RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'status', v_status);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('apply_referral_code', 'ERROR', jsonb_build_object('error', SQLERRM, 'user_id', p_user_id, 'code', p_code));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Enhance Trade Trigger to prevent double-dipping and respect toggles
CREATE OR REPLACE FUNCTION public.handle_referral_rewards_on_trade_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_id UUID;
    v_referral_id UUID;
    v_referral_status TEXT;
    v_referrer_sp INTEGER := 25;
    v_referee_sp INTEGER := 10;
    v_program_enabled BOOLEAN := true;
    v_trade_enabled BOOLEAN := true;
BEGIN
    -- [1] FEATURE TOGGLE CHECK
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_program_enabled FROM sp_config WHERE config_key = 'referral_program_enabled';
    SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_trade_enabled FROM sp_config WHERE config_key = 'referral_first_trade_enabled';

    IF NOT v_program_enabled OR NOT v_trade_enabled THEN
        RETURN NEW;
    END IF;

    -- [2] Only process when trade moves to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- [3] Check if buyer was referred and get the referral record
        SELECT id, referrer_user_id, status 
        INTO v_referral_id, v_referrer_id, v_referral_status
        FROM referrals 
        WHERE referred_user_id = NEW.buyer_id 
        ORDER BY created_at ASC LIMIT 1;

        -- [4] IF REFERRED AND PENDING -> This is their FIRST trade
        IF v_referrer_id IS NOT NULL AND v_referral_status = 'pending' THEN
            
            -- [BP-1] DOUBLE-DIP PROTECTION: Check if they already got points (maybe toggle was off during signup)
            IF EXISTS (
                SELECT 1 FROM public.sp_ledger 
                WHERE user_id = NEW.buyer_id AND transaction_type = 'earn_referral'
            ) THEN
                UPDATE public.referrals SET status = 'completed', completed_at = now() WHERE id = v_referral_id;
                RETURN NEW;
            END IF;

            -- Get amounts from config
            SELECT COALESCE((config_value #>> '{}')::INTEGER, 25) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
            SELECT COALESCE((config_value #>> '{}')::INTEGER, 10) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';

            -- A: Credit Referrer
            IF v_referrer_sp > 0 THEN
                PERFORM public.adjust_sp_wallet(
                    v_referrer_id, 
                    v_referrer_sp, 
                    'referral_reward', 
                    'Bonus: Friend (#' || SUBSTRING(NEW.buyer_id::text, 1, 8) || ') completed first trade'
                );
            END IF;

            -- B: Credit Referee (Alice)
            IF v_referee_sp > 0 THEN
                PERFORM public.adjust_sp_wallet(
                    NEW.buyer_id, 
                    v_referee_sp, 
                    'referral_reward', 
                    'Bonus: Your first completed trade'
                );
            END IF;

            -- C: Update Referral Table Status
            UPDATE public.referrals 
            SET status = 'completed', 
                completed_at = now() 
            WHERE id = v_referral_id;

            INSERT INTO debug_logs (process_name, message, payload)
            VALUES ('referral_reward', 'Trade rewards granted successfully', jsonb_build_object(
                'trade_id', NEW.id, 
                'referrer_id', v_referrer_id, 
                'referee_id', NEW.buyer_id, 
                'referrer_sp', v_referrer_sp,
                'referee_sp', v_referee_sp
            ));
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('handle_referral_rewards_on_trade_completion', 'CRITICAL ERROR', jsonb_build_object('error', SQLERRM, 'trade_id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ALIGNMENT: Mark existing referrals as 'completed' if rewards were already given
-- This prevents the trigger from double-rewarding users who signed up before this fix
DO $$
DECLARE
    v_aligned_count INTEGER := 0;
BEGIN
    UPDATE public.referrals r
    SET status = 'completed', completed_at = created_at
    WHERE status = 'pending'
    AND EXISTS (
        SELECT 1 FROM public.sp_ledger st 
        WHERE st.user_id = r.referred_user_id 
        AND st.transaction_type = 'earn_referral'
    );
    
    GET DIAGNOSTICS v_aligned_count = ROW_COUNT;
    
    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('referral_alignment', 'Aligned existing referral statuses', jsonb_build_object('count', v_aligned_count));
END $$;

-- 4. Fix JSONB casting in award_listing_referral_sp (resolves 22023 error)
CREATE OR REPLACE FUNCTION public.award_listing_referral_sp(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referral_id UUID,
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_sp INTEGER;
  v_referee_sp INTEGER;
  v_referrer_awarded INTEGER := 0;
  v_referee_awarded INTEGER := 0;
  v_feature_enabled BOOLEAN := true;
BEGIN
  -- FEATURE TOGGLE CHECK: Extract as text first, THEN cast to BOOLEAN (BP-1)
  SELECT (config_value #>> '{}')::BOOLEAN INTO v_feature_enabled
  FROM public.sp_config
  WHERE config_key = 'referral_first_listing_enabled';

  v_feature_enabled := COALESCE(v_feature_enabled, true);
  IF NOT v_feature_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral listing bonus feature is disabled');
  END IF;

  -- Amounts from config: Extract as text first, THEN cast to INTEGER (BP-1)
  SELECT COALESCE((config_value #>> '{}')::INTEGER, 25) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_listing_sp';
  SELECT COALESCE((config_value #>> '{}')::INTEGER, 10) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_listing_sp';

  -- Award to Referrer
  IF v_referrer_sp > 0 THEN
      PERFORM public.adjust_sp_wallet(p_referrer_id, v_referrer_sp, 'referral_reward', 'Referral Bonus: Friend approved first listing');
      v_referrer_awarded := v_referrer_sp;
  END IF;

  -- Award to Referee
  IF v_referee_sp > 0 THEN
      PERFORM public.adjust_sp_wallet(p_referee_id, v_referee_sp, 'referral_bonus', 'Referral Bonus: First listing approved');
      v_referee_awarded := v_referee_sp;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp_awarded', v_referrer_awarded,
    'referee_sp_awarded', v_referee_awarded
  );
END;
$$ SET search_path = public;

-- 5. UPDATE LISTING TRIGGER to handle signup bonus when First Listing is first.
CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_listing_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_referral_status TEXT;
  v_referral_code TEXT;
  v_is_first_listing BOOLEAN;
  v_result JSONB;
  v_program_enabled BOOLEAN := true;
  v_listing_enabled BOOLEAN := true;
  v_trade_enabled BOOLEAN := true;
  v_referrer_sp INTEGER := 50;
  v_referee_sp INTEGER := 20;
BEGIN
  -- FEATURE TOGGLE CHECK
  SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_program_enabled FROM sp_config WHERE config_key = 'referral_program_enabled';
  SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_listing_enabled FROM sp_config WHERE config_key = 'referral_first_listing_enabled';
  SELECT COALESCE((config_value #>> '{}')::BOOLEAN, true) INTO v_trade_enabled FROM sp_config WHERE config_key = 'referral_first_trade_enabled';

  IF NOT v_program_enabled THEN
    RETURN NEW;
  END IF;

  -- We trigger when a listing becomes 'available' (approved)
  IF (NEW.status = 'available' AND (OLD.status IS NULL OR OLD.status <> 'available')) THEN
    
    v_referee_user_id := NEW.seller_id;

    -- 1. Check if user was referred
    SELECT referred_by, referred_by_code INTO v_referrer_user_id, v_referral_code
    FROM public.profiles
    WHERE user_id = v_referee_user_id;

    IF v_referrer_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- 2. Find the referral record
    SELECT id, status INTO v_referral_id, v_referral_status
    FROM public.referrals
    WHERE referrer_user_id = v_referrer_user_id
      AND referred_user_id = v_referee_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- 3. FIRST approved listing check
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.items i
      WHERE i.seller_id = v_referee_user_id
        AND i.status IN ('available', 'sold') 
        AND i.id <> NEW.id
        AND i.approved_at IS NOT NULL
    ) INTO v_is_first_listing;

    IF NOT v_is_first_listing THEN
      RETURN NEW;
    END IF;

    -- [REVISED] 4. Award Signup Reward ONLY if this is the ONLY active gate.
    -- If First Trade is ALSO enabled, we hold the main signup bonus (100 SP) for the trade action
    -- and only award the Listing Bonus (25 SP) now.
    IF v_referral_status = 'pending' AND v_listing_enabled AND NOT v_trade_enabled THEN
         -- Double-dip check
         IF NOT EXISTS (
             SELECT 1 FROM public.sp_ledger 
             WHERE user_id = v_referee_user_id AND transaction_type = 'earn_referral'
         ) THEN
             SELECT COALESCE((config_value #>> '{}')::INTEGER, 20) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';
             SELECT COALESCE((config_value #>> '{}')::INTEGER, 50) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
             
             PERFORM public.adjust_sp_wallet(v_referee_user_id, v_referee_sp, 'referral_bonus', 'Referral bonus from ' || v_referral_code);
             PERFORM public.adjust_sp_wallet(v_referrer_user_id, v_referrer_sp, 'referral_reward', 'Referral reward for ' || v_referral_code);
             
             -- Since no trade is required, we can mark the referral completed now
             UPDATE public.referrals SET status = 'completed', completed_at = now() WHERE id = v_referral_id;
         END IF;
    END IF;

    -- 5. Award specific LISTING BONUS (additional points) if enabled
    IF v_listing_enabled THEN
        SELECT public.award_listing_referral_sp(
          v_referrer_user_id,
          v_referee_user_id,
          v_referral_id,
          NEW.id
        ) INTO v_result;
    END IF;

    INSERT INTO debug_logs (process_name, message, payload)
    VALUES ('listing_referral_bonus', 'Processed listing bonus', jsonb_build_object(
        'item_id', NEW.id,
        'referee_id', v_referee_user_id,
        'is_first', v_is_first_listing,
        'result', v_result
    ));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Re-attach Triggers to ensure they point to the updated functions
DROP TRIGGER IF EXISTS trigger_referral_rewards_on_trade_completion ON trades;
CREATE TRIGGER trigger_referral_rewards_on_trade_completion
    AFTER UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION public.handle_referral_rewards_on_trade_completion();

DROP TRIGGER IF EXISTS trigger_process_referral_bonus_on_listing ON public.items;
CREATE TRIGGER trigger_process_referral_bonus_on_listing
  AFTER UPDATE OF status ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_bonus_on_listing_v2();
