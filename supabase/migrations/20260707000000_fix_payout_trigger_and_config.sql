-- Migration: 20260707000000_fix_payout_trigger_and_config
-- Mode B: Idempotent rerunnable migration
--
-- Purpose: Fix the `initiate-payout` Edge Function never being invoked by:
--   1. Adding missing `payout_status` and `payout_amount_cents` columns to `trades`
--   2. Updating the trigger `fn_queue_payout_on_complete` to fallback to
--      `admin_config` table when DB GUCs are not set (matching the pattern
--      used by `create_trade_notification` in migration 211)
--   3. Seeding `admin_config` entries for the required keys
--
-- Root Cause:
--   The trigger function fn_queue_payout_on_complete used current_setting() for
--   app.supabase_url and app.service_role_key, but these custom GUCs were never
--   configured via ALTER DATABASE. Both returned NULL, making net.http_post(url:=NULL)
--   silently fail — no HTTP call was ever dispatched to initiate-payout.
--
--   Additionally, create_seller_payout_on_trade_completion() tried to UPDATE
--   trades.payout_status and trades.payout_amount_cents, but those columns
--   didn't exist on the table.
--
-- Spec: docx/TRADING-FLOW-V2.md §6.3.1, §6.3.3, TFV2-018

-- =============================================================================
-- BLOCK 1: Add missing columns to trades table
-- =============================================================================

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS payout_status TEXT,
  ADD COLUMN IF NOT EXISTS payout_amount_cents INTEGER;

-- Add constraint for valid payout_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_payout_status_check'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_payout_status_check
      CHECK (payout_status IN ('pending', 'requires_action', 'processing', 'paid', 'failed'));
  END IF;
END $$;

-- =============================================================================
-- BLOCK 2: Update fn_queue_payout_on_complete with admin_config fallback
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_queue_payout_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_ef_url TEXT;
  v_auth_jwt TEXT;
BEGIN
  -- Only queue if no active dispute (D-26 guard)
  IF NEW.dispute_status IS DISTINCT FROM 'reported'
    AND NEW.dispute_status IS DISTINCT FROM 'under_review'
  THEN
    -- Set idempotency key (only if not already set)
    UPDATE public.trades
    SET payout_idempotency_key = 'payout_' || NEW.id::text
    WHERE id = NEW.id AND payout_idempotency_key IS NULL;

    -- Resolve Edge Function base URL (matches pattern in create_trade_notification)
    -- 1) Try GUC app.edge_function_base_url first
    -- 2) Then try GUC app.supabase_url + '/functions/v1'
    -- 3) Fall back to admin_config 'supabase_url' key
    v_ef_url := NULLIF(current_setting('app.edge_function_base_url', true), '');
    IF v_ef_url IS NULL THEN
      v_ef_url := NULLIF(current_setting('app.supabase_url', true), '');
      IF v_ef_url IS NOT NULL THEN
        v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
      ELSE
        -- Fallback to admin_config
        SELECT ac.value INTO v_ef_url
        FROM public.admin_config ac
        WHERE ac.key = 'supabase_url'
          AND ac.is_active = true
        LIMIT 1;

        IF v_ef_url IS NOT NULL THEN
          v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
        END IF;
      END IF;
    END IF;

    -- Resolve auth JWT (matches pattern in create_trade_notification)
    -- 1) Try GUC app.service_role_key first
    -- 2) Fall back to admin_config 'supabase_service_role_key'
    v_auth_jwt := NULLIF(current_setting('app.service_role_key', true), '');
    IF v_auth_jwt IS NULL THEN
      SELECT ac.value INTO v_auth_jwt
      FROM public.admin_config ac
      WHERE ac.key = 'supabase_service_role_key'
        AND ac.is_active = true
      LIMIT 1;
    END IF;

    -- Only attempt net.http_post if we have both URL and auth
    IF v_ef_url IS NOT NULL AND v_auth_jwt IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_ef_url || '/initiate-payout',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_auth_jwt
        ),
        body    := jsonb_build_object('trade_id', NEW.id::text)
      );
    ELSE
      RAISE WARNING 'fn_queue_payout_on_complete: Cannot queue payout for trade % — missing URL or auth config. URL set: %, Auth set: %',
        NEW.id, v_ef_url IS NOT NULL, v_auth_jwt IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let payout queueing break trade completion
  RAISE WARNING 'fn_queue_payout_on_complete error for trade %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger is correctly re-linked
DROP TRIGGER IF EXISTS trg_queue_payout_on_complete ON trades;
CREATE TRIGGER trg_queue_payout_on_complete
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.fn_queue_payout_on_complete();

-- =============================================================================
-- BLOCK 3: Seed admin_config entries (safe, uses INSERT ON CONFLICT)
-- =============================================================================

-- The supabase_url key: the project's base URL
-- User must update this to the actual project URL before the trigger will work.
INSERT INTO public.admin_config (key, value, category, data_type, is_active, created_at, updated_at)
VALUES ('supabase_url', 'https://drntwgporzabmxdqykrp.supabase.co', 'feature_flags', 'string', true, now(), now())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = now()
WHERE admin_config.is_active = false;

-- The service role key placeholder — user MUST replace this with the real key
INSERT INTO public.admin_config (key, value, category, data_type, is_active, created_at, updated_at)
VALUES ('supabase_service_role_key', 'PLACEHOLDER-REPLACE-WITH-SERVICE-ROLE-KEY', 'feature_flags', 'string', true, now(), now())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = now()
WHERE admin_config.is_active = false;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
--
-- 1) Verify columns were added:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'trades' AND column_name IN ('payout_status', 'payout_amount_cents');
--
-- 2) Verify trigger exists:
--    SELECT trigger_name, event_manipulation, action_statement
--    FROM information_schema.triggers
--    WHERE event_object_table = 'trades' AND trigger_name = 'trg_queue_payout_on_complete';
--
-- 3) Check admin_config entries:
--    SELECT key, value, is_active FROM admin_config
--    WHERE key IN ('supabase_url', 'supabase_service_role_key');
--
-- 4) After running, complete a trade and check initiate-payout logs:
--    https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/functions/initiate-payout/logs
