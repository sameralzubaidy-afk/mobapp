-- Check SP Config and Recent Trades for Referral Logic
-- This helps diagnose why referral rewards weren't credited

-- 1. Check referral config toggles and values
SELECT config_key, config_value, category 
FROM public.sp_config 
WHERE config_key LIKE 'referral_%';

-- 2. Check if the buyer has referred_by set
-- (Using the user_id from the user's previous message)
SELECT user_id, name, referred_by, referred_by_code 
FROM public.profiles 
WHERE user_id = '56496d9d-6d97-45d4-9de0-2c92a47e6cdb';

-- 3. Check the trade record
SELECT id, buyer_id, seller_id, status, completed_at, updated_at
FROM public.trades
WHERE buyer_id = '56496d9d-6d97-45d4-9de0-2c92a47e6cdb'
ORDER BY updated_at DESC;

-- 4. Check debug logs for any errors or successes
SELECT * FROM public.debug_logs 
WHERE process_name = 'referral_reward' 
   OR (payload->>'buyer_id') = '56496d9d-6d97-45d4-9de0-2c92a47e6cdb'
ORDER BY created_at DESC;

-- 5. Check sp_ledger for the referrer
-- (Using Bob's user_id: dec51263-f5bf-4239-ac6e-d745ca9d660c)
SELECT * FROM public.sp_ledger
WHERE user_id = 'dec51263-f5bf-4239-ac6e-d745ca9d660c'
ORDER BY created_at DESC;
