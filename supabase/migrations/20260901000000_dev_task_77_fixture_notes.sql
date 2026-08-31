-- File: supabase/migrations/20260901000000_dev_task_77_fixture_notes.sql
-- Dev Task 77 item 6 — disambiguate QA fixture trades.
--
-- Problem (QA Task 15, 2026-08-31): two "QA Canned Cancelled-Trade Item" trades
-- existed with identical titles but different refund states, so QA burned calls
-- figuring out which was which. The seed cannot stamp a distinguishing label on a
-- trade without a column to hold it.
--
-- Fix: add an optional `notes` (a.k.a. fixture_tag) column to `trades`. The seed
-- stamps the canned TRD-TC-B08 trade with 'fixture:TRD-TC-B08', and future
-- QA-created fixture trades can carry their own tag. The TradeList UI does NOT
-- render this column, so it is QA/dev-facing metadata only (no UX impact).

-- 1. Add the notes column (nullable — no existing-row backfill needed).
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.trades.notes IS
  'Optional QA/dev fixture tag (e.g. fixture:TRD-TC-B08) to disambiguate identical-looking seeded trades. Not rendered in the app UI.';

-- 2. Verification queries (run one per call — see supabase-sql.instructions.md):
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'trades' AND column_name = 'notes';
--    SELECT id, status, notes FROM public.trades
--    WHERE notes IS NOT NULL LIMIT 5;
