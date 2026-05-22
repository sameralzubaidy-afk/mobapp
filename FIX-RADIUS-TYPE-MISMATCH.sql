-- Fix for get_nodes_within_radius type mismatch
-- The function expects TEXT but the table columns are VARCHAR(255)

DROP FUNCTION IF EXISTS get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;

CREATE FUNCTION get_nodes_within_radius(
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
) AS $$
DECLARE
  v_radius_miles DOUBLE PRECISION;
BEGIN
  -- Store parameter in local variable to avoid ambiguity
  v_radius_miles := radius_miles;
  
  RETURN QUERY
  SELECT
    gn.id,
    gn.name::TEXT,
    gn.city::TEXT,
    gn.state::TEXT,
    (ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34) AS distance_miles
  FROM geographic_nodes gn
  WHERE
    gn.is_active = true
    AND ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34 <= v_radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
