-- =============================================================================
-- FIX-Task-35 items 4 + 5 (2026-09-14) — completion-path capture invariant +
-- auto-complete batch-set coupling.
--
-- WHY
--   Two independent defects let a trade reach `completed` — with the item marked
--   sold and a seller payout queued — while the buyer's Stripe authorization was
--   never captured. Together they produced the two `completed`-with-uncaptured-PI
--   trades this task repaired (`47bdab0a` $28.49, `acb4939a` $25.03):
--
--     * item 5 — `process-auto-complete` passed `p_batch_size: <count>` to this
--       RPC, but the RPC re-selects its own batch (`ORDER BY auto_complete_at ASC
--       LIMIT p_batch_size`). The count described the SET of trades whose capture
--       succeeded; the RPC's window was ordered by a DIFFERENT key, so an eligible
--       trade could be completed even when its capture had failed. A count is not
--       a set.
--
--     * item 4 — `complete_trade_v2` had no capture invariant at all. It is
--       granted to `authenticated`, so a direct PostgREST call (or any future
--       caller that forgets the capture leg) flips the status unconditionally.
--
-- WHAT THIS DOES
--   BLOCK 1 — `rpc_process_auto_complete(p_batch_size, p_trade_ids uuid[])`:
--     an explicit id list the RPC cannot escape. `p_trade_ids IS NULL` preserves
--     the old "select my own batch" behaviour for any future admin/cron caller.
--   BLOCK 2 — `complete_trade_v2(p_trade_id, p_user_id, p_capture_confirmed)`:
--     refuses the `in_progress -> completed` transition when the trade has cash to
--     collect and the caller has not asserted a confirmed capture.
--   BLOCK 3 — `rpc_finalize_trade_after_capture` passes the assertion, because by
--     construction it only runs AFTER a capture confirmed.
--
-- WHY A CALLER ATTESTATION RATHER THAN A DB-DERIVED CHECK
--   The database cannot observe a Stripe capture. The two columns that LOOK like
--   capture evidence are mirrors of `trades.status` (`payments.derived_state`,
--   `payments.captured_at` — written by `fn_payments_sync_from_trade`, R100) and
--   the ONLY durable stamp (`tax_records.captured_at`) is absent for tax-exempt
--   trades and cannot be written when the tax record is already `voided` — both
--   shapes exist in live data. A DB-derived guard would therefore either miss the
--   case entirely or hard-block legitimate completions. So the capture leg
--   attests, and this RPC refuses any caller that has not attested. That converts
--   a silent default into a loud, explicit assertion.
--
--   A contradiction is still LOGGED (not blocked) when an attested capture meets a
--   tax record that is still `quoted`/`capture_failed` — that combination means the
--   capture leg ran but `rpc_mark_tax_collected` failed silently (the EFs log that
--   as non-fatal), which is worth seeing without stranding the trade.
--
-- SCOPE OF THE GUARD — deliberately narrow:
--   * only the `in_progress -> completed` transition (a re-finalize of an
--     already-`completed` trade is untouched);
--   * only when `cash_amount_cents > 0` (a zero-cash trade legitimately needs no
--     capture);
--   * NOT the seller's bare hand-over stamp (CASE 1 without
--     `buyer_marked_completed_at` completes nothing and moves no money).
--
-- MODE: B — idempotent rerunnable. DROP + CREATE is required for the signature
-- changes (BP-12: a CREATE OR REPLACE with a new argument list would create a
-- SECOND overload and make `f(100)` ambiguous).
--
-- ROLLBACK (one block, restores the exact pre-change state):
--   * `DROP FUNCTION public.rpc_process_auto_complete(integer, uuid[]);`
--     then re-apply 20260908000001 BLOCK 1 (the `(integer)` definition).
--   * `DROP FUNCTION public.complete_trade_v2(uuid, uuid, boolean);`
--     then re-apply 20260830000010 BLOCK 1 (the 2-arg definition).
--   * `CREATE OR REPLACE FUNCTION public.rpc_finalize_trade_after_capture` with
--     the 2-arg `complete_trade_v2(p_trade_id, v_trade.buyer_id)` call
--     (pre-change body captured live before authoring, md5 recorded in the report).
--   Rollback is safe because both signatures keep a DEFAULT for the new argument,
--   so any caller not yet updated still resolves.
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the `process-auto-complete`
-- and `complete-trade` Edge Functions (they pass the new arguments).
-- =============================================================================

-- =============================================================================
-- BLOCK 1 — rpc_process_auto_complete: accept an explicit trade-id set
-- =============================================================================
DROP FUNCTION IF EXISTS public.rpc_process_auto_complete(integer);

CREATE FUNCTION public.rpc_process_auto_complete(
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
      -- FIX-Task-35 item 5: when the caller names the trades it verified, this RPC
      -- may ONLY complete those. Without this clause the RPC re-selects its own
      -- `auto_complete_at ASC LIMIT p_batch_size` window, which is ordered by a
      -- key unrelated to which captures succeeded — the bug that completed trades
      -- whose capture had FAILED.
      AND (p_trade_ids IS NULL OR t.id = ANY(p_trade_ids))
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

COMMENT ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) IS
'Auto-completes eligible trades. When p_trade_ids is supplied, ONLY those trades may be completed — the caller (process-auto-complete EF) passes the ids whose Stripe capture it verified.';

GRANT EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_process_auto_complete(integer, uuid[]) FROM anon, PUBLIC;

-- =============================================================================
-- BLOCK 2 — complete_trade_v2: capture invariant
-- =============================================================================
DROP FUNCTION IF EXISTS public.complete_trade_v2(uuid, uuid);

CREATE FUNCTION public.complete_trade_v2(
    p_trade_id UUID,
    p_user_id UUID,
    p_capture_confirmed BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_seller_id UUID;
    v_buyer_id UUID;
    v_actor_id UUID;
    v_sp_amount INTEGER;
    v_cash_amount_cents INTEGER;
    v_seller_fee_cents INTEGER;
    v_net_cash_cents INTEGER;
    v_listing_id UUID;
    v_payout_result JSONB;
    v_will_complete BOOLEAN;
BEGIN
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
    END IF;

    v_seller_id := v_trade.seller_id;
    v_buyer_id := v_trade.buyer_id;
    v_sp_amount := COALESCE((to_jsonb(v_trade.sp_amount) #>> '{}')::integer, 0);
    v_cash_amount_cents := COALESCE((to_jsonb(v_trade.cash_amount_cents) #>> '{}')::integer, 0);
    v_seller_fee_cents := COALESCE((to_jsonb(v_trade.seller_transaction_fee_cents) #>> '{}')::integer, 0);
    v_net_cash_cents := GREATEST(0, v_cash_amount_cents - v_seller_fee_cents);
    v_listing_id := v_trade.listing_id;

    -- DT57: identity is auth.uid()-derived when a user JWT is present (takes
    -- precedence over p_user_id), else p_user_id (trusted service_role callers
    -- only). Fail closed on NULL actor.
    v_actor_id := COALESCE(auth.uid(), p_user_id);
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    IF v_actor_id <> v_seller_id AND v_actor_id <> v_buyer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- =====================================================================
    -- FIX-Task-35 item 4 — CAPTURE INVARIANT (2026-09-14)
    --
    -- A trade may only be flipped to 'completed' when the caller asserts that the
    -- buyer's money was captured. Evaluated HERE, before any status write, and
    -- gated on whether THIS call actually completes the trade:
    --
    --   buyer acting            -> CASE 2 always completes            -> guarded
    --   seller acting, buyer
    --     already marked        -> CASE 1 completes                   -> guarded
    --   seller acting alone     -> only a hand-over stamp, no money
    --                              moves, no payout is created        -> NOT guarded
    --   trade already completed -> re-finalize, nothing new to collect -> NOT guarded
    --
    -- `p_capture_confirmed` is a caller ATTESTATION, not a proof: the database
    -- cannot observe Stripe (see the header). Its job is to make the money path
    -- impossible to enter by accident — every caller must now state the capture
    -- outcome, and a caller that has not been updated fails LOUDLY here instead of
    -- silently completing an uncaptured trade.
    -- =====================================================================
    v_will_complete := (v_trade.status = 'in_progress')
        AND (
            v_actor_id = v_buyer_id
            OR (v_actor_id = v_seller_id AND v_trade.buyer_marked_completed_at IS NOT NULL)
        );

    IF v_will_complete AND v_cash_amount_cents > 0 AND p_capture_confirmed IS NOT TRUE THEN
        RAISE WARNING 'complete_trade_v2: refused completion of trade % — capture not confirmed (cash=% cents)',
            p_trade_id, v_cash_amount_cents;
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'CAPTURE_NOT_CONFIRMED',
                'message', 'This trade has money to collect but no confirmed payment capture, so it was not completed.',
                'details', jsonb_build_object(
                    'trade_id', p_trade_id,
                    'cash_amount_cents', v_cash_amount_cents,
                    'p_capture_confirmed', p_capture_confirmed
                )
            )
        );
    END IF;

    -- Observability only, never blocking: an attested capture whose tax record is
    -- still awaiting capture means the capture leg ran but `rpc_mark_tax_collected`
    -- failed silently (the EFs log that as non-fatal). Blocking here would strand a
    -- trade whose money WAS collected, so this is a warning, not a refusal.
    IF p_capture_confirmed IS TRUE AND v_cash_amount_cents > 0 AND EXISTS (
        SELECT 1 FROM public.tax_records tr
        WHERE tr.trade_id = p_trade_id
          AND tr.tax_status IN ('quoted', 'capture_failed')
    ) THEN
        RAISE WARNING 'complete_trade_v2: trade % completed with capture confirmed but tax_records still quoted/capture_failed',
            p_trade_id;
    END IF;

    -- CASE 1: SELLER marks complete (First step)
    IF v_actor_id = v_seller_id THEN
        UPDATE public.trades
        SET seller_marked_completed_at = now(),
            status = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN 'completed' ELSE status END,
            completed_at = CASE WHEN buyer_marked_completed_at IS NOT NULL THEN now() ELSE completed_at END
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        IF v_trade.status = 'completed' THEN
            NULL; -- fall through to CASE 2
        ELSE
            RETURN jsonb_build_object('success', true, 'status', v_trade.status, 'trade', row_to_json(v_trade));
        END IF;
    END IF;

    -- CASE 2: BUYER marks complete (Second step / finalize)
    IF v_actor_id = v_buyer_id OR v_trade.status = 'completed' THEN
        UPDATE public.trades
        SET buyer_marked_completed_at = now(),
            status = 'completed',
            completed_at = now()
        WHERE id = p_trade_id
        RETURNING * INTO v_trade;

        -- 1. Update Item
        UPDATE public.items SET status = 'sold', updated_at = now() WHERE id = v_listing_id;

        -- 2. SP is handled by fn_release_all_sp_on_complete() trigger — no manual SP call needed.

        -- 3. Update payout_amount_cents on the trade with the net cash (after seller fee deduction)
        UPDATE public.trades
        SET payout_amount_cents = v_net_cash_cents,
            updated_at = now()
        WHERE id = p_trade_id;

        -- 4. Create seller payout record (§6.3.1 / PAY-006)
        v_payout_result := NULL;
        IF v_net_cash_cents > 0 THEN
            SELECT public.create_seller_payout_on_trade_completion(
                p_trade_id,
                v_seller_id,
                v_net_cash_cents
            ) INTO v_payout_result;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'completed',
            'payout_result', v_payout_result,
            'trade', row_to_json(v_trade)
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.complete_trade_v2(uuid, uuid, boolean) IS
'Finalizes a trade (SP release + payout). REQUIRES p_capture_confirmed = true when the trade has cash to collect and this call will flip it to completed (FIX-Task-35 item 4).';

-- Grants: authenticated (complete-trade EF calls with the user's JWT) +
-- service_role. anon/PUBLIC revoked (312 only revoked anon; restate idempotently).
REVOKE EXECUTE ON FUNCTION public.complete_trade_v2(uuid, uuid, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_trade_v2(uuid, uuid, boolean) TO authenticated, service_role;

-- =============================================================================
-- BLOCK 3 — rpc_finalize_trade_after_capture: pass the capture assertion
--   By construction this routine only runs AFTER a capture confirmed, so it
--   attests on behalf of its caller. Signature unchanged -> CREATE OR REPLACE.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_finalize_trade_after_capture(
  p_trade_id UUID,
  p_stripe_capture_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_capture_result JSONB;
  v_complete_result JSONB;
BEGIN
  IF p_trade_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'p_trade_id is required')
    );
  END IF;

  -- Step 1: Mark tax as collected (idempotent)
  v_capture_result := public.rpc_mark_tax_collected(p_trade_id, p_stripe_capture_id);

  IF (v_capture_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN v_capture_result;
  END IF;

  -- Step 2: Call the existing complete_trade_v2 to finalize SP and payout.
  -- FIX-Task-35 item 4: attest the capture — reaching this line means the caller
  -- already captured at Stripe (this routine is only invoked post-capture).
  SELECT buyer_id INTO v_trade FROM public.trades WHERE id = p_trade_id;

  v_complete_result := public.complete_trade_v2(p_trade_id, v_trade.buyer_id, TRUE);

  -- If complete_trade_v2 returns an error, we still mark tax as collected but
  -- flag the completion failure separately.
  IF (v_complete_result->>'success') IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object(
        'code', 'COMPLETION_FAILED_AFTER_CAPTURE',
        'message', 'Tax was collected but trade completion failed. Manual admin review required.',
        'details', jsonb_build_object(
          'capture_result', v_capture_result,
          'completion_error', v_complete_result->'error'
        )
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'tax_capture', v_capture_result->'data',
      'trade_completion', v_complete_result
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', jsonb_build_object('code', 'FINALIZE_AFTER_CAPTURE_ERROR', 'message', SQLERRM)
  );
END;
$$;

-- =============================================================================
-- BLOCK 4 — Verification (run manually; one statement per call)
-- =============================================================================
-- 1) Signatures are the NEW ones and the OLD overloads are gone:
--    SELECT p.proname, pg_get_function_arguments(p.oid)
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('rpc_process_auto_complete', 'complete_trade_v2')
--    ORDER BY 1;
--    EXPECT: rpc_process_auto_complete(p_batch_size integer DEFAULT 100, p_trade_ids uuid[] DEFAULT NULL)
--            complete_trade_v2(p_trade_id uuid, p_user_id uuid, p_capture_confirmed boolean DEFAULT NULL)
--
-- 2) Grants unchanged in spirit (service_role only / + authenticated):
--    SELECT p.proname, coalesce(array_to_string(p.proacl, ' | '), '(default)')
--    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('rpc_process_auto_complete', 'complete_trade_v2');
--
-- 3) The guard actually refuses (BP-81/BP-90 — invoke it, don't just watch the
--    DDL succeed). Use an in_progress cash trade with cash_amount_cents > 0:
--    SELECT public.complete_trade_v2('<trade_uuid>', '<buyer_uuid>');
--    EXPECT: {"success": false, "error": {"code": "CAPTURE_NOT_CONFIRMED", ...}}
--
-- 4) The id filter actually bounds the batch (an id set that matches nothing
--    must complete nothing):
--    SELECT public.rpc_process_auto_complete(100, ARRAY['00000000-0000-0000-0000-000000000000']::uuid[]);
--    EXPECT: {"success": true, "auto_completed_count": 0, ...}
