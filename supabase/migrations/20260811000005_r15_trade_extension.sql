-- ============================================================================
-- R15 — Re-Authorization on Extension (Wave 7, Post-Day-1)
-- Migration: 20260811000005_r15_trade_extension.sql
-- Mode B: Idempotent rerunnable migration (safe to re-run; drop-then-create
--         everywhere / CREATE OR REPLACE for functions / ADD COLUMN IF NOT EXISTS).
--
-- WHAT THIS DOES (owner summary):
--   A buyer or seller may request ONE extra-time extension during the
--   post-acceptance PICKUP WINDOW (trade.status = 'in_progress'). The request
--   goes to the counterparty, who must accept within `extension_response_window_hours`
--   (default 4h). On mutual acceptance the existing Stripe payment hold is VOIDED
--   and a brand-new authorization is placed (fresh PaymentIntent, fresh 7-day
--   authorization window, fresh pickup deadline). On explicit denial, 4h timeout
--   (auto-deny), or re-authorization failure, the trade immediately AUTO-CANCELS
--   and the hold is released through the SAME shared path R2's expiry flows use
--   (rpc_auto_cancel_trade -> status='cancelled' + rpc_void_tax_for_trade; the
--   existing triggers fire SP release + notifications). Exactly ONE extension per
--   trade: any second request is rejected outright regardless of outcome.
--
--   R15 product decisions locked in (2026-08-09):
--   1. Pickup window only — never the offer window.
--   2. Either party initiates; counterparty must accept; no response within the
--      4h window auto-denies (defaults to "no extension").
--   3. Void + FRESH authorization on mutual acceptance (not incremental); limit
--      to exactly one extension per trade.
--   4. R1 fee-state + R5 SP pending-release trigger on the completion event —
--      no pause/resume logic needed during the 4h consent wait.
--   5. Reuse R2's reminder/notification system (create_trade_notification in-app
--      + send-trade-notifications push) — no parallel notification path.
--   6. Deny / timeout / re-auth-failure -> immediate auto-cancel + hold release
--      via R2's existing expiry-and-release behavior. No retry-payment / grace.
--   7. R3 payout buffer + R4 dispute-cost key off the ACTUAL completion
--      timestamp — a granted extension shifts them later with NO special-case
--      code (R3 migration 20260810000008 header confirms).
--   8. The re-authorization is a distinct N2 audit event `trade_extension_reauth`
--      with its own idempotency key — not a retry of the original authorization.
--
-- Spec: authored R15 section -> docx/SYSTEM_REQUIREMENTS_V2.md §8D (R15).
--       Cross-ref: docx/SYSTEM_REQUIREMENTS_V2.md §1.6 (R2/R3), §8.1 (R1),
--       §8B (N2); docx/TRADING-FLOW-V2.md §3 (D-30).
--
-- RULES applied:
--   - Naming: p_ params, v_ locals, all columns qualified with table aliases.
--   - Rerunnable: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--     DROP POLICY/CONSTRAINT then CREATE, ON CONFLICT DO NOTHING seeds.
--   - Canonical helpers: fn_admin_config_int / fn_admin_config_safe_int (N1).
--   - Shared auto-cancel path: rpc_auto_cancel_trade() — the SAME primitives +
--     triggers R2's check-authorization-expiry / process-expired-offers use.
--   - SP release on cancel is handled by the existing fn_release_sp_on_cancel
--     trigger — NEVER call credit_sp_for_cancelled_trade here (double-credit trap).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Schema + config seed + trigger/function rewrites + RPCs
-- ---------------------------------------------------------------------------

-- 1) Seed R15 config keys (R15-3, R15-2). ON CONFLICT DO NOTHING preserves
--    admin edits across replays.
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES
  (
    'extension_response_window_hours',
    '4',
    'R15: hours the counterparty has to accept/decline an extension request. No response = auto-deny + auto-cancel. Default: 4',
    'trade',
    'number',
    true
  ),
  (
    'extension_window_hours',
    '72',
    'R15: length of the new pickup window granted on a successful extension (fresh authorization resets the 7-day clock). Must be <= 167h. Default: 72',
    'trade',
    'number',
    true
  ),
  (
    'extension_max_per_trade',
    '1',
    'R15: exactly one extension per trade (hard-coded gate; value must stay 1). Any second request is rejected regardless of outcome.',
    'trade',
    'number',
    true
  )
ON CONFLICT (key) DO NOTHING;

-- 2) New trades columns for the extension request/consent state machine.
--    Extension state is modelled as COLUMNS (not a new trades.status value) so
--    the closed trades_status_check CHECK constraint is untouched (BP-12/BP-36).
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS extension_status text,
  ADD COLUMN IF NOT EXISTS extension_requested_by uuid,
  ADD COLUMN IF NOT EXISTS extension_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_request_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_responded_by uuid,
  ADD COLUMN IF NOT EXISTS extension_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_granted_at timestamptz;

-- Closed CHECK on extension_status values (rerunnable via DO-block guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trades'::regclass
      AND conname = 'trades_extension_status_check'
  ) THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_extension_status_check
      CHECK (
        extension_status IS NULL
        OR extension_status IN ('requested', 'accepted', 'denied', 'auto_denied', 'reauth_failed')
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.trades.extension_status IS
'R15: requested -> awaiting counterparty consent; accepted -> granted (fresh re-auth placed); denied -> counterparty declined; auto_denied -> 4h response window elapsed; reauth_failed -> fresh authorization failed. NULL = no extension activity. Exactly one extension per trade.';
COMMENT ON COLUMN public.trades.extension_requested_by IS 'R15: auth.users.id of the party that requested the extension (buyer or seller).';
COMMENT ON COLUMN public.trades.extension_requested_at IS 'R15: when the extension request was made.';
COMMENT ON COLUMN public.trades.extension_request_expires_at IS 'R15: deadline for the counterparty to respond (requested_at + extension_response_window_hours). Passed without a response -> auto-deny + auto-cancel.';
COMMENT ON COLUMN public.trades.extension_responded_by IS 'R15: auth.users.id of the counterparty that responded (accept/decline). NULL for auto_denied.';
COMMENT ON COLUMN public.trades.extension_responded_at IS 'R15: when the counterparty responded, or when auto-deny was applied.';
COMMENT ON COLUMN public.trades.extension_granted_at IS 'R15: one-time flag set when the extension is granted (mutual consent + fresh re-auth). Non-NULL means the trade used its single extension.';

-- 3) fn_validate_trade_timing_config — add the three R15 keys to the validated
--    set and enforce their ranges. HARD BLOCK on violations (matches R2).
--    R15-3: extension_window_hours must stay <= 167h because a fresh
--    authorization resets authorization_expires_at to now()+7d and the new
--    pickup deadline (now()+extension_window_hours) must precede it.
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
  v_extension_window_raw text;
  v_extension_response_window_raw text;
  v_extension_max_raw text;

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
  v_extension_response_window integer;
  v_extension_max integer;
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
    'pickup_notif_2_hours_before',
    'extension_response_window_hours',
    'extension_window_hours',
    'extension_max_per_trade'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT ac.value INTO v_offer_timeout_raw FROM public.admin_config ac WHERE ac.key = 'offer_timeout_hours' LIMIT 1;
  SELECT ac.value INTO v_offer_notif_1_raw FROM public.admin_config ac WHERE ac.key = 'offer_notif_1_hours_before' LIMIT 1;
  SELECT ac.value INTO v_offer_notif_2_raw FROM public.admin_config ac WHERE ac.key = 'offer_notif_2_hours_before' LIMIT 1;
  SELECT ac.value INTO v_auto_complete_raw FROM public.admin_config ac WHERE ac.key = 'auto_complete_hours' LIMIT 1;
  SELECT ac.value INTO v_auto_complete_notif_raw FROM public.admin_config ac WHERE ac.key = 'auto_complete_notif_hours_before' LIMIT 1;
  SELECT ac.value INTO v_pending_release_raw FROM public.admin_config ac WHERE ac.key = 'pending_sp_release_days' LIMIT 1;
  SELECT ac.value INTO v_member_fee_raw FROM public.admin_config ac WHERE ac.key = 'transaction_fee_member_cents' LIMIT 1;
  SELECT ac.value INTO v_non_member_fee_raw FROM public.admin_config ac WHERE ac.key = 'transaction_fee_non_member_cents' LIMIT 1;
  SELECT ac.value INTO v_max_offers_raw FROM public.admin_config ac WHERE ac.key = 'max_pending_offers_per_seller' LIMIT 1;
  SELECT ac.value INTO v_pickup_window_raw FROM public.admin_config ac WHERE ac.key = 'pickup_window_hours' LIMIT 1;
  SELECT ac.value INTO v_pickup_notif_1_raw FROM public.admin_config ac WHERE ac.key = 'pickup_notif_1_hours_before' LIMIT 1;
  SELECT ac.value INTO v_pickup_notif_2_raw FROM public.admin_config ac WHERE ac.key = 'pickup_notif_2_hours_before' LIMIT 1;
  SELECT ac.value INTO v_extension_window_raw FROM public.admin_config ac WHERE ac.key = 'extension_window_hours' LIMIT 1;
  SELECT ac.value INTO v_extension_response_window_raw FROM public.admin_config ac WHERE ac.key = 'extension_response_window_hours' LIMIT 1;
  SELECT ac.value INTO v_extension_max_raw FROM public.admin_config ac WHERE ac.key = 'extension_max_per_trade' LIMIT 1;

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
  ELSIF NEW.key = 'extension_window_hours' THEN
    v_extension_window_raw := NEW.value;
  ELSIF NEW.key = 'extension_response_window_hours' THEN
    v_extension_response_window_raw := NEW.value;
  ELSIF NEW.key = 'extension_max_per_trade' THEN
    v_extension_max_raw := NEW.value;
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
  v_extension_window := public.fn_admin_config_safe_int(v_extension_window_raw, 72);
  v_extension_response_window := public.fn_admin_config_safe_int(v_extension_response_window_raw, 4);
  v_extension_max := public.fn_admin_config_safe_int(v_extension_max_raw, 1);

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

  -- R15-3: extension window is a FRESH authorization (clock resets to now()+7d),
  -- so it must be <= 167h to guarantee capture precedes the new auth expiry.
  IF v_extension_window < 1 OR v_extension_window > 167 THEN
    RAISE EXCEPTION 'extension_window_hours (%) must be between 1 and 167 (must stay under Stripe''s 7-day authorization limit)', v_extension_window;
  END IF;

  IF v_extension_response_window < 1 OR v_extension_response_window > 48 THEN
    RAISE EXCEPTION 'extension_response_window_hours (%) must be between 1 and 48', v_extension_response_window;
  END IF;

  -- R15-3: exactly one extension per trade (locked product decision).
  IF v_extension_max <> 1 THEN
    RAISE EXCEPTION 'extension_max_per_trade (%) must be 1 — exactly one extension per trade (R15 locked decision)', v_extension_max;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) rpc_request_trade_extension — buyer or seller requests one extension during
--    the pickup window. SECURITY DEFINER: caller is the authenticated user (via
--    the trade-extension Edge Function); the function validates participant +
--    state + one-time-use and writes the request atomically (row-lock serializes
--    concurrent double-requests; a repeated request is idempotent).
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
  IF v_trade.disputed_at IS NOT NULL AND v_trade.dispute_resolution IS NULL THEN
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

COMMENT ON FUNCTION public.rpc_request_trade_extension IS
'R15: opens a one-time extension request during the pickup window. Idempotent for concurrent double-requests; rejects any second request regardless of prior outcome.';

-- 5) rpc_apply_trade_extension — counterparty accepts: atomically swap in the
--    freshly-created PaymentIntent, reset authorization_expires_at to now()+7d,
--    push auto_complete_at to now()+extension_window_hours, mark granted.
--    The Edge Function performs the Stripe void+fresh-auth BEFORE calling this;
--    this RPC only commits the DB state (guards + atomic UPDATE + N2 audit).
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

  IF v_trade.disputed_at IS NOT NULL AND v_trade.dispute_resolution IS NULL THEN
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

COMMENT ON FUNCTION public.rpc_apply_trade_extension IS
'R15: commits a granted extension (counterparty accepted): swaps in the fresh PaymentIntent, resets the 7-day auth window, pushes the pickup deadline, marks the one-time grant, and audits trade_extension_reauth.';

-- 6) rpc_auto_cancel_trade — THE SHARED auto-cancel/release path (R15-6).
--    This is the SAME sequence R2's expiry flows use (check-authorization-expiry,
--    process-expired-offers): set status='cancelled' + cancellation_reason, void
--    tax via rpc_void_tax_for_trade, and let the existing triggers fire SP
--    release (fn_release_sp_on_cancel) + notifications. Idempotent: cancelling
--    an already-cancelled trade is a no-op. NEVER call credit_sp_for_cancelled_trade
--    from here (the trigger already refunds SP — double-credit trap).
CREATE OR REPLACE FUNCTION public.rpc_auto_cancel_trade(
  p_trade_id uuid,
  p_reason text,
  p_cancelled_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_cancelled_at timestamptz;
BEGIN
  IF p_trade_id IS NULL OR p_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id and p_reason are required'));
  END IF;

  SELECT * INTO v_trade FROM public.trades t WHERE t.id = p_trade_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      jsonb_build_object('code', 'TRADE_NOT_FOUND', 'message', 'We couldn''t find this trade.'));
  END IF;

  -- Idempotent: already cancelled -> noop.
  IF v_trade.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'data',
      jsonb_build_object('trade_id', p_trade_id, 'action', 'noop', 'reason', 'already_cancelled'));
  END IF;

  v_cancelled_at := COALESCE(p_cancelled_at, now());

  UPDATE public.trades t SET
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_at = COALESCE(t.cancelled_at, v_cancelled_at),
    last_status_change_at = now(),
    updated_at = now()
  WHERE t.id = p_trade_id;

  -- Shared tax release (idempotent; noop on zero-tax trades).
  PERFORM public.rpc_void_tax_for_trade(p_trade_id, p_reason);

  -- N2 audit: generic trade_cancelled with the reason in after_state.
  PERFORM public.fn_log_financial_audit(
    'trade_cancelled', 'trade', p_trade_id, NULL,
    jsonb_build_object('status', v_trade.status),
    jsonb_build_object('status', 'cancelled', 'cancellation_reason', p_reason),
    NULL,
    'auto_cancel_' || p_reason || '_' || p_trade_id::text,
    NULL
  );

  RETURN jsonb_build_object('success', true, 'data',
    jsonb_build_object('trade_id', p_trade_id, 'status', 'cancelled', 'cancellation_reason', p_reason));
END;
$$;

COMMENT ON FUNCTION public.rpc_auto_cancel_trade IS
'R15: shared auto-cancel/release path — status=cancelled + cancellation_reason + rpc_void_tax_for_trade. SP release and notifications fire via existing triggers. Idempotent.';

-- 7) rpc_process_extension_timeouts — cron RPC (R15-2): finds pending extension
--    requests past extension_request_expires_at, marks them auto_denied, and
--    auto-cancels the trade through the shared rpc_auto_cancel_trade path.
--    Creates in-app notifications explicitly (BP-18 — reminder-style events are
--    NOT covered by the status-change trigger) and returns push payloads for the
--    send-trade-notifications EF. SECURITY DEFINER (cron service-role caller).
CREATE OR REPLACE FUNCTION public.rpc_process_extension_timeouts(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timeout RECORD;
  v_auto_denied_count integer := 0;
  v_in_app_created integer := 0;
  v_notifications jsonb := '[]'::jsonb;
BEGIN
  FOR v_timeout IN (
    SELECT t.id, t.extension_requested_by, t.buyer_id, t.seller_id, t.extension_request_expires_at
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.extension_status = 'requested'
      AND t.extension_request_expires_at IS NOT NULL
      AND t.extension_request_expires_at < now()
    ORDER BY t.extension_request_expires_at ASC
    LIMIT p_batch_size
  ) LOOP
    -- Mark auto-denied (no responder; default = no extension).
    UPDATE public.trades t SET
      extension_status = 'auto_denied',
      extension_responded_at = now(),
      updated_at = now()
    WHERE t.id = v_timeout.id;

    v_auto_denied_count := v_auto_denied_count + 1;

    -- R15-6: auto-cancel + release the hold via the SHARED R2 path.
    PERFORM public.rpc_auto_cancel_trade(v_timeout.id, 'extension_timeout');

    -- Explicit in-app notification to the REQUESTER (BP-18).
    INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
    VALUES (
      v_timeout.extension_requested_by,
      'trades',
      'extension_auto_denied',
      'Extension Request Expired',
      'Your request to extend the pickup window timed out (no response), so the trade was cancelled.',
      ARRAY['push', 'in_app'],
      jsonb_build_object('trade_id', v_timeout.id, 'event_type', 'extension_auto_denied')
    );
    v_in_app_created := v_in_app_created + 1;

    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_timeout.id,
      'event_type', 'extension_auto_denied',
      'recipient_user_id', v_timeout.extension_requested_by,
      'extra_data', jsonb_build_object()
    );

    -- Explicit in-app notification to the COUNTERPARTY (the party that did not
    -- respond) so they know the trade was cancelled (trigger is gated for this
    -- reason — see send_trade_status_notification below).
    IF v_timeout.extension_requested_by = v_timeout.buyer_id THEN
      INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
      VALUES (
        v_timeout.seller_id,
        'trades',
        'trade_cancelled',
        'Trade Cancelled',
        'The trade was cancelled because an extension request was not answered in time.',
        ARRAY['push', 'in_app'],
        jsonb_build_object('trade_id', v_timeout.id, 'event_type', 'trade_cancelled')
      );
      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_timeout.id,
        'event_type', 'trade_cancelled',
        'recipient_user_id', v_timeout.seller_id,
        'extra_data', jsonb_build_object()
      );
    ELSE
      INSERT INTO public.user_notifications (user_id, category, type, title, body, channels, data)
      VALUES (
        v_timeout.buyer_id,
        'trades',
        'trade_cancelled',
        'Trade Cancelled',
        'The trade was cancelled because an extension request was not answered in time.',
        ARRAY['push', 'in_app'],
        jsonb_build_object('trade_id', v_timeout.id, 'event_type', 'trade_cancelled')
      );
      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_timeout.id,
        'event_type', 'trade_cancelled',
        'recipient_user_id', v_timeout.buyer_id,
        'extra_data', jsonb_build_object()
      );
    END IF;
    v_in_app_created := v_in_app_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'auto_denied_count', v_auto_denied_count,
    'cancelled_count', v_auto_denied_count,
    'in_app_created', v_in_app_created,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_process_extension_timeouts IS
'R15 cron: auto-denies + auto-cancels trades whose extension request expired without a response; creates in-app notifications and returns push payloads.';

-- 8) rpc_process_auto_complete — R15 D2 (user-confirmed 2026-08-10): while an
--    extension request is pending, BLOCK auto-complete so the 4h consent decision
--    always resolves first (grant -> new window; deny/timeout -> auto-cancel).
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
BEGIN
  WITH eligible_trades AS (
    SELECT t.id
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (t.extension_status IS DISTINCT FROM 'requested')
      AND (
        t.disputed_at IS NULL
        OR t.dispute_resolution IS NOT NULL
      )
    ORDER BY t.auto_complete_at ASC
    LIMIT p_batch_size
  )
  UPDATE public.trades t
  SET
    status = 'completed',
    completed_at = COALESCE(t.completed_at, now()),
    updated_at = now(),
    last_status_change_at = now()
  FROM eligible_trades et
  WHERE t.id = et.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'auto_completed_count', v_updated_count,
    'processed_at', now()
  );
END;
$$;

-- 9) rpc_send_pickup_reminders — same guard: skip trades with a pending
--    extension request so reminder copy ("auto-completes in X hours") is never
--    misleading while auto-complete is blocked.
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

  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND (t.extension_status IS DISTINCT FROM 'requested')
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

  FOR v_in_progress_trade IN (
    SELECT t.id, t.listing_id, t.buyer_id, i.title AS listing_title, t.auto_complete_at
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND (t.extension_status IS DISTINCT FROM 'requested')
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

-- 10) send_trade_status_notification — R15 gating: when a trade is auto-cancelled
--     because of an extension negative outcome (extension_denied / extension_timeout
--     / extension_reauth_failed), skip the generic 'trade_cancelled' notification:
--     the trade-extension EF and process-extension-timeouts cron send reason-specific
--     notifications to the requester AND a trade_cancelled to the counterparty
--     explicitly. This avoids a duplicate generic message (BP-32 double-notify).
CREATE OR REPLACE FUNCTION public.send_trade_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_item_title       TEXT;
  v_buyer_name       TEXT;
  v_seller_name      TEXT;
  v_listing_id_text  TEXT;
  v_seller_marked_before TEXT;
  v_seller_marked_after  TEXT;
BEGIN
  v_seller_marked_before := to_jsonb(OLD)->>'seller_marked_completed_at';
  v_seller_marked_after := to_jsonb(NEW)->>'seller_marked_completed_at';

  IF NEW.status = OLD.status
     AND COALESCE(v_seller_marked_before, '') = COALESCE(v_seller_marked_after, '') THEN
    RETURN NEW;
  END IF;

  v_listing_id_text := COALESCE(to_jsonb(NEW)->>'listing_id', to_jsonb(NEW)->>'item_id');

  SELECT i.title INTO v_item_title FROM public.items i WHERE i.id::text = v_listing_id_text;
  SELECT COALESCE(p.name, 'Buyer') INTO v_buyer_name FROM public.profiles p WHERE p.user_id = NEW.buyer_id;
  SELECT COALESCE(p.name, 'Seller') INTO v_seller_name FROM public.profiles p WHERE p.user_id = NEW.seller_id;

  IF v_seller_marked_before IS NULL
     AND v_seller_marked_after IS NOT NULL
     AND NEW.status <> 'completed' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_completion_requested',
      'Trade Ready for Your Confirmation',
      COALESCE(v_seller_name, 'The seller') || ' marked your trade for "' || COALESCE(v_item_title, 'item') || '" as complete. Please confirm once received.',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
        'type', 'trade_completion_requested'
      )
    );
  END IF;

  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_accepted',
      'Trade Accepted! ✅',
      COALESCE(v_seller_name, 'The seller') || ' accepted your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
        'type', 'trade_accepted'
      )
    );
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_rejected',
      'Trade Declined',
      COALESCE(v_seller_name, 'The seller') || ' declined your trade request for "' || COALESCE(v_item_title, 'item') || '"',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/browse',
        'type', 'trade_rejected'
      )
    );
  ELSIF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    PERFORM public.create_trade_notification(
      NEW.buyer_id,
      'trade_completed',
      'Trade Complete! 🎉',
      'Your trade for "' || COALESCE(v_item_title, 'item') || '" is complete! Don''t forget to leave a review.',
      jsonb_build_object(
        'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
        'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
        'type', 'trade_completed'
      )
    );
    IF NEW.seller_id <> NEW.buyer_id THEN
      PERFORM public.create_trade_notification(
        NEW.seller_id,
        'trade_completed',
        'Trade Complete! 🎉',
        'Your trade with ' || COALESCE(v_buyer_name, 'the buyer') || ' for "' || COALESCE(v_item_title, 'item') || '" is complete!',
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades/' || NEW.id::text,
          'type', 'trade_completed'
        )
      );
    END IF;
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- R15 (2026-08-10): extension-cancel outcomes are notified explicitly by the
    -- trade-extension EF / process-extension-timeouts cron. Skip the generic
    -- 'trade_cancelled' to avoid a duplicate notification.
    IF NEW.cancellation_reason IN ('extension_denied', 'extension_timeout', 'extension_reauth_failed') THEN
      NULL;
    ELSE
      PERFORM public.create_trade_notification(
        NEW.buyer_id,
        'trade_cancelled',
        'Trade Cancelled',
        'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
        jsonb_build_object(
          'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
          'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
          'type', 'trade_cancelled'
        )
      );
      IF NEW.seller_id <> NEW.buyer_id THEN
        PERFORM public.create_trade_notification(
          NEW.seller_id,
          'trade_cancelled',
          'Trade Cancelled',
          'The trade for "' || COALESCE(v_item_title, 'item') || '" has been cancelled.',
          jsonb_build_object(
            'trade_id', NEW.id::text, 'item_id', COALESCE(v_listing_id_text, ''),
            'item_title', COALESCE(v_item_title, ''), 'deep_link', '/trades',
            'type', 'trade_cancelled'
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  IF to_regclass('public.debug_logs') IS NOT NULL THEN
    INSERT INTO public.debug_logs (process_name, message, payload)
    VALUES (
      'send_trade_status_notification',
      'ERROR',
      jsonb_build_object(
        'trade_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status,
        'error', SQLERRM, 'state', SQLSTATE
      )
    );
  END IF;
  RAISE WARNING '[send_trade_status_notification] Error for trade %: % (SQLSTATE: %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_status_notification ON public.trades;
CREATE TRIGGER trade_status_notification
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.send_trade_status_notification();

-- 11) N2 audit mutation_type CHECK — add the R15 event types (R15-8:
--     trade_extension_reauth + extension_requested) and fix the latent N3 gap
--     (dispute_evidence_staged is logged by stripe-webhook but was missing from
--     the CHECK, so those audit rows silently never landed). Rerunnable via the
--     DROP-then-ADD pattern (mirrors 20260810000008_r3_delayed_payout_buffer).
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.financial_audit_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%mutation_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.financial_audit_log DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.financial_audit_log ADD CONSTRAINT financial_audit_log_mutation_type_check
    CHECK (mutation_type IN (
      'offer_created', 'payment_intent_created', 'payment_captured',
      'payment_capture_failed', 'payment_cancelled', 'refund_issued',
      'refund_voided', 'payout_initiated', 'payout_paid',
      'payout_requires_action', 'payout_failed', 'payout_scheduled',
      'sp_reserved', 'sp_restored', 'sp_released', 'sp_issued',
      'sp_deducted', 'sp_frozen', 'sp_unfrozen', 'sp_expired',
      'buyer_fee_charged', 'seller_fee_deducted',
      'tax_quoted', 'tax_collected', 'tax_voided', 'tax_refunded',
      'trade_cancelled', 'trade_completed',
      'trade_extension_reauth', 'extension_requested',
      'dispute_evidence_staged'
    ));
END;
$$;

-- 12) Grants (explicit, matching codebase convention). User-facing RPCs grant
--     authenticated + service_role; cron RPC grants service_role.
GRANT EXECUTE ON FUNCTION public.rpc_request_trade_extension(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_trade_extension(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_auto_cancel_trade(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_process_extension_timeouts(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 2 — Indexes + scheduler wiring
-- ---------------------------------------------------------------------------

-- Index for the 4h-timeout cron lookup.
CREATE INDEX IF NOT EXISTS idx_trades_extension_timeout
  ON public.trades (extension_status, extension_request_expires_at)
  WHERE extension_status = 'requested';

-- Scheduler wiring: call the process-extension-timeouts Edge Function every 5
-- minutes (mirror 20260810000001 send-pickup-reminders wiring). COALESCE chain
-- includes a hardcoded fallback for the service role key (BP-22).
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
    RAISE NOTICE 'Skipping process-extension-timeouts cron schedule: could not resolve base URL or service role key.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'process-extension-timeouts';

    v_job_sql := format(
      $f$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb
        );$f$,
      v_base_url || '/process-extension-timeouts',
      v_service_role_key
    );

    PERFORM cron.schedule(
      'process-extension-timeouts',
      '*/5 * * * *',
      v_job_sql
    );
  END IF;
END;
$$;

-- On-demand trigger for testing: SELECT public.rpc_trigger_process_extension_timeouts();
CREATE OR REPLACE FUNCTION public.rpc_trigger_process_extension_timeouts()
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
    url := v_base_url || '/process-extension-timeouts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := '{}'::jsonb
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'http_response', v_result);
END;
$$;

-- ---------------------------------------------------------------------------
-- Verification queries (SQL-3)
-- ---------------------------------------------------------------------------
-- SELECT key, value FROM public.admin_config WHERE key LIKE 'extension%';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'trades' AND column_name LIKE 'extension%';
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('rpc_request_trade_extension','rpc_apply_trade_extension','rpc_auto_cancel_trade','rpc_process_extension_timeouts');
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.financial_audit_log'::regclass AND contype = 'c';
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-extension-timeouts';
--
-- Common failure modes:
-- 1) The 7-day guardrail now also validates extension_window_hours (<=167h) —
--    an admin lowering offer/pickup to fit the guardrail must also keep the
--    extension window under the limit.
-- 2) rpc_request_trade_extension returns EXTENSION_ALREADY_USED on any second
--    request (regardless of outcome) — the locked one-extension-per-trade rule.
-- 3) rpc_process_extension_timeouts only targets in_progress trades with a
--    pending request that has passed its expiry — expired/legacy trades excluded.
-- 4) rpc_auto_cancel_trade does NOT call credit_sp_for_cancelled_trade — SP
--    restore comes from the fn_release_sp_on_cancel trigger (double-credit trap).
-- ============================================================================
