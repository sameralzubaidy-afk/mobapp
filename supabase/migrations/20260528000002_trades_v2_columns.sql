-- File: supabase/migrations/20260528000002_trades_v2_columns.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (TFV2-002)
-- Mode B: Idempotent rerunnable migration
-- Purpose:
-- 1) Extend trades with V2 timing/dispute/payout/SP snapshot columns.
-- 2) Add listing_offer_stats and lock payment preference during active trades.
-- 3) Add reserved_sp to sp_wallets and profile tuning fields.

-- -----------------------------------------------------------------------------
-- 1) Trades extensions
-- -----------------------------------------------------------------------------
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_complete_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_sp_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_notes text,
  ADD COLUMN IF NOT EXISTS dispute_resolution text,
  ADD COLUMN IF NOT EXISTS payment_preference_snapshot text,
  ADD COLUMN IF NOT EXISTS final_sp_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fee_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failed_reason text,
  ADD COLUMN IF NOT EXISTS payout_idempotency_key text,
  ADD COLUMN IF NOT EXISTS bundle_size integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sp_category_multiplier numeric(5,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS sp_earned_at_completion integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sp_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS sp_reserved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'trades_final_sp_amount_check') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_final_sp_amount_check CHECK (final_sp_amount >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'trades_total_fee_cents_check') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_total_fee_cents_check CHECK (total_fee_cents >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'trades_bundle_size_check') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_bundle_size_check CHECK (bundle_size >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'trades_sp_category_multiplier_check') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_sp_category_multiplier_check CHECK (sp_category_multiplier > 0 AND sp_category_multiplier <= 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'trades_dispute_resolution_check') THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_dispute_resolution_check CHECK (
        dispute_resolution IS NULL
        OR dispute_resolution IN ('open', 'resolved_buyer', 'resolved_seller', 'rejected')
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_trades_offer_expires_at
  ON public.trades (offer_expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_trades_auto_complete_at
  ON public.trades (auto_complete_at)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_trades_pending_sp_release_at
  ON public.trades (pending_sp_release_at)
  WHERE status = 'completed' AND sp_released_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_payout_idempotency_key
  ON public.trades (payout_idempotency_key)
  WHERE payout_idempotency_key IS NOT NULL;

-- Backfill timing columns for currently active rows.
DO $$
DECLARE
  v_offer_timeout_hours integer := 48;
  v_auto_complete_hours integer := 72;
BEGIN
  SELECT COALESCE(public.fn_admin_config_safe_int(ac.value, 48), 48)
  INTO v_offer_timeout_hours
  FROM public.admin_config ac
  WHERE ac.key = 'offer_timeout_hours'
  LIMIT 1;

  SELECT COALESCE(public.fn_admin_config_safe_int(ac.value, 72), 72)
  INTO v_auto_complete_hours
  FROM public.admin_config ac
  WHERE ac.key = 'auto_complete_hours'
  LIMIT 1;

  UPDATE public.trades t
  SET offer_expires_at = COALESCE(
      t.offer_expires_at,
      t.created_at + make_interval(hours => v_offer_timeout_hours)
    )
  WHERE t.status = 'pending'
    AND t.offer_expires_at IS NULL;

  UPDATE public.trades t
  SET auto_complete_at = COALESCE(
      t.auto_complete_at,
      COALESCE(t.last_status_change_at, t.updated_at, t.created_at) + make_interval(hours => v_auto_complete_hours)
    )
  WHERE t.status = 'in_progress'
    AND t.auto_complete_at IS NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) SP wallet reservation support
-- -----------------------------------------------------------------------------
ALTER TABLE public.sp_wallets
  ADD COLUMN IF NOT EXISTS reserved_sp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conname = 'sp_wallets_reserved_sp_check') THEN
    ALTER TABLE public.sp_wallets
      ADD CONSTRAINT sp_wallets_reserved_sp_check CHECK (reserved_sp >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sp_wallets_reserved_sp ON public.sp_wallets (reserved_sp);

-- -----------------------------------------------------------------------------
-- 3) Listing offer stats table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_offer_stats (
  listing_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  unanswered_offer_count integer NOT NULL DEFAULT 0,
  last_offer_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_offer_stats_unanswered_offer_count_check CHECK (unanswered_offer_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_listing_offer_stats_unanswered
  ON public.listing_offer_stats (unanswered_offer_count DESC, updated_at DESC);

ALTER TABLE public.listing_offer_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_offer_stats_select_owner ON public.listing_offer_stats;
CREATE POLICY listing_offer_stats_select_owner
  ON public.listing_offer_stats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.items i
      WHERE i.id = listing_offer_stats.listing_id
        AND i.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS listing_offer_stats_service_role ON public.listing_offer_stats;
CREATE POLICY listing_offer_stats_service_role
  ON public.listing_offer_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4) Profile tuning fields for seller QoL.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_response_time_hours numeric(6,2) DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_complete_opt_out boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 5) Prevent payment preference changes during active trade windows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_lock_payment_preference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_active_trade boolean;
BEGIN
  IF COALESCE(OLD.accepts_swap_points, false) IS NOT DISTINCT FROM COALESCE(NEW.accepts_swap_points, false) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trades t
    WHERE t.listing_id = NEW.id
      AND t.status IN ('pending', 'payment_processing', 'in_progress')
  ) INTO v_has_active_trade;

  IF v_has_active_trade THEN
    RAISE EXCEPTION 'Cannot change payment preference while listing has active trades';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lock_payment_preference ON public.items;
CREATE TRIGGER trigger_lock_payment_preference
BEFORE UPDATE OF accepts_swap_points
ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_payment_preference();

-- -----------------------------------------------------------------------------
-- Verification queries
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'trades'
--   AND column_name IN (
--     'offer_expires_at',
--     'auto_complete_at',
--     'pending_sp_release_at',
--     'sp_earned_at_completion',
--     'sp_released_at',
--     'sp_reserved_at'
--   )
-- ORDER BY column_name;
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'sp_wallets'
--   AND column_name = 'reserved_sp';
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'listing_offer_stats';
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'listing_offer_stats';
--
-- Common failure modes:
-- 1) Missing fn_admin_config_safe_int from prior migration: apply 20260528000001 first.
-- 2) Legacy items table without accepts_swap_points: add/align item listing schema before trigger creation.
-- 3) Existing duplicate payout keys: clean data before unique index creation.
