-- ================================================================
-- Migration: 081_enable_realtime_messages.sql
-- Module: MODULE-07 MSG-001 - Enable Realtime on Messages Table
-- Description: Ensure realtime is properly enabled for the messages table
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- Enable realtime broadcasts on the messages table
-- This allows subscriptions to receive INSERT/UPDATE/DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify realtime is enabled
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
