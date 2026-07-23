-- =============================================================================
-- Migration: Add per-seller offer cap to admin_config (admin-configurable)
-- Date: 2026-07-18
-- Mode B: Idempotent rerunnable migration
-- Purpose:
--   1) Seed max_pending_offers_per_seller key in admin_config (default 3)
--   2) Update fn_validate_trade_timing_config trigger to include the new key
--   3) Ensure offer cap is 1-10 range validated
-- =============================================================================

-- ── 1. Seed the config key ──────────────────────────────────────────────────
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES (
  'max_pending_offers_per_seller',
  '3',
  'Maximum number of pending offers a buyer can have with a single seller at once. Bundle offers count as 1.',
  'trade',
  'number',
  true
)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Update validation trigger to include new key ────────────────────────
-- The trigger fn_validate_trade_timing_config must know about the new key
-- so it can validate range and cross-key relationships.
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
  v_max_offers_raw text;

  v_offer_timeout integer;
  v_offer_notif_1 integer;
  v_offer_notif_2 integer;
  v_auto_complete integer;
  v_auto_complete_notif integer;
  v_pending_release integer;
  v_member_fee integer;
  v_non_member_fee integer;
  v_max_offers integer;
BEGIN
  IF NEW.key NOT IN (
    'offer_timeout_hours',
    'offer_notif_1_hours_before',
    'offer_notif_2_hours_before',
    'auto_complete_hours',
    'auto_complete_notif_hours_before',
    'pending_sp_release_days',
    'transaction_fee_member_cents',
    'transaction_fee_non_member_cents',
    'max_pending_offers_per_seller'
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

  SELECT ac.value INTO v_max_offers_raw
  FROM public.admin_config ac
  WHERE ac.key = 'max_pending_offers_per_seller'
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
  ELSIF NEW.key = 'max_pending_offers_per_seller' THEN
    v_max_offers_raw := NEW.value;
  END IF;

  v_offer_timeout := public.fn_admin_config_safe_int(v_offer_timeout_raw, 48);
  v_offer_notif_1 := public.fn_admin_config_safe_int(v_offer_notif_1_raw, 24);
  v_offer_notif_2 := public.fn_admin_config_safe_int(v_offer_notif_2_raw, 6);
  v_auto_complete := public.fn_admin_config_safe_int(v_auto_complete_raw, 72);
  v_auto_complete_notif := public.fn_admin_config_safe_int(v_auto_complete_notif_raw, 12);
  v_pending_release := public.fn_admin_config_safe_int(v_pending_release_raw, 3);
  v_member_fee := public.fn_admin_config_safe_int(v_member_fee_raw, 99);
  v_non_member_fee := public.fn_admin_config_safe_int(v_non_member_fee_raw, 299);
  v_max_offers := public.fn_admin_config_safe_int(v_max_offers_raw, 3);

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

  -- New: validate max_pending_offers_per_seller range (1-10)
  IF v_max_offers < 1 OR v_max_offers > 10 THEN
    RAISE EXCEPTION 'max_pending_offers_per_seller (%) must be between 1 and 10', v_max_offers;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists; CREATE OR REPLACE of the function is sufficient.
-- The existing trigger trigger_validate_trade_timing_config calls this function.

-- ── Verification queries ────────────────────────────────────────────────────
-- -- Verify seed row exists
-- SELECT key, value, category, data_type, is_active
-- FROM public.admin_config
-- WHERE key = 'max_pending_offers_per_seller';
--
-- -- Verify trigger function was updated (should include max_pending_offers_per_seller)
-- SELECT proname, prosrc
-- FROM pg_proc
-- WHERE proname = 'fn_validate_trade_timing_config';
--
-- -- Verify trigger still exists
-- SELECT tgname
-- FROM pg_trigger
-- WHERE tgrelid = 'public.admin_config'::regclass
--   AND tgname = 'trigger_validate_trade_timing_config';
--
-- -- Test validation (should succeed)
-- SELECT upsert_admin_config_setting('max_pending_offers_per_seller', '5', 'trade', 'number', false, true);
-- SELECT value FROM admin_config WHERE key = 'max_pending_offers_per_seller';
--
-- -- Test validation (should fail — out of range)
-- SELECT upsert_admin_config_setting('max_pending_offers_per_seller', '0', 'trade', 'number', false, true);
-- SELECT upsert_admin_config_setting('max_pending_offers_per_seller', '11', 'trade', 'number', false, true);
--
-- -- Reset to default
-- SELECT upsert_admin_config_setting('max_pending_offers_per_seller', '3', 'trade', 'number', false, true);
