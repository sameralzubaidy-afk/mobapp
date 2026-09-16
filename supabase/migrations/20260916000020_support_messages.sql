-- Migration: 311_support_messages.sql
-- Description: Creates support_messages table for user-submitted help requests
-- Mode: Idempotent (safe to re-run)
-- BP-9 ordering: tables → constraints → RLS → policies → indexes

-- ============================================================
-- BLOCK 1: Schema
-- ============================================================

-- 1. Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject    TEXT        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),
  message    TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  status     TEXT        NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BLOCK 2: Security + Indexes
-- ============================================================

-- Drop existing policies first (idempotent re-run safety)
DROP POLICY IF EXISTS "support_messages_insert_own"   ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_own"   ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_service_role" ON public.support_messages;

-- Authenticated users can submit their own messages
CREATE POLICY "support_messages_insert_own" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users can view their own messages
CREATE POLICY "support_messages_select_own" ON public.support_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role (admin portal) has full access
CREATE POLICY "support_messages_service_role" ON public.support_messages
  FOR ALL TO service_role
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id   ON public.support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status    ON public.support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);

-- ============================================================
-- Verification queries (run after applying migration)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns WHERE table_name = 'support_messages' ORDER BY ordinal_position;

-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'support_messages';

-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'support_messages';
