-- ============================================================================
-- R2 — Cleanup: retire legacy auto-complete paths + consolidate reminder keys
-- Date: 2026-08-10
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   Removes the legacy, no-capture auto-complete path that overlapped the
--   modern capture-first processor, and consolidates the duplicate
--   auto-complete reminder config keys so the admin UI and DB agree on ONE set.
--
--   1. UNSCHEDULE the legacy SQL-wrapper cron `auto_complete_trades_every_12h`
--      (runs every 12h, calls scheduled_auto_complete_trades() which can
--      complete trades WITHOUT capturing the Stripe hold — a real risk that
--      overlaps process-auto-complete). The modern `process-auto-complete`
--      cron (captures PI first, every 15 min) is the single canonical path.
--   2. DROP the legacy wrapper function `scheduled_auto_complete_trades()`.
--   3. fn_validate_trade_timing_config: also validate the canonical
--      `auto_complete_notif_1/2_hours_before` keys (the single legacy
--      `auto_complete_notif_hours_before` stays validated for back-compat but
--      is deprecated in the admin UI).
--
-- NOTE: the orphaned `check-offer-timeouts` cron / `invoke_check_offer_timeouts`
-- RPC from 20260510000003 are already absent from this project (verified
-- 2026-08-10) — only a stale entry in the admin cron-monitoring page references
-- it; that page entry is removed in the admin code, not here.
--
-- RULES: idempotent (unschedule/drop are safe to re-run); p_ params, v_ locals,
-- qualified columns; canonical read helper fn_admin_config_int.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Retire the legacy no-capture auto-complete cron + wrapper
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule(c.jobid)
  FROM cron.job c
  WHERE c.jobname IN ('auto_complete_trades_every_12h', 'auto_complete_trades_every_12m');

  RAISE NOTICE 'Legacy auto-complete cron unscheduled (if it existed).';
END;
$$;

DROP FUNCTION IF EXISTS public.scheduled_auto_complete_trades();

-- ---------------------------------------------------------------------------
-- 2) Consolidate auto-complete reminder config keys in the validation trigger
--    (canonical keys: auto_complete_notif_1/2_hours_before; the single legacy
--    auto_complete_notif_hours_before remains validated for back-compat but is
--    deprecated and no longer surfaced in the admin UI).
-- ---------------------------------------------------------------------------
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
  v_auto_complete_notif_1_raw text;
  v_auto_complete_notif_2_raw text;
  v_pending_release_raw text;
  v_member_fee_raw text;
  v_non_member_fee_raw text;
  v_max_offers_raw text;
  v_pickup_window_raw text;
  v_pickup_notif_1_raw text;
  v_pickup_notif_2_raw text;

  v_offer_timeout integer;
  v_offer_notif_1 integer;
  v_offer_notif_2 integer;
  v_auto_complete integer;
  v_auto_complete_notif integer;
  v_auto_complete_notif_1 integer;
  v_auto_complete_notif_2 integer;
  v_pending_release integer;
  v_member_fee integer;
  v_non_member_fee integer;
  v_max_offers integer;
  v_pickup_window integer;
  v_pickup_notif_1 integer;
  v_pickup_notif_2 integer;
BEGIN
  IF NEW.key NOT IN (
    'offer_timeout_hours',
    'offer_notif_1_hours_before',
    'offer_notif_2_hours_before',
    'auto_complete_hours',
    'auto_complete_notif_hours_before',
    'auto_complete_notif_1_hours_before',
    'auto_complete_notif_2_hours_before',
    'pending_sp_release_days',
    'transaction_fee_member_cents',
    'transaction_fee_non_member_cents',
    'max_pending_offers_per_seller',
    'pickup_window_hours',
    'pickup_notif_1_hours_before',
    'pickup_notif_2_hours_before'
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

  SELECT ac.value INTO v_auto_complete_notif_1_raw
  FROM public.admin_config ac
  WHERE ac.key = 'auto_complete_notif_1_hours_before'
  LIMIT 1;

  SELECT ac.value INTO v_auto_complete_notif_2_raw
  FROM public.admin_config ac
  WHERE ac.key = 'auto_complete_notif_2_hours_before'
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

  SELECT ac.value INTO v_pickup_window_raw
  FROM public.admin_config ac
  WHERE ac.key = 'pickup_window_hours'
  LIMIT 1;

  SELECT ac.value INTO v_pickup_notif_1_raw
  FROM public.admin_config ac
  WHERE ac.key = 'pickup_notif_1_hours_before'
  LIMIT 1;

  SELECT ac.value INTO v_pickup_notif_2_raw
  FROM public.admin_config ac
  WHERE ac.key = 'pickup_notif_2_hours_before'
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
  ELSIF NEW.key = 'auto_complete_notif_1_hours_before' THEN
    v_auto_complete_notif_1_raw := NEW.value;
  ELSIF NEW.key = 'auto_complete_notif_2_hours_before' THEN
    v_auto_complete_notif_2_raw := NEW.value;
  ELSIF NEW.key = 'pending_sp_release_days' THEN
    v_pending_release_raw := NEW.value;
  ELSIF NEW.key = 'transaction_fee_member_cents' THEN
    v_member_fee_raw := NEW.value;
  ELSIF NEW.key = 'transaction_fee_non_member_cents' THEN
    v_non_member_fee_raw := NEW.value;
  ELSIF NEW.key = 'max_pending_offers_per_seller' THEN
    v_max_offers_raw := NEW.value;
  ELSIF NEW.key = 'pickup_window_hours' THEN
    v_pickup_window_raw := NEW.value;
  ELSIF NEW.key = 'pickup_notif_1_hours_before' THEN
    v_pickup_notif_1_raw := NEW.value;
  ELSIF NEW.key = 'pickup_notif_2_hours_before' THEN
    v_pickup_notif_2_raw := NEW.value;
  END IF;

  v_offer_timeout := public.fn_admin_config_safe_int(v_offer_timeout_raw, 48);
  v_offer_notif_1 := public.fn_admin_config_safe_int(v_offer_notif_1_raw, 24);
  v_offer_notif_2 := public.fn_admin_config_safe_int(v_offer_notif_2_raw, 6);
  v_auto_complete := public.fn_admin_config_safe_int(v_auto_complete_raw, 72);
  v_auto_complete_notif := public.fn_admin_config_safe_int(v_auto_complete_notif_raw, 12);
  v_auto_complete_notif_1 := public.fn_admin_config_safe_int(v_auto_complete_notif_1_raw, 24);
  v_auto_complete_notif_2 := public.fn_admin_config_safe_int(v_auto_complete_notif_2_raw, 2);
  v_pending_release := public.fn_admin_config_safe_int(v_pending_release_raw, 3);
  v_member_fee := public.fn_admin_config_safe_int(v_member_fee_raw, 99);
  v_non_member_fee := public.fn_admin_config_safe_int(v_non_member_fee_raw, 299);
  v_max_offers := public.fn_admin_config_safe_int(v_max_offers_raw, 3);
  v_pickup_window := public.fn_admin_config_safe_int(v_pickup_window_raw, 72);
  v_pickup_notif_1 := public.fn_admin_config_safe_int(v_pickup_notif_1_raw, 24);
  v_pickup_notif_2 := public.fn_admin_config_safe_int(v_pickup_notif_2_raw, 2);

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

  IF v_auto_complete_notif_1 >= v_auto_complete THEN
    RAISE EXCEPTION 'auto_complete_notif_1_hours_before (%) must be less than auto_complete_hours (%)',
      v_auto_complete_notif_1,
      v_auto_complete;
  END IF;

  IF v_auto_complete_notif_2 >= v_auto_complete_notif_1 THEN
    RAISE EXCEPTION 'auto_complete_notif_2_hours_before (%) must be less than auto_complete_notif_1_hours_before (%)',
      v_auto_complete_notif_2,
      v_auto_complete_notif_1;
  END IF;

  IF v_pending_release < 1 OR v_pending_release > 30 THEN
    RAISE EXCEPTION 'pending_sp_release_days (%) must be between 1 and 30', v_pending_release;
  END IF;

  IF v_member_fee >= v_non_member_fee THEN
    RAISE EXCEPTION 'transaction_fee_member_cents (%) must be less than transaction_fee_non_member_cents (%)',
      v_member_fee,
      v_non_member_fee;
  END IF;

  IF v_max_offers < 1 OR v_max_offers > 10 THEN
    RAISE EXCEPTION 'max_pending_offers_per_seller (%) must be between 1 and 10', v_max_offers;
  END IF;

  IF v_pickup_window < 1 OR v_pickup_window > 168 THEN
    RAISE EXCEPTION 'pickup_window_hours (%) must be between 1 and 168', v_pickup_window;
  END IF;

  IF v_pickup_notif_1 >= v_pickup_window THEN
    RAISE EXCEPTION 'pickup_notif_1_hours_before (%) must be less than pickup_window_hours (%)',
      v_pickup_notif_1,
      v_pickup_window;
  END IF;

  IF v_pickup_notif_2 >= v_pickup_notif_1 THEN
    RAISE EXCEPTION 'pickup_notif_2_hours_before (%) must be less than pickup_notif_1_hours_before (%)',
      v_pickup_notif_2,
      v_pickup_notif_1;
  END IF;

  -- R2 7-DAY GUARDRAIL (HARD BLOCK): offer + pickup must total <= 167h.
  IF v_offer_timeout + v_pickup_window > 167 THEN
    RAISE EXCEPTION
      'offer_timeout_hours (%) + pickup_window_hours (%) must total at most 167h (Stripe''s 7-day / 168h authorization limit). Lower one of the windows.',
      v_offer_timeout,
      v_pickup_window;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Verification queries (SQL-3)
-- ---------------------------------------------------------------------------
-- SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'auto_complete_trades%';
-- SELECT proname FROM pg_proc WHERE proname = 'scheduled_auto_complete_trades';
-- SELECT proname FROM pg_proc WHERE proname = 'fn_validate_trade_timing_config';
-- -- Consolidation test (should succeed): upsert canonical keys
-- SELECT upsert_admin_config_setting('auto_complete_notif_1_hours_before', '24', 'trade', 'number', false, true, NULL);
-- SELECT upsert_admin_config_setting('auto_complete_notif_2_hours_before', '2', 'trade', 'number', false, true, NULL);
-- -- Ordering test (should FAIL): notif_2 >= notif_1
-- SELECT upsert_admin_config_setting('auto_complete_notif_2_hours_before', '24', 'trade', 'number', false, true, NULL);
-- -- Restore
-- SELECT upsert_admin_config_setting('auto_complete_notif_2_hours_before', '2', 'trade', 'number', false, true, NULL);
