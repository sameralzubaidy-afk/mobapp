-- ================================================================
-- Migration: 081_message_expiration.sql
-- Module: MODULE-07 MSG-004 - Message Expiration
-- Description: Automatically delete messages 30 days after trade completion
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Admin Config + Expiration Function
-- ================================================================

-- 1. Add admin config for message expiration days
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'message_expiration_days',
  '30',
  'Days after trade completion before messages are soft deleted',
  'moderation',
  'number',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  updated_at = NOW();

-- 2. Create function to mark expired messages
CREATE OR REPLACE FUNCTION mark_expired_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expiration_days INTEGER;
  v_deleted_count INTEGER;
BEGIN
  -- Get expiration days from config
  SELECT CAST(value AS INTEGER) INTO v_expiration_days
  FROM admin_config
  WHERE key = 'message_expiration_days';

  -- Default to 30 if not configured
  IF v_expiration_days IS NULL THEN
    v_expiration_days := 30;
  END IF;

  -- Mark messages as deleted if trade completed + expiration_days ago
  WITH expired_messages AS (
    UPDATE messages m
    SET 
      deleted_at = NOW(),
      updated_at = NOW()
    FROM trades t
    WHERE m.trade_id = t.id
      AND m.deleted_at IS NULL
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.completed_at < (NOW() - (v_expiration_days || ' days')::INTERVAL)
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM expired_messages;

  -- Log the deletion count
  RAISE NOTICE 'Marked % messages as expired', v_deleted_count;

  RETURN v_deleted_count;
END;
$$;

-- 3. Add comment to function
COMMENT ON FUNCTION mark_expired_messages() IS 'Marks messages as deleted (soft delete) X days after trade completion. Expiration period is configurable via admin_config.message_expiration_days';

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify admin config exists
-- SELECT key, value, data_type, description FROM admin_config WHERE key = 'message_expiration_days';

-- Verify function exists
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'mark_expired_messages';

-- Test function (DRY RUN - see what would be deleted)
-- SELECT COUNT(*) FROM messages m
-- INNER JOIN trades t ON m.trade_id = t.id
-- WHERE m.deleted_at IS NULL
--   AND t.status = 'completed'
--   AND t.completed_at IS NOT NULL
--   AND t.completed_at < (NOW() - INTERVAL '30 days');

-- Execute function (CAUTION: will soft delete messages)
-- SELECT mark_expired_messages();

-- Verify deleted messages are excluded from queries
-- SELECT COUNT(*) FROM messages WHERE deleted_at IS NOT NULL;

-- ================================================================
-- Common Failure Modes & Notes
-- ================================================================

/*
FAILURE MODE 1: trades.completed_at is NULL even when status = 'completed'
- This can happen if trade completion logic doesn't set completed_at
- Fix: Update complete_trade_v2 RPC to always set completed_at
- Workaround: Manually set completed_at for old trades

FAILURE MODE 2: admin_config table doesn't exist
- This table should exist from MODULE-01 INFRA-003
- If missing, create it first or add admin_config schema to this migration

FAILURE MODE 3: Function runs but count is always 0
- Check if trades have status = 'completed' AND completed_at is set
- Check if completed_at is old enough (> 30 days ago)
- Verify messages exist for those trades

PERFORMANCE NOTE:
- For large message tables (>100k rows), consider adding an index:
  CREATE INDEX IF NOT EXISTS idx_messages_expiration_check 
  ON messages(trade_id, deleted_at) WHERE deleted_at IS NULL;
*/
