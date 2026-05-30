-- File: supabase/migrations/20260528000001_admin_config_trade_timing.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (TFV2-001)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Add TradeFlow V2 timing and fee config fields to admin_config.
-- 2) Seed key/value config rows for Admin UI editing.
-- 3) Validate timing relationships with a trigger on admin_config writes.

-- -----------------------------------------------------------------------------
-- 1) Ensure admin_config supports a dedicated trade category (optional).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'trade';
  EXCEPTION
    WHEN undefined_object THEN
      -- Legacy environments may not use enum category.
      NULL;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Add table-level columns used by DB-side validation defaults.
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS offer_notif_1_hours_before integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS offer_notif_2_hours_before integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS auto_complete_hours integer DEFAULT 72,
  ADD COLUMN IF NOT EXISTS auto_complete_notif_hours_before integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pending_sp_release_days integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS transaction_fee_member_cents integer DEFAULT 99,
  ADD COLUMN IF NOT EXISTS transaction_fee_non_member_cents integer DEFAULT 299;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_offer_notif_1_hours_before') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_offer_notif_1_hours_before
      CHECK (offer_notif_1_hours_before BETWEEN 1 AND 168);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_offer_notif_2_hours_before') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_offer_notif_2_hours_before
      CHECK (offer_notif_2_hours_before BETWEEN 1 AND 168);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_auto_complete_hours') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_auto_complete_hours
      CHECK (auto_complete_hours BETWEEN 24 AND 336);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_auto_complete_notif_hours_before') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_auto_complete_notif_hours_before
      CHECK (auto_complete_notif_hours_before BETWEEN 1 AND 72);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_pending_sp_release_days') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_pending_sp_release_days
      CHECK (pending_sp_release_days BETWEEN 1 AND 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_transaction_fee_member_cents') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_transaction_fee_member_cents
      CHECK (transaction_fee_member_cents BETWEEN 0 AND 10000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'check_transaction_fee_non_member_cents') THEN
    ALTER TABLE public.admin_config
      ADD CONSTRAINT check_transaction_fee_non_member_cents
      CHECK (transaction_fee_non_member_cents BETWEEN 0 AND 10000);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Seed key/value config rows so Admin UI can edit these values directly.
-- -----------------------------------------------------------------------------
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('offer_timeout_hours', '48', 'Hours before a pending offer expires automatically', 'trade', 'number', true),
  ('offer_notif_1_hours_before', '24', 'First reminder before offer expiration (hours)', 'trade', 'number', true),
  ('offer_notif_2_hours_before', '6', 'Second reminder before offer expiration (hours)', 'trade', 'number', true),
  ('auto_complete_hours', '72', 'Auto-complete in-progress trades after this many hours', 'trade', 'number', true),
  ('auto_complete_notif_hours_before', '12', 'Reminder sent before auto-complete (hours)', 'trade', 'number', true),
  ('pending_sp_release_days', '3', 'Days before seller pending SP is released after completion', 'trade', 'number', true),
  ('transaction_fee_member_cents', '99', 'Buyer transaction fee for members in cents', 'fees', 'number', true),
  ('transaction_fee_non_member_cents', '299', 'Buyer transaction fee for non-members in cents', 'fees', 'number', true)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4) Helpers + validation trigger for key/value updates.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_config_safe_int(
  p_value text,
  p_default integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  v_clean := regexp_replace(COALESCE(p_value, ''), '[^0-9\-]', '', 'g');

  IF v_clean = '' OR v_clean = '-' THEN
    RETURN p_default;
  END IF;

  RETURN v_clean::integer;
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_default;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_validate_trade_timing_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer_timeout_raw text;
  v_offer_notif_1_raw text;
  v_offer_notif_2_raw text;
  v_auto_complete_raw text;
  v_auto_complete_notif_raw text;
  v_pending_release_raw text;
  v_member_fee_raw text;
  v_non_member_fee_raw text;

  v_offer_timeout integer;
  v_offer_notif_1 integer;
  v_offer_notif_2 integer;
  v_auto_complete integer;
  v_auto_complete_notif integer;
  v_pending_release integer;
  v_member_fee integer;
  v_non_member_fee integer;
BEGIN
  IF NEW.key NOT IN (
    'offer_timeout_hours',
    'offer_notif_1_hours_before',
    'offer_notif_2_hours_before',
    'auto_complete_hours',
    'auto_complete_notif_hours_before',
    'pending_sp_release_days',
    'transaction_fee_member_cents',
    'transaction_fee_non_member_cents'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT ac.value INTO v_offer_timeout_raw
  FROM public.admin_config ac
  WHERE ac.key = 'offer_timeout_hours'
  LIMIT 1;

  SELECT ac.value INTO v_offer_notif_1_raw
  FROM public.admin_config ac
  WHERE ac.key = 'offer_notif_1_hours_before'
  LIMIT 1;

  SELECT ac.value INTO v_offer_notif_2_raw
  FROM public.admin_config ac
  WHERE ac.key = 'offer_notif_2_hours_before'
  LIMIT 1;

  SELECT ac.value INTO v_auto_complete_raw
  FROM public.admin_config ac
  WHERE ac.key = 'auto_complete_hours'
  LIMIT 1;

  SELECT ac.value INTO v_auto_complete_notif_raw
  FROM public.admin_config ac
  WHERE ac.key = 'auto_complete_notif_hours_before'
  LIMIT 1;

  SELECT ac.value INTO v_pending_release_raw
  FROM public.admin_config ac
  WHERE ac.key = 'pending_sp_release_days'
  LIMIT 1;

  SELECT ac.value INTO v_member_fee_raw
  FROM public.admin_config ac
  WHERE ac.key = 'transaction_fee_member_cents'
  LIMIT 1;

  SELECT ac.value INTO v_non_member_fee_raw
  FROM public.admin_config ac
  WHERE ac.key = 'transaction_fee_non_member_cents'
  LIMIT 1;

  IF NEW.key = 'offer_timeout_hours' THEN
    v_offer_timeout_raw := NEW.value;
  ELSIF NEW.key = 'offer_notif_1_hours_before' THEN
    v_offer_notif_1_raw := NEW.value;
  ELSIF NEW.key = 'offer_notif_2_hours_before' THEN
    v_offer_notif_2_raw := NEW.value;
  ELSIF NEW.key = 'auto_complete_hours' THEN
    v_auto_complete_raw := NEW.value;
  ELSIF NEW.key = 'auto_complete_notif_hours_before' THEN
    v_auto_complete_notif_raw := NEW.value;
  ELSIF NEW.key = 'pending_sp_release_days' THEN
    v_pending_release_raw := NEW.value;
  ELSIF NEW.key = 'transaction_fee_member_cents' THEN
    v_member_fee_raw := NEW.value;
  ELSIF NEW.key = 'transaction_fee_non_member_cents' THEN
    v_non_member_fee_raw := NEW.value;
  END IF;

  v_offer_timeout := public.fn_admin_config_safe_int(v_offer_timeout_raw, 48);
  v_offer_notif_1 := public.fn_admin_config_safe_int(v_offer_notif_1_raw, 24);
  v_offer_notif_2 := public.fn_admin_config_safe_int(v_offer_notif_2_raw, 6);
  v_auto_complete := public.fn_admin_config_safe_int(v_auto_complete_raw, 72);
  v_auto_complete_notif := public.fn_admin_config_safe_int(v_auto_complete_notif_raw, 12);
  v_pending_release := public.fn_admin_config_safe_int(v_pending_release_raw, 3);
  v_member_fee := public.fn_admin_config_safe_int(v_member_fee_raw, 99);
  v_non_member_fee := public.fn_admin_config_safe_int(v_non_member_fee_raw, 299);

  IF v_offer_notif_1 > v_offer_timeout THEN
    RAISE EXCEPTION 'offer_notif_1_hours_before (%) cannot exceed offer_timeout_hours (%)',
      v_offer_notif_1,
      v_offer_timeout;
  END IF;

  IF v_offer_notif_2 > v_offer_notif_1 THEN
    RAISE EXCEPTION 'offer_notif_2_hours_before (%) cannot exceed offer_notif_1_hours_before (%)',
      v_offer_notif_2,
      v_offer_notif_1;
  END IF;

  IF v_auto_complete_notif >= v_auto_complete THEN
    RAISE EXCEPTION 'auto_complete_notif_hours_before (%) must be less than auto_complete_hours (%)',
      v_auto_complete_notif,
      v_auto_complete;
  END IF;

  IF v_pending_release < 1 OR v_pending_release > 30 THEN
    RAISE EXCEPTION 'pending_sp_release_days (%) must be between 1 and 30', v_pending_release;
  END IF;

  IF v_member_fee >= v_non_member_fee THEN
    RAISE EXCEPTION 'transaction_fee_member_cents (%) must be less than transaction_fee_non_member_cents (%)',
      v_member_fee,
      v_non_member_fee;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_trade_timing_config ON public.admin_config;
CREATE TRIGGER trigger_validate_trade_timing_config
BEFORE INSERT OR UPDATE OF key, value
ON public.admin_config
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_trade_timing_config();

-- -----------------------------------------------------------------------------
-- Verification queries
-- -----------------------------------------------------------------------------
-- SELECT key, value, category, data_type
-- FROM public.admin_config
-- WHERE key IN (
--   'offer_timeout_hours',
--   'offer_notif_1_hours_before',
--   'offer_notif_2_hours_before',
--   'auto_complete_hours',
--   'auto_complete_notif_hours_before',
--   'pending_sp_release_days',
--   'transaction_fee_member_cents',
--   'transaction_fee_non_member_cents'
-- )
-- ORDER BY key;
--
-- SELECT tgname
-- FROM pg_trigger
-- WHERE tgrelid = 'public.admin_config'::regclass
--   AND tgname = 'trigger_validate_trade_timing_config';
--
-- Common failure modes:
-- 1) Enum category missing in older environments: this migration safely ignores missing enum.
-- 2) Existing malformed key values: safe-int parsing applies defaults and trigger raises on invalid relationships.
-- 3) Legacy config schema drift: verify admin_config has key/value columns before applying.
