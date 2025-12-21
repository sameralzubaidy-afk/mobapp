-- File: supabase/seed_admin_config.sql
-- Seed admin configuration values for SMS rate limiting and authentication settings
-- Run this after migrations: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed_admin_config.sql

-- Insert default admin configuration values
INSERT INTO admin_config (key, value, description)
VALUES 
  ('sms_rate_limit_per_hour', '10', 'Maximum SMS verification codes that can be sent per hour per phone number'),
  ('verification_code_expiry_minutes', '10', 'How long verification codes remain valid before expiring (in minutes)'),
  ('max_verification_attempts', '3', 'Maximum number of incorrect code attempts before requiring a new code'),
  ('max_login_attempts', '5', 'Maximum failed login attempts before account lockout'),
  ('password_reset_expiry_minutes', '15', 'Password reset token expiry time in minutes'),
  ('referral_bonus_points', '50', 'Swap Points awarded for successful referral (to both referrer and referred)'),
  ('referral_window_days', '60', 'Number of days to claim referral bonus after signup')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify seeded data
SELECT key, value, description, created_at, updated_at 
FROM admin_config 
ORDER BY key;
