-- File: supabase/migrations/20260201000000_fix_referral_rewards_v2_bridge.sql
-- Description: Bridge the legacy Referral system to the modern SP Ledger system.
-- Mode: Idempotent rerunnable migration
-- Changes:
-- 1. Update sp_config with V2 reward amounts (Referrer: 25, Referee: 10)
-- 2. Update referrals table status constraint to include 'completed'
-- 3. Modernize referral reward trigger to use award_referral_sp (sp_ledger/sp_batches)
-- 4. Ensure rewards are only granted on the FIRST completed trade.

-- =============================================================================
-- 1. UPDATE SP CONFIG AMOUNTS (MODULE-11 V2 COMPLIANCE)
-- =============================================================================

UPDATE public.sp_config 
SET config_value = '25' 
WHERE config_key = 'referral_reward_referrer_sp';

UPDATE public.sp_config 
SET config_value = '10' 
WHERE config_key = 'referral_reward_referee_sp';

-- If they don't exist, insert them
INSERT INTO public.sp_config (config_key, config_value, value_type, description, category)
SELECT 'referral_reward_referrer_sp', '25', 'number', 'SP awarded to referrer when referee completes first trade', 'referral'
WHERE NOT EXISTS (SELECT 1 FROM sp_config WHERE config_key = 'referral_reward_referrer_sp');

INSERT INTO public.sp_config (config_key, config_value, value_type, description, category)
SELECT 'referral_reward_referee_sp', '10', 'number', 'SP awarded to referee when they complete first trade', 'referral'
WHERE NOT EXISTS (SELECT 1 FROM sp_config WHERE config_key = 'referral_reward_referee_sp');

-- =============================================================================
-- 2. UPDATE REFERRALS TABLE STATUS
-- =============================================================================

-- Add 'completed' to the status check if not already present
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'completed', 'claimed', 'expired'));

-- Migrate existing 'claimed' to 'completed' for UI consistency
UPDATE public.referrals SET status = 'completed' WHERE status = 'claimed';

-- =============================================================================
-- 3. CREATE VOID FUNCTION: process_referral_bonus_on_trade_v2
-- =============================================================================
-- This replaces the legacy process_referral_bonus_on_trade
-- It uses award_referral_sp which handles ledger + wallets + batches

CREATE OR REPLACE FUNCTION public.process_referral_bonus_on_trade_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_referral_record RECORD;
    v_result JSONB;
BEGIN
    -- SECURITY CONTEXT: This function runs as SECURITY DEFINER via the award_referral_sp call
    -- Only trigger when trade status changes to 'completed'
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed')) THEN
        
        -- Check if either buyer or seller is a referee in a pending referral
        -- We look for the referee specifically as the one completing their first trade
        SELECT * INTO v_referral_record
        FROM public.referrals
        WHERE (referred_user_id = NEW.buyer_id OR referred_user_id = NEW.seller_id)
          AND status = 'pending'
        LIMIT 1;

        -- If a pending referral is found, check if this is indeed their FIRST completed trade
        IF v_referral_record IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.trades 
                WHERE (buyer_id = v_referral_record.referred_user_id OR seller_id = v_referral_record.referred_user_id)
                  AND status = 'completed'
                  AND id <> NEW.id
            ) THEN
                -- Award the rewards using the modern SP function (from migration 094)
                -- This function handles ledger, wallet, and batches
                -- It also checks if both users are active/trial subscribers as per V2.
                SELECT award_referral_sp(
                    v_referral_record.referrer_user_id,
                    v_referral_record.referred_user_id,
                    v_referral_record.id
                ) INTO v_result;

                -- Update the referral status to 'completed' regardless of success (or failure)
                -- to prevent multiple reward attempts if they don't qualify (e.g. no subscription)
                UPDATE public.referrals
                SET 
                    status = 'completed',
                    claimed_at = NOW(),
                    bonus_claimed_at = NOW(),
                    bonus_claimed_referrer_at = NOW(),
                    bonus_points = COALESCE((SELECT (config_value)::int FROM sp_config WHERE config_key = 'referral_reward_referee_sp'), 10),
                    bonus_points_referrer = COALESCE((SELECT (config_value)::int FROM sp_config WHERE config_key = 'referral_reward_referrer_sp'), 25)
                WHERE id = v_referral_record.id;
                
                -- Log debugging info
                IF (v_result->>'success')::BOOLEAN THEN
                    RAISE NOTICE 'Referral rewards successfully granted for referral %', v_referral_record.id;
                ELSE
                    RAISE WARNING 'Referral % processed but rewards not granted: %', v_referral_record.id, v_result->>'error';
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 4. RECREATE TRIGGER ON trades TABLE
-- =============================================================================

-- Drop legacy trigger if it exists
DROP TRIGGER IF EXISTS trigger_process_referral_bonus_on_trade ON public.trades;

-- Create the new modernized trigger
CREATE TRIGGER trigger_process_referral_bonus_on_trade
    AFTER UPDATE OF status ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.process_referral_bonus_on_trade_v2();

-- =============================================================================
-- 5. VERIFICATION QUERIES
-- =============================================================================

-- 1. Check config values
-- SELECT config_key, config_value FROM sp_config WHERE config_key LIKE 'referral_reward_%_sp';

-- 2. Verify trigger exists
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_process_referral_bonus_on_trade';

-- 3. Check for any 'pending' referrals that missed their reward
-- SELECT * FROM referrals WHERE status = 'pending';
