-- ================================================================
-- Migration: 080_messages_table.sql
-- Module: MODULE-07 MSG-001 - Supabase Realtime Chat
-- Description: Create messages table for real-time text messaging between buyers and sellers
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Schema (tables, constraints, indexes, RLS)
-- ================================================================

-- 1. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) <= 2000),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT content_or_image CHECK (
    (message_type = 'text' AND content IS NOT NULL) OR
    (message_type = 'image' AND image_url IS NOT NULL)
  )
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_trade_id ON messages(trade_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NULL;

-- 3. Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "Users can view messages from own trades" ON messages;
DROP POLICY IF EXISTS "Users can send messages to own trades" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;

-- 5. Create RLS policies

-- Users can view messages from their trades
CREATE POLICY "Users can view messages from own trades"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = messages.trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    )
    AND deleted_at IS NULL
  );

-- Users can send messages to their trades
CREATE POLICY "Users can send messages to own trades"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_id
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    )
  );

-- Users can soft delete own messages
CREATE POLICY "Users can delete own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- 6. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create updated_at trigger
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify table exists
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'messages';

-- Verify columns
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position;

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'messages';

-- Verify RLS enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'messages';

-- Verify policies
-- SELECT policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'messages';

-- Test insert (run as authenticated user)
-- INSERT INTO messages (trade_id, sender_id, content) VALUES ('<valid_trade_id>', auth.uid(), 'Test message');

-- Test select
-- SELECT id, trade_id, sender_id, content, created_at FROM messages WHERE trade_id = '<valid_trade_id>' ORDER BY created_at DESC LIMIT 5;
