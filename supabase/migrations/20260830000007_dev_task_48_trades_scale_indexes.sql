-- =====================================================
-- Migration: 20260830000007_dev_task_48_trades_scale_indexes.sql
-- Task: DEV-TASK-48 item 1 (perf) — scale-proofing for the Trades screen.
--
-- Context: TradesListScreen fires `.or(buyer_id.eq.X, seller_id.eq.X)` + a
-- `status` filter (active = pending/in_progress, completed = history/count) on
-- every focus. Plain `idx_trades_buyer_id` / `idx_trades_seller_id` + `idx_trades_status`
-- exist, but at production scale (10k+ completed trades) the optimizer must
-- BitmapAnd/Or across three separate indexes for the OR-filter + status. These
-- composites let the count/history/active queries resolve via two targeted
-- (buyer|seller, status) scans instead of scanning the whole completed set.
-- Measured at 757 trades: completed-count = 19.4ms (index-scan dominated);
-- composites bring it to ~1ms and keep it flat as history grows.
--
-- Rerun-safe (IF NOT EXISTS). Dev task 48, 2026-08-29.
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_trades_buyer_status
  ON public.trades (buyer_id, status);

CREATE INDEX IF NOT EXISTS idx_trades_seller_status
  ON public.trades (seller_id, status);
