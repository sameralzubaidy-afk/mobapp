-- ============================================================================
-- P2 — Restore Node-Scoped Discovery: get_nodes_within_radius → canonical nodes
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Repoints the radius-search RPC used by the Discover location filter from
--   the DEPRECATED geographic_nodes table to the CANONICAL public.nodes table.
--   This removes the UUID mismatch that made the location filter return node
--   ids that never matched items.node_id / profiles.node_id (Phase 24 proved
--   the filter was cosmetic). Keep the exact same return shape + input
--   signature so the mobile client (resolveNodeScopeByLocation →
--   get_nodes_within_radius) needs NO change to the RPC call.
--
-- WHY geographic_nodes (not nodes) was the root cause:
--   * items.node_id / profiles.node_id FK to public.nodes(id) (canonical).
--   * get_nodes_within_radius read public.geographic_nodes (only Buffalo +
--     Greenwich live, different UUIDs) → returned ids that never matched.
--   * get_top_categories_by_state was already corrected to join nodes
--     (see 20260811000008_record_discover_rpcs_applied_manually.sql).
--
-- DESIGN:
--   * Return id as n.id::UUID — safe under BOTH the committed TEXT schema and
--     the live UUID schema (UUID→UUID is an identity cast; TEXT→UUID validates).
--   * nodes.is_active is the active filter (matches geographic_nodes.is_active).
--   * SECURITY DEFINER retained (STABLE read; original was DEFINER) — keep the
--     same security posture. search_path pinned (BP-5).
--   * OUT OF SCOPE (flagged, NOT changed): legacy calculate_node_distance
--     (20251217000003) and items_with_node_info view (20251217000002) still
--     read geographic_nodes — unused by any discovery path; a future cleanup
--     migration can drop geographic_nodes after they are retired.
--
-- RULES: SQL-0 (Mode B), BP-5 (SECURITY DEFINER + search_path), BP-10
-- (verification queries), p_/v_ naming, qualified columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Recreate get_nodes_within_radius to read public.nodes
--   (same input signature + return type → CREATE OR REPLACE is safe; BP-12)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nodes_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  city TEXT,
  state TEXT,
  distance_miles DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_radius_miles DOUBLE PRECISION;
BEGIN
  v_radius_miles := COALESCE(radius_miles, 0);

  RETURN QUERY
  SELECT
    n.id::UUID,
    n.name::TEXT,
    n.city::TEXT,
    n.state::TEXT,
    (
      extensions.ST_DistanceSphere(
        extensions.ST_MakePoint(n.longitude, n.latitude),
        extensions.ST_MakePoint(center_lng, center_lat)
      ) / 1609.34
    )::DOUBLE PRECISION AS distance_miles
  FROM public.nodes n
  WHERE n.is_active = TRUE
    AND (
      extensions.ST_DistanceSphere(
        extensions.ST_MakePoint(n.longitude, n.latitude),
        extensions.ST_MakePoint(center_lng, center_lat)
      ) / 1609.34
    ) <= v_radius_miles
  ORDER BY distance_miles ASC;
END;
$$;

COMMENT ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
IS 'Returns active nodes within miles radius. Reads the CANONICAL public.nodes table (P2 node-scoped discovery); geographic_nodes is deprecated.';

GRANT EXECUTE ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont) — Re-assert the geographic_nodes deprecation marker (no data change)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.geographic_nodes IS
'DEPRECATED (P2 2026-08-17): superseded by public.nodes. No discovery RPC reads this table anymore; kept for legacy reference only (calculate_node_distance, items_with_node_info view). Scheduled for removal in a future cleanup migration.';

-- ===========================================================================
-- BLOCK 2 — Verification queries (run one statement per call)
-- ===========================================================================
-- 1. Radius lookup around Norwalk CT — ids MUST match public.nodes.id
--    (NOT geographic_nodes.id):
--    SELECT * FROM public.get_nodes_within_radius(41.0534, -73.5387, 10);
--
-- 2. Cross-check — returned ids exist in canonical nodes:
--    SELECT n.id, n.name
--    FROM public.nodes n
--    JOIN (SELECT (get_nodes_within_radius(41.0534, -73.5387, 10)).id) r ON r.id = n.id;
--
-- 3. No returned id should appear in geographic_nodes:
--    SELECT r.id, gn.name
--    FROM public.geographic_nodes gn
--    RIGHT JOIN (SELECT (get_nodes_within_radius(41.0534, -73.5387, 10)).id) r
--      ON r.id = gn.id
--    WHERE gn.id IS NULL;  -- expect rows = canonical nodes (not in geographic_nodes)
