-- ================================================================
-- Migration: 20260905000002_dev_task_113_enable_trades_realtime.sql
-- DEV-TASK-113 (2026-09-05) item 2 — Trade Timeline live refresh
-- Module: MODULE-06 Trade Flow / trade timeline live state
-- Mode: B (Idempotent rerunnable migration)
--
-- Problem: TradeTimelineScreen (and TradeDetailScreen) subscribe to
-- postgres_changes on `trades`, but `trades` was never added to the
-- supabase_realtime publication — the subscription silently does nothing, so a
-- trade timeline that is OPEN while an admin (or the other party) resolves a
-- dispute stays stale until remount/relaunch (QA Task 31-M R3 finding #2 / R59;
-- Trade Detail's realtime channel and the timeline's channel both no-op). The
-- same silent-no-op failure mode is documented in
-- 20260720000001_enable_cart_realtime.sql ("Subscriptions silently do nothing").
--
-- Fix: add `trades` to the supabase_realtime publication. Realtime filters
-- delivered rows through RLS, so each party only receives updates for trades
-- they can SELECT (buyers/sellers read their own trades via the timeline's
-- user-JWT query). On any UPDATE the screens re-run their full fetch
-- (trade row + listing + payout + refunds), so no trigger work is needed here.
-- ================================================================

DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication p WHERE p.pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Publication supabase_realtime does not exist';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY['trades']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table_name
        AND c.relkind = 'r'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables ppt
        WHERE ppt.pubname = 'supabase_realtime'
          AND ppt.schemaname = 'public'
          AND ppt.tablename = v_table_name
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
          'public',
          v_table_name
        );
        RAISE NOTICE 'Added %.% to supabase_realtime', 'public', v_table_name;
      ELSE
        RAISE NOTICE '%.% already in supabase_realtime', 'public', v_table_name;
      END IF;
    ELSE
      RAISE NOTICE 'Skipping %.% (table not found)', 'public', v_table_name;
    END IF;
  END LOOP;
END;
$$;

-- ================================================================
-- Verification queries (run after apply)
-- 1) Membership present (expect exactly one row: public / trades)
--    SELECT schemaname, tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND tablename = 'trades';
-- 2) Re-run safety — the DO block is idempotent (adds only when absent).
-- ================================================================
