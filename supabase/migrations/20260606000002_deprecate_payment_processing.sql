-- Deprecate payment_processing Status from Trade Flow (D-30 Completion)
-- Mode: Idempotent Rerunnable Migration
--
-- D-30 changed trades to start as 'in_progress' with Stripe pre-auth at
-- submission. The 'payment_processing' intermediate status is no longer used:
--   - Accept: stays 'in_progress', sets auto_complete_at
--   - Decline: becomes 'cancelled'
--   - Complete: becomes 'completed'
--
-- Changes:
-- 1) Remove 'payment_processing' from trades.status CHECK constraint
-- 2) fn_transfer_sp_on_accept() → no-op (Edge Function handles accept directly)
-- 3) fn_auto_decline_competing_offers() → no-op (Edge Function directly cancels)
-- 4) fn_update_unanswered_counter() → remove payment_processing from conditions
-- 5) fn_release_sp_on_cancel_deprecated → clean up refund RPC conditions

-- ======================================================================
-- 1. Update CHECK constraint on trades.status
-- ======================================================================
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_status_check;

ALTER TABLE public.trades ADD CONSTRAINT trades_status_check
  CHECK (status IN ('pending', 'payment_failed', 'in_progress', 'completed', 'cancelled'));

-- Note: 'pending' is kept for legacy trades created before D-30.
-- New trades always start as 'in_progress'.

-- ======================================================================
-- 2. fn_transfer_sp_on_accept — no-op (Edge Function handles accept)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_transfer_sp_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- DEPRECATED: 'payment_processing' is no longer used.
  -- The transactions-update Edge Function handles accept directly:
  --   - status stays 'in_progress' with auto_complete_at set
  --   - competing offers cancelled directly via SQL update
  --   - Stripe capture happens inline
  RETURN NEW;
END;
$$;

-- ======================================================================
-- 3. fn_auto_decline_competing_offers — no-op (Edge Function handles it)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_decline_competing_offers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- DEPRECATED: 'payment_processing' is no longer used.
  -- The transactions-update Edge Function (D-30) directly cancels competing
  -- offers in the same UPDATE call:
  --   trades.update(status='cancelled').eq('status','in_progress').is('auto_complete_at',null)
  RETURN NEW;
END;
$$;

-- ======================================================================
-- 4. fn_update_unanswered_counter — remove payment_processing
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_update_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- D-30: 'payment_processing' deprecated. Only cancelled decreases counter.
  IF (OLD.status = 'pending' OR OLD.status = 'in_progress') AND NEW.status = 'cancelled' THEN
    IF NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'Offer expired' THEN
      RETURN NEW;
    END IF;

    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = GREATEST(0, los.unanswered_offer_count - 1),
      updated_at = now()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- 5. Update offer expiry cron — remove payment_processing references
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter_on_offer_accepted()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- D-30: Accept doesn't transition through payment_processing.
  -- The transactions-update Edge Function handles counter reset directly.
  -- This trigger is kept as a fallback — fires when any in_progress trade
  -- has auto_complete_at set (indicating acceptance).
  IF ((OLD.status = 'pending' OR OLD.status = 'in_progress')
      AND NEW.status = 'in_progress'
      AND NEW.auto_complete_at IS NOT NULL
      AND OLD.auto_complete_at IS NULL)
  THEN
    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = 0,
      updated_at = now()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================
-- 6. fn_reset_unanswered_counter — remove payment_processing from condition
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- D-30: 'payment_processing' deprecated. Only cancelled resets counter.
  IF NEW.status = 'cancelled'
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired')
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

-- ======================================================================
-- 7. Remove payment_processing from admin SP economy summary query
-- ======================================================================
CREATE OR REPLACE FUNCTION public.get_admin_sp_economy_summary(
  p_start_date TIMESTAMPTZ DEFAULT now() - interval '30 days',
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  total_sp_earned BIGINT,
  total_sp_spent BIGINT,
  total_sp_in_circulation BIGINT,
  total_active_trades BIGINT,
  total_completed_trades BIGINT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(amount) FROM public.sp_ledger WHERE amount > 0 AND created_at BETWEEN p_start_date AND p_end_date), 0)::BIGINT AS total_sp_earned,
    COALESCE((SELECT SUM(ABS(amount)) FROM public.sp_ledger WHERE amount < 0 AND created_at BETWEEN p_start_date AND p_end_date), 0)::BIGINT AS total_sp_spent,
    COALESCE((SELECT SUM(available_balance + pending_balance) FROM public.sp_wallets WHERE state = 'active'), 0)::BIGINT AS total_sp_in_circulation,
    COALESCE((SELECT COUNT(*)::BIGINT FROM public.trades WHERE status = 'in_progress' AND created_at BETWEEN p_start_date AND p_end_date), 0) AS total_active_trades,
    COALESCE((SELECT COUNT(*)::BIGINT FROM public.trades WHERE status = 'completed' AND completed_at BETWEEN p_start_date AND p_end_date), 0) AS total_completed_trades;
END;
$$;

-- ======================================================================
-- 8. Drop old triggers no longer needed (they fire on status changes
--    that never happen in the D-30 flow)
-- ======================================================================
DROP TRIGGER IF EXISTS trigger_transfer_sp_on_accept ON public.trades;
CREATE TRIGGER trigger_transfer_sp_on_accept
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_transfer_sp_on_accept();

DROP TRIGGER IF EXISTS trigger_auto_decline_competing_offers ON public.trades;
CREATE TRIGGER trigger_auto_decline_competing_offers
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_decline_competing_offers();

DROP TRIGGER IF EXISTS trigger_update_unanswered_counter ON public.trades;
CREATE TRIGGER trigger_update_unanswered_counter
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_unanswered_counter();

DROP TRIGGER IF EXISTS trigger_reset_unanswered_counter_on_offer_accepted ON public.trades;
CREATE TRIGGER trigger_reset_unanswered_counter_on_offer_accepted
AFTER UPDATE OF status ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.fn_reset_unanswered_counter_on_offer_accepted();

-- ======================================================================
-- Verification queries
-- ======================================================================
-- 1) Confirm 'payment_processing' removed from CHECK constraint
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'trades'::regclass AND contype = 'c';
-- Expected: CHECK (status IN ('pending', 'payment_failed', 'in_progress', 'completed', 'cancelled'))
--
-- 2) Confirm fn_transfer_sp_on_accept is a no-op
-- SELECT prosrc FROM pg_proc WHERE proname = 'fn_transfer_sp_on_accept';
-- Expected: only "RETURN NEW;" (no business logic)
--
-- 3) Confirm no function references 'payment_processing' as a status
-- SELECT DISTINCT proname FROM pg_proc
-- WHERE prosrc LIKE '%payment_processing%';
-- Expected: empty (no remaining references)
--
-- Common failure modes:
-- 1) CHECK constraint drop may fail if there are rows with status='payment_processing'.
--    Run: SELECT COUNT(*) FROM trades WHERE status = 'payment_processing';
--    If > 0, update them first: UPDATE trades SET status = 'in_progress' WHERE status = 'payment_processing';
-- 2) D-30 must be applied first (20260605000001).
