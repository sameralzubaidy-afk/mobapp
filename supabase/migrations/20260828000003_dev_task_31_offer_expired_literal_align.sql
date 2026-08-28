-- File: supabase/migrations/20260828000003_dev_task_31_offer_expired_literal_align.sql
-- Date: 2026-08-28
-- Mode B: Idempotent rerunnable migration (safe to re-run)
--
-- DEV-TASK-31 (F2): fn_reset_unanswered_counter compares the snake literal
-- 'offer_expired', but the expiry writer (rpc_process_expired_offers) has always
-- stored the display form 'Offer expired' (capital O + space) in
-- trades.cancellation_reason. Because the guard never matched, every expiry
-- RESET listing_offer_stats.unanswered_offer_count to 0 — so the
-- 2-consecutive-unanswered-offer seller-ignore prompt could never accumulate.
--
-- Fix: align the guard's literal to the writer's actual value ('Offer expired'),
-- so expiry PRESERVES the streak (the RPC's own decrement stands) and only a
-- seller accept / explicit decline resets the counter to 0.
--
-- Canonical-value decision (DEV-TASK-31): keep 'Offer expired' — the value the
-- live writer (rpc_process_expired_offers), all historical rows,
-- fn_update_unanswered_counter, fn_analytics_trade_outcome, ReviewOfferScreen and
-- the test fixtures already use. Snake 'offer_expired_competing' stays as-is
-- (already consistent everywhere). BP-76 writer-side snake normalization is a
-- possible follow-up but would require a data backfill + flipping 2 currently
-- correct triggers — out of scope here (see TODO(REFACTOR) in TradeListScreen).

-- =============================================================================
-- BLOCK 1 — Schema: redefine fn_reset_unanswered_counter + reattach trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- D-30: 'payment_processing' deprecated. Only cancelled resets the counter.
  -- DEV-TASK-31 (F2): the guard must match the writer's actual literal
  -- ('Offer expired') so expiry does NOT reset the streak; only a seller accept
  -- or explicit decline resets it.
  IF NEW.status = 'cancelled'
    AND (NEW.cancellation_reason IS DISTINCT FROM 'Offer expired')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired_competing')
  THEN
    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = 0,
      updated_at = NOW()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_unanswered_counter ON public.trades;
CREATE TRIGGER trg_reset_unanswered_counter
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_reset_unanswered_counter();

-- =============================================================================
-- BLOCK 2 — Verification queries (run ONE per call)
-- =============================================================================
-- 1) Function body contains the corrected literal:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_reset_unanswered_counter';
--    Expected: prosrc contains "IS DISTINCT FROM 'Offer expired'".
--
-- 2) Trigger is attached:
--    SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
--    WHERE tgrelid = 'public.trades'::regclass AND tgname = 'trg_reset_unanswered_counter';
--
-- 3) No stray snake guard remains in the live function:
--    SELECT prosrc LIKE '%DISTINCT FROM ''offer_expired''%' AS has_snake_guard
--    FROM pg_proc WHERE proname = 'fn_reset_unanswered_counter';
--    Expected: has_snake_guard = false
