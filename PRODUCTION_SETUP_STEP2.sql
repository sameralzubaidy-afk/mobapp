-- ========================================
-- STEP 2: Create enum and table
-- ========================================

CREATE TYPE admin_config_category AS ENUM ('subscription', 'swap_points', 'fees', 'sms', 'email', 'moderation', 'safety', 'analytics', 'feature_flags');

CREATE TABLE admin_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category admin_config_category NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string',
  is_secret BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT valid_key_format CHECK (key ~ '^[a-z0-9_]+$')
);
