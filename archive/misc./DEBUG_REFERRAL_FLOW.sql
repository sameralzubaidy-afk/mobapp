-- DEBUG_REFERRAL_FLOW.sql
-- Run this to diagnose why a completed trade didn't trigger referral rewards

-- 1. Check the trade status
SELECT id, buyer_id, seller_id, status, created_at, completed_at 
FROM trades 
WHERE status = 'completed' 
ORDER BY completed_at DESC 
LIMIT 5;

-- 2. Check the referrals table for those trades
-- Specifically looking for buyers who were referred
SELECT r.id, r.referrer_user_id, r.referred_user_id, r.status, r.referral_code, r.created_at, r.completed_at
FROM referrals r
JOIN trades t ON r.referred_user_id = t.buyer_id
WHERE t.status = 'completed';

-- 3. Check for any errors in the debug_logs table
SELECT * FROM debug_logs 
WHERE process_name IN ('handle_referral_rewards_on_trade_completion', 'adjust_sp_wallet')
ORDER BY created_at DESC 
LIMIT 20;

-- 4. Check sp_config values
SELECT key, value, last_updated 
FROM sp_config 
WHERE key IN ('referral_program_enabled', 'referral_first_trade_enabled', 'referral_bonus_referrer', 'referral_bonus_referee');

-- 5. Check trigger status
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_referral_rewards_on_trade_completion';
