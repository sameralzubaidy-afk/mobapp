-- TFV2-019: Trade events table — append-only instrumentation log
--
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B).
--
-- FIX-Task-60 — COLUMN NAMES RECONCILED TO THE SHIPPED WRITERS
-- -----------------------------------------------------------
-- This file used to create `event_name` / `user_id`. Every actual writer of this
-- table uses `event_type` / `actor_id` instead:
--   * supabase/functions/_shared/trade-events.ts        (the shared logTradeEvent helper)
--   * supabase/functions/create-trade-offer, release-payment,
--     check-authorization-expiry, check-trade-notifications,
--     initiate-payout, open-dispute, resolve-dispute,
--     transactions-update, admin-trade-action          (direct .insert({ event_type, actor_id }))
--   * p2p-kids-admin/src/app/api/admin/trades/dispute-action/route.ts
--   * p2p-kids-marketplace/src/__tests__/e2e/trade-tfv2-001-022.e2e.ts (reads both columns)
-- and the live staging table carries `event_type` / `actor_id`. So the table built
-- from this migration was one no shipped code path could write to — and because
-- every writer swallows its insert error (console.warn / .then error hook), the
-- failure was SILENT: the trade-event audit trail simply stayed empty.
-- The names are corrected here to the ones the code and staging actually use.

-- ============================================================
-- TRADE EVENTS TABLE (Section 16)
-- Insert-only append log. No PII in metadata.
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id   UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id   UUID REFERENCES auth.users(id),  -- actor (null for system/cron events)
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Convergence for a database already built by an earlier revision of this file
-- (which created `event_name` / `user_id`). `CREATE TABLE IF NOT EXISTS` above
-- is a no-op there, so the rename has to be explicit. No-op when already correct.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_events' AND column_name = 'event_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.trade_events RENAME COLUMN event_name TO event_type;
    RAISE NOTICE 'trade_events.event_name -> event_type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_events' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_events' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE public.trade_events RENAME COLUMN user_id TO actor_id;
    RAISE NOTICE 'trade_events.user_id -> actor_id';
  END IF;

  -- The FK to auth.users follows the column, but its NAME would still say user_id.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_events_user_id_fkey' AND conrelid = 'public.trade_events'::regclass
  ) THEN
    ALTER TABLE public.trade_events RENAME CONSTRAINT trade_events_user_id_fkey TO trade_events_actor_id_fkey;
  END IF;
END $$;

-- Stale index from the earlier shape: it indexes a column that no longer exists
-- under that name (it was renamed, taking the index definition with it) — drop the
-- OLD NAME so the lockfile-style index set matches the live table.
DROP INDEX IF EXISTS public.idx_trade_events_event_name;

CREATE INDEX IF NOT EXISTS idx_trade_events_trade_id   ON trade_events(trade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_events_event_type ON trade_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trade_events_created_at ON trade_events(created_at DESC);

-- Partial unique index for idempotency on cron-triggered events
-- (prevents double-logging when cron retries)
DROP INDEX IF EXISTS public.idx_trade_events_cron_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_events_cron_idempotency
  ON trade_events(trade_id, event_type)
  WHERE event_type IN ('offer_expired', 'auto_completed', 'sp_released_to_seller', 'sp_restored_to_buyer');


ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access trade_events" ON trade_events;
CREATE POLICY "Service role full access trade_events" ON trade_events
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admin role read trade_events" ON trade_events;
CREATE POLICY "Admin role read trade_events" ON trade_events
  FOR SELECT
  USING (
    -- NOTE (FIX-Task-40): this policy referenced `admin_users`, a table that
    -- exists nowhere — not in any migration and not in the live database.  The
    -- repo's canonical admin predicate is user_has_role(), which the admin
    -- surfaces (admin_audit_logs, admin global search, ...) already use.
    public.user_has_role(auth.uid(), 'admin'::text)
  );

-- ---------------------------------------------------------------------------
-- FIX-Task-60: policies that exist on the live staging table but had no creator
-- in the chain, so a rebuilt database enforced DIFFERENT access than staging.
-- Copied verbatim from the staging fingerprint so both sides match.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trade_events_service ON trade_events;
CREATE POLICY trade_events_service ON trade_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS trade_events_user_read ON trade_events;
CREATE POLICY trade_events_user_read ON trade_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.id = trade_events.trade_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- ============================================================
-- HELPER: log_trade_event()
-- Call this from all triggers and Edge Functions.
-- ============================================================
-- NOTE (FIX-Task-60): the insert below now targets the reconciled column names.
-- The PARAMETER is still called p_event_name to avoid a signature change
-- (BP-12: changing the identity arguments requires a DROP, and the function has
-- no callers in the repo or in staging, so there is nothing to gain from it).
CREATE OR REPLACE FUNCTION log_trade_event(
  p_trade_id   UUID,
  p_event_name TEXT,
  p_user_id    UUID DEFAULT NULL,
  p_metadata   JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO trade_events (trade_id, event_type, actor_id, metadata)
  VALUES (p_trade_id, p_event_name, p_user_id, p_metadata)
  ON CONFLICT DO NOTHING;  -- idempotency for cron-triggered events
EXCEPTION WHEN OTHERS THEN
  -- Never let event logging break the primary operation
  RAISE WARNING 'log_trade_event failed for trade % event %: %', p_trade_id, p_event_name, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- Verification (SQL-3) — expected results in comments:
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='trade_events' ORDER BY 1;
-- Expected: actor_id, created_at, event_type, id, metadata, trade_id   (6 rows)
--
-- SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='trade_events' ORDER BY 1;
-- Expected: idx_trade_events_created_at, idx_trade_events_cron_idempotency,
--           idx_trade_events_event_type, idx_trade_events_trade_id, trade_events_pkey
--
-- SELECT policyname, cmd, roles::text FROM pg_policies WHERE schemaname='public' AND tablename='trade_events' ORDER BY 1;
-- Expected: "Admin role read trade_events", "Service role full access trade_events",
--           trade_events_service, trade_events_user_read
--
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trade_events'::regclass;
-- Expected: t
-- =============================================================================
