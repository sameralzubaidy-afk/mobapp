-- ==========================================================================
-- QUICK FIX: Trade completion failing due to missing messages.expires_at
-- ==========================================================================
-- Symptom (buyer completes trade):
--   column "expires_at" of relation "messages" does not exist
--
-- Cause:
--   A DB trigger function public.set_message_expiration() runs when a trade
--   status flips to 'completed' and updates messages.expires_at.
--   Some environments have the trigger but not the column.
--
-- Fix:
--   1) Add messages.expires_at
--   2) Recreate public.set_message_expiration() to use admin_config.message_expiration_days
--   3) Drop/recreate trigger on trades
--
-- Safe to re-run.

-- ============================================================================
-- BLOCK 1 — Schema
-- ============================================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_message_expiration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiration_days INTEGER;
BEGIN
  IF (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
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
DROP TRIGGER IF EXISTS set_message_expiration_after_trade_complete ON public.trades;
CREATE TRIGGER set_message_expiration_after_trade_complete
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.set_message_expiration();

CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON public.messages(expires_at);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1) Column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='messages' AND column_name='expires_at';

-- 2) Trigger exists
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.trades'::regclass
  AND tgname = 'set_message_expiration_after_trade_complete';
