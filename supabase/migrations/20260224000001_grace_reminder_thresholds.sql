-- ================================================================
-- Migration: 20260224000001_grace_reminder_thresholds.sql
-- Module: MODULE-11 SUB-009 - Grace Period Countdown, Reminders & Expiry
-- Description: Add grace_reminder_thresholds admin config field
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Add grace_reminder_thresholds to admin_config
-- ================================================================

-- Insert grace_reminder_thresholds config (idempotent)
INSERT INTO public.admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'grace_reminder_thresholds',
  '[60, 30, 7, 1]',
  'Days before grace period expiry to send reminder notifications (JSON array)',
  'subscription',
  'json',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category;

-- Verification query
SELECT key, value, description, data_type, category
FROM public.admin_config
WHERE key = 'grace_reminder_thresholds';

-- Expected output:
-- key: grace_reminder_thresholds
-- value: [60, 30, 7, 1]
-- description: Days before grace period expiry to send reminder notifications (JSON array)
-- data_type: json
-- category: subscription

-- ================================================================
-- Common Failure Modes
-- ================================================================
/*
FAILURE MODE 1: Duplicate key constraint violation
- Cause: Key already exists
- Solution: Migration uses ON CONFLICT DO UPDATE (idempotent)

FAILURE MODE 2: Invalid JSON in value field
- Cause: Malformed JSON array
- Solution: Ensure value is valid JSON array format: [60, 30, 7, 1]

BEST PRACTICE:
- Admin can customize via admin portal: [90, 60, 30, 14, 7, 3, 1]
- System will send notification when days_remaining matches any value in array
*/
