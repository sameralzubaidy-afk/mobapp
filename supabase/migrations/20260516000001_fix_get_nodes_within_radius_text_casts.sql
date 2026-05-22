-- Mode B: idempotent rerunnable migration
-- Fixes RPC 42804 errors by casting VARCHAR node fields to TEXT
-- to match the declared RETURNS TABLE contract.

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
    gn.id,
    gn.name::TEXT,
    gn.city::TEXT,
    gn.state::TEXT,
    (ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34)::DOUBLE PRECISION AS distance_miles
  FROM public.geographic_nodes gn
  WHERE gn.is_active = TRUE
    AND (ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34) <= v_radius_miles
  ORDER BY distance_miles ASC;
END;
$$;

COMMENT ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
IS 'Returns active geographic nodes within radius in miles; VARCHAR columns are cast to TEXT for strict RPC type matching.';

GRANT EXECUTE ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
TO authenticated, anon, service_role;

-- Verification query (run after migration):
-- SELECT proname, proargtypes::regtype[], prorettype::regtype
-- FROM pg_proc
-- WHERE proname = 'get_nodes_within_radius';

-- Sample call verification:
-- SELECT * FROM public.get_nodes_within_radius(41.0534, -73.5387, 10);

-- Common failure modes:
-- 1) 42804 type mismatch if node string columns are not cast to TEXT in SELECT.
-- 2) missing PostGIS extension if ST_DistanceSphere is unavailable.
-- 3) missing EXECUTE grants causes RPC permission errors.
