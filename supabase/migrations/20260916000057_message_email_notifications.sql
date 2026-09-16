-- ================================================================
-- Migration: 082_message_email_notifications.sql
-- Module: MODULE-07 MSG-007 - Email Notifications for Unread Messages
-- Description: Add email tracking and admin config for email notification delay
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Schema (columns, config, functions)
-- ================================================================

-- 1. Add email_sent_at column to messages table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'email_sent_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN email_sent_at TIMESTAMPTZ;
    RAISE NOTICE 'Added email_sent_at column to messages table';
  ELSE
    RAISE NOTICE 'email_sent_at column already exists';
  END IF;
END$$;

-- 2. Add admin config for email notification delay (hours)
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'message_email_delay_hours',
  '1',
  'Hours to wait before sending email for unread message',
  'email',
  'number',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description;

-- 3. Add admin config to enable/disable email notifications
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'message_email_enabled',
  'true',
  'Enable/disable email notifications for unread messages',
  'email',
  'boolean',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description;

-- 4. Add index on email_sent_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_email_sent_at 
ON messages(email_sent_at) 
WHERE email_sent_at IS NULL AND deleted_at IS NULL;

-- 5. Create RPC function to find unread messages needing email
DROP FUNCTION IF EXISTS get_unread_messages_for_email(INTEGER);

CREATE OR REPLACE FUNCTION get_unread_messages_for_email(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  message_id UUID,
  trade_id UUID,
  sender_id UUID,
  recipient_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  sender_name TEXT,
  recipient_email TEXT
) AS $$
DECLARE
  v_delay_hours INTEGER;
  v_email_enabled BOOLEAN;
BEGIN
  -- Get email delay configuration
  SELECT CAST(value AS INTEGER) INTO v_delay_hours
  FROM admin_config
  WHERE key = 'message_email_delay_hours';

  IF v_delay_hours IS NULL THEN
    v_delay_hours := 1; -- Default to 1 hour
  END IF;

  -- Check if email notifications are enabled
  SELECT CAST(value AS BOOLEAN) INTO v_email_enabled
  FROM admin_config
  WHERE key = 'message_email_enabled';

  IF v_email_enabled IS FALSE THEN
    RAISE NOTICE 'Email notifications disabled';
    RETURN;
  END IF;

  -- Find unread messages older than delay threshold
  RETURN QUERY
  SELECT 
    m.id AS message_id,
    m.trade_id,
    m.sender_id,
    t.buyer_id AS recipient_id,
    m.content,
    m.created_at,
    sp.name AS sender_name,
    au.email AS recipient_email
  FROM messages m
  JOIN trades t ON t.id = m.trade_id
  JOIN profiles sp ON sp.user_id = m.sender_id
  JOIN auth.users au ON au.id = t.buyer_id
  WHERE m.email_sent_at IS NULL
    AND m.deleted_at IS NULL
    AND m.created_at < (NOW() - (v_delay_hours || ' hours')::INTERVAL)
    AND m.sender_id != t.buyer_id
  LIMIT p_limit;

  -- Also get messages for sellers
  RETURN QUERY
  SELECT 
    m.id AS message_id,
    m.trade_id,
    m.sender_id,
    t.seller_id AS recipient_id,
    m.content,
    m.created_at,
    sp.name AS sender_name,
    au.email AS recipient_email
  FROM messages m
  JOIN trades t ON t.id = m.trade_id
  JOIN profiles sp ON sp.user_id = m.sender_id
  JOIN auth.users au ON au.id = t.seller_id
  WHERE m.email_sent_at IS NULL
    AND m.deleted_at IS NULL
    AND m.created_at < (NOW() - (v_delay_hours || ' hours')::INTERVAL)
    AND m.sender_id != t.seller_id
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create RPC function to mark message email as sent
DROP FUNCTION IF EXISTS mark_message_email_sent(UUID);

CREATE OR REPLACE FUNCTION mark_message_email_sent(p_message_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE messages
  SET email_sent_at = NOW()
  WHERE id = p_message_id AND email_sent_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify column exists
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'email_sent_at';

-- Verify admin config
-- SELECT key, value FROM admin_config WHERE key IN ('message_email_delay_hours', 'message_email_enabled');

-- Verify index exists
-- SELECT indexname FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_email_sent_at';

-- Test RPC function
-- SELECT * FROM get_unread_messages_for_email(10);

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback this migration:
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_sent_at;
-- DELETE FROM admin_config WHERE key IN ('message_email_delay_hours', 'message_email_enabled');
-- DROP INDEX IF EXISTS idx_messages_email_sent_at;
-- DROP FUNCTION IF EXISTS get_unread_messages_for_email(INTEGER);
-- DROP FUNCTION IF EXISTS mark_message_email_sent(UUID);
