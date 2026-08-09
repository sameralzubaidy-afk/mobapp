-- ============================================================================
-- R2 — Auth-and-Capture + Countdown State Machine (enforcement gap-fill)
-- Date: 2026-08-10
-- Mode B: Idempotent rerunnable migration
--
-- WHAT THIS DOES (owner summary):
--   R2 was ~90% already shipped as D-30 / Trade Flow V2 (checkout places an
--   uncaptured Stripe hold, 48h offer window auto-cancels + releases, "I Got It"
--   captures, offer/auto-complete crons + reminders run). This migration closes
--   the remaining gaps:
--   1. The post-acceptance deadline is now sourced from the configurable
--      pickup window (`pickup_window_hours`, default 72h) instead of the
--      legacy `auto_complete_hours` key. Auto-complete behavior at the
--      deadline is RETAINED (owner decision 2026-08-09).
--   2. NEW pickup-window reminders (in-app + push, buyer-only, two
--      configurable thresholds): `pickup_notif_1/2_hours_before` config keys
--      + `pickup_reminder_1/2_sent_at` tracking columns + rpc_send_pickup_reminders
--      + send-pickup-reminders cron (every 5 min).
--   3. 7-DAY GUARDRAIL (HARD BLOCK): `fn_validate_trade_timing_config` now
--      rejects offer_timeout_hours + pickup_window_hours totalling 168h or more
--      (Stripe authorization holds expire after 7 days; capture must precede
--      authorization_expires_at). Failure mode = HARD BLOCK (RAISE EXCEPTION),
--      NOT auto-clamp — documented in SYSTEM_REQUIREMENTS_V2 §1.6 and the
--      admin manual-testing guide. The runtime check-authorization-expiry cron
--      remains the backstop.
--
-- RULES applied:
--   - Read-Before-Write: seed rows use ON CONFLICT DO NOTHING so admin edits
--     are preserved across replays.
--   - Naming: p_ params, v_ locals, qualified columns.
--   - Canonical read helper: fn_admin_config_int (N1, 20260809000004).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1: Seed config keys + tracking columns + trigger/function rewrites + RPC
-- ---------------------------------------------------------------------------

-- 1) Seed the two pickup-window reminder thresholds (buyer-only).
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  (
    'pickup_notif_1_hours_before',
    '24',
    'First reminder before the pickup/auto-complete window ends (hours). Sent to the buyer. Must be < pickup_window_hours. Default: 24',
    'trade',
    'number',
    true
  ),
  (
    'pickup_notif_2_hours_before',
    '2',
    'Final reminder before the pickup/auto-complete window ends (hours). Sent to the buyer. Must be < pickup_notif_1_hours_before. Default: 2',
    'trade',
    'number',
    true
  )
ON CONFLICT (key) DO NOTHING;

-- 2) Tracking columns for pickup-window reminders (dedupe guard).
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS pickup_reminder_1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_reminder_2_sent_at timestamptz;

COMMENT ON COLUMN public.trades.pickup_reminder_1_sent_at IS
'Timestamp when the first pickup-window reminder was sent to the buyer (R2).';

COMMENT ON COLUMN public.trades.pickup_reminder_2_sent_at IS
'Timestamp when the final pickup-window reminder was sent to the buyer (R2).';

-- 3) fn_set_auto_complete_at — source the post-acceptance deadline from the
--    configurable pickup window (fallback: legacy auto_complete_hours, then 72h).
--    Trigger (trigger_set_auto_complete_at) already exists; CREATE OR REPLACE
--    of the function is sufficient.
CREATE OR REPLACE FUNCTION public.fn_set_auto_complete_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pickup_window_hours integer;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'in_progress' THEN
    RETURN NEW;
  END IF;

  IF NEW.auto_complete_at IS NULL THEN
    -- R2 (2026-08-10): pickup_window_hours is the canonical post-acceptance
    -- deadline. Falls back to the legacy auto_complete_hours key, then 72h.
    v_pickup_window_hours := public.fn_admin_config_int('pickup_window_hours', NULL);
    IF v_pickup_window_hours IS NULL THEN
      v_pickup_window_hours := public.fn_admin_config_int('auto_complete_hours', 72);
    END IF;
    NEW.auto_complete_at := now() + make_interval(hours => v_pickup_window_hours);
  END IF;

  RETURN NEW;
END;
$$;

-- 4) fn_validate_trade_timing_config — add pickup_window_hours + pickup_notif_1/2
--    to the validated keys and enforce the 7-DAY GUARDRAIL (HARD BLOCK):
--    offer_timeout_hours + pickup_window_hours must total <= 167h (< 168h).
--    Trigger (trigger_validate_trade_timing_config) already exists.
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
  v_pickup_window_raw text;
  v_pickup_notif_1_raw text;
  v_pickup_notif_2_raw text;

  v_offer_timeout integer;
  v_offer_notif_1 integer;
  v_offer_notif_2 integer;
  v_auto_complete integer;
  v_auto_complete_notif integer;
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

  -- R2 (2026-08-10): pickup window range
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

  -- R2 7-DAY GUARDRAIL (HARD BLOCK, 2026-08-10): Stripe authorization holds
  -- expire 7 days (168h) after the offer is created. The capture must happen
  -- before authorization_expires_at, so offer + pickup windows must total
  -- under 168h (max 167h). Failure mode = HARD BLOCK — the admin must lower a
  -- window. The runtime check-authorization-expiry cron stays as backstop.
  IF v_offer_timeout + v_pickup_window > 167 THEN
    RAISE EXCEPTION
      'offer_timeout_hours (%) + pickup_window_hours (%) must total at most 167h (Stripe''s 7-day / 168h authorization limit). Lower one of the windows.',
      v_offer_timeout,
      v_pickup_window;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) rpc_send_pickup_reminders — buyer-only pickup-window reminders.
--    Mirrors rpc_send_auto_complete_reminders (20260708000001) but reads the
--    two configurable thresholds from admin_config via fn_admin_config_int.
--    SECURITY DEFINER needed because: called by a service-role Edge Function
--    cron to create user_notifications rows for other users.
CREATE OR REPLACE FUNCTION public.rpc_send_pickup_reminders(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_notif_1 integer := 24;
  v_pickup_notif_2 integer := 2;
  v_reminder_1_count integer := 0;
  v_reminder_2_count integer := 0;
  v_in_app_created integer := 0;
  v_in_progress_trade RECORD;
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  v_pickup_notif_1 := public.fn_admin_config_int('pickup_notif_1_hours_before', 24);
  v_pickup_notif_2 := public.fn_admin_config_int('pickup_notif_2_hours_before', 2);

  -- First pickup reminder (window: threshold ± 30 min before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + (make_interval(hours => v_pickup_notif_1) - INTERVAL '30 minutes')
      AND t.auto_complete_at <= now() + (make_interval(hours => v_pickup_notif_1) + INTERVAL '30 minutes')
      AND (t.pickup_reminder_1_sent_at IS NULL OR t.pickup_reminder_1_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades t SET pickup_reminder_1_sent_at = now() WHERE t.id = v_in_progress_trade.id;
    v_reminder_1_count := v_reminder_1_count + 1;

    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'pickup_reminder_1',
      'Confirm Pickup Soon',
      'Confirm pickup for "' || v_in_progress_trade.listing_title || '" within ' || v_pickup_notif_1 || ' hours or the trade auto-completes.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'pickup_reminder_1', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_pickup_notif_1)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'pickup_reminder_1',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object('listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_pickup_notif_1)
    );
  END LOOP;

  -- Final pickup reminder (window: threshold ± 30 min before auto_complete_at)
  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at > now() + (make_interval(hours => v_pickup_notif_2) - INTERVAL '30 minutes')
      AND t.auto_complete_at <= now() + (make_interval(hours => v_pickup_notif_2) + INTERVAL '30 minutes')
      AND (t.pickup_reminder_2_sent_at IS NULL OR t.pickup_reminder_2_sent_at < t.created_at)
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  ) LOOP
    UPDATE public.trades t SET pickup_reminder_2_sent_at = now() WHERE t.id = v_in_progress_trade.id;
    v_reminder_2_count := v_reminder_2_count + 1;

    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_in_progress_trade.buyer_id,
      'trades',
      'pickup_reminder_2',
      'Pickup Deadline Soon',
      '"' || v_in_progress_trade.listing_title || '" auto-completes in ' || v_pickup_notif_2 || ' hours. Complete the trade to confirm pickup.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_in_progress_trade.id, 'event_type', 'pickup_reminder_2', 'listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_pickup_notif_2)
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_in_progress_trade.id,
      'event_type', 'pickup_reminder_2',
      'recipient_user_id', v_in_progress_trade.buyer_id,
      'extra_data', jsonb_build_object('listing_title', v_in_progress_trade.listing_title, 'hours_remaining', v_pickup_notif_2)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'pickup_reminded_1', v_reminder_1_count,
    'pickup_reminded_2', v_reminder_2_count,
    'in_app_created', v_in_app_created,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_send_pickup_reminders(integer) TO service_role;

COMMENT ON FUNCTION public.rpc_send_pickup_reminders IS
'Finds in-progress trades needing pickup-window reminders (buyer-only), marks tracking columns, creates in-app user_notifications rows, and returns push payloads for the Edge Function. Thresholds read from pickup_notif_1/2_hours_before.';

-- ---------------------------------------------------------------------------
-- BLOCK 2: Indexes + scheduler wiring
-- ---------------------------------------------------------------------------

-- Indexes for reminder lookups (mirror ac_reminder indexes).
CREATE INDEX IF NOT EXISTS idx_trades_pickup_reminder_1
  ON public.trades (auto_complete_at, pickup_reminder_1_sent_at)
  WHERE status = 'in_progress' AND auto_complete_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_pickup_reminder_2
  ON public.trades (auto_complete_at, pickup_reminder_2_sent_at)
  WHERE status = 'in_progress' AND auto_complete_at IS NOT NULL;

-- Scheduler wiring: call send-pickup-reminders Edge Function every 5 minutes
-- (mirror 20260708000001_auto_complete_reminders.sql). COALESCE chain includes
-- a hardcoded fallback for the service role key (BP-22).
DO $$
DECLARE
  v_base_url text;
  v_service_role_key text;
  v_job_sql text;
BEGIN
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    NULLIF(current_setting('custom.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'supabase_url' AND ac.is_active = true LIMIT 1) || '/functions/v1',
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );

  v_service_role_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    NULLIF(current_setting('custom.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss'
  );

  IF v_base_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Skipping send-pickup-reminders cron schedule: could not resolve base URL or service role key.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'send-pickup-reminders';

    v_job_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/send-pickup-reminders',
      v_service_role_key
    );

    PERFORM cron.schedule(
      'send-pickup-reminders',
      '*/5 * * * *',
      v_job_sql
    );
  END IF;
END;
$$;

-- On-demand trigger for testing: SELECT public.rpc_trigger_send_pickup_reminders();
CREATE OR REPLACE FUNCTION public.rpc_trigger_send_pickup_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_url text;
  v_service_key text;
  v_result jsonb;
BEGIN
  v_base_url := COALESCE(
    NULLIF(current_setting('app.edge_function_base_url', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'edge_function_base_url' AND ac.is_active = true LIMIT 1),
    'https://drntwgporzabmxdqykrp.supabase.co/functions/v1'
  );
  v_service_key := COALESCE(
    NULLIF(current_setting('app.service_role_key', true), ''),
    (SELECT ac.value FROM public.admin_config ac WHERE ac.key = 'service_role_key' AND ac.is_active = true LIMIT 1),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.6a7vFP2L4OjUcEqEUkwdryGPwONQe3-LR6BY3FA2Qss'
  );

  SELECT net.http_post(
    url := v_base_url || '/send-pickup-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := '{}'::jsonb
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'http_response', v_result);
END;
$$;

-- ---------------------------------------------------------------------------
-- Verification queries (SQL-3)
-- ---------------------------------------------------------------------------
-- SELECT key, value FROM public.admin_config WHERE key LIKE 'pickup_notif%';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'trades' AND column_name IN ('pickup_reminder_1_sent_at', 'pickup_reminder_2_sent_at');
-- SELECT proname FROM pg_proc WHERE proname IN ('fn_set_auto_complete_at','fn_validate_trade_timing_config','rpc_send_pickup_reminders','rpc_trigger_send_pickup_reminders');
-- SELECT public.rpc_send_pickup_reminders(10);
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'send-pickup-reminders';
--
-- Guardrail tests (HARD BLOCK — expect RAISE EXCEPTION):
--   SELECT upsert_admin_config_setting('offer_timeout_hours', '100', 'trade', 'number', false, true, NULL); -- stored 100
--   SELECT upsert_admin_config_setting('pickup_window_hours', '72', 'trade', 'number', false, true, NULL);  -- 100+72=172 > 167 → blocked
--   SELECT upsert_admin_config_setting('pickup_window_hours', '67', 'trade', 'number', false, true, NULL);  -- 100+67=167 → OK
--   SELECT upsert_admin_config_setting('offer_timeout_hours', '48', 'trade', 'number', false, true, NULL);  -- restore default
--   SELECT upsert_admin_config_setting('pickup_window_hours', '72', 'trade', 'number', false, true, NULL);  -- restore default
--
-- Common failure modes:
-- 1) Missing pg_cron/pg_net: scheduler section safely no-ops (RAISE NOTICE).
-- 2) The guardrail compares against the STORED offer_timeout_hours — if an admin
--    sets pickup=72 while offer=100 is already stored, the write is rejected until
--    one window is lowered (intended HARD BLOCK).
-- 3) rpc_send_pickup_reminders only targets in_progress trades with
--    auto_complete_at set (accepted trades) — expired/legacy trades are excluded.
