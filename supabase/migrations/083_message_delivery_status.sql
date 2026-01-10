-- ================================================================
-- Migration: 083_message_delivery_status.sql
-- Module: MODULE-07 MSG-008 - Message Delivery Status Tracking
-- Description: Add delivery status tracking (sent, delivered, read)
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Schema (columns, enums, indexes, RPC)
-- ================================================================

-- 1. Create delivery status enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_delivery_status') THEN
    CREATE TYPE message_delivery_status AS ENUM ('sent', 'delivered', 'read');
    RAISE NOTICE 'Created message_delivery_status enum';
  ELSE
    RAISE NOTICE 'message_delivery_status enum already exists';
  END IF;
END$$;

-- 2. Add delivery_status column to messages table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE messages ADD COLUMN delivery_status message_delivery_status NOT NULL DEFAULT 'sent';
    RAISE NOTICE 'Added delivery_status column to messages table';
  ELSE
    RAISE NOTICE 'delivery_status column already exists';
  END IF;
END$$;

-- 3. Add delivered_at column (timestamp when status changed to delivered)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMPTZ;
    RAISE NOTICE 'Added delivered_at column to messages table';
  ELSE
    RAISE NOTICE 'delivered_at column already exists';
  END IF;
END$$;

-- 4. Add read_at column (timestamp when status changed to read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ;
    RAISE NOTICE 'Added read_at column to messages table';
  ELSE
    RAISE NOTICE 'read_at column already exists';
  END IF;
END$$;

-- 5. Add indexes for efficient status queries
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status 
ON messages(delivery_status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_read_status
ON messages(trade_id, delivery_status)
WHERE deleted_at IS NULL AND delivery_status != 'read';

-- 6. Create RPC function to update message delivery status
DROP FUNCTION IF EXISTS update_message_delivery_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_message_delivery_status(
  p_message_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status message_delivery_status;
BEGIN
  -- Validate status
  IF p_status NOT IN ('sent', 'delivered', 'read') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be sent, delivered, or read', p_status;
  END IF;

  -- Get current status
  SELECT delivery_status INTO v_current_status
  FROM messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;

  -- Only allow status progression: sent -> delivered -> read
  IF p_status = 'delivered' THEN
    IF v_current_status = 'read' THEN
      -- Already read, don't downgrade
      RETURN FALSE;
    END IF;

    UPDATE messages
    SET 
      delivery_status = 'delivered'::message_delivery_status,
      delivered_at = COALESCE(delivered_at, NOW())
    WHERE id = p_message_id;

  ELSIF p_status = 'read' THEN
    -- Can upgrade from any status to read
    UPDATE messages
    SET 
      delivery_status = 'read'::message_delivery_status,
      delivered_at = COALESCE(delivered_at, NOW()),
      read_at = COALESCE(read_at, NOW())
    WHERE id = p_message_id;

  ELSE
    -- 'sent' status - no update needed (already default)
    RETURN FALSE;
  END IF;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create RPC function to mark trade messages as delivered (when recipient opens chat)
DROP FUNCTION IF EXISTS mark_trade_messages_delivered(UUID, UUID);

CREATE OR REPLACE FUNCTION mark_trade_messages_delivered(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Mark all unread messages from other party as delivered
  UPDATE messages
  SET 
    delivery_status = 'delivered'::message_delivery_status,
    delivered_at = COALESCE(delivered_at, NOW())
  WHERE trade_id = p_trade_id
    AND sender_id != p_user_id
    AND delivery_status = 'sent'::message_delivery_status
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create RPC function to mark trade messages as read (when recipient views chat)
DROP FUNCTION IF EXISTS mark_trade_messages_read(UUID, UUID);

CREATE OR REPLACE FUNCTION mark_trade_messages_read(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Mark all messages from other party as read
  UPDATE messages
  SET 
    delivery_status = 'read'::message_delivery_status,
    delivered_at = COALESCE(delivered_at, NOW()),
    read_at = COALESCE(read_at, NOW())
  WHERE trade_id = p_trade_id
    AND sender_id != p_user_id
    AND delivery_status != 'read'::message_delivery_status
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create RLS policies for delivery status updates
-- Users can update delivery status on messages they received
DROP POLICY IF EXISTS "Users can update delivery status of received messages" ON messages;

CREATE POLICY "Users can update delivery status of received messages"
  ON messages FOR UPDATE
  USING (
    -- User is part of the trade
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
      -- AND user is NOT the sender (can only update received messages)
      AND messages.sender_id != auth.uid()
    )
  )
  WITH CHECK (
    -- Only allow updating delivery_status, delivered_at, read_at fields
    -- (checked at application level)
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
      AND messages.sender_id != auth.uid()
    )
  );

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify enum exists
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'message_delivery_status'::regtype ORDER BY enumsortorder;

-- Verify columns exist
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'messages' AND column_name IN ('delivery_status', 'delivered_at', 'read_at');

-- Verify indexes exist
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'messages' AND indexname IN ('idx_messages_delivery_status', 'idx_messages_read_status');

-- Test RPC functions
-- SELECT update_message_delivery_status('<message_id>', 'delivered');
-- SELECT mark_trade_messages_delivered('<trade_id>', '<user_id>');
-- SELECT mark_trade_messages_read('<trade_id>', '<user_id>');

-- ================================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS "Users can update delivery status of received messages" ON messages;
-- DROP FUNCTION IF EXISTS mark_trade_messages_read(UUID, UUID);
-- DROP FUNCTION IF EXISTS mark_trade_messages_delivered(UUID, UUID);
-- DROP FUNCTION IF EXISTS update_message_delivery_status(UUID, TEXT);
-- DROP INDEX IF EXISTS idx_messages_read_status;
-- DROP INDEX IF EXISTS idx_messages_delivery_status;
-- ALTER TABLE messages DROP COLUMN IF EXISTS read_at;
-- ALTER TABLE messages DROP COLUMN IF EXISTS delivered_at;
-- ALTER TABLE messages DROP COLUMN IF EXISTS delivery_status;
-- DROP TYPE IF EXISTS message_delivery_status;
