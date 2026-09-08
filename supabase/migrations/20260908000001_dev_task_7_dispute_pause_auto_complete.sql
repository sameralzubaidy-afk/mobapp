-- =============================================================================
-- FIX-Task-7 (2026-09-08) — P1: a reported dispute does NOT pause auto-complete
-- QA Task TRD-R1 P1: open-dispute wrote the modern dispute overlay
-- (dispute_status/reason/notes/opened_at) but never the legacy `disputed_at`
-- column, while the auto-complete / extension / complete-trade guards gated only
-- on `disputed_at` (a dead guard — nothing in production wrote it). A reported
-- dispute therefore auto-completed: item sold + seller payout queued while the
-- dispute stayed open.
--
-- Fix (defense in depth, per FIX-Task-7 item 1):
--   1. open-dispute EF now stamps `disputed_at` (edge-function change, see
--      supabase/functions/open-dispute/index.ts).
--   2. Auto-complete + extension guards now ALSO gate on the live
--      `dispute_status` column (reported/under_review), not just `disputed_at`.
--   3. Belt-and-suspenders trigger: keep `disputed_at` in sync whenever
--      `dispute_status` transitions (reported/under_review -> stamp;
--      none/resolved -> clear), so no future write path can strand the drift.
--
-- MODE: B — idempotent rerunnable (CREATE OR REPLACE / guarded DROP+CREATE).
-- Apply BEFORE deploying the open-dispute / resolve-dispute / complete-trade /
-- process-auto-complete Edge Functions (migration-first deploy order).
-- =============================================================================

-- =============================================================================
-- 1. rpc_process_auto_complete — gate on live dispute_status too
--    (current body preserved from 20260830000001 BLOCK 3; ONLY the eligibility
--     WHERE clause changed: adds COALESCE(dispute_status,'none') NOT IN
--     ('reported','under_review') so a reported/under_review dispute can never
--     be flipped to completed even if a writer forgot disputed_at).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_process_auto_complete(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_trade RECORD;
  v_net_cash_cents integer;
  v_payout_result jsonb;
BEGIN
  FOR v_trade IN
    SELECT t.id, t.seller_id, t.listing_id, t.cash_amount_cents, t.seller_transaction_fee_cents
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (t.extension_status IS DISTINCT FROM 'requested')
      AND (
        t.disputed_at IS NULL
        OR t.dispute_resolution IS NOT NULL
      )
      -- FIX-Task-7 (P1): an OPEN dispute (reported/under_review) must pause
      -- auto-complete regardless of the disputed_at legacy column. NULL-safe:
      -- legacy rows with NULL dispute_status default to 'none' (eligible).
      AND COALESCE(t.dispute_status, 'none') NOT IN ('reported', 'under_review')
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Flip to completed. Dev Task 41 item 11: stamp auto_completed_at so the
    -- notification trigger uses the guide's "automatically marked complete" copy.
    UPDATE public.trades t
    SET status = 'completed',
        completed_at = COALESCE(t.completed_at, now()),
        updated_at = now(),
        last_status_change_at = now(),
        auto_completed_at = COALESCE(t.auto_completed_at, now())
    WHERE t.id = v_trade.id;

    v_updated_count := v_updated_count + 1;

    -- DT-39: mirror complete_trade_v2's completion side-effects.
    UPDATE public.items i SET status = 'sold', updated_at = now() WHERE i.id = v_trade.listing_id;

    v_net_cash_cents := GREATEST(0,
      COALESCE(v_trade.cash_amount_cents, 0) - COALESCE(v_trade.seller_transaction_fee_cents, 0));

    UPDATE public.trades t
    SET payout_amount_cents = v_net_cash_cents,
        updated_at = now()
    WHERE t.id = v_trade.id;

    BEGIN
      IF v_net_cash_cents > 0 THEN
        SELECT public.create_seller_payout_on_trade_completion(
          v_trade.id,
          v_trade.seller_id,
          v_net_cash_cents
        ) INTO v_payout_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF to_regclass('public.debug_logs') IS NOT NULL THEN
        INSERT INTO public.debug_logs (process_name, message, payload)
        VALUES (
          'rpc_process_auto_complete',
          'payout creation failed for trade ' || v_trade.id::text || ': ' || SQLERRM,
          jsonb_build_object('trade_id', v_trade.id::text, 'net_cash_cents', v_net_cash_cents)
        );
      END IF;
      RAISE WARNING 'rpc_process_auto_complete: payout creation failed for trade %: %', v_trade.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'auto_completed_count', v_updated_count,
    'processed_at', now()
  );
END;
$$;

-- Preserve the original grant (service_role — cron/EF invocation).
GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer) FROM anon, PUBLIC;

-- =============================================================================
-- 2. rpc_request_trade_extension — DISPUTE_OPEN guard keys on live dispute_status
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_request_trade_extension(
  p_trade_id uuid,
  p_requester_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_response_window_hours integer := 4;
  v_expires_at timestamptz;
BEGIN
  IF p_trade_id IS NULL OR p_requester_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id and p_requester_id are required'));
  END IF;

  SELECT * INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'TRADE_NOT_FOUND', 'message', 'We couldn''t find this trade.'));
  END IF;

  -- Requester must be a participant (buyer or seller).
  IF v_trade.buyer_id <> p_requester_id AND v_trade.seller_id <> p_requester_id THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'FORBIDDEN', 'message', 'You are not a participant in this trade.'));
  END IF;

  -- R15-1: pickup window only (status must be in_progress — post-acceptance).
  IF v_trade.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'INVALID_STATE', 'message',
        'Extensions can only be requested during the pickup window (after the offer is accepted).',
        'details', jsonb_build_object('status', v_trade.status)));
  END IF;

  -- Block while an open dispute is unresolved (mirror rpc_process_auto_complete guard).
  -- FIX-Task-7 (P1): also treat reported/under_review dispute_status as open —
  -- do not depend on the legacy disputed_at write path.
  IF (v_trade.dispute_status IS NOT NULL AND v_trade.dispute_status NOT IN ('none', 'resolved'))
     OR (v_trade.disputed_at IS NOT NULL AND v_trade.dispute_resolution IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'DISPUTE_OPEN', 'message', 'Cannot request an extension while a dispute is open.'));
  END IF;

  -- R15-3: exactly one extension per trade — any prior extension activity
  -- (requested / accepted / denied / auto_denied / reauth_failed) blocks a new
  -- request, regardless of outcome (locked decision).
  IF v_trade.extension_status IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'EXTENSION_ALREADY_USED',
        'message', 'This trade has already used its one extension.',
        'details', jsonb_build_object('extension_status', v_trade.extension_status)));
  END IF;

  -- R15-2: consent window = extension_response_window_hours (default 4h).
  v_response_window_hours := public.fn_admin_config_int('extension_response_window_hours', 4);
  v_expires_at := now() + make_interval(hours => v_response_window_hours);

  UPDATE public.trades t SET
    extension_status = 'requested',
    extension_requested_by = p_requester_id,
    extension_requested_at = now(),
    extension_request_expires_at = v_expires_at,
    extension_responded_by = NULL,
    extension_responded_at = NULL,
    updated_at = now()
  WHERE t.id = p_trade_id;

  -- N2 audit (R15-8): distinct event type, own idempotency key.
  PERFORM public.fn_log_financial_audit(
    'extension_requested', 'trade', p_trade_id, p_requester_id,
    jsonb_build_object('extension_status', v_trade.extension_status),
    jsonb_build_object('extension_status', 'requested', 'extension_request_expires_at', v_expires_at),
    NULL,
    'extension_requested_' || p_trade_id::text,
    NULL
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'extension_status', 'requested',
    'extension_request_expires_at', v_expires_at,
    'requester_id', p_requester_id,
    'counterparty_id', CASE WHEN v_trade.buyer_id = p_requester_id THEN v_trade.seller_id ELSE v_trade.buyer_id END,
    'listing_id', v_trade.listing_id,
    'buyer_id', v_trade.buyer_id,
    'seller_id', v_trade.seller_id
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_request_trade_extension(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_request_trade_extension(uuid, uuid) FROM anon, PUBLIC;

-- =============================================================================
-- 3. rpc_apply_trade_extension — DISPUTE_OPEN guard keys on live dispute_status
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_apply_trade_extension(
  p_trade_id uuid,
  p_actor_id uuid,
  p_new_pi_id text,
  p_new_pi_amount_cents integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_extension_window_hours integer := 72;
  v_new_auto_complete_at timestamptz;
  v_new_auth_expires_at timestamptz;
BEGIN
  IF p_trade_id IS NULL OR p_actor_id IS NULL OR p_new_pi_id IS NULL OR p_new_pi_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id, p_actor_id and p_new_pi_id are required'));
  END IF;

  SELECT * INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'TRADE_NOT_FOUND', 'message', 'We couldn''t find this trade.'));
  END IF;

  -- Actor must be a participant AND the counterparty (cannot accept your own request).
  IF v_trade.buyer_id <> p_actor_id AND v_trade.seller_id <> p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'FORBIDDEN', 'message', 'You are not a participant in this trade.'));
  END IF;

  IF v_trade.extension_requested_by = p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'CANNOT_SELF_RESPOND', 'message', 'You cannot respond to your own extension request.'));
  END IF;

  -- R15-1: only valid while the trade is in the pickup window.
  IF v_trade.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'INVALID_STATE', 'message', 'This trade is no longer in the pickup window.'));
  END IF;

  -- FIX-Task-7 (P1): treat reported/under_review dispute_status as open too.
  IF (v_trade.dispute_status IS NOT NULL AND v_trade.dispute_status NOT IN ('none', 'resolved'))
     OR (v_trade.disputed_at IS NOT NULL AND v_trade.dispute_resolution IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'DISPUTE_OPEN', 'message', 'Cannot accept an extension while a dispute is open.'));
  END IF;

  -- There must be a pending request to accept.
  IF v_trade.extension_status IS DISTINCT FROM 'requested' THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'NO_PENDING_REQUEST', 'message', 'There is no pending extension request on this trade.'));
  END IF;

  IF v_trade.extension_granted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'EXTENSION_ALREADY_USED', 'message', 'This trade has already used its one extension.'));
  END IF;

  -- R15-3: granted window = extension_window_hours (fresh auth resets the clock).
  v_extension_window_hours := public.fn_admin_config_int('extension_window_hours', 72);
  v_new_auto_complete_at := now() + make_interval(hours => v_extension_window_hours);
  v_new_auth_expires_at := now() + interval '7 days';

  UPDATE public.trades t SET
    stripe_payment_intent_id = p_new_pi_id,
    authorization_expires_at = v_new_auth_expires_at,
    auto_complete_at = v_new_auto_complete_at,
    extension_status = 'accepted',
    extension_granted_at = now(),
    extension_responded_by = p_actor_id,
    extension_responded_at = now(),
    updated_at = now()
  WHERE t.id = p_trade_id;

  -- N2 audit (R15-8): distinct `trade_extension_reauth` event with its OWN
  -- idempotency key (not a retry of the original authorization).
  PERFORM public.fn_log_financial_audit(
    'trade_extension_reauth', 'trade', p_trade_id, p_actor_id,
    jsonb_build_object(
      'stripe_payment_intent_id', v_trade.stripe_payment_intent_id,
      'authorization_expires_at', v_trade.authorization_expires_at,
      'auto_complete_at', v_trade.auto_complete_at
    ),
    jsonb_build_object(
      'stripe_payment_intent_id', p_new_pi_id,
      'authorization_expires_at', v_new_auth_expires_at,
      'auto_complete_at', v_new_auto_complete_at,
      'extension_status', 'accepted'
    ),
    p_new_pi_amount_cents,
    'extension_reauth_' || p_trade_id::text,
    NULL
  );

  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object(
    'extension_status', 'accepted',
    'auto_complete_at', v_new_auto_complete_at,
    'authorization_expires_at', v_new_auth_expires_at,
    'stripe_payment_intent_id', p_new_pi_id
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_trade_extension(uuid, uuid, text, integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_apply_trade_extension(uuid, uuid, text, integer) FROM anon, PUBLIC;

-- =============================================================================
-- 4. Belt-and-suspenders: keep disputed_at in sync with dispute_status so no
--    single write path (EF or future script) can ever strand the drift again.
--    reported/under_review  -> stamp disputed_at (if not already set)
--    none/resolved          -> clear disputed_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_sync_disputed_at_from_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dispute_status IN ('reported', 'under_review') THEN
    IF NEW.disputed_at IS NULL THEN
      NEW.disputed_at := now();
    END IF;
  ELSIF NEW.dispute_status IN ('none', 'resolved') THEN
    NEW.disputed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Rerun-safe (Mode B): drop + recreate the trigger.
DROP TRIGGER IF EXISTS trg_sync_disputed_at_from_status ON public.trades;
CREATE TRIGGER trg_sync_disputed_at_from_status
  BEFORE UPDATE OF dispute_status ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_disputed_at_from_status();

-- =============================================================================
-- Verification queries (SQL-3 / BP-10): confirm objects exist post-apply.
-- =============================================================================
-- Expected: 3 rows (the three FIX-Task-7 RPCs redefined above).
-- SELECT p.proname, p.prosecdef
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('rpc_process_auto_complete','rpc_request_trade_extension','rpc_apply_trade_extension')
--   AND p.prokind = 'f'
-- ORDER BY p.proname;

-- Expected: 1 row (the sync trigger).
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'public.trades'::regclass AND tgname = 'trg_sync_disputed_at_from_status';

-- Expected: trigger function exists.
-- SELECT proname FROM pg_proc WHERE proname = 'fn_sync_disputed_at_from_status';
