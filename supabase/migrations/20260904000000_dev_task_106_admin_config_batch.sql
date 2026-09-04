-- =============================================================================
-- Migration: 20260904000000_dev_task_106_admin_config_batch.sql
-- Mode: B (idempotent rerunnable migration — all statements are CREATE OR
--       REPLACE FUNCTION / CREATE FUNCTION + grants; safe to re-run).
--
-- DEV-TASK-106 item 1 (MED-HIGH): the R2 trade-timing guardrail is
-- ORDER-DEPENDENT for multi-key saves.
--
-- Root cause (QA Task 29, F06/F03): the trade-timing settings page saves by
-- looping `upsert_admin_config_setting()` once per key (N auto-commit
-- transactions). The BEFORE-row trigger `fn_validate_trade_timing_config()`
-- validates each key against the *currently-stored* paired value at the moment
-- of that key's write, NOT the batch's intended final state. From
-- offer=48/pickup=72, one Save raising offer→100 AND lowering pickup→67 (a
-- valid 167h final state) FAILS because the offer write is checked against the
-- stale stored pickup=72 (172h) before pickup=67 lands.
--
-- Fix (approved option 2 — validate the batch's intended final state
-- server-side, atomically):
--   1) fn_trade_timing_config_keys()        — single canonical key list.
--   2) fn_validate_trade_timing_state(jsonb) — shared full-state validator: all
--      trade-timing cross-key + range rules, operating on a complete value map
--      (single source of truth for the rule set).
--   3) fn_validate_trade_timing_config()    — trigger fn REWRITTEN to (a) short-
--      circuit when the transaction-local `app.bypass_trade_timing_validation`
--      GUC is 'on' (the batch RPC pre-validates the final state itself) and
--      (b) otherwise read the stored 15 keys, overlay NEW, and delegate to the
--      shared state validator. Single-key writes keep identical enforcement.
--   4) upsert_admin_config_settings_batch() — new transactional batch RPC:
--      SECURITY DEFINER, same identity gate as the single-key RPC, validates
--      the batch's intended FINAL state BEFORE writing anything (raise ⇒ whole
--      batch rolls back, nothing written), then writes every item in ONE
--      transaction reusing the existing per-key upsert (audit/category/
--      updated_by + per-key money guard preserved). Any mid-write error also
--      rolls the whole batch back (atomic accept/reject).
--
-- Why not a DEFERRED CONSTRAINT alone: the page's old loop was N separate
-- auto-commit RPC calls — deferral only helps inside ONE transaction, so a
-- single-transaction batch path was required regardless.
--
-- NOTE (flagged, NOT fixed — DEV-TASK-106): the page writes
-- auto_complete_notif_1_hours_before / auto_complete_notif_2_hours_before,
-- which are NOT in the validated key set below (only the deprecated single
-- auto_complete_notif_hours_before is). Their ordering is still client-only.
-- =============================================================================

-- =============================================================================
-- 1) Canonical trade-timing key list (single source for trigger + batch)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_trade_timing_config_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
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
    'pickup_notif_2_hours_before',
    'extension_response_window_hours',
    'extension_window_hours',
    'extension_max_per_trade'
  ]::text[];
$$;

-- =============================================================================
-- 2) Shared full-state validator (single source of truth for the rule set)
--    p_values: jsonb map of key -> TEXT value (as stored in admin_config.value).
--    Missing keys fall back to the same defaults the trigger used via
--    fn_admin_config_safe_int(). Raises on any violation (P0001) — the exact
--    messages from the previous trigger body (R15) are preserved.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_trade_timing_state(
  p_values jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
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
  v_extension_window integer;
  v_extension_response integer;
  v_extension_max integer;
BEGIN
  v_offer_timeout := public.fn_admin_config_safe_int(p_values->>'offer_timeout_hours', 48);
  v_offer_notif_1 := public.fn_admin_config_safe_int(p_values->>'offer_notif_1_hours_before', 24);
  v_offer_notif_2 := public.fn_admin_config_safe_int(p_values->>'offer_notif_2_hours_before', 6);
  v_auto_complete := public.fn_admin_config_safe_int(p_values->>'auto_complete_hours', 72);
  v_auto_complete_notif := public.fn_admin_config_safe_int(p_values->>'auto_complete_notif_hours_before', 12);
  v_pending_release := public.fn_admin_config_safe_int(p_values->>'pending_sp_release_days', 3);
  v_member_fee := public.fn_admin_config_safe_int(p_values->>'transaction_fee_member_cents', 99);
  v_non_member_fee := public.fn_admin_config_safe_int(p_values->>'transaction_fee_non_member_cents', 299);
  v_max_offers := public.fn_admin_config_safe_int(p_values->>'max_pending_offers_per_seller', 3);
  v_pickup_window := public.fn_admin_config_safe_int(p_values->>'pickup_window_hours', 72);
  v_pickup_notif_1 := public.fn_admin_config_safe_int(p_values->>'pickup_notif_1_hours_before', 24);
  v_pickup_notif_2 := public.fn_admin_config_safe_int(p_values->>'pickup_notif_2_hours_before', 2);
  v_extension_window := public.fn_admin_config_safe_int(p_values->>'extension_window_hours', 72);
  v_extension_response := public.fn_admin_config_safe_int(p_values->>'extension_response_window_hours', 4);
  v_extension_max := public.fn_admin_config_safe_int(p_values->>'extension_max_per_trade', 1);

  IF v_offer_notif_1 > v_offer_timeout THEN
    RAISE EXCEPTION 'offer_notif_1_hours_before (%) cannot exceed offer_timeout_hours (%)', v_offer_notif_1, v_offer_timeout;
  END IF;

  IF v_offer_notif_2 > v_offer_notif_1 THEN
    RAISE EXCEPTION 'offer_notif_2_hours_before (%) cannot exceed offer_notif_1_hours_before (%)', v_offer_notif_2, v_offer_notif_1;
  END IF;

  IF v_auto_complete_notif >= v_auto_complete THEN
    RAISE EXCEPTION 'auto_complete_notif_hours_before (%) must be less than auto_complete_hours (%)', v_auto_complete_notif, v_auto_complete;
  END IF;

  IF v_pending_release < 1 OR v_pending_release > 30 THEN
    RAISE EXCEPTION 'pending_sp_release_days (%) must be between 1 and 30', v_pending_release;
  END IF;

  IF v_member_fee >= v_non_member_fee THEN
    RAISE EXCEPTION 'transaction_fee_member_cents (%) must be less than transaction_fee_non_member_cents (%)', v_member_fee, v_non_member_fee;
  END IF;

  IF v_max_offers < 1 OR v_max_offers > 10 THEN
    RAISE EXCEPTION 'max_pending_offers_per_seller (%) must be between 1 and 10', v_max_offers;
  END IF;

  IF v_pickup_window < 1 OR v_pickup_window > 168 THEN
    RAISE EXCEPTION 'pickup_window_hours (%) must be between 1 and 168', v_pickup_window;
  END IF;

  IF v_pickup_notif_1 >= v_pickup_window THEN
    RAISE EXCEPTION 'pickup_notif_1_hours_before (%) must be less than pickup_window_hours (%)', v_pickup_notif_1, v_pickup_window;
  END IF;

  IF v_pickup_notif_2 >= v_pickup_notif_1 THEN
    RAISE EXCEPTION 'pickup_notif_2_hours_before (%) must be less than pickup_notif_1_hours_before (%)', v_pickup_notif_2, v_pickup_notif_1;
  END IF;

  -- R2 7-DAY GUARDRAIL (HARD BLOCK): offer + pickup windows must total <= 167h.
  IF v_offer_timeout + v_pickup_window > 167 THEN
    RAISE EXCEPTION
      'offer_timeout_hours (%) + pickup_window_hours (%) must total at most 167h (Stripe''s 7-day / 168h authorization limit). Lower one of the windows.',
      v_offer_timeout, v_pickup_window;
  END IF;

  -- R15-3: extension window is a FRESH authorization (clock resets to now()+7d).
  IF v_extension_window < 1 OR v_extension_window > 167 THEN
    RAISE EXCEPTION 'extension_window_hours (%) must be between 1 and 167 (must stay under Stripe''s 7-day authorization limit)', v_extension_window;
  END IF;

  IF v_extension_response < 1 OR v_extension_response > 48 THEN
    RAISE EXCEPTION 'extension_response_window_hours (%) must be between 1 and 48', v_extension_response;
  END IF;

  IF v_extension_max <> 1 THEN
    RAISE EXCEPTION 'extension_max_per_trade (%) must be 1 — exactly one extension per trade (R15 locked decision)', v_extension_max;
  END IF;
END;
$$;

-- =============================================================================
-- 3) Trigger fn REWRITTEN — bypass flag + delegate to the shared state
--    validator. Same trigger registration stays (BEFORE INSERT OR UPDATE OF
--    key, value). CREATE OR REPLACE is idempotent.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_trade_timing_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stored jsonb;
  v_map jsonb;
BEGIN
  -- DEV-TASK-106: the batch RPC validates the batch's intended FINAL state
  -- itself, then sets this transaction-local GUC (auto-resets at commit) so
  -- intermediate per-row states inside that ONE transaction are not
  -- false-rejected. Single-key writes (flag unset) keep full enforcement.
  IF COALESCE(current_setting('app.bypass_trade_timing_validation', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Only validate rows whose key participates in trade-timing rules.
  IF NOT (NEW.key = ANY (public.fn_trade_timing_config_keys())) THEN
    RETURN NEW;
  END IF;

  -- Snapshot the currently-stored trade-timing values, overlay the row being
  -- written, then validate the resulting state against every rule at once.
  SELECT COALESCE(jsonb_object_agg(ac.key, ac.value), '{}'::jsonb)
    INTO v_stored
    FROM public.admin_config ac
   WHERE ac.key = ANY (public.fn_trade_timing_config_keys());

  v_map := jsonb_set(v_stored, ARRAY[NEW.key], to_jsonb(NEW.value), true);

  PERFORM public.fn_validate_trade_timing_state(v_map);

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4) Transactional batch RPC — validates the intended FINAL state, then writes
--    every item atomically. Returns the same shape as the single-key upsert.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_admin_config_settings_batch(
  p_items jsonb,
  p_admin_id uuid DEFAULT NULL
)
RETURNS TABLE (
  out_id BIGINT,
  out_key TEXT,
  out_value TEXT,
  out_category public.admin_config_category,
  out_data_type TEXT,
  out_is_secret BOOLEAN,
  out_is_active BOOLEAN,
  out_updated_at TIMESTAMP WITH TIME ZONE,
  out_updated_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_item jsonb;
  v_key text;
  v_value text;
  v_category public.admin_config_category;
  v_data_type text;
  v_is_secret boolean;
  v_is_active boolean;
  v_stored jsonb;
  v_map jsonb;
BEGIN
  -- Same identity gate as upsert_admin_config_setting (DT59 / DT-57): only
  -- service_role (admin API routes) or an authenticated admin (browser,
  -- real auth.uid()) may write. current_setting('role'), NOT
  -- request.jwt.claim.role.
  v_actor_role := COALESCE(current_setting('role', true), '');
  IF v_actor_role <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.admin_has_role(auth.uid())) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: only admins or service_role can update configuration';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_BATCH: p_items must be a JSON array of {key,value,category,data_type,...}'
      USING ERRCODE = '22023';
  END IF;

  -- 1) AUTHORITATIVE VALIDATION — the batch's intended FINAL state. Snapshot
  --    the stored trade-timing values, overlay every item, validate once.
  --    A raise here (or anywhere below) rolls the whole transaction back, so
  --    nothing is ever partially written.
  SELECT COALESCE(jsonb_object_agg(ac.key, ac.value), '{}'::jsonb)
    INTO v_stored
    FROM public.admin_config ac
   WHERE ac.key = ANY (public.fn_trade_timing_config_keys());

  v_map := v_stored;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_key := v_item->>'key';
    IF v_key IS NULL OR v_key = '' THEN
      RAISE EXCEPTION 'INVALID_BATCH: every item must carry a key' USING ERRCODE = '22023';
    END IF;
    v_map := jsonb_set(v_map, ARRAY[v_key], to_jsonb(v_item->>'value'), true);
  END LOOP;
  PERFORM public.fn_validate_trade_timing_state(v_map);

  -- 2) WRITE PHASE — one transaction. The per-row trade-timing trigger is
  --    bypassed (we pre-validated the final state); the per-key money guard
  --    inside upsert_admin_config_setting still runs per item. Any raise
  --    (e.g. money guard, category cast) rolls the whole batch back.
  PERFORM set_config('app.bypass_trade_timing_validation', 'on', true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_key := v_item->>'key';
    v_value := v_item->>'value';
    IF v_value IS NULL THEN
      RAISE EXCEPTION 'INVALID_BATCH: item % must carry a value', v_key USING ERRCODE = '22023';
    END IF;
    v_category := COALESCE((v_item->>'category')::public.admin_config_category, 'feature_flags'::public.admin_config_category);
    v_data_type := COALESCE(v_item->>'data_type', 'string');
    v_is_secret := COALESCE((v_item->>'is_secret')::boolean, FALSE);
    v_is_active := COALESCE((v_item->>'is_active')::boolean, TRUE);

    RETURN QUERY
    SELECT * FROM public.upsert_admin_config_setting(
      v_key,
      v_value,
      v_category,
      v_data_type,
      v_is_secret,
      v_is_active,
      p_admin_id
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- 5) Grants — mirror the single-key RPC (BP-78). The dt61 event trigger
--    auto-revokes PUBLIC/anon/authenticated on new functions, so explicit
--    grants are mandatory for the browser (authenticated) + API (service_role).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.upsert_admin_config_settings_batch(jsonb, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_admin_config_settings_batch(jsonb, uuid) TO authenticated, service_role;

-- =============================================================================
-- VERIFICATION QUERIES (SQL-3 / SQL-10) — run AFTER applying to staging
-- =============================================================================

-- 1. Valid final state passes (offer 100 + pickup 67 = 167h — previously the
--    exact false-rejection case). Expect NO error:
-- SELECT public.fn_validate_trade_timing_state('{"offer_timeout_hours":"100","pickup_window_hours":"67"}'::jsonb);

-- 2. Genuinely invalid final state still REJECTED (200h). Expect P0001:
-- SELECT public.fn_validate_trade_timing_state('{"offer_timeout_hours":"120","pickup_window_hours":"80"}'::jsonb);

-- 3. Batch RPC round-trips a valid two-key save atomically (offer 48→100,
--    pickup 72→67 in ONE call) — expect rows returned and then REVERT by
--    calling it again with the original values. Both writes are one transaction:
-- SELECT * FROM public.upsert_admin_config_settings_batch(
--   '[{"key":"offer_timeout_hours","value":"100","category":"trade","data_type":"number"},
--     {"key":"pickup_window_hours","value":"67","category":"trade","data_type":"number"}]'::jsonb,
--   NULL);

-- 4. Invalid batch (120 + 80) rejects with NO partial write — expect P0001 and
--    then confirm neither key changed:
-- SELECT * FROM public.upsert_admin_config_settings_batch(
--   '[{"key":"offer_timeout_hours","value":"120","category":"trade","data_type":"number"},
--     {"key":"pickup_window_hours","value":"80","category":"trade","data_type":"number"}]'::jsonb,
--   NULL);

-- 5. Functions exist + trigger still attached:
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('fn_trade_timing_config_keys','fn_validate_trade_timing_state',
--    'fn_validate_trade_timing_config','upsert_admin_config_settings_batch');
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.admin_config'::regclass
--   AND tgname = 'trigger_validate_trade_timing_config';
