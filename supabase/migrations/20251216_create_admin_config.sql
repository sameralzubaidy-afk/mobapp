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
INSERT INTO public.admin_config (key, value, description) VALUES
  ('sms_rate_limit_per_hour', '10', 'Maximum number of SMS verification codes that can be sent per hour per phone number. Helps prevent SMS spam and abuse.'),
  ('verification_code_expiry_minutes', '10', 'How long verification codes remain valid before expiring (in minutes).'),
  ('max_verification_attempts', '5', 'Maximum number of incorrect code attempts before requiring a new code.')
ON CONFLICT (key) DO NOTHING;
