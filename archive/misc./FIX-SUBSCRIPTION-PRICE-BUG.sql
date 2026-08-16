-- ================================================================
-- FIX SUBSCRIPTION PRICE DISPLAY BUG
-- ================================================================
-- 
-- ISSUE: Compare Plans screen shows $1500.00 instead of $4.99
-- ROOT CAUSE: admin_config.subscription_price_monthly stored incorrectly
-- 
-- This script fixes the value to 499 cents = $4.99
-- ================================================================

-- Step 1: Check current value
SELECT 
  id,
  subscription_price_monthly,
  CASE 
    WHEN subscription_price_monthly >= 100 THEN subscription_price_monthly / 100
    ELSE subscription_price_monthly
  END as normalized_price_dollars
FROM admin_config 
WHERE id = 1;

-- Expected results:
-- If subscription_price_monthly = 150000 → normalized = $1500.00 (WRONG)
-- If subscription_price_monthly = 1500 → normalized = $15.00 (WRONG)
-- If subscription_price_monthly = 499 → normalized = $4.99 (CORRECT)

-- ================================================================

-- Step 2: Fix the value (ONLY RUN THIS IF PRICE IS WRONG)
UPDATE admin_config 
SET 
  subscription_price_monthly = 499,  -- $4.99 in cents
  updated_at = NOW()
WHERE id = 1;

-- ================================================================

-- Step 3: Verify the fix
SELECT 
  id,
  subscription_price_monthly,
  trial_period_days,
  platform_fee_buyer_fixed_cents,
  platform_fee_buyer_percentage,
  updated_at
FROM admin_config 
WHERE id = 1;

-- Expected results:
-- subscription_price_monthly: 499
-- trial_period_days: 30 (or configured value)
-- platform_fee_buyer_fixed_cents: 25 ($0.25)
-- platform_fee_buyer_percentage: 2.5 (2.5%)

-- ================================================================

-- NOTES:
-- 1. The normalizeSubscriptionPriceMonthly() function in adminConfig.ts
--    automatically converts cents to dollars if value >= 100
-- 2. Always store prices in CENTS (499 = $4.99, 999 = $9.99, etc.)
-- 3. The app will cache the config for 5 minutes, so force-refresh
--    or wait 5 minutes to see the updated price
-- 4. After fixing, the Compare Plans screen should show $4.99/mo
--    instead of $1500.00/mo

-- ================================================================
-- OPTIONAL: Set other recommended admin config values
-- ================================================================

-- Uncomment to set additional recommended values:
/*
UPDATE admin_config 
SET 
  -- Subscription
  subscription_price_monthly = 499,           -- $4.99/month
  trial_period_days = 30,                     -- 30-day trial
  
  -- Transaction Fees (Buyer)
  platform_fee_buyer_fixed_cents = 25,        -- $0.25 fixed
  platform_fee_buyer_percentage = 2.5,        -- 2.5%
  
  -- Transaction Fees (Seller)
  platform_fee_seller_fixed_cents = 25,       -- $0.25 fixed
  platform_fee_seller_percentage = 8.0,       -- 8%
  
  -- Subscriber Discounts
  subscriber_fee_reduction_fixed_cents = 15,  -- $0.15 discount
  subscriber_fee_reduction_percentage = 1.5,  -- 1.5% discount
  
  -- Swap Points
  sp_earn_rate_percentage = 100,              -- 100% of price = 1:1 ratio
  sp_max_redemption_percentage = 50,          -- Max 50% of purchase with SP
  sp_pending_days = 3,                        -- 3-day pending period
  sp_grace_period_days = 90,                  -- 90-day grace after cancel
  
  -- Update timestamp
  updated_at = NOW()
WHERE id = 1;
*/

-- ================================================================
-- END OF FIX SCRIPT
-- ================================================================
