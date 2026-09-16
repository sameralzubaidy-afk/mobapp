-- Migration: 20260826000003_support_message_replies.sql
-- Description: Store admin replies to support tickets (part of the admin
--   review + reply surface — decision D5). No client access; service-role only.
-- Mode: Idempotent rerunnable (safe to re-run)
-- Applied to staging 2026-08-26 (see docs/decision-log.md, D5).

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.support_message_replies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  support_message_id  UUID        NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  admin_id            UUID        REFERENCES auth.users(id),
  reply_text          TEXT        NOT NULL CHECK (char_length(reply_text) BETWEEN 1 AND 5000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.support_message_replies ENABLE ROW LEVEL SECURITY;

-- 3. RLS: admin-only surface (service role full access; no client access)
DROP POLICY IF EXISTS "support_message_replies_service_role" ON public.support_message_replies;
CREATE POLICY "support_message_replies_service_role" ON public.support_message_replies
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_support_message_replies_message_id ON public.support_message_replies(support_message_id);
CREATE INDEX IF NOT EXISTS idx_support_message_replies_created_at ON public.support_message_replies(created_at DESC);

-- ============================================================
-- Verification (SQL-3 / SQL-6)
-- ============================================================
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'support_message_replies' ORDER BY ordinal_position;
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'support_message_replies';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'support_message_replies';
