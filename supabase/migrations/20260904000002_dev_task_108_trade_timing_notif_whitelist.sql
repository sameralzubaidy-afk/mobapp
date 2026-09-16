-- =============================================================================
-- Migration: 20260904000001_dev_task_108_trade_timing_notif_whitelist.sql
-- Mode: B (idempotent rerunnable migration — all statements are CREATE OR
--       REPLACE FUNCTION; safe to re-run).
--
-- DEV-TASK-108 item 6 (from Dev Task 107): the page writes
--   auto_complete_notif_1_hours_before / auto_complete_notif_2_hours_before
--   (R2 auto-complete reminders), which were validated CLIENT-ONLY. The
--   server-side trade-timing validator whitelist covered only the deprecated
--   single legacy key `auto_complete_notif_hours_before` — this exact gap was
--   flagged as latent in DEV-TASK-106 ("their ordering is still client-only").
--
-- Fix (transactional-batch pattern, NOT the old per-key loop — the whole point
-- of the DT106 batch RPC was to validate the batch's intended FINAL state once,
-- order-independently). We extend the two shared functions the trigger AND the
-- batch RPC both delegate to, so every write path (single-key trigger write,
-- batch RPC) enforces the rules server-side with no order dependency:
--   1) fn_trade_timing_config_keys()        — add the two keys to the canonical
--      list (this is what makes the BEFORE-row trigger + batch RPC snapshot &
--      validate them).
--   2) fn_validate_trade_timing_state(jsonb) — parse the two keys (defaults 24/2,
--      same as the old R2 trigger) and enforce the R2 ordering rules:
--        auto_complete_notif_1_hours_before < auto_complete_hours
--        auto_complete_notif_2_hours_before < auto_complete_notif_1_hours_before
--      (mirrors the client validator in
--       p2p-kids-admin/src/lib/tradeTimingValidation.ts and the pre-DT106 R2
--       trigger body in 20260810000002_r2_cleanup.sql).
--
-- fn_validate_trade_timing_config() (the trigger fn) and
-- upsert_admin_config_settings_batch() need NO body change — both delegate to
-- fn_trade_timing_config_keys() + fn_validate_trade_timing_state(). The legacy
-- auto_complete_notif_hours_before key stays validated for back-compat.
-- =============================================================================

-- =============================================================================
-- 1) Canonical key list — add the two R2 auto-complete reminder keys.
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
    'auto_complete_notif_1_hours_before',
    'auto_complete_notif_2_hours_before',
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
-- 2) Shared full-state validator — add the two keys' parse + ordering checks.
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
  v_auto_complete_notif_1 integer;
  v_auto_complete_notif_2 integer;
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
  v_auto_complete_notif_1 := public.fn_admin_config_safe_int(p_values->>'auto_complete_notif_1_hours_before', 24);
  v_auto_complete_notif_2 := public.fn_admin_config_safe_int(p_values->>'auto_complete_notif_2_hours_before', 2);
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

  -- DEV-TASK-108 (R2): the two canonical auto-complete reminder keys are now
  -- validated server-side (previously client-only).
  IF v_auto_complete_notif_1 >= v_auto_complete THEN
    RAISE EXCEPTION 'auto_complete_notif_1_hours_before (%) must be less than auto_complete_hours (%)', v_auto_complete_notif_1, v_auto_complete;
  END IF;

  IF v_auto_complete_notif_2 >= v_auto_complete_notif_1 THEN
    RAISE EXCEPTION 'auto_complete_notif_2_hours_before (%) must be less than auto_complete_notif_1_hours_before (%)', v_auto_complete_notif_2, v_auto_complete_notif_1;
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
-- VERIFICATION QUERIES (SQL-3 / SQL-10) — run AFTER applying to staging
-- =============================================================================

-- 1. Valid combined state passes (notif_1=24 < auto_complete=72; notif_2=2 <
--    notif_1=24; offer 48 + pickup 72 = 120 ≤ 167). Expect NO error:
-- SELECT public.fn_validate_trade_timing_state(
--   '{"offer_timeout_hours":"48","pickup_window_hours":"72",
--     "auto_complete_hours":"72","auto_complete_notif_1_hours_before":"24",
--     "auto_complete_notif_2_hours_before":"2"}'::jsonb);

-- 2. INVALID combined state REJECTED — notif_2 (24) >= notif_1 (24). Expect P0001:
-- SELECT public.fn_validate_trade_timing_state(
--   '{"auto_complete_hours":"72","auto_complete_notif_1_hours_before":"24",
--     "auto_complete_notif_2_hours_before":"24"}'::jsonb);

-- 3. INVALID combined state REJECTED — notif_1 (80) >= auto_complete_hours (72).
--    Expect P0001:
-- SELECT public.fn_validate_trade_timing_state(
--   '{"auto_complete_hours":"72","auto_complete_notif_1_hours_before":"80",
--     "auto_complete_notif_2_hours_before":"2"}'::jsonb);

-- 4. Single-key trigger path also enforces: writing auto_complete_notif_2=24
--    while stored notif_1=24 is rejected (overlay of stored + NEW). Expect
--    P0001 — run via the shared RPC:
-- SELECT * FROM public.upsert_admin_config_setting(
--   'auto_complete_notif_2_hours_before','24','trade','number',FALSE,TRUE,NULL);

-- 5. Batch RPC round-trips a valid two-key change atomically, then REVERT:
-- SELECT * FROM public.upsert_admin_config_settings_batch(
--   '[{"key":"auto_complete_notif_1_hours_before","value":"36","category":"trade","data_type":"number"},
--     {"key":"auto_complete_notif_2_hours_before","value":"4","category":"trade","data_type":"number"}]'::jsonb,
--   NULL);
-- (revert with 24/2 in a second call)

-- 6. Functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('fn_trade_timing_config_keys','fn_validate_trade_timing_state');
