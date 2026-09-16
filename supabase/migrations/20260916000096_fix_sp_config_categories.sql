-- Fix sp_config Categories for Referral/Starter Pack
-- Mode: Idempotent Rerunnable Migration
-- Problem: Many referral-related keys live in sp_config with category='general',
--          while the admin UI/API sometimes filters by category='referral' / 'starter_pack'.
-- Solution: Normalize categories based on config_key prefixes.

-- 1) Referral keys
UPDATE public.sp_config sc
SET category = 'referral'
WHERE sc.config_key LIKE 'referral_%'
  AND (sc.category IS NULL OR sc.category = 'general');

-- 2) Starter pack keys
UPDATE public.sp_config sc
SET category = 'starter_pack'
WHERE sc.config_key LIKE 'starter_pack_%'
  AND (sc.category IS NULL OR sc.category = 'general');

-- Verification
-- SELECT config_key, category FROM public.sp_config WHERE config_key LIKE 'referral_%' ORDER BY config_key;
-- SELECT config_key, category FROM public.sp_config WHERE config_key LIKE 'starter_pack_%' ORDER BY config_key;
