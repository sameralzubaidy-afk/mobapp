-- Mode B: idempotent rerunnable migration
-- Fixes get_nodes_within_radius failures when PostGIS functions are not on public search_path.

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
    (
      extensions.ST_DistanceSphere(
        extensions.ST_MakePoint(gn.longitude, gn.latitude),
        extensions.ST_MakePoint(center_lng, center_lat)
      ) / 1609.34
    )::DOUBLE PRECISION AS distance_miles
  FROM public.geographic_nodes gn
  WHERE gn.is_active = TRUE
    AND (
      extensions.ST_DistanceSphere(
        extensions.ST_MakePoint(gn.longitude, gn.latitude),
        extensions.ST_MakePoint(center_lng, center_lat)
      ) / 1609.34
    ) <= v_radius_miles
  ORDER BY distance_miles ASC;
END;
$$;

COMMENT ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
IS 'Returns active nodes within miles radius; uses explicit extensions schema for PostGIS functions and casts varchar fields to text.';

GRANT EXECUTE ON FUNCTION public.get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
TO authenticated, anon, service_role;

-- Verification queries:
-- SELECT proname, proargtypes::regtype[], prorettype::regtype
-- FROM pg_proc
-- WHERE proname = 'get_nodes_within_radius';
--
-- SELECT * FROM public.get_nodes_within_radius(41.0534, -73.5387, 10);
