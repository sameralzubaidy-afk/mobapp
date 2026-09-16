-- ============================================================================
-- Dev Task 124 (Item 1) — Dispatch manual Stripe withdrawals to Connect
-- ============================================================================
-- Problem: `request_seller_payout` creates a `seller_payouts` row with
-- status='processing' and trade_id NULL (a manual withdrawal) but never calls
-- Stripe. Only the trade-completion trigger dispatches (fn_queue_payout_on_complete
-- → initiate-payout, keyed on trades.status = 'completed'), so every manual
-- withdrawal sits in 'processing' forever and the money never moves. QA Task 37
-- confirmed "no transfer minted — request_seller_payout creates the row only".
--
-- Fix (option C, owner-approved): TWO dispatch paths, both idempotent —
--   1) IMMEDIATE: an AFTER-INSERT trigger on seller_payouts that net.http_post's
--      to the new `dispatch-manual-payouts` Edge Function with { payout_id }
--      (mirrors fn_queue_payout_on_complete / initiate-payout).
--   2) SAFETY SWEEP: an hourly pg_cron job (`dispatch-manual-payouts`, '0 * * * *'
--      — same cadence as `release-due-payouts`) that POSTs {} so the EF sweeps any
--      row still 'processing' with no provider_reference_id (catches a failed/
--      missed trigger post; the Stripe idempotency key prevents double transfers).
--
-- The EF (`supabase/functions/dispatch-manual-payouts/index.ts`) does
-- stripe.transfers.create({ amount: net_amount_cents, destination: method
-- .stripe_account_id }, { idempotencyKey: 'manual_payout_<payout_id>' }) and marks
-- the row completed / failed. It is deployed separately.
--
-- Change classification: A (DB/migration + money path). Tier 0 + Tier 2.
-- Scope: provider='stripe' manual withdrawals ONLY (trade_id IS NULL). PayPal /
-- ACH manual rows are untouched (out of scope for DT124 item 1).
-- ============================================================================

-- ============================================================================
-- BLOCK 1: fn_queue_manual_payout_dispatch — AFTER INSERT queue to the EF
-- ============================================================================
-- Mirrors fn_queue_payout_on_complete (20260707000000): resolves the EF base URL
-- (GUC app.edge_function_base_url → app.supabase_url + '/functions/v1' →
-- admin_config 'supabase_url') and auth JWT (GUC app.service_role_key →
-- admin_config 'supabase_service_role_key'), then net.http_post's
-- { payout_id } to /dispatch-manual-payouts. pg_net queues in-transaction, so a
-- rollback of the withdrawal cancels the job; the Stripe idempotency key guards
-- a rare double-fire. Never let queueing break the withdrawal commit.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_queue_manual_payout_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ef_url TEXT;
  v_auth_jwt TEXT;
BEGIN
  -- Resolve Edge Function base URL (same chain as fn_queue_payout_on_complete)
  v_ef_url := NULLIF(current_setting('app.edge_function_base_url', true), '');
  IF v_ef_url IS NULL THEN
    v_ef_url := NULLIF(current_setting('app.supabase_url', true), '');
    IF v_ef_url IS NOT NULL THEN
      v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
    ELSE
      SELECT ac.value INTO v_ef_url
      FROM public.admin_config ac
      WHERE ac.key = 'supabase_url'
        AND ac.is_active = true
      LIMIT 1;
      IF v_ef_url IS NOT NULL THEN
        v_ef_url := rtrim(v_ef_url, '/') || '/functions/v1';
      END IF;
    END IF;
  END IF;

  -- Resolve auth JWT (service role — same chain as fn_queue_payout_on_complete)
  v_auth_jwt := NULLIF(current_setting('app.service_role_key', true), '');
  IF v_auth_jwt IS NULL THEN
    SELECT ac.value INTO v_auth_jwt
    FROM public.admin_config ac
    WHERE ac.key = 'supabase_service_role_key'
      AND ac.is_active = true
    LIMIT 1;
  END IF;

  -- Only attempt net.http_post if we have both URL and auth
  IF v_ef_url IS NOT NULL AND v_auth_jwt IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_ef_url || '/dispatch-manual-payouts',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_auth_jwt
      ),
      body    := jsonb_build_object('payout_id', NEW.id::text)
    );
  ELSE
    RAISE WARNING 'fn_queue_manual_payout_dispatch: Cannot queue payout % — missing URL or auth config. URL set: %, Auth set: %',
      NEW.id, v_ef_url IS NOT NULL, v_auth_jwt IS NOT NULL;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let dispatch queueing break the withdrawal commit. The hourly sweep
  -- (BLOCK 3) is the backstop that will still pick this row up.
  RAISE WARNING 'fn_queue_manual_payout_dispatch error for payout %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- BLOCK 2: Trigger — AFTER INSERT on stripe manual withdrawals only
-- ============================================================================
DROP TRIGGER IF EXISTS trg_queue_manual_payout_dispatch ON public.seller_payouts;
CREATE TRIGGER trg_queue_manual_payout_dispatch
  AFTER INSERT ON public.seller_payouts
  FOR EACH ROW
  WHEN (NEW.provider = 'stripe' AND NEW.trade_id IS NULL AND NEW.status = 'processing')
  EXECUTE FUNCTION public.fn_queue_manual_payout_dispatch();

-- ============================================================================
-- BLOCK 3: Hourly safety-sweep cron (same cadence as release-due-payouts)
-- ============================================================================
-- Uses the generic runtime wrapper rpc_fire_edge_function (20260830000004) so no
-- secret is baked into cron.job (BP-22/BP-47 hygiene). The wrapper fail-closes
-- with CONFIG_UNAVAILABLE if base URL / service key are unset at run time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'net' AND p.proname = 'http_post') THEN

    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'dispatch-manual-payouts';

    PERFORM cron.schedule(
      'dispatch-manual-payouts',
      '0 * * * *', -- hourly, top of hour — same as release-due-payouts
      'SELECT public.rpc_fire_edge_function(''/dispatch-manual-payouts'');'
    );
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES (run one statement at a time — result-granularity rule)
-- ============================================================================
-- 1) Function present:
--    SELECT proname FROM pg_proc
--    WHERE proname = 'fn_queue_manual_payout_dispatch';
--
-- 2) Trigger linked on seller_payouts:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'public.seller_payouts'::regclass
--      AND tgname = 'trg_queue_manual_payout_dispatch';
--
-- 3) Cron scheduled (hourly):
--    SELECT jobname, schedule, command FROM cron.job
--    WHERE jobname = 'dispatch-manual-payouts';
--
-- 4) Manual withdrawals currently stranded (should be empty once EF deployed
--    + trigger/sweep dispatch them):
--    SELECT id, user_id, status, provider, provider_reference_id, net_amount_cents
--    FROM public.seller_payouts
--    WHERE provider = 'stripe' AND trade_id IS NULL
--      AND status = 'processing' AND provider_reference_id IS NULL;
-- ============================================================================
