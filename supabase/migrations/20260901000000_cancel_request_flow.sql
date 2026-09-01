-- =============================================================================
-- Migration: 20260901000000_cancel_request_flow.sql
-- Mode: B (idempotent rerunnable migration)
--
-- FIX-CANCEL (2026-09-01) — Option A: Buyer "Request to Cancel" with
-- configurable admin escalation.
--
-- Closes the buyer in-progress cancel gap: a buyer on an in_progress trade can
-- submit a Request to Cancel. The seller approves (→ existing cancel-trade EF:
-- SP release + Stripe refund + tax void) or declines (→ escalate to admin). If
-- the seller does not respond within cancel_request_response_timeout_hours,
-- the request auto-escalates to admin. Admin resolves via Approve Cancel (→
-- existing force-cancel/refund path) or Keep Trade (→ trade continues).
--
-- Everything about escalation is admin_config-driven (NOT hard-coded):
--   cancel_request_escalation_enabled      (bool,   default true)
--   cancel_request_response_timeout_hours  (number, default 48)
--
-- State machine (trades.cancel_request_status):
--   requested -> approved (transient; cancellation executes via existing EF)
--   requested -> escalated (seller declined OR response timeout) -> resolved
--   requested -> withdrawn (buyer retracts)
--   resolved carries cancel_request_resolution = approved_cancel | keep_trade
--
-- Money operations are NEVER reimplemented here — approve paths only mark
-- state; the existing cancel-trade EF / admin force-cancel handle SP/Stripe/
-- tax. In-app notifications reuse public.create_trade_notification (145_trade_
-- notifications.sql); push is delivered by the existing send-trade-notifications
-- processor for rows with channel 'push'.
-- =============================================================================

-- =============================================================================
-- BLOCK A: trades overlay columns + CHECK constraints
-- =============================================================================
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS cancel_requested_by     UUID,
  ADD COLUMN IF NOT EXISTS cancel_requested_role   TEXT,
  ADD COLUMN IF NOT EXISTS cancel_request_reason   TEXT,
  ADD COLUMN IF NOT EXISTS cancel_request_status   TEXT,
  ADD COLUMN IF NOT EXISTS cancel_request_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_request_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_request_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_request_resolved_by UUID,
  ADD COLUMN IF NOT EXISTS cancel_request_resolution  TEXT;

COMMENT ON COLUMN public.trades.cancel_requested_by IS
'Buyer who requested the cancellation (auth user id).';
COMMENT ON COLUMN public.trades.cancel_requested_role IS
'Role that requested cancellation. Currently always ''buyer'' (seller has instant cancel).';
COMMENT ON COLUMN public.trades.cancel_request_reason IS
'Free-text reason from the buyer''s cancellation request.';
COMMENT ON COLUMN public.trades.cancel_request_status IS
'requested | approved | escalated | resolved | withdrawn (see 20260901000000_cancel_request_flow.sql).';
COMMENT ON COLUMN public.trades.cancel_request_expires_at IS
'Deadline for the seller to respond; after this the cron escalates the request.';
COMMENT ON COLUMN public.trades.cancel_request_resolution IS
'approved_cancel | keep_trade — set when cancel_request_status = ''resolved''.';

-- Rerunnable CHECK constraints (drop-then-create, no CREATE CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cancel_request_status') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT chk_cancel_request_status
      CHECK (cancel_request_status IN ('requested','approved','escalated','resolved','withdrawn'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cancel_request_resolution') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT chk_cancel_request_resolution
      CHECK (cancel_request_resolution IN ('approved_cancel','keep_trade'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cancel_request_role') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT chk_cancel_request_role
      CHECK (cancel_requested_role IN ('buyer','seller'));
  END IF;
END;
$$;

-- Defense-in-depth: the cancel_request_* columns must not be writable directly
-- by client roles (trades has no authenticated UPDATE policy today, but this
-- keeps the columns locked even if one is ever added). SECURITY DEFINER RPCs
-- run as owner and are unaffected.
REVOKE UPDATE (cancel_requested_by, cancel_requested_role, cancel_request_reason,
  cancel_request_status, cancel_request_created_at, cancel_request_expires_at,
  cancel_request_resolved_at, cancel_request_resolved_by, cancel_request_resolution)
  ON public.trades FROM anon, authenticated;

-- =============================================================================
-- BLOCK B: cron-audit table (mirrors auto_complete_runs) + RLS (service_role)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cancel_request_escalation_runs (
  id              BIGSERIAL PRIMARY KEY,
  ran_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_count INTEGER NOT NULL DEFAULT 0,
  errors_count    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.cancel_request_escalation_runs ENABLE ROW LEVEL SECURITY;

-- Rerunnable policy (DROP + CREATE per SQL-1)
DROP POLICY IF EXISTS "cancel_request_escalation_runs_service_role_all" ON public.cancel_request_escalation_runs;
CREATE POLICY "cancel_request_escalation_runs_service_role_all"
  ON public.cancel_request_escalation_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- BLOCK C: admin_config seed + config helpers
-- =============================================================================
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('cancel_request_escalation_enabled', 'true',
   'When true, seller-declined or timeout-expired cancellation requests auto-escalate to the admin Action Center. When false, a declined request ends with the trade continuing (no admin review).',
   'trade', 'boolean', true),
  ('cancel_request_response_timeout_hours', '48',
   'Hours a seller has to respond to a buyer''s cancellation request before it auto-escalates to admin. Default: 48.',
   'trade', 'number', true)
ON CONFLICT (key) DO NOTHING;

-- Read the response timeout; BP-13: default 48 links to this migration's seed.
CREATE OR REPLACE FUNCTION public.fn_cancel_request_timeout_hours()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw   TEXT;
  v_value INTEGER;
BEGIN
  SELECT ac.value INTO v_raw
  FROM public.admin_config ac
  WHERE ac.key = 'cancel_request_response_timeout_hours' AND ac.is_active = TRUE
  LIMIT 1;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN 48; -- seed default 20260901000000_cancel_request_flow.sql
  END IF;

  BEGIN
    v_value := v_raw::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN 48; -- seed default 20260901000000_cancel_request_flow.sql
  END;

  IF v_value <= 0 OR v_value > 336 THEN
    RETURN 48; -- seed default 20260901000000_cancel_request_flow.sql
  END IF;

  RETURN v_value;
END;
$$;

-- Read the escalation-enabled flag; BP-13: default true links to this migration's seed.
CREATE OR REPLACE FUNCTION public.fn_cancel_request_escalation_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw   TEXT;
  v_value BOOLEAN;
BEGIN
  SELECT ac.value INTO v_raw
  FROM public.admin_config ac
  WHERE ac.key = 'cancel_request_escalation_enabled' AND ac.is_active = TRUE
  LIMIT 1;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN TRUE; -- seed default 20260901000000_cancel_request_flow.sql
  END IF;

  BEGIN
    v_value := v_raw::BOOLEAN;
  EXCEPTION WHEN OTHERS THEN
    RETURN TRUE; -- seed default 20260901000000_cancel_request_flow.sql
  END;

  RETURN COALESCE(v_value, TRUE);
END;
$$;

-- =============================================================================
-- BLOCK D: RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_request_cancel_trade — buyer initiates a request (single or whole bundle)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_request_cancel_trade(
  p_trade_id UUID,
  p_user_id  UUID,
  p_reason   TEXT DEFAULT NULL,
  p_scope    TEXT DEFAULT 'all' -- 'all' | 'single'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade          RECORD;
  v_buyer_name     TEXT;
  v_item_title     TEXT;
  v_timeout_hours  INTEGER;
  v_expires_at     TIMESTAMPTZ;
  v_now            TIMESTAMPTZ := NOW();
  v_bundle_id      UUID;
  v_updated        INTEGER;
BEGIN
  -- 1. Load trade (row lock)
  SELECT t.* INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND',
      'error', 'Trade not found');
  END IF;

  -- 2. Caller must be the buyer
  IF v_trade.buyer_id IS NULL OR p_user_id <> v_trade.buyer_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_BUYER',
      'error', 'Only the buyer can request a cancellation');
  END IF;

  -- 3. Status must be in_progress
  IF v_trade.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'code', 'WRONG_STATUS',
      'error', 'Cancellation can only be requested while the trade is in progress',
      'status', v_trade.status);
  END IF;

  -- 4. No unresolved dispute
  IF v_trade.dispute_status IS NOT NULL AND v_trade.dispute_status NOT IN ('none','resolved') THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNRESOLVED_DISPUTE',
      'error', 'This trade is under review and cannot be cancelled right now');
  END IF;

  -- 5. No existing pending request
  IF v_trade.cancel_request_status IN ('requested','escalated') THEN
    RETURN jsonb_build_object('success', false, 'code', 'REQUEST_ALREADY_PENDING',
      'error', 'A cancellation request is already pending for this trade');
  END IF;

  -- 6. Expiry from config
  v_timeout_hours := public.fn_cancel_request_timeout_hours();
  v_expires_at := v_now + make_interval(hours => v_timeout_hours);

  -- 7. Apply to the trade (or the whole bundle when scope = all)
  v_bundle_id := v_trade.bundle_id;
  IF p_scope = 'all' AND v_bundle_id IS NOT NULL THEN
    UPDATE public.trades t
    SET cancel_requested_by      = p_user_id,
        cancel_requested_role    = 'buyer',
        cancel_request_reason    = p_reason,
        cancel_request_status    = 'requested',
        cancel_request_created_at = v_now,
        cancel_request_expires_at = v_expires_at,
        cancel_request_resolved_at = NULL,
        cancel_request_resolved_by = NULL,
        cancel_request_resolution  = NULL,
        updated_at               = v_now
    WHERE t.bundle_id = v_bundle_id
      AND t.status = 'in_progress';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    UPDATE public.trades t
    SET cancel_requested_by      = p_user_id,
        cancel_requested_role    = 'buyer',
        cancel_request_reason    = p_reason,
        cancel_request_status    = 'requested',
        cancel_request_created_at = v_now,
        cancel_request_expires_at = v_expires_at,
        cancel_request_resolved_at = NULL,
        cancel_request_resolved_by = NULL,
        cancel_request_resolution  = NULL,
        updated_at               = v_now
    WHERE t.id = p_trade_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_UPDATED_ROWS',
      'error', 'No cancellable trade found for the request scope');
  END IF;

  -- 8. Notify seller (in-app + push via the send-trade-notifications processor)
  SELECT COALESCE(p.name, 'Someone') INTO v_buyer_name
  FROM public.profiles p WHERE p.user_id = v_trade.buyer_id;
  SELECT COALESCE(i.title, 'item') INTO v_item_title
  FROM public.items i WHERE i.id = v_trade.listing_id;

  PERFORM public.create_trade_notification(
    v_trade.seller_id,
    'cancel_request_sent',
    'Cancellation requested',
    COALESCE(v_buyer_name, 'Someone') || ' wants to cancel "' || COALESCE(v_item_title, 'item')
      || '". Reply in ' || v_timeout_hours || 'h or our team will review it.',
    jsonb_build_object(
      'trade_id',   v_trade.id::text,
      'item_title', COALESCE(v_item_title, ''),
      'buyer_id',   v_trade.buyer_id::text,
      'buyer_name', COALESCE(v_buyer_name, ''),
      'deep_link',  '/trades/' || v_trade.id::text,
      'type',       'cancel_request_sent'
    )
  );

  RETURN jsonb_build_object('success', true, 'trade_id', p_trade_id,
    'scope', p_scope, 'updated_trades', v_updated,
    'expires_at', v_expires_at, 'timeout_hours', v_timeout_hours);
END;
$$;

-- -----------------------------------------------------------------------------
-- fn_withdraw_cancel_request — buyer retracts a pending request
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_withdraw_cancel_request(
  p_trade_id UUID,
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade      RECORD;
  v_buyer_name TEXT;
  v_item_title TEXT;
  v_now        TIMESTAMPTZ := NOW();
  v_updated    INTEGER;
BEGIN
  SELECT t.* INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND', 'error', 'Trade not found');
  END IF;

  IF v_trade.cancel_requested_by IS NULL OR p_user_id <> v_trade.cancel_requested_by THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_REQUESTER',
      'error', 'Only the buyer who requested the cancellation can withdraw it');
  END IF;

  IF v_trade.cancel_request_status <> 'requested' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_PENDING',
      'error', 'This cancellation request can no longer be withdrawn');
  END IF;

  -- Cascade to bundle siblings still 'requested'
  IF v_trade.bundle_id IS NOT NULL THEN
    UPDATE public.trades t
    SET cancel_request_status = 'withdrawn',
        cancel_request_resolved_at = v_now,
        cancel_request_resolution = NULL,
        updated_at = v_now
    WHERE (t.id = p_trade_id OR t.bundle_id = v_trade.bundle_id)
      AND t.cancel_request_status = 'requested';
  ELSE
    UPDATE public.trades t
    SET cancel_request_status = 'withdrawn',
        cancel_request_resolved_at = v_now,
        cancel_request_resolution = NULL,
        updated_at = v_now
    WHERE t.id = p_trade_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(p.name, 'Someone') INTO v_buyer_name
  FROM public.profiles p WHERE p.user_id = v_trade.cancel_requested_by;
  SELECT COALESCE(i.title, 'item') INTO v_item_title
  FROM public.items i WHERE i.id = v_trade.listing_id;

  PERFORM public.create_trade_notification(
    v_trade.seller_id,
    'cancel_request_withdrawn',
    'Cancellation withdrawn',
    COALESCE(v_buyer_name, 'Someone') || ' withdrew their request to cancel "'
      || COALESCE(v_item_title, 'item') || '". The trade continues.',
    jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
      'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_withdrawn')
  );

  RETURN jsonb_build_object('success', true, 'trade_id', p_trade_id, 'updated_trades', v_updated);
END;
$$;

-- -----------------------------------------------------------------------------
-- fn_respond_cancel_request — seller approves or declines (approve => state only;
-- the money cancel runs through the existing cancel-trade EF afterwards)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_respond_cancel_request(
  p_trade_id UUID,
  p_user_id  UUID,
  p_action   TEXT -- 'approve' | 'decline'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade       RECORD;
  v_item_title  TEXT;
  v_escalate    BOOLEAN;
  v_now         TIMESTAMPTZ := NOW();
  v_updated     INTEGER;
  v_new_status  TEXT;
  v_resolution  TEXT;
BEGIN
  SELECT t.* INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND', 'error', 'Trade not found');
  END IF;

  -- Caller must be the seller
  IF v_trade.seller_id IS NULL OR p_user_id <> v_trade.seller_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_SELLER',
      'error', 'Only the seller can respond to a cancellation request');
  END IF;

  IF v_trade.cancel_request_status IS DISTINCT FROM 'requested' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_PENDING',
      'error', 'There is no pending cancellation request to respond to');
  END IF;

  -- Expired request can no longer be responded to (cron escalates it)
  IF v_trade.cancel_request_expires_at IS NOT NULL
     AND v_trade.cancel_request_expires_at < v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'REQUEST_EXPIRED',
      'error', 'The response window has passed — this request has been sent to our team');
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
    v_resolution := 'approved_cancel';
  ELSIF p_action = 'decline' THEN
    v_escalate := public.fn_cancel_request_escalation_enabled();
    IF v_escalate THEN
      v_new_status := 'escalated';
      v_resolution := NULL;
    ELSE
      v_new_status := 'resolved';
      v_resolution := 'keep_trade';
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ACTION',
      'error', 'Action must be approve or decline');
  END IF;

  -- Cascade to bundle siblings still 'requested'
  IF v_trade.bundle_id IS NOT NULL THEN
    UPDATE public.trades t
    SET cancel_request_status = v_new_status,
        cancel_request_resolution = v_resolution,
        cancel_request_resolved_at = v_now,
        cancel_request_resolved_by = NULL,
        updated_at = v_now
    WHERE (t.id = p_trade_id OR t.bundle_id = v_trade.bundle_id)
      AND t.cancel_request_status = 'requested';
  ELSE
    UPDATE public.trades t
    SET cancel_request_status = v_new_status,
        cancel_request_resolution = v_resolution,
        cancel_request_resolved_at = v_now,
        cancel_request_resolved_by = NULL,
        updated_at = v_now
    WHERE t.id = p_trade_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(i.title, 'item') INTO v_item_title
  FROM public.items i WHERE i.id = v_trade.listing_id;

  -- Notifications
  IF p_action = 'approve' THEN
    -- Buyer: request approved (refund follows via the cancel-trade EF).
    -- Seller: covered by the existing trade_cancelled status trigger.
    PERFORM public.create_trade_notification(
      v_trade.buyer_id,
      'cancel_request_approved',
      'Cancellation approved',
      'Your cancellation for "' || COALESCE(v_item_title, 'item')
        || '" was approved — your refund is on its way.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_approved')
    );
  ELSIF p_action = 'decline' AND v_escalate THEN
    -- Buyer: escalated to team
    PERFORM public.create_trade_notification(
      v_trade.buyer_id,
      'cancel_request_escalated',
      'Sent to our team',
      'The seller did not respond to your cancellation for "'
        || COALESCE(v_item_title, 'item') || '". Our team is reviewing it now.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_escalated')
    );
  ELSIF p_action = 'decline' AND NOT v_escalate THEN
    PERFORM public.create_trade_notification(
      v_trade.buyer_id,
      'cancel_request_resolved',
      'Trade continues',
      'We reviewed your cancellation request for "' || COALESCE(v_item_title, 'item')
        || '" — the trade will continue as planned.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_resolved')
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'trade_id', p_trade_id,
    'action', p_action, 'status', v_new_status, 'updated_trades', v_updated);
END;
$$;

-- -----------------------------------------------------------------------------
-- fn_escalate_expired_cancel_requests — cron RPC (every 10 min) + manual
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_escalate_expired_cancel_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
  v_now     TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.fn_cancel_request_escalation_enabled() THEN
    INSERT INTO public.cancel_request_escalation_runs (processed_count, errors_count)
    VALUES (0, 0);
    RETURN jsonb_build_object('success', true, 'skipped', true,
      'reason', 'escalation disabled', 'updated', 0);
  END IF;

  UPDATE public.trades t
  SET cancel_request_status = 'escalated',
      updated_at = v_now
  WHERE t.cancel_request_status = 'requested'
    AND t.cancel_request_expires_at IS NOT NULL
    AND t.cancel_request_expires_at < v_now
    AND t.status = 'in_progress';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.cancel_request_escalation_runs (processed_count, errors_count)
  VALUES (v_updated, 0);

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'ran_at', v_now);
END;
$$;

-- -----------------------------------------------------------------------------
-- fn_resolve_cancel_request — admin approve-cancel or keep-trade (state only;
-- approve_cancel money path runs through the existing admin force-cancel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_cancel_request(
  p_trade_id UUID,
  p_admin_id UUID,
  p_action   TEXT -- 'approve_cancel' | 'keep_trade'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade      RECORD;
  v_item_title TEXT;
  v_actor_id   UUID;
  v_now        TIMESTAMPTZ := NOW();
  v_updated    INTEGER;
  v_new_status TEXT;
  v_resolution TEXT;
BEGIN
  -- Actor identity + admin authorization (BP-78): service_role (admin portal
  -- service client) bypasses; authenticated callers must pass an admin.
  v_actor_id := COALESCE(p_admin_id, auth.uid());
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    IF v_actor_id IS NULL OR NOT public.admin_has_role(v_actor_id) THEN
      RETURN jsonb_build_object('success', false, 'code', 'NOT_ADMIN',
        'error', 'Admin access required');
    END IF;
  END IF;

  SELECT t.* INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TRADE_NOT_FOUND', 'error', 'Trade not found');
  END IF;

  IF v_trade.cancel_request_status NOT IN ('requested','escalated') THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ACTIONABLE',
      'error', 'No actionable cancellation request on this trade');
  END IF;

  IF p_action = 'approve_cancel' THEN
    v_new_status := 'approved';
    v_resolution := 'approved_cancel';
  ELSIF p_action = 'keep_trade' THEN
    v_new_status := 'resolved';
    v_resolution := 'keep_trade';
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ACTION',
      'error', 'Action must be approve_cancel or keep_trade');
  END IF;

  IF v_trade.bundle_id IS NOT NULL THEN
    UPDATE public.trades t
    SET cancel_request_status = v_new_status,
        cancel_request_resolution = v_resolution,
        cancel_request_resolved_at = v_now,
        cancel_request_resolved_by = v_actor_id,
        updated_at = v_now
    WHERE (t.id = p_trade_id OR t.bundle_id = v_trade.bundle_id)
      AND t.cancel_request_status IN ('requested','escalated');
  ELSE
    UPDATE public.trades t
    SET cancel_request_status = v_new_status,
        cancel_request_resolution = v_resolution,
        cancel_request_resolved_at = v_now,
        cancel_request_resolved_by = v_actor_id,
        updated_at = v_now
    WHERE t.id = p_trade_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(i.title, 'item') INTO v_item_title
  FROM public.items i WHERE i.id = v_trade.listing_id;

  IF p_action = 'approve_cancel' THEN
    PERFORM public.create_trade_notification(
      v_trade.buyer_id,
      'cancel_request_approved',
      'Cancellation approved',
      'Your cancellation for "' || COALESCE(v_item_title, 'item')
        || '" was approved — your refund is on its way.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_approved')
    );
  ELSIF p_action = 'keep_trade' THEN
    PERFORM public.create_trade_notification(
      v_trade.buyer_id,
      'cancel_request_resolved',
      'Trade continues',
      'We reviewed your cancellation request for "' || COALESCE(v_item_title, 'item')
        || '" — the trade will continue as planned.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_resolved')
    );
    PERFORM public.create_trade_notification(
      v_trade.seller_id,
      'cancel_request_resolved',
      'Trade continues',
      'The buyer''s cancellation request for "' || COALESCE(v_item_title, 'item')
        || '" was not approved. The trade continues.',
      jsonb_build_object('trade_id', v_trade.id::text, 'item_title', COALESCE(v_item_title, ''),
        'deep_link', '/trades/' || v_trade.id::text, 'type', 'cancel_request_resolved')
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'trade_id', p_trade_id,
    'action', p_action, 'status', v_new_status, 'resolution', v_resolution,
    'resolved_by', v_actor_id, 'updated_trades', v_updated);
END;
$$;

-- -----------------------------------------------------------------------------
-- fn_admin_list_cancel_requests — feed for the admin Action Center source
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_list_cancel_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                   t.id,
      'trade_id',             t.id,
      'bundle_id',            t.bundle_id,
      'item_title',           it.title,
      'buyer_id',             t.cancel_requested_by,
      'buyer_name',           bp.name,
      'seller_id',            t.seller_id,
      'seller_name',          sp.name,
      'reason',               t.cancel_request_reason,
      'status',               t.cancel_request_status,
      'requested_at',         t.cancel_request_created_at,
      'expires_at',           t.cancel_request_expires_at,
      'cash_amount_cents',    t.cash_amount_cents,
      'sp_amount',            t.sp_amount,
      'trade_status',         t.status
    ) ORDER BY t.cancel_request_created_at ASC
  ), '[]'::jsonb) INTO v_result
  FROM public.trades t
  LEFT JOIN public.items it ON it.id = t.listing_id
  LEFT JOIN public.profiles bp ON bp.user_id = t.cancel_requested_by
  LEFT JOIN public.profiles sp ON sp.user_id = t.seller_id
  WHERE t.cancel_request_status IN ('requested','escalated')
    AND t.status = 'in_progress';

  RETURN v_result;
END;
$$;

-- =============================================================================
-- BLOCK E: extend admin Action Center with the cancel_requests source
-- =============================================================================

-- --- Summary: add cancel_requests group -------------------------------------
CREATE OR REPLACE FUNCTION public.admin_action_center_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now                  TIMESTAMPTZ;
  v_flagged_count        INTEGER;
  v_dispute_count        INTEGER;
  v_id_badge_count       INTEGER;
  v_payout_count         INTEGER;
  v_cancel_request_count INTEGER;
  v_recent               INTEGER;
  v_prior                INTEGER;
  v_anomaly              BOOLEAN;
  v_reasons              JSONB;
  v_drift                JSONB;
  v_drift_count          INTEGER;
  v_groups               JSONB;
  v_total                INTEGER;
BEGIN
  v_now := NOW();

  SELECT COUNT(*)::INTEGER INTO v_flagged_count
  FROM public.items i WHERE i.status = 'flagged';

  SELECT COUNT(*)::INTEGER INTO v_dispute_count
  FROM public.trades t WHERE t.dispute_status IN ('reported', 'under_review');

  SELECT COUNT(*)::INTEGER INTO v_id_badge_count
  FROM public.id_badge_verification_requests r WHERE r.status = 'pending';

  SELECT COUNT(*)::INTEGER INTO v_payout_count
  FROM public.seller_payouts sp WHERE sp.status = 'failed';

  -- Cancel requests awaiting admin (escalated) or still awaiting seller response
  SELECT COUNT(*)::INTEGER INTO v_cancel_request_count
  FROM public.trades t
  WHERE t.cancel_request_status IN ('requested','escalated')
    AND t.status = 'in_progress';

  SELECT COUNT(*)::INTEGER INTO v_recent
  FROM public.trades t
  WHERE t.status = 'cancelled' AND t.cancelled_at >= v_now - INTERVAL '7 days';

  SELECT COUNT(*)::INTEGER INTO v_prior
  FROM public.trades t
  WHERE t.status = 'cancelled'
    AND t.cancelled_at >= v_now - INTERVAL '14 days'
    AND t.cancelled_at <  v_now - INTERVAL '7 days';

  v_anomaly := (v_recent >= 3) AND (v_recent >= 2 * v_prior);

  IF v_anomaly THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC
    ), '[]'::jsonb) INTO v_reasons
    FROM (
      SELECT t.cancellation_reason AS reason, COUNT(*)::INTEGER AS cnt
      FROM public.trades t
      WHERE t.status = 'cancelled'
        AND t.cancelled_at >= v_now - INTERVAL '7 days'
        AND t.cancellation_reason IS NOT NULL
      GROUP BY t.cancellation_reason
    ) x;
  ELSE
    v_reasons := '[]'::jsonb;
  END IF;

  WITH drift AS (
    SELECT d.key, d.default_val, d.min_val, d.max_val
    FROM (VALUES
      ('grace_period_days',                 90,   30,  180),
      ('offer_timeout_hours',               48,   1,   168),
      ('offer_notif_1_hours_before',        24,   1,   168),
      ('offer_notif_2_hours_before',        6,    1,   168),
      ('auto_complete_hours',               72,   24,  336),
      ('auto_complete_notif_hours_before',  12,   1,   72),
      ('pending_sp_release_days',           3,    1,   30),
      ('transaction_fee_member_cents',      99,   0,   10000),
      ('transaction_fee_non_member_cents',  299,  0,   10000),
      ('sp_max_percentage_per_purchase',    50,   0,   100),
      ('min_listing_price',                 0,    0,   10000)
    ) AS d(key, default_val, min_val, max_val)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'key', ac.key, 'value', ac.value,
      'documented_default', d.default_val,
      'recommended_min', d.min_val,
      'recommended_max', d.max_val
    ) ORDER BY ac.key
  ), '[]'::jsonb) INTO v_drift
  FROM public.admin_config ac
  JOIN drift d ON d.key = ac.key
  WHERE ac.is_active = TRUE
    AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND (ac.value)::NUMERIC NOT BETWEEN d.min_val AND d.max_val;

  v_drift_count := COALESCE(jsonb_array_length(v_drift), 0);

  v_groups := jsonb_build_array(
    jsonb_build_object('source', 'flagged_items',     'count', v_flagged_count),
    jsonb_build_object('source', 'disputes',          'count', v_dispute_count),
    jsonb_build_object('source', 'id_badge_requests', 'count', v_id_badge_count),
    jsonb_build_object('source', 'cancel_requests',   'count', v_cancel_request_count),
    jsonb_build_object(
      'source', 'cancel_anomalies',
      'count',  CASE WHEN v_anomaly THEN 1 ELSE 0 END,
      'detail', jsonb_build_object('recent_7d', v_recent, 'prior_7d', v_prior, 'reasons', v_reasons)
    ),
    jsonb_build_object('source', 'failed_payouts', 'count', v_payout_count),
    jsonb_build_object('source', 'config_drift',   'count', v_drift_count, 'detail', v_drift)
  );

  v_total := v_flagged_count + v_dispute_count + v_id_badge_count
           + v_cancel_request_count
           + (CASE WHEN v_anomaly THEN 1 ELSE 0 END)
           + v_payout_count + v_drift_count;

  RETURN jsonb_build_object('generated_at', v_now, 'total', v_total, 'groups', v_groups);
END;
$$;

-- --- Detail: add cancel_requests branch --------------------------------------
CREATE OR REPLACE FUNCTION public.admin_action_center_detail(p_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result   JSONB;
  v_now      TIMESTAMPTZ;
  v_recent   INTEGER;
  v_prior    INTEGER;
  v_reasons  JSONB;
  v_top_users JSONB;
BEGIN
  v_now := NOW();

  IF p_source = 'flagged_items' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', i.id, 'title', i.title, 'price', i.price, 'status', i.status,
        'flagged_at', i.flagged_at, 'seller_id', i.seller_id,
        'seller_name', pr.name, 'seller_email', pr.email
      ) ORDER BY i.flagged_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.items i
    LEFT JOIN public.profiles pr ON pr.user_id = i.seller_id
    WHERE i.status = 'flagged';

  ELSIF p_source = 'disputes' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', t.id, 'item_title', it.title, 'dispute_status', t.dispute_status,
        'dispute_reason', t.dispute_reason, 'dispute_opened_at', t.dispute_opened_at,
        'cash_amount_cents', t.cash_amount_cents, 'sp_amount', t.sp_amount
      ) ORDER BY t.dispute_opened_at ASC
    ), '[]'::jsonb) INTO v_result
    FROM public.trades t
    LEFT JOIN public.items it ON it.id = t.listing_id
    WHERE t.dispute_status IN ('reported', 'under_review');

  ELSIF p_source = 'id_badge_requests' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', r.id, 'user_id', r.user_id, 'first_name', r.first_name,
        'last_name', r.last_name, 'email', r.email,
        'submitted_at', r.submitted_at, 'node_id', r.node_id
      ) ORDER BY r.submitted_at ASC
    ), '[]'::jsonb) INTO v_result
    FROM public.id_badge_verification_requests r
    WHERE r.status = 'pending';

  ELSIF p_source = 'cancel_requests' THEN
    v_result := public.fn_admin_list_cancel_requests();

  ELSIF p_source = 'cancel_anomalies' THEN
    SELECT COUNT(*)::INTEGER INTO v_recent
    FROM public.trades t
    WHERE t.status = 'cancelled' AND t.cancelled_at >= v_now - INTERVAL '7 days';

    SELECT COUNT(*)::INTEGER INTO v_prior
    FROM public.trades t
    WHERE t.status = 'cancelled'
      AND t.cancelled_at >= v_now - INTERVAL '14 days'
      AND t.cancelled_at <  v_now - INTERVAL '7 days';

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC
    ), '[]'::jsonb) INTO v_reasons
    FROM (
      SELECT t.cancellation_reason AS reason, COUNT(*)::INTEGER AS cnt
      FROM public.trades t
      WHERE t.status = 'cancelled'
        AND t.cancelled_at >= v_now - INTERVAL '7 days'
        AND t.cancellation_reason IS NOT NULL
      GROUP BY t.cancellation_reason
    ) x;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'user_id', q.user_id, 'seller_name', q.seller_name,
        'seller_email', q.seller_email, 'cancelled_7d', q.cnt
      ) ORDER BY q.cnt DESC
    ), '[]'::jsonb) INTO v_top_users
    FROM (
      SELECT y.user_id, pr.name AS seller_name, pr.email AS seller_email, y.cnt
      FROM (
        SELECT t.seller_id AS user_id, COUNT(*)::INTEGER AS cnt
        FROM public.trades t
        WHERE t.status = 'cancelled'
          AND t.cancelled_at >= v_now - INTERVAL '7 days'
        GROUP BY t.seller_id ORDER BY cnt DESC LIMIT 5
      ) y
      LEFT JOIN public.profiles pr ON pr.user_id = y.user_id
    ) q;

    v_result := jsonb_build_object(
      'recent_7d', v_recent, 'prior_7d', v_prior, 'reasons', v_reasons, 'top_users', v_top_users
    );

  ELSIF p_source = 'failed_payouts' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', sp.id, 'user_id', sp.user_id, 'trade_id', sp.trade_id,
        'net_amount_cents', sp.net_amount_cents, 'status', sp.status,
        'failure_reason', sp.failure_reason, 'created_at', sp.created_at,
        'seller_name', pr.name, 'seller_email', au.email
      ) ORDER BY sp.created_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.seller_payouts sp
    LEFT JOIN public.profiles pr ON pr.user_id = sp.user_id
    LEFT JOIN auth.users au ON au.id = sp.user_id
    WHERE sp.status = 'failed';

  ELSIF p_source = 'config_drift' THEN
    WITH drift AS (
      SELECT d.key, d.default_val, d.min_val, d.max_val
      FROM (VALUES
        ('grace_period_days',                 90,   30,  180),
        ('offer_timeout_hours',               48,   1,   168),
        ('offer_notif_1_hours_before',        24,   1,   168),
        ('offer_notif_2_hours_before',        6,    1,   168),
        ('auto_complete_hours',               72,   24,  336),
        ('auto_complete_notif_hours_before',  12,   1,   72),
        ('pending_sp_release_days',           3,    1,   30),
        ('transaction_fee_member_cents',      99,   0,   10000),
        ('transaction_fee_non_member_cents',  299,  0,   10000),
        ('sp_max_percentage_per_purchase',    50,   0,   100),
        ('min_listing_price',                 0,    0,   10000)
      ) AS d(key, default_val, min_val, max_val)
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'key', ac.key, 'value', ac.value,
        'documented_default', d.default_val,
        'recommended_min', d.min_val,
        'recommended_max', d.max_val
      ) ORDER BY ac.key
    ), '[]'::jsonb) INTO v_result
    FROM public.admin_config ac
    JOIN drift d ON d.key = ac.key
    WHERE ac.is_active = TRUE
      AND ac.value ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND (ac.value)::NUMERIC NOT BETWEEN d.min_val AND d.max_val;

  ELSE
    RETURN jsonb_build_object('error', 'unknown_source');
  END IF;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- BLOCK F: cron schedule + grants + verification
-- =============================================================================

-- Schedule escalation every 10 minutes (BP-21: cron lives with the RPC).
-- Idempotent: only schedule when the job does not already exist.
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalate-cancel-requests') THEN
      PERFORM cron.schedule('escalate-cancel-requests', '*/10 * * * *',
        'SELECT public.fn_escalate_expired_cancel_requests();');
    END IF;
  END IF;
END;
$$;

-- --- Grants (BP-78: explicit minimal; rely on dt61 guard for new functions) --
-- User RPCs: authenticated + service_role (admin portal service client)
REVOKE ALL ON FUNCTION public.fn_request_cancel_trade(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_withdraw_cancel_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_respond_cancel_request(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_request_timeout_hours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_request_escalation_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_request_cancel_trade(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_withdraw_cancel_request(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_respond_cancel_request(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_request_timeout_hours() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_request_escalation_enabled() TO authenticated, service_role;

-- Cron + admin RPCs: service_role (admin portal service client) + authenticated (manual/ops)
REVOKE ALL ON FUNCTION public.fn_escalate_expired_cancel_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_resolve_cancel_request(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_admin_list_cancel_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_escalate_expired_cancel_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_cancel_request(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_list_cancel_requests() TO service_role;

-- --- Verification (run one statement at a time) ------------------------------
-- SELECT column_name FROM information_schema.columns WHERE table_name='trades'
--   AND column_name LIKE 'cancel_request_%';
-- SELECT key, value, category, data_type, is_active FROM public.admin_config
--   WHERE key IN ('cancel_request_escalation_enabled','cancel_request_response_timeout_hours');
-- SELECT public.fn_cancel_request_timeout_hours();
-- SELECT public.fn_cancel_request_escalation_enabled();
-- SELECT public.admin_action_center_summary();
-- SELECT public.admin_action_center_detail('cancel_requests');
-- SELECT public.fn_admin_list_cancel_requests();
-- SELECT public.fn_escalate_expired_cancel_requests();
-- SELECT public.fn_escalate_expired_cancel_requests();  -- idempotent re-run
