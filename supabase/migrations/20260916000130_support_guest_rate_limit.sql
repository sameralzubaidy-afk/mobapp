-- Migration: 20260826000004_support_guest_rate_limit.sql
-- Description: Abuse-protection for the logged-OUT (guest) support ticket flow.
--   Caps anonymous support_messages submissions per contact_email (max 3 per 24h).
--   Authenticated submissions are unaffected (already gated by login + RLS).
-- Mode: Idempotent rerunnable (safe to re-run)
-- Companion: mobile ContactSupportScreen.tsx matches on SQLSTATE 'GRATL' to show
--            a friendly "limit reached" alert instead of a raw DB error.
-- Depends on: 311_support_messages.sql, 20260826000002_support_messages_anon_contact.sql

-- ============================================================
-- BLOCK 1: Schema (function)  →  BLOCK 2: trigger + index
-- ============================================================

-- 1. Trigger function: enforce guest rate limit (max 3 per contact_email per 24h)
CREATE OR REPLACE FUNCTION public.fn_support_guest_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- SECURITY DEFINER needed because: the anon role has NO SELECT policy on
-- public.support_messages, so an invoker-rights trigger would count 0 existing
-- guest rows and the rate limit would never fire. As definer (table owner) the
-- function can read all rows to count the window. Search path pinned to public.
DECLARE
  v_count INTEGER;
BEGIN
  -- Only guest submissions are rate-limited. Authenticated rows (user_id set)
  -- short-circuit here and are always allowed (login is the anti-abuse gate).
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Count this contact_email's guest submissions in the rolling 24h window.
  -- The trigger fires BEFORE INSERT, so the current row is not yet counted.
  SELECT COUNT(*) INTO v_count
  FROM public.support_messages sm
  WHERE sm.user_id IS NULL
    AND sm.contact_email = NEW.contact_email
    AND sm.created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= 3 THEN
    -- Best-effort block log for abuse monitoring; never let a logging failure
    -- suppress the RAISE below (BP-4: log, then re-raise the real outcome).
    BEGIN
      INSERT INTO public.debug_logs (process_name, message, payload)
      VALUES (
        'support_guest_rate_limit',
        'BLOCKED',
        jsonb_build_object(
          'contact_email', NEW.contact_email,
          'count_24h', v_count
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'support_guest_rate_limit: could not log block: %', SQLERRM;
    END;

    -- Friendly, human copy surfaced to the client (matched on SQLSTATE 'GRATL').
    RAISE EXCEPTION 'You have reached the limit for support messages. Please try again later.'
      USING ERRCODE = 'GRATL';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- BLOCK 2: Security + Performance
-- ============================================================

-- 2. BEFORE INSERT trigger (guest rows only — user_id NULL + contact_email set)
DROP TRIGGER IF EXISTS trg_support_guest_rate_limit ON public.support_messages;
CREATE TRIGGER trg_support_guest_rate_limit
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW
  WHEN (NEW.user_id IS NULL AND NEW.contact_email IS NOT NULL)
  EXECUTE FUNCTION public.fn_support_guest_rate_limit();

-- 3. Partial index backing the 24h count query (guest rows only)
CREATE INDEX IF NOT EXISTS idx_support_messages_guest_rate_limit
  ON public.support_messages (contact_email, created_at DESC)
  WHERE user_id IS NULL;

-- ============================================================
-- Verification queries (run after applying)
-- ============================================================
-- Function:
--   SELECT proname, prosrc FROM pg_proc WHERE proname = 'fn_support_guest_rate_limit';
-- Trigger (incl. WHEN condition):
--   SELECT trigger_name, event_manipulation, action_statement, condition
--   FROM information_schema.triggers
--   WHERE trigger_schema = 'public' AND event_object_table = 'support_messages';
-- Index:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'support_messages'
--     AND indexname = 'idx_support_messages_guest_rate_limit';
-- Behaviour (simulate the 4th-blocked case via the anon insert path):
--   INSERT 3 guest rows for one contact_email, then a 4th must fail with
--   SQLSTATE 'GRATL' and the message 'You have reached the limit for support
--   messages. Please try again later.'  (See docs/ note + QA test steps.)
--   Authenticated inserts (user_id set) must continue to succeed.
-- ============================================================
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_support_guest_rate_limit ON public.support_messages;
--   DROP FUNCTION IF EXISTS public.fn_support_guest_rate_limit();
--   DROP INDEX IF EXISTS idx_support_messages_guest_rate_limit;
-- ============================================================
