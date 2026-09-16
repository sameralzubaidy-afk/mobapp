-- Create admin_config table
CREATE TABLE IF NOT EXISTS public.admin_config (
  key VARCHAR(255) PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_config_read_all" ON public.admin_config;
DROP POLICY IF EXISTS "admin_config_write_service_role" ON public.admin_config;

-- Create policies
CREATE POLICY "admin_config_read_all" ON public.admin_config
  FOR SELECT USING (true);

CREATE POLICY "admin_config_write_service_role" ON public.admin_config
  FOR UPDATE USING (auth.role() = 'service_role');

-- Insert default configuration values
-- FIX-Task-40 phase 3: the CANONICAL admin_config (20250113_create_admin_config.sql,
-- which sorts EARLIER) declares `category admin_config_category NOT NULL`, so this
-- INSERT must supply it. All three keys are SMS/verification settings and 'sms' is a
-- label of the canonical enum. Note the NOT NULL check is evaluated while the row is
-- formed, BEFORE `ON CONFLICT` resolves - which is why omitting the column failed even
-- for keys that already existed.
INSERT INTO public.admin_config (key, value, description, category) VALUES
  ('sms_rate_limit_per_hour', '10', 'Maximum number of SMS verification codes that can be sent per hour per phone number. Helps prevent SMS spam and abuse.', 'sms'),
  ('verification_code_expiry_minutes', '10', 'How long verification codes remain valid before expiring (in minutes).', 'sms'),
  ('max_verification_attempts', '5', 'Maximum number of incorrect code attempts before requiring a new code.', 'sms')
ON CONFLICT (key) DO NOTHING;
