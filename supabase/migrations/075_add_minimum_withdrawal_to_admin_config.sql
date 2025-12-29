-- Migration: Add minimum withdrawal amount to admin_config
-- Allows admins to dynamically configure the minimum withdrawal threshold
-- If set to 0, the minimum is effectively disabled

-- Add minimum_withdrawal_amount_cents to admin_config
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active) VALUES
('minimum_withdrawal_amount_cents', '500', 'Minimum withdrawal amount in cents (e.g., 500 = $5.00). Set to 0 to disable minimum.', 'fees', 'number', FALSE, TRUE)
ON CONFLICT (key) DO UPDATE
  SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- Add comment for documentation
COMMENT ON COLUMN admin_config.key IS 'Configuration key. Example: minimum_withdrawal_amount_cents controls the minimum payout threshold.';
