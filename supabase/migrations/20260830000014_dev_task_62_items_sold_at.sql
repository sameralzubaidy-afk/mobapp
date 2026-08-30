-- =============================================================================
-- DEV TASK 62 (QA Task 8) — Item 3: stamp items.sold_at when an item sells
--
-- MODE: B (idempotent, rerunnable)
--
-- Root cause: items.sold_at (nullable, no default — 20251217000002:47) has
-- NEVER been written by any code path. Both live completion RPCs
-- (complete_trade_v2 → 20260830000010, rpc_process_auto_complete →
-- 20260830000001) and resolve-dispute (via complete_trade_v2) set only
-- status='sold', updated_at=now(). No trigger stamps sold_at. Result: sold_at
-- is NULL on every sale, which silently breaks the comparable-sale pricing
-- lookback (pricingService .eq('status','sold').gte('sold_at', lookback)).
--
-- Fix: a BEFORE UPDATE trigger on items that stamps sold_at whenever status
-- transitions to 'sold' and sold_at is still NULL. One trigger covers ALL
-- current and future completion paths (buyer complete, auto-complete, dispute
-- resolve_complete). Plus a one-time backfill from trades.completed_at for
-- already-sold items.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCK 1 — Schema (function + trigger) + backfill
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_stamp_item_sold_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sold' AND NEW.sold_at IS NULL THEN
    NEW.sold_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_stamp_item_sold_at ON public.items;
CREATE TRIGGER tr_stamp_item_sold_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.fn_stamp_item_sold_at();

-- Backfill already-sold items from the trade completion time. Items whose trade
-- has a completion timestamp get the accurate sold time; the trigger covers any
-- fresh sale. (Sold items with no completed trade — no completed_at — are left
-- NULL; there is no accurate timestamp to backfill from.)
UPDATE public.items i
SET sold_at = t.completed_at
FROM public.trades t
WHERE t.listing_id = i.id
  AND i.status = 'sold'
  AND i.sold_at IS NULL
  AND t.completed_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- BLOCK 2 — Verification queries (run after applying)
-- -----------------------------------------------------------------------------
-- 1) Trigger attached:
--    SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'tr_stamp_item_sold_at';
-- 2) Function body:
--    SELECT prosrc FROM pg_proc WHERE proname = 'fn_stamp_item_sold_at';
-- 3) Backfill result (expect 0 remaining NULL sold_at rows that have a completed trade):
--    SELECT count(*) FROM items i WHERE i.status='sold' AND i.sold_at IS NULL
--      AND EXISTS (SELECT 1 FROM trades t WHERE t.listing_id = i.id AND t.completed_at IS NOT NULL);
-- 4) Fresh-sale check (after completing a real trade):
--    SELECT id, status, sold_at FROM items WHERE status='sold' ORDER BY updated_at DESC LIMIT 5;
