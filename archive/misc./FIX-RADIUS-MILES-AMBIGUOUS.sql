-- ================================================================
-- FIX: "column reference radius_miles is ambiguous" error
-- Issue: RPC function parameter conflicting in WHERE clause
-- Solution: Store parameter in local variable to avoid ambiguity
-- ================================================================

-- STEP 1: Drop the problematic function
DROP FUNCTION IF EXISTS get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;

-- STEP 2: Recreate with local variable to avoid ambiguity
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
    gn.name,
    gn.city,
    gn.state,
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
    ) / 1609.34 <= v_radius_miles  -- Uses local variable, no ambiguity
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Verify the function was recreated
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_nodes_within_radius';

-- Expected result: 1 row with routine_name='get_nodes_within_radius' and routine_type='FUNCTION'
