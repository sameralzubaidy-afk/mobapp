-- File: supabase/migrations/20251222_add_sp_max_percentage_config.sql
-- TASK TRADE-V2-002: Add sp_max_percentage_per_purchase to admin_config

-- 1. Ensure columns exist (in case simpler schema was used)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_config' AND column_name='category') THEN
        ALTER TABLE admin_config ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_config' AND column_name='data_type') THEN
        ALTER TABLE admin_config ADD COLUMN data_type TEXT DEFAULT 'string';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_config' AND column_name='is_active') THEN
        ALTER TABLE admin_config ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Insert or update the SP max percentage configuration
INSERT INTO admin_config (key, value, description, category, data_type, is_active)
VALUES (
  'sp_max_percentage_per_purchase', 
  '50', 
  'Maximum percentage of an item price that can be paid using Swap Points (0-100).', 
  'swap_points', 
  'number', 
  TRUE
)
ON CONFLICT (key) 
DO UPDATE SET 
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  updated_at = NOW();

-- 3. Add other SP related configs if missing
INSERT INTO admin_config (key, value, description, category, data_type, is_active)
VALUES 
  ('sp_earn_multiplier', '1.0', 'Multiplier for earning Swap Points on sales.', 'swap_points', 'number', TRUE),
  ('sp_pending_days', '3', 'Number of days Swap Points remain pending before being released.', 'swap_points', 'number', TRUE),
  ('sp_expiration_days', '90', 'Number of days Swap Points remain valid before expiring.', 'swap_points', 'number', TRUE)
ON CONFLICT (key) DO NOTHING;
