-- =============================================================================
-- FIX-Task-36 (2026-09-14) — the auto-complete CRON bypassed Stripe capture.
--
-- WHY
--   `cron.job` jobid 42 (`process-auto-complete`, every 15 minutes, ACTIVE) was
--   running:
--
--       SELECT public.rpc_process_auto_complete(100);
--
--   — the BARE RPC, which flips `in_progress -> completed` purely on elapsed time.
--   The Stripe PaymentIntent CAPTURE lives only in the `process-auto-complete`
--   Edge Function, so every tick of that job completed trades whose buyer money
--   was never collected.
--
--   PROOF IT HAPPENED LIVE. At 2026-09-14 21:45:00.484911 (a 15-minute tick) this
--   job completed 3 trades in a single batch with uncaptured authorizations:
--
--     57d50a84-0aa8-4a5c-b13e-158f2374c579   $16.00   pi_3UEJrf4I6kCJlvXo1uJzeWwr
--     2bb49d39-bb67-44f9-bca2-ee43b8a22b74   $20.00   pi_3UEJrf4I6kCJlvXo1btD4tPR
--     cdb2a42d-b653-4c2b-82c4-a772c04727a7   $14.00   pi_3UEJrg4I6kCJlvXo00lxdTdO
--     ---------------------------------------------------------------- $50.00 cash
--   All three Stripe PIs still read `requires_capture` / `amount_received = 0`,
--   their `tax_records` rows are still `quoted`, and `financial_audit_log` holds NO
--   `payment_captured` row for any of them (the EF writes one per capture, with
--   `idempotency_key = capture_<tradeId>`) — two independent proofs that the writer
--   was the cron, not the EF.
--
--   The rows LOOK collected in the database because `payments.derived_state` and
--   `payments.captured_at` are trigger MIRRORS of `trades.status`
--   (`fn_payments_sync_from_trade`, R100) — the DB cannot observe Stripe.
--
--   THIS IS THE THIRD TIME THIS CLASS RECURRED: FIX-Task-24 fixed the expiry leg,
--   FIX-Task-35 fixed the auto-complete leg **in the Edge Function and the QA
--   playbook (R14)** — and the cron entry point was never changed, so the broken
--   call kept running. That is why this migration fixes it at BOTH ends.
--
-- WHAT THIS DOES
--   BLOCK 1 — `rpc_process_auto_complete` now REFUSES, at the database level, to
--     complete a trade that has money attached unless the caller names it
--     explicitly (`p_trade_ids`). The EF always passes the ids whose capture it
--     just verified; a bare caller (the drifted cron) passes only a batch size, so
--     `p_trade_ids IS NULL` and the guard fires. Refusals are COUNTED and WARNed,
--     so a bare caller fails LOUDLY instead of silently completing money trades.
--   BLOCK 2 — the cron job is re-pointed at the Edge Function
--     (`SELECT public.rpc_fire_edge_function('/process-auto-complete');`),
--     matching its sibling jobs (`send-offer-reminders`, `dispatch-manual-payouts`).
--     Done as a migration so it survives environment re-provisioning and cannot be
--     silently lost the way the original (EF-pointing) schedule was.
--
-- WHY A CALLER-NAMES-IT GUARD AND NOT A "REVOKE service_role EXECUTE"
--   Revoking service_role would NOT isolate the EF path: the `process-auto-complete`
--   Edge Function calls this RPC as `service_role` too (same credential the cron
--   uses). There is no database-observable difference between the two callers, so
--   the only sound discriminator is the ARGUMENT the caller supplies — and the EF
--   always supplies the verified id set. The guard therefore keys on
--   `p_trade_ids IS NULL`, which is exactly the shape a bare/clock-only caller has.
--   (Same reasoning as FIX-Task-35's `p_capture_confirmed`: the DB cannot see
--   Stripe, so the capture leg must ATTEST, and the RPC refuses anyone who has not.)
--
-- SCOPE OF THE GUARD — deliberately narrow:
--   * only trades that have money attached are refused
--     (`cash_amount_cents > 0` OR a `stripe_payment_intent_id` exists);
--   * a genuinely free trade (no cash, no PI) still auto-completes on a bare call,
--     so the cron's legitimate work is not blocked by a missing argument;
--   * trades NAMED by the caller are unaffected — the EF path is byte-for-byte
--     behaviour-compatible (it always passes a non-empty id list).
--
-- MODE: B — idempotent rerunnable. `CREATE OR REPLACE` only, because the SIGNATURE
--   IS UNCHANGED (`p_batch_size integer DEFAULT 100, p_trade_ids uuid[] DEFAULT NULL`).
--   Unlike FIX-Task-35 there is no DROP here, so there is no window in which the
--   function is missing and no ambiguous-overload risk (BP-12).
--
-- DEPLOY ORDER: no Edge Function redeploy is required — the EF's existing named-arg
--   call `{ p_batch_size, p_trade_ids }` is already compatible. Apply this migration
--   and the cron is fixed.
--
-- ROLLBACK (one block, restores the exact pre-change state):
--   * re-apply `20260914000001_fix_task_35_capture_invariant_and_auto_complete_ids.sql`
--     BLOCK 1 verbatim (same signature, without the capture guard), and
--   * re-schedule the old command:
--       SELECT cron.unschedule(c.jobid) FROM cron.job c
--        WHERE c.jobname = 'process-auto-complete';
--       SELECT cron.schedule('process-auto-complete', '*/15 * * * *',
--         'SELECT public.rpc_process_auto_complete(100);');
--   Rollback re-opens the money leak, so it is only correct if the cron is disabled
--   at the same time.
--
-- VERIFICATION (run AFTER applying — BP-81/BP-90: a clean DDL result proves nothing,
--   the changed object must be INVOKED):
--   1) cron command corrected:
--        SELECT jobid, jobname, schedule, active, command FROM cron.job
--         WHERE jobname = 'process-auto-complete';
--        -- EXPECT: command = SELECT public.rpc_fire_edge_function('/process-auto-complete');
--   2) refusal path — a bare call must complete NOTHING and report it:
--        SELECT public.rpc_process_auto_complete(100);
--        -- EXPECT: {"success": true, "auto_completed_count": 0, "refused_count": N, ...}
--        --         plus a WARNING in the server log
--   3) success path — naming the trade completes it:
--        SELECT public.rpc_process_auto_complete(100, ARRAY['<trade-uuid>']::uuid[]);
--        -- EXPECT: {"success": true, "auto_completed_count": 1, "refused_count": 0, ...}
--   4) regression sweep (no bare money RPC left scheduled):
--        (from p2p-kids-marketplace) npm run qa:cron-health
--        -- EXPECT: exit 0, no FAIL
-- =============================================================================

-- =============================================================================
-- BLOCK 1 — rpc_process_auto_complete: refuse a money trade the caller did not name
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_process_auto_complete(
  p_batch_size integer DEFAULT 100,
  p_trade_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_refused_count integer := 0;
  v_trade RECORD;
  v_net_cash_cents integer;
  v_payout_result jsonb;
BEGIN
  -- FIX-Task-36 item 3 — how many eligible trades this call would have to REFUSE.
  -- Computed BEFORE the loop so a bare caller is loud: the number lands in the
  -- return value (and therefore in `cron.job_run_details.return_message`), instead
  -- of the money simply going uncollected in silence — which is exactly how this
  -- bug survived two prior fixes.
  IF p_trade_ids IS NULL THEN
    SELECT count(*) INTO v_refused_count
    FROM public.trades t
    WHERE t.status = 'in_progress'
      AND t.auto_complete_at IS NOT NULL
      AND t.auto_complete_at <= now()
      AND (t.extension_status IS DISTINCT FROM 'requested')
      AND (t.disputed_at IS NULL OR t.dispute_resolution IS NOT NULL)
      AND COALESCE(t.dispute_status, 'none') NOT IN ('reported', 'under_review')
      AND (
        COALESCE(t.cash_amount_cents, 0) > 0
        OR t.stripe_payment_intent_id IS NOT NULL
      );

    IF v_refused_count > 0 THEN
      RAISE WARNING
        'rpc_process_auto_complete: REFUSED % eligible trade(s) carrying money — caller supplied no p_trade_ids, so no confirmed capture could be attested. A scheduled caller must reach the process-auto-complete Edge Function (FIX-Task-36).',
        v_refused_count;
    END IF;
  END IF;

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
      -- FIX-Task-35 item 5: when the caller names the trades it verified, this RPC
      -- may ONLY complete those. Without this clause the RPC re-selects its own
      -- `auto_complete_at ASC LIMIT p_batch_size` window, which is ordered by a
      -- key unrelated to which captures succeeded — the bug that completed trades
      -- whose capture had FAILED.
      AND (p_trade_ids IS NULL OR t.id = ANY(p_trade_ids))
      -- FIX-Task-36 item 3 — CAPTURE GUARD (the structural half of the fix).
      -- A caller that has NOT named the trades it verified a capture for may only
      -- complete a trade with NO money attached. The Edge Function always passes
      -- `p_trade_ids`; the bare clock-only caller does not — so this is the exact
      -- discriminator between "the capture leg ran" and "someone just waited".
      AND (
        p_trade_ids IS NOT NULL
        OR (
          COALESCE(t.cash_amount_cents, 0) <= 0
          AND t.stripe_payment_intent_id IS NULL
        )
      )
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
    -- FIX-Task-36: additive key — existing consumers read only the keys above.
    'refused_count', v_refused_count,
    'processed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) IS
'Auto-completes eligible trades. When p_trade_ids is supplied, ONLY those trades may be completed — the caller (process-auto-complete EF) passes the ids whose Stripe capture it verified. FIX-Task-36: a caller that supplies NO p_trade_ids may not complete any trade carrying money (cash_amount_cents > 0 or a stripe_payment_intent_id), because it cannot attest a capture; such trades are counted in `refused_count`.';

-- Grants are unchanged by CREATE OR REPLACE, but re-asserting them keeps the
-- intended privilege set visible in this migration (and survives a role reset).
GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) FROM anon, PUBLIC;

-- =============================================================================
-- BLOCK 2 — re-point the `process-auto-complete` cron at its Edge Function
-- =============================================================================
DO $$
BEGIN
  -- Same capability guard the sibling scheduling migrations use: only touch cron
  -- when both pg_cron and pg_net are actually present (BP-21 / BP-22).
  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cron')
     AND EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'net' AND p.proname = 'http_post'
     ) THEN

    -- Always address the job BY NAME, never by a hardcoded jobid: jobid 42 is a
    -- runtime artifact of pg_cron's sequential assignment, not a stable identifier.
    -- `cron.unschedule` RAISES when the job is absent, so the set-based PERFORM
    -- (which passes zero rows and therefore never calls it) is the safe form.
    PERFORM cron.unschedule(c.jobid)
    FROM cron.job c
    WHERE c.jobname = 'process-auto-complete';

    -- rpc_fire_edge_function resolves the base URL and the service-role key from
    -- admin_config at RUN time and fails closed with CONFIG_UNAVAILABLE — so no
    -- credential is baked into this schedule (BP-22), which is what let the earlier
    -- hardcoded-token schedules rot.
    PERFORM cron.schedule(
      'process-auto-complete',
      '*/15 * * * *',
      'SELECT public.rpc_fire_edge_function(''/process-auto-complete'');'
    );
  ELSE
    RAISE NOTICE 'FIX-Task-36: cron/pg_net unavailable — skipped re-pointing process-auto-complete';
  END IF;
END;
$$;

-- =============================================================================
-- VERIFY (run these separately — see the header for expected results):
--   SELECT jobid, jobname, schedule, active, command FROM cron.job
--    WHERE jobname = 'process-auto-complete';
--   SELECT public.rpc_process_auto_complete(100);
--   SELECT public.rpc_process_auto_complete(100, ARRAY['<trade-uuid>']::uuid[]);
--   (from p2p-kids-marketplace) npm run qa:cron-health
-- =============================================================================
