-- Migration: Remove Trial Extension Artifacts
-- Purpose: Fully remove referral-based trial extension schema/RPC/config if it exists.
-- This migration is safe to run even if the original trial-extension migration was never applied.

-- 1) Remove RPC
DROP FUNCTION IF EXISTS public.extend_trial_period(UUID, UUID);

-- 2) Remove subscription column
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS referral_extensions_used;

-- 3) Remove admin_config keys
DELETE FROM admin_config
WHERE key IN ('max_referral_extensions', 'referral_extension_days');
