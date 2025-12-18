-- Supabase migration: Create function to get nodes within radius
-- Purpose: Support distance-based item filtering (NODE-006)
-- Created: 2025-12-17

-- Function to get all nodes within a radius of a center point
-- Used by item filtering to show items from nearby communities
CREATE OR REPLACE FUNCTION get_nodes_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  city TEXT,
  state TEXT,
  distance_miles DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id::TEXT,
    n.name,
    n.city,
    n.state,
    (ST_DistanceSphere(
      ST_MakePoint(n.longitude, n.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34)::DOUBLE PRECISION AS distance_miles  -- Convert meters to miles
  FROM nodes n
  WHERE
    n.is_active = true
    AND ST_DistanceSphere(
      ST_MakePoint(n.longitude, n.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34 <= radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create index on nodes for spatial queries (if not exists)
-- This improves performance for get_nodes_within_radius
CREATE INDEX IF NOT EXISTS idx_nodes_location 
ON nodes USING GIST (ST_MakePoint(longitude, latitude));

-- Grant execute permission on function to anon/authenticated users
GRANT EXECUTE ON FUNCTION get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) 
TO anon, authenticated;
