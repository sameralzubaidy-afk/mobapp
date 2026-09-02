-- =============================================================================
-- Migration: 20260902000000_fix_escalate_expired_cancel_requests_notify.sql
-- DEV-TASK-83 (Z03): the timeout-escalation cron RPC marked requests 'escalated'
-- but never created the `cancel_request_escalated` notification — unlike the
-- seller-decline path (fn_respond_cancel_request), which does. Per the spec/guide
-- (TRD line 6748), a buyer whose request times out should get the same
-- "Sent to our team" notification as a decline-triggered escalation.
--
-- SQL-0 mode: MODE B (idempotent rerunnable) — CREATE OR REPLACE FUNCTION.
-- No signature change → no DROP FUNCTION needed (BP-12).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_escalate_expired_cancel_requests — cron RPC (every 10 min) + manual
--   Now captures the affected trades BEFORE the status UPDATE and emits one
--   `cancel_request_escalated` notification per (buyer, bundle) — mirroring the
--   decline-escalation copy — so a 3-item bundle gets 1 notification, not 3.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_escalate_expired_cancel_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated    INTEGER;
  v_now        TIMESTAMPTZ := NOW();
  v_esc        RECORD;
  v_item_title TEXT;
BEGIN
  IF NOT public.fn_cancel_request_escalation_enabled() THEN
    INSERT INTO public.cancel_request_escalation_runs (processed_count, errors_count)
    VALUES (0, 0);
    RETURN jsonb_build_object('success', true, 'skipped', true,
      'reason', 'escalation disabled', 'updated', 0);
  END IF;

  -- DEV-TASK-83 (Z03): capture the affected rows FIRST so the buyer can be
  -- notified after the UPDATE (the UPDATE hides which rows escalated).
  CREATE TEMP TABLE tmp_escalated_cancel_requests ON COMMIT DROP AS
  SELECT t.id, t.bundle_id, t.cancel_requested_by, t.listing_id
  FROM public.trades t
  WHERE t.cancel_request_status = 'requested'
    AND t.cancel_request_expires_at IS NOT NULL
    AND t.cancel_request_expires_at < v_now
    AND t.status = 'in_progress';

  UPDATE public.trades t
  SET cancel_request_status = 'escalated',
      updated_at = v_now
  WHERE t.cancel_request_status = 'requested'
    AND t.cancel_request_expires_at IS NOT NULL
    AND t.cancel_request_expires_at < v_now
    AND t.status = 'in_progress';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- One notification per (buyer, bundle) — mirror fn_respond_cancel_request's
  -- decline-escalation copy exactly ('Sent to our team' / deep link).
  FOR v_esc IN
    SELECT DISTINCT ON (x.cancel_requested_by, COALESCE(x.bundle_id, x.id))
           x.id, x.bundle_id, x.cancel_requested_by, x.listing_id
    FROM tmp_escalated_cancel_requests x
    ORDER BY x.cancel_requested_by, COALESCE(x.bundle_id, x.id)
  LOOP
    SELECT COALESCE(i.title, 'item') INTO v_item_title
    FROM public.items i WHERE i.id = v_esc.listing_id;

    PERFORM public.create_trade_notification(
      v_esc.cancel_requested_by,
      'cancel_request_escalated',
      'Sent to our team',
      'The seller did not respond to your cancellation for "'
        || COALESCE(v_item_title, 'item') || '". Our team is reviewing it now.',
      jsonb_build_object('trade_id', v_esc.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_esc.id::text, 'type', 'cancel_request_escalated')
    );
  END LOOP;

  DROP TABLE IF EXISTS tmp_escalated_cancel_requests;

  INSERT INTO public.cancel_request_escalation_runs (processed_count, errors_count)
  VALUES (v_updated, 0);

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'ran_at', v_now);
END;
$$;

-- =============================================================================
-- VERIFICATION (run AFTER applying — read-only):
--   1. Function body has the notification loop:
--      SELECT prosrc FROM pg_proc WHERE proname = 'fn_escalate_expired_cancel_requests';
--   2. Grants unchanged (authenticated, service_role — POSTGRES/anon revoked):
--      SELECT (aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner)))).grantee::regrole
--      FROM pg_proc p WHERE p.proname = 'fn_escalate_expired_cancel_requests';
--   3. Fast-clock a pending request, run SELECT public.fn_escalate_expired_cancel_requests(),
--      then confirm one `cancel_request_escalated` row per bundle:
--      SELECT user_id, type, data->>'deep_link' FROM user_notifications
--      WHERE type = 'cancel_request_escalated' ORDER BY created_at DESC LIMIT 5;
-- =============================================================================
