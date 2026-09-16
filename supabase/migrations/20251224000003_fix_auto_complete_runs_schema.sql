-- Migration: Ensure auto_complete_runs has expected columns used by scheduled_auto_complete_trades()
-- Date: 2025-12-26

-- Add missing columns if they don't exist so the wrapper INSERT won't fail
ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS invoked_by text;

ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS job_payload jsonb;

ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS result jsonb;

ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE public.auto_complete_runs
  ADD COLUMN IF NOT EXISTS run_at timestamptz NOT NULL DEFAULT now();

-- Verify columns (run interactively if desired):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auto_complete_runs' ORDER BY ordinal_position;
