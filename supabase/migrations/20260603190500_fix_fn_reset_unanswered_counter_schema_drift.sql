-- File: supabase/migrations/20260603190500_fix_fn_reset_unanswered_counter_schema_drift.sql
-- Purpose: permanent fix for cancel_trade_v2 failures caused by trigger schema drift.
--
-- Root cause:
-- - trigger function public.fn_reset_unanswered_counter referenced columns that do not exist
--   in public.listing_offer_stats:
--   - seller_id
--   - consecutive_unanswered_offers_count
-- - this raised: column "seller_id" does not exist during trade cancellation updates.
--
-- Mode B: idempotent rerunnable migration.

CREATE OR REPLACE FUNCTION public.fn_reset_unanswered_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('payment_processing', 'cancelled')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired_competing')
  THEN
    -- listing_offer_stats is listing-scoped; reset the existing unanswered_offer_count field.
    UPDATE public.listing_offer_stats los
    SET
      unanswered_offer_count = 0,
      updated_at = NOW()
    WHERE los.listing_id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Verification query 1: function text no longer references seller_id/consecutive_unanswered_offers_count
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'fn_reset_unanswered_counter';

-- Verification query 2: listing_offer_stats canonical columns
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'listing_offer_stats'
-- ORDER BY ordinal_position;
