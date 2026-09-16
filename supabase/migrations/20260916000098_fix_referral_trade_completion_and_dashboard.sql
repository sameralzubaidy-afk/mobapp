-- Migration: Fix Referral Trade Completion Rewards and Dashboard Visibility
-- Mode: Idempotent Rerunnable

-- 1. Ensure RLS allows referrers to see their referrals (Dashboard Fix)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select_policy" ON public.referrals;
CREATE POLICY "referrals_select_policy" ON public.referrals
    FOR SELECT TO authenticated
    USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 2. Enhanced Trigger for Trade Completion
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
    v_trade_count INTEGER;
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

            -- C: Update Referral Table Status (CRITICAL FOR DASHBOARD)
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

-- Re-attach trigger
DROP TRIGGER IF EXISTS trigger_referral_rewards_on_trade_completion ON public.trades;
CREATE TRIGGER trigger_referral_rewards_on_trade_completion
    AFTER UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION public.handle_referral_rewards_on_trade_completion();

-- 3. Backfill missing referral records from profiles (BP-2/Sync)
INSERT INTO public.referrals (referrer_user_id, referred_user_id, status, referral_code)
SELECT referred_by, user_id, 'pending', COALESCE(referred_by_code, 'unknown')
FROM profiles
WHERE referred_by IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM referrals WHERE referred_user_id = profiles.user_id
)
ON CONFLICT DO NOTHING;

-- 4. Manual catch-up for trades already completed while logic was buggy (Sync)
DO $$
DECLARE
    v_rec RECORD;
    v_referrer_sp INTEGER := 25;
    v_referee_sp INTEGER := 10;
BEGIN
    -- Get amounts
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 25) INTO v_referrer_sp FROM sp_config WHERE config_key = 'referral_reward_referrer_sp';
    SELECT COALESCE((config_value #>> '{}')::INTEGER, 10) INTO v_referee_sp FROM sp_config WHERE config_key = 'referral_reward_referee_sp';

    FOR v_rec IN 
        SELECT t.id as trade_id, t.buyer_id, ref.referrer_user_id, ref.id as referral_id
        FROM trades t
        JOIN referrals ref ON t.buyer_id = ref.referred_user_id
        WHERE t.status = 'completed' 
        AND ref.status = 'pending'
    LOOP
        -- Credit Referrer
        PERFORM public.adjust_sp_wallet(v_rec.referrer_user_id, v_referrer_sp, 'referral_reward', 'Bonus: Friend (#' || SUBSTRING(v_rec.buyer_id::text, 1, 8) || ') completed trade');
        -- Credit Referee
        PERFORM public.adjust_sp_wallet(v_rec.buyer_id, v_referee_sp, 'referral_reward', 'Bonus: Your first completed trade');
        -- Update record
        UPDATE referrals SET status = 'completed', completed_at = now() WHERE id = v_rec.referral_id;
        
        INSERT INTO debug_logs (process_name, message, payload)
        VALUES ('referral_catchup', 'Granted missed rewards', jsonb_build_object('trade_id', v_rec.trade_id, 'referee', v_rec.buyer_id));
    END LOOP;
END $$;

-- Verification Query
-- SELECT * FROM debug_logs WHERE process_name = 'referral_catchup';
