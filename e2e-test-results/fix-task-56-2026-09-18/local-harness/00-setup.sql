-- =============================================================================
-- FIX-Task-56 — LOCAL rule harness, part 1 of 2 (SETUP).
--
-- This is NOT a repo migration and must never be applied to staging. It exists so
-- the FIX-Task-56 migration can be EXECUTED and asserted against a throwaway local
-- PostgreSQL database before it is applied to staging — the staging MCP path was
-- unauthenticated at the time of writing, and this is the local-validation step the
-- standing rules prefer anyway.
--
-- It creates the MINIMUM surface the migration touches:
--   * the roles the migration's REVOKE/GRANT reference (they exist on Supabase but
--     not in a bare local Postgres, and their absence would fail for an
--     unrepresentative reason)
--   * public.seller_payout_methods, including the real unique partial index that
--     enforces "at most one primary per seller" — that index is part of the
--     behaviour under test, not decoration
--   * public.debug_logs, so the trigger's audit path is exercisable
--   * a results table the assertions write their verdicts into
--
-- Run order:  createdb fix56_scratch
--             psql -f 00-setup.sql
--             psql -f <the FIX-Task-56 migration>
--             psql -f 10-tests.sql
-- =============================================================================

-- Supabase roles the migration's grants name. NOLOGIN stubs are enough.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Mirror of the real table's shape for the columns the migration touches.
CREATE TABLE public.seller_payout_methods (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  method_type        TEXT NOT NULL DEFAULT 'stripe_connect',
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_account_id  TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- The REAL index from 20260916000045_seller_payouts.sql:231 — it is what makes the
-- auto-promote's "occupy the single primary slot" behaviour observable.
CREATE UNIQUE INDEX seller_payout_methods_one_primary_idx
  ON public.seller_payout_methods (user_id)
  WHERE is_primary = TRUE;

CREATE INDEX seller_payout_methods_user_id_idx
  ON public.seller_payout_methods (user_id);

-- Mirror of public.debug_logs (20260916000148_stabilize_auth_triggers.sql:17).
CREATE TABLE public.debug_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name TEXT NOT NULL,
  message      TEXT,
  payload      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Verdict sink for part 2.
CREATE TABLE public.fix56_results (
  test_id     TEXT,
  expectation TEXT,
  observed    TEXT,
  verdict     TEXT
);
