-- File: supabase/migrations/20260205000004_seed_referral_feature_toggles.sql
-- Purpose: Seed missing referral feature toggle config keys
-- Mode: Idempotent (safe to re-run)

-- Ensure these referral feature toggle keys exist in sp_config
-- Note: config_value is JSONB, so we cast true/false to JSONB properly
INSERT INTO sp_config (config_key, config_value, value_type, description, category)
VALUES
  ('referral_first_trade_enabled', 'true'::jsonb, 'boolean', 'Enable SP bonus on first referee trade', 'referral'),
  ('referral_first_listing_enabled', 'true'::jsonb, 'boolean', 'Enable SP bonus on first referee listing', 'referral')
ON CONFLICT (config_key) DO NOTHING;

-- Verification query:
-- SELECT config_key, config_value, category FROM sp_config 
-- WHERE config_key IN ('referral_first_trade_enabled', 'referral_first_listing_enabled');
