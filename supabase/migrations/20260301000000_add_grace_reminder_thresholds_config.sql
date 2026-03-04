-- ============================================================================
-- Add grace_reminder_thresholds to admin_config
-- Purpose: Store configurable reminder notification thresholds for grace period
-- Date: 2026-03-01
-- Task: SUB-011
-- ============================================================================

-- Insert the new config key if it doesn't exist
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'grace_reminder_thresholds',
  '[60, 30, 7, 1]',
  'JSON array of day thresholds when grace period reminder notifications are sent (days before expiry)',
  'subscription',
  'json',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO NOTHING;

-- Verification query
SELECT key, value, description, category, data_type
FROM public.admin_config
WHERE key IN ('grace_period_days', 'grace_reminder_thresholds')
ORDER BY key;
