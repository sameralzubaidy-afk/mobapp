-- ============================================================================
-- FIX-Task-60 — nodes + debug_logs: RLS and shape brought to the live staging state
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- ============================================================================
--
-- WHY (all four items are staging-vs-chain divergences found by the fidelity gate)
-- -------------------------------------------------------------------------------
-- 1. RLS was DISABLED on `nodes` and `debug_logs` in a rebuilt database while the
--    live staging tables have it ENABLED. That is a real exposure in every
--    from-scratch environment: with RLS off, `nodes` (which carries tax config) and
--    `debug_logs` (which carries raw error text) are fully readable by any
--    authenticated client via PostgREST.
--    The policies below are copied VERBATIM from the staging fingerprints, so the
--    rebuilt database reproduces the exact access model that the live system runs
--    today (which is the configuration QA exercises).
-- 2. `nodes.id` had no DEFAULT in the chain while staging defaults it to
--    `gen_random_uuid()`: any INSERT that omits the id fails on a rebuilt database.
-- 3. `nodes.city/state/zip_code` were VARCHAR(100)/VARCHAR(2)/VARCHAR(5) in the
--    chain while staging stores them as TEXT. The limits are not relied on by any
--    code path (nothing validates or truncates to those lengths) and they REJECT
--    legitimate data — a full state name or a ZIP+4 (`06850-1234`) — so a rebuilt
--    database would refuse inserts the live one accepts.
-- 4. `debug_logs` was missing the `user_id` / `error_message` columns and three
--    indexes that staging has.
--
-- NOTE (deferred, see the FIX-Task-60 report): `nodes.latitude/longitude` stay
-- NUMERIC(10,8)/(11,8) here even though staging uses DOUBLE PRECISION. The precision
-- is sufficient for coordinates and every consumer casts or compares numerically, so
-- the divergence is numerically inert; changing a numeric column type on a live,
-- indexed table is a bigger, riskier change than this reconciliation warrants.

-- ============================================================================
-- 1. nodes — column shape
-- ============================================================================

ALTER TABLE public.nodes ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Widening only: VARCHAR(n) -> TEXT accepts everything the old type accepted.
ALTER TABLE public.nodes ALTER COLUMN city     TYPE TEXT;
ALTER TABLE public.nodes ALTER COLUMN state    TYPE TEXT;
ALTER TABLE public.nodes ALTER COLUMN zip_code TYPE TEXT;

-- Backfill first so SET NOT NULL cannot fail on a database that already has rows.
UPDATE public.nodes SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE public.nodes ALTER COLUMN updated_at SET NOT NULL;

-- ============================================================================
-- 2. nodes — RLS + policies (verbatim from the staging fingerprints)
-- ============================================================================

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nodes_public_active ON public.nodes;
CREATE POLICY nodes_public_active ON public.nodes
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS nodes_admin_manage ON public.nodes;
CREATE POLICY nodes_admin_manage ON public.nodes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'::text
    )
  );

-- ============================================================================
-- 3. debug_logs — shape + RLS
-- ============================================================================
-- RLS is enabled to MATCH staging (staging has RLS on with no policies, i.e. only
-- service_role / BYPASSRLS readers see these rows). Writers are DB-side trigger
-- functions owned by the table owner, which bypasses RLS, so logging is unaffected.

ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS debug_logs_created_at_idx   ON public.debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS debug_logs_process_name_idx ON public.debug_logs(process_name);
CREATE INDEX IF NOT EXISTS debug_logs_user_id_idx      ON public.debug_logs(user_id);

ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verification (SQL-3)
-- ============================================================================
-- SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relname IN ('nodes','debug_logs');
-- Expected: both true
--
-- SELECT policyname, cmd, roles::text FROM pg_policies WHERE schemaname='public' AND tablename='nodes' ORDER BY 1;
-- Expected: nodes_admin_manage (ALL, {public}), nodes_public_active (SELECT, {public})
--
-- SELECT column_name, data_type, is_nullable, coalesce(column_default,'-')
--   FROM information_schema.columns WHERE table_schema='public' AND table_name='nodes'
--   AND column_name IN ('id','city','state','zip_code','updated_at') ORDER BY 1;
-- Expected: city/state/zip_code = text; updated_at nullable = NO; id default = gen_random_uuid()
--
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public'
--   AND table_name='debug_logs' AND column_name IN ('user_id','error_message');
-- Expected: 2 rows
-- ============================================================================
