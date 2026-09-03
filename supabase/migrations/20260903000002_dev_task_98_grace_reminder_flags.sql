-- ================================================================
-- File: 20260903000002_dev_task_98_grace_reminder_flags.sql
-- Task: DEV-TASK-98 — Fix grace-reminder cron defects (found during R41)
-- Defect 2: the grace-period-cron Edge Function (SUB-009) reads + writes
-- `grace_reminder_sent_day_60/30/7/1` boolean columns on public.subscriptions
-- to dedupe per-threshold reminders, but those columns existed in NO migration
-- (they were applied to the live DB only via an ad-hoc SQL-editor patch that was
-- never version-controlled). Any environment rebuilt from migrations (CI, local
-- `supabase db reset`, a fresh clone) silently lacks the columns, so the cron's
-- flag-based dedup breaks there.
--
-- This migration commits the columns to source (Mode B — idempotent +
-- rerunnable), mirroring the trial-reminder flag convention in
-- 20260215000000_sub_003_trial_reminder_flags.sql. No-op on the current staging
-- DB where the one-off patch already added them (same nullable + DEFAULT FALSE
-- shape), so it is safe to apply anywhere.
-- ================================================================

-- BLOCK 1: Add grace reminder dedup columns to subscriptions
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'grace_reminder_sent_day_60'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN grace_reminder_sent_day_60 BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'grace_reminder_sent_day_30'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN grace_reminder_sent_day_30 BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'grace_reminder_sent_day_7'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN grace_reminder_sent_day_7 BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'grace_reminder_sent_day_1'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN grace_reminder_sent_day_1 BOOLEAN DEFAULT FALSE;
  END IF;
END;
$$;

-- ================================================================
-- BLOCK 2: Comments
-- ================================================================
COMMENT ON COLUMN public.subscriptions.grace_reminder_sent_day_60 IS
'MODULE-11 SUB-009: Grace reminder already sent at the 60-day-before-expiry threshold (cron grace-period-cron dedup).';
COMMENT ON COLUMN public.subscriptions.grace_reminder_sent_day_30 IS
'MODULE-11 SUB-009: Grace reminder already sent at the 30-day-before-expiry threshold (cron grace-period-cron dedup).';
COMMENT ON COLUMN public.subscriptions.grace_reminder_sent_day_7 IS
'MODULE-11 SUB-009: Grace reminder already sent at the 7-day-before-expiry threshold (cron grace-period-cron dedup).';
COMMENT ON COLUMN public.subscriptions.grace_reminder_sent_day_1 IS
'MODULE-11 SUB-009: Grace reminder already sent at the 1-day-before-expiry threshold (cron grace-period-cron dedup).';

-- ================================================================
-- BLOCK 3: Verification queries
-- ================================================================
-- Expected: 4 rows, all BOOLEAN, nullable, DEFAULT false
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'subscriptions'
--   AND column_name IN ('grace_reminder_sent_day_60','grace_reminder_sent_day_30',
--                       'grace_reminder_sent_day_7','grace_reminder_sent_day_1')
-- ORDER BY column_name;
