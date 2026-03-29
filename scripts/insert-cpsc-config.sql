-- SAFETY-002: Insert CPSC recall check configuration into admin_config
-- Run this SQL in Supabase SQL Editor after migration 305

-- Insert CPSC recall check enabled flag (default: true)
INSERT INTO admin_config (key, value, category, description)
VALUES (
  'cpsc_recall_check_enabled',
  'true',
  'safety',
  'Enable automatic CPSC recall matching for new listings'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert CPSC match threshold (default: 0.5)
INSERT INTO admin_config (key, value, category, description)
VALUES (
  'cpsc_match_threshold',
  '0.5',
  'safety',
  'Confidence threshold (0.0-1.0) for automatic item flagging. Items with similarity score >= this value will be flagged for review.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify insertion
SELECT key, value, category, description, updated_at 
FROM admin_config 
WHERE key IN ('cpsc_recall_check_enabled', 'cpsc_match_threshold')
ORDER BY key;
