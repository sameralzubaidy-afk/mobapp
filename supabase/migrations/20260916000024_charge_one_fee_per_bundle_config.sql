-- Migration: Add charge_one_fee_per_bundle admin config toggle
-- 
-- Purpose: Admin toggle to control whether a bundle checkout charges
-- the platform fee once (per bundle) or per item (current behavior).
-- Applies to both free-tier and subscriber fixed fees.
--
-- When enabled (true): A bundle with N items charges the platform fee exactly once.
-- When disabled (false, default): Each item in the bundle charges the fee (current behavior).

INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'charge_one_fee_per_bundle',
  'false',
  'When enabled, bundles charge the platform fee once instead of per item. Single-item trades are unaffected.',
  'fees',
  'boolean',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO NOTHING;
