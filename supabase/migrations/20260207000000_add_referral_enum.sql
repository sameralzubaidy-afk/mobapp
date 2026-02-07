-- Step 1: Add 'referral' category to admin_config_category enum
-- This must run BEFORE the config sync migration tries to use 'referral' category

ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'referral';
