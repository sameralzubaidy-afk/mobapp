-- File: supabase/migrations/20260912000010_fix_task_24_expiry_rpc_voids_tax.sql
--
-- FIX-Task-24 item 2 (2026-09-12) — the offer-expiry path could leave a tax record
-- stuck at `tax_status='quoted'` FOREVER when the RPC was driven directly.
--
-- WHY (QA Task, Group L 2026-09-12, finding F2):
--   `rpc_process_expired_offers()` cancels the trade but never voids the tax record
--   and never cancels the Stripe PaymentIntent — both of those legs live ONLY in the
--   `process-expired-offers` Edge Function (which pg_cron invokes). Driving the bare
--   RPC is the *documented QA fast-clock recipe*, so the recipe itself bypassed both
--   legs: the trade became 'cancelled' while its tax record stayed 'quoted' with
--   `voided_at` NULL. Nothing ever repairs it, because the cron only re-processes
--   trades still in `pending`. Three live rows were stuck this way (plus 25
--   harness-cancelled rows — see the companion cleanup script).
--
-- FIX (owner decision 2026-09-12 — "make the RPC self-contained"):
--   The RPC now voids the trade's tax record itself, so the DB-side leg can no
--   longer be left inconsistent by ANY caller. The void is guarded to the two
--   voidable statuses (`quoted` / `capture_failed`) and wrapped so the expiry sweep
--   can never fail on the tax leg — mirroring the Edge Function's non-blocking
--   handling. `rpc_void_tax_for_trade` itself is deliberately NOT modified: 12+
--   callers depend on it, and changing its already-voided behaviour would widen the
--   blast radius for no gain (see FIX-Task-24 handoff / Further Considerations).
--
--   The Stripe PI cancel still lives in the Edge Function (it needs the Stripe API
--   and this repo's standing rule is that the RPC is DATA-ONLY — see
--   `20260609000002_fix_rpc_remove_http_calls.sql`). The documented QA recipe is
--   therefore updated in the SAME change to POST the `process-expired-offers` Edge
--   Function instead of selecting the RPC (QA playbook R14 + the 4 guide recipes).
--
-- Mode B — idempotent rerunnable (CREATE OR REPLACE + explicit grant re-assertion).
--
-- BLOCK 1: rpc_process_expired_offers (tax-void leg added)
-- BLOCK 2: grants
-- BLOCK 3: verification queries (run one statement at a time)

BEGIN;

-- =============================================================================
-- BLOCK 1 — rpc_process_expired_offers
-- Body otherwise identical to 20260829000001_dev_task_34_seller_ignore_streak.sql
-- (BLOCK 2, L151-264). ONLY additions: the per-trade tax-void block + two locals
-- (v_tax_status, v_tax_voided) + the `tax_voided_count` response key.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_process_expired_offers(
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_expired_trade RECORD;
  v_notifications jsonb := '[]'::jsonb;
  v_stats_record RECORD;
  v_streak_count integer := 0;
  -- FIX-Task-24 item 2
  v_tax_status text;
  v_tax_voided integer := 0;
  v_tax_result jsonb;
BEGIN
  FOR v_expired_trade IN (
    SELECT 
      t.id, 
      t.listing_id, 
      t.buyer_id, 
      t.seller_id,
      i.title as listing_title,
      i.status as item_status
    FROM public.trades t
    INNER JOIN public.items i ON t.listing_id = i.id
    WHERE t.status = 'pending'
      AND t.offer_expires_at IS NOT NULL
      AND t.offer_expires_at <= now()
    ORDER BY t.offer_expires_at ASC
    LIMIT p_batch_size
  ) LOOP
    -- DEV-TASK-34: read current streak + cooldown state BEFORE mutating.
    SELECT los.unanswered_offer_count, los.last_prompt_sent_at
    INTO v_stats_record
    FROM public.listing_offer_stats los
    WHERE los.listing_id = v_expired_trade.listing_id;

    -- Cancel the trade. Fires trg_reset_unanswered_counter with reason
    -- 'Offer expired' → NO reset (DT-34 resets only on 'seller_declined');
    -- trigger_update_unanswered_counter is dropped by DT-34 (no decrement).
    UPDATE public.trades
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Offer expired',
        updated_at = now(),
        last_status_change_at = now()
    WHERE id = v_expired_trade.id;

    -- ───────────────────────────────────────────────────────────────────────
    -- FIX-Task-24 item 2: VOID the tax record here, inside the RPC.
    --
    -- Before this, the tax void (and the PI cancel) lived ONLY in the
    -- `process-expired-offers` Edge Function, so calling this RPC directly — the
    -- documented QA fast-clock recipe — left `tax_status='quoted'` stuck forever
    -- (the cron only re-processes trades still in `pending`). Voiding here makes
    -- the DB-side leg self-contained: no caller can leave tax inconsistent.
    --
    -- GUARD: only void when the record is actually voidable. The EF path voids
    -- BEFORE calling this RPC, so by the time we get here the record is already
    -- 'voided' — and `rpc_void_tax_for_trade` returns INVALID_STATE for that, so
    -- the guard keeps the EF path a clean no-op instead of a logged error.
    --
    -- The whole block is non-blocking + loudly logged, mirroring the EF's own
    -- `try/catch` handling: a tax-leg failure must never abort the expiry sweep.
    -- ───────────────────────────────────────────────────────────────────────
    BEGIN
      SELECT tr.tax_status::text
      INTO v_tax_status
      FROM public.tax_records tr
      WHERE tr.trade_id = v_expired_trade.id
      FOR UPDATE;

      IF FOUND AND v_tax_status IN ('quoted', 'capture_failed') THEN
        v_tax_result := public.rpc_void_tax_for_trade(
          v_expired_trade.id,
          'offer_expired'
        );

        IF (v_tax_result ->> 'success')::boolean IS TRUE THEN
          v_tax_voided := v_tax_voided + 1;
        ELSE
          RAISE WARNING 'FIX-Task-24: tax void returned an error for expired trade %: %',
            v_expired_trade.id, v_tax_result;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'FIX-Task-24: tax void failed for expired trade %: %',
        v_expired_trade.id, SQLERRM;
    END;

    -- DEV-TASK-34: each unanswered expiry INCREMENTS the consecutive-expiry
    -- streak by 1 (this REPLACES the old simultaneous-pending-count decrement).
    -- Insert-or-update so a listing with no stats row still accumulates.
    INSERT INTO public.listing_offer_stats (listing_id, unanswered_offer_count, updated_at)
    VALUES (v_expired_trade.listing_id, 1, now())
    ON CONFLICT (listing_id)
    DO UPDATE SET
      unanswered_offer_count = public.listing_offer_stats.unanswered_offer_count + 1,
      updated_at = now()
    RETURNING unanswered_offer_count INTO v_streak_count;

    v_updated_count := v_updated_count + 1;

    -- Queue buyer notification
    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_expired_trade.id,
      'event_type', 'offer_expired',
      'recipient_user_id', v_expired_trade.buyer_id,
      'extra_data', jsonb_build_object(
        'listing_title', v_expired_trade.listing_title,
        'item_still_available', v_expired_trade.item_status = 'available'
      )
    );

    -- Queue seller notification
    v_notifications := v_notifications || jsonb_build_object(
      'trade_id', v_expired_trade.id,
      'event_type', 'offer_expired_seller',
      'recipient_user_id', v_expired_trade.seller_id,
      'extra_data', jsonb_build_object('listing_title', v_expired_trade.listing_title)
    );

    -- DEV-TASK-34: fire the seller-ignore nudge when the STREAK reaches the
    -- existing threshold (2 consecutive unanswered expiries). Cooldown and
    -- threshold unchanged — only WHAT counts toward the streak changed.
    IF v_streak_count >= 2 AND 
       (v_stats_record.last_prompt_sent_at IS NULL OR 
        v_stats_record.last_prompt_sent_at < now() - INTERVAL '7 days') THEN

      v_notifications := v_notifications || jsonb_build_object(
        'trade_id', v_expired_trade.id,
        'event_type', 'seller_ignore_prompt',
        'recipient_user_id', v_expired_trade.seller_id,
        'extra_data', jsonb_build_object(
          'listing_title', v_expired_trade.listing_title,
          'listing_id', v_expired_trade.listing_id,
          'unanswered_count', v_streak_count
        )
      );

      UPDATE public.listing_offer_stats
      SET last_prompt_sent_at = now()
      WHERE listing_id = v_expired_trade.listing_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_offers_processed', v_updated_count,
    'tax_voided_count', v_tax_voided,
    'processed_at', now(),
    'notifications', v_notifications
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_process_expired_offers IS
'Cancels expired pending offers, updates stats, and (FIX-Task-24) voids the tax record for each cancelled trade so a direct RPC call cannot leave tax_status stuck at ''quoted''. Returns notification payloads for the caller (Edge Function) to send. DEV-TASK-34: unanswered_offer_count is now a consecutive-expiry streak — each unanswered expiry increments it by 1; the seller_ignore_prompt fires when the streak reaches 2 (cooldown 7d). NOTE: the Stripe PI cancel still lives in the process-expired-offers Edge Function — call the EF, not this RPC, when driving the full expiry path.';

-- =============================================================================
-- BLOCK 2 — grants (BP-78: explicit minimal grants, re-asserted after REPLACE)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.rpc_process_expired_offers(integer)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_process_expired_offers(integer)
  TO service_role;

COMMIT;

-- ============================================================================
-- BLOCK 3 — Verification queries (run ONE statement per call)
-- ============================================================================
-- V1) The function was replaced (the new response key is present):
--     SELECT pg_get_functiondef(p.oid) LIKE '%tax_voided_count%' AS has_tax_void
--       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'rpc_process_expired_offers';
--     Expected: has_tax_void = true.
--
-- V2) LIVE invocation — expires one fast-clocked disposable offer and proves the
--     tax record is voided in the SAME call (drive this against a QA fixture trade
--     only; it MUTATES data):
--     -- a) fast-clock a pending offer:
--     UPDATE public.trades SET offer_expires_at = now() - interval '1 second'
--      WHERE id = '<disposable-pending-trade-uuid>' AND status = 'pending';
--     -- b) run the RPC (separate statement — read the JSON):
--     SELECT public.rpc_process_expired_offers(100);
--     Expected: expired_offers_processed >= 1 AND tax_voided_count >= 1.
--     -- c) read back in a SEPARATE statement (never same-statement — R24):
--     SELECT t.status, t.cancellation_reason, tr.tax_status, tr.voided_at
--       FROM public.trades t LEFT JOIN public.tax_records tr ON tr.trade_id = t.id
--      WHERE t.id = '<disposable-pending-trade-uuid>';
--     Expected: status='cancelled', cancellation_reason='Offer expired',
--               tax_status='voided', voided_at IS NOT NULL.
--
-- V3) No permanently-stuck quoted tax records remain on cancelled expiry trades:
--     SELECT count(*) FROM public.tax_records tr
--       JOIN public.trades t ON t.id = tr.trade_id
--      WHERE t.status = 'cancelled'
--        AND tr.tax_status = 'quoted';
--     Expected: 0 (after the companion cleanup script has been run).
--
-- Common failure modes:
--   - 42501 permission denied for a client call -> expected: only service_role has
--     EXECUTE (cron/EF path). PostgREST maps 42501 to HTTP 401.
--   - tax_voided_count = 0 on a trade that DID have a quoted record -> the guard's
--     FOUND check did not see the row (check tax_records.trade_id linkage) or the
--     record was already 'voided' (EF-first path — a legitimate no-op).
-- ============================================================================
