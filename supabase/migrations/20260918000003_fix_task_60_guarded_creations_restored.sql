-- ============================================================================
-- FIX-Task-60 — restore the objects a FALSE GUARD silently skipped
-- Mode: Idempotent rerunnable migration (SQL-0 Mode B)
-- ============================================================================
--
-- ROOT CAUSE
-- ----------
-- `20240101000001_resolve_active_node_and_waitlist.sql` (originally
-- `006_resolve_active_node_and_waitlist.sql`) wraps its RPCs, indexes and policies
-- in `DO $$ IF EXISTS (SELECT 1 FROM information_schema.tables ... 'nodes') THEN ...`.
-- The FIX-Task-40 phase-3 renumber placed that file FIRST in the chain, while
-- `nodes` is not created until `20241213000001_add_auth_module_tables.sql`. So at
-- replay time the guard is FALSE and everything inside it is skipped — silently,
-- with no error, and the file still "applies cleanly".
--
-- WHAT THAT COSTS (measured against the staging fingerprints)
-- ----------------------------------------------------------
--   * `resolve_active_node_for_signup(...)` never exists in a rebuilt database.
--     The mobile app calls it directly (`services/location.ts` → RPC
--     `resolve_active_node_for_signup`) to resolve a signup ZIP to a node, so
--     location resolution is broken on any from-scratch environment.
--   * 4 `zip_waitlist` indexes and 3 `zip_waitlist` RLS policies never exist either.
--
-- This migration re-creates them at the END of the chain, where every dependency
-- exists. The function body is copied VERBATIM from the guarded file (nothing is
-- re-invented) and its signature/result match the live staging function exactly.
-- The guard in the original file is left in place: it is correct for a database
-- where `nodes` really does not exist yet, and it is harmless once the object
-- already exists (the re-create below is idempotent).

-- ============================================================================
-- 1. resolve_active_node_for_signup — finds exact ZIP match OR nearest active node
-- ============================================================================
-- Logic (unchanged from 006):
--   a) ACTIVE node with an exact ZIP match  → match_type='zip'
--   b) otherwise NEAREST ACTIVE node        → match_type='nearest'
--   c) no active nodes                      → empty result

CREATE OR REPLACE FUNCTION public.resolve_active_node_for_signup(
  requested_zip TEXT,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  zip_code TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  match_type TEXT
) AS $func$
DECLARE
  exact_match_count INT;
BEGIN
  -- First, check if there's an ACTIVE node with exact ZIP match
  SELECT COUNT(*) INTO exact_match_count
  FROM public.nodes
  WHERE public.nodes.zip_code = requested_zip AND public.nodes.is_active = TRUE;

  -- If exact ZIP match exists → return it
  IF exact_match_count > 0 THEN
    RETURN QUERY
    SELECT
      n.id,
      n.name,
      n.zip_code,
      n.city,
      n.state,
      n.latitude::DOUBLE PRECISION,
      n.longitude::DOUBLE PRECISION,
      NULL::DOUBLE PRECISION as distance_km,
      'zip'::TEXT as match_type
    FROM public.nodes n
    WHERE n.zip_code = requested_zip AND n.is_active = TRUE
    LIMIT 1;
    RETURN;
  END IF;

  -- Otherwise, return NEAREST ACTIVE node by PostGIS distance
  RETURN QUERY
  SELECT
    n.id,
    n.name,
    n.zip_code,
    n.city,
    n.state,
    n.latitude::DOUBLE PRECISION,
    n.longitude::DOUBLE PRECISION,
    (ST_DistanceSphere(
      ST_MakePoint(user_lng, user_lat),
      ST_MakePoint(n.longitude::DOUBLE PRECISION, n.latitude::DOUBLE PRECISION)
    ) / 1000.0) as distance_km,
    'nearest'::TEXT as match_type
  FROM public.nodes n
  WHERE n.is_active = TRUE
  ORDER BY ST_DistanceSphere(
    ST_MakePoint(user_lng, user_lat),
    ST_MakePoint(n.longitude::DOUBLE PRECISION, n.latitude::DOUBLE PRECISION)
  ) ASC
  LIMIT 1;
END;
$func$ LANGUAGE plpgsql STABLE;

-- BP-79: the `dt61_guard_revoke_fn_public` event trigger strips PUBLIC/anon/
-- authenticated on every new function, so an explicit GRANT is required or the
-- client cannot call this. Mirrors the sibling precedent in the same original
-- file (increment/decrement_node_member_count grant to authenticated, anon).
GRANT EXECUTE ON FUNCTION public.resolve_active_node_for_signup(TEXT, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated, anon, service_role;

-- ============================================================================
-- 2. zip_waitlist — indexes skipped by the same guard
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_zip_waitlist_created_at    ON public.zip_waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zip_waitlist_requested_zip ON public.zip_waitlist(requested_zip);
CREATE INDEX IF NOT EXISTS idx_zip_waitlist_status        ON public.zip_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_zip_waitlist_user_id       ON public.zip_waitlist(user_id);

-- ============================================================================
-- 3. zip_waitlist — RLS policies skipped by the same guard
-- ============================================================================
-- Definitions copied verbatim from the staging fingerprints (role omitted = the
-- default PUBLIC, which is what staging records).

ALTER TABLE public.zip_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zip_waitlist_user_select ON public.zip_waitlist;
CREATE POLICY zip_waitlist_user_select ON public.zip_waitlist
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS zip_waitlist_user_insert ON public.zip_waitlist;
CREATE POLICY zip_waitlist_user_insert ON public.zip_waitlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS zip_waitlist_user_update ON public.zip_waitlist;
CREATE POLICY zip_waitlist_user_update ON public.zip_waitlist
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Verification (SQL-3)
-- ============================================================================
-- SELECT p.oid::regprocedure::text, pg_get_function_result(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.proname='resolve_active_node_for_signup';
-- Expected: 1 row, TABLE(id uuid, name text, zip_code text, city text, state text,
--           latitude double precision, longitude double precision,
--           distance_km double precision, match_type text)
--
-- SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='zip_waitlist' ORDER BY 1;
-- Expected: idx_zip_waitlist_created_at, idx_zip_waitlist_requested_zip,
--           idx_zip_waitlist_status, idx_zip_waitlist_user_id, zip_waitlist_pkey
--
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='zip_waitlist' ORDER BY 1;
-- Expected: zip_waitlist_user_insert, zip_waitlist_user_select, zip_waitlist_user_update
--
-- SELECT has_function_privilege('authenticated',
--   'public.resolve_active_node_for_signup(text,double precision,double precision)', 'EXECUTE');
-- Expected: t
-- ============================================================================
