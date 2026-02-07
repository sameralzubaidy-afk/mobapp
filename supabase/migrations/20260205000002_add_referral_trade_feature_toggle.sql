-- File: supabase/migrations/20260205000002_add_referral_trade_feature_toggle.sql
-- Mode B: Idempotent rerunnable migration
-- Purpose: Add feature toggle for referral first trade bonus
-- Dependency: Requires sp_config table and existing referral trade bonus RPC

-- =============================================================================
-- 1) ADD FEATURE TOGGLE FOR TRADE BONUS
-- =============================================================================

INSERT INTO public.sp_config (config_key, config_value, value_type, description, category) VALUES
  ('referral_first_trade_enabled', 'true', 'boolean', 'Enable/disable SP rewards when referee completes first approved trade', 'referral')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- 2) VERIFICATION QUERIES
-- =============================================================================

-- Verify config key was inserted
SELECT config_key, config_value, value_type, description, category
FROM public.sp_config
WHERE config_key = 'referral_first_trade_enabled';

-- List all referral feature toggles
SELECT config_key, config_value, value_type, description
FROM public.sp_config
WHERE category = 'referral' AND value_type = 'boolean'
ORDER BY config_key;
