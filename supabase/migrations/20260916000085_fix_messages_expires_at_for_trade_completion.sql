-- Migration: 20260105000000_fix_messages_expires_at_for_trade_completion.sql
-- Purpose: Fix trade completion failures caused by trigger writing messages.expires_at when column is missing.
-- Aligns message expiration trigger with admin_config.message_expiration_days (defaults to 30).
--
-- SQL Mode: Idempotent rerunnable migration

-- ============================================================================
-- BLOCK 1 — Schema
-- ============================================================================

-- 1) Add expires_at (nullable) to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2) Create/replace trigger function
CREATE OR REPLACE FUNCTION public.set_message_expiration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiration_days INTEGER;
BEGIN
  -- Only set expiration when trade becomes completed
  IF (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
    -- Read admin-configurable retention period (fallback to 30)
    SELECT NULLIF(TRIM(ac.value), '')::INTEGER
      INTO v_expiration_days
    FROM public.admin_config ac
    WHERE ac.key = 'message_expiration_days'
      AND ac.is_active = TRUE
    LIMIT 1;

    IF v_expiration_days IS NULL THEN
      v_expiration_days := 30;
    END IF;

    UPDATE public.messages m
    SET expires_at = COALESCE(NEW.completed_at, NOW()) + (v_expiration_days || ' days')::INTERVAL
    WHERE m.trade_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- BLOCK 2 — Security + Performance
-- ============================================================================

-- 3) Ensure the trigger exists and points to the latest function body
DROP TRIGGER IF EXISTS set_message_expiration_after_trade_complete ON public.trades;
CREATE TRIGGER set_message_expiration_after_trade_complete
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.set_message_expiration();

-- 4) Optional index for future cleanup queries
CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON public.messages(expires_at);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Confirm column exists
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='messages' AND column_name='expires_at';
--
-- Confirm trigger exists
-- SELECT tgname
-- FROM pg_trigger
-- WHERE tgrelid = 'public.trades'::regclass
--   AND tgname = 'set_message_expiration_after_trade_complete';
