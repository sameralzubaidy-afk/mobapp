-- Migration: 20260826000002_support_messages_anon_contact.sql
-- Description: Allow logged-OUT (guest) users to submit support tickets.
--   - support_messages.user_id becomes NULLABLE (guests have no auth.users row)
--   - new contact_email column (required for guests — admin reply channel)
--   - new contact_phone column (optional guest field)
--   - anon INSERT RLS policy (guests insert with user_id NULL + contact_email)
-- Mode: Idempotent rerunnable (safe to re-run)
-- Applied to staging 2026-08-26 (see docs/decision-log.md, D2/D6).

-- 1. Make user_id nullable (guest submissions have no auth.users row)
ALTER TABLE public.support_messages ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add contact_email for guest submissions (admin reply channel)
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 3. Add optional contact_phone for guest submissions
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 4. Length guard for contact_phone (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_contact_phone_len_check'
  ) THEN
    ALTER TABLE public.support_messages
      ADD CONSTRAINT support_messages_contact_phone_len_check
      CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 20);
  END IF;
END $$;

-- 5. XOR check: authenticated rows carry no contact_email; guest rows MUST carry one
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_guest_contact_email_check'
  ) THEN
    ALTER TABLE public.support_messages
      ADD CONSTRAINT support_messages_guest_contact_email_check
      CHECK (
        (user_id IS NOT NULL AND contact_email IS NULL)
        OR
        (user_id IS NULL AND contact_email IS NOT NULL)
      );
  END IF;
END $$;

-- 6. RLS: allow guests (anon role) to submit a ticket (user_id NULL + contact_email present)
DROP POLICY IF EXISTS "support_messages_insert_anon" ON public.support_messages;
CREATE POLICY "support_messages_insert_anon" ON public.support_messages
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND contact_email IS NOT NULL);

-- ============================================================
-- Verification (SQL-3 / SQL-6)
-- ============================================================
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'support_messages' ORDER BY ordinal_position;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname IN ('support_messages_guest_contact_email_check','support_messages_contact_phone_len_check');
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'support_messages' ORDER BY policyname;
