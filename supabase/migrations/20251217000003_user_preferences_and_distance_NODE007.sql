-- ================================================================
-- Migration: 20251217000003_user_preferences_and_distance_NODE007.sql
-- Module: MODULE-03 NODE-007 - Distance Radius Filter
-- Description: Creates user_preferences table and calculate_node_distance function
-- ================================================================

-- =============================================================================
-- STEP 1: DROP EXISTING OBJECTS (if re-running)
-- =============================================================================

DROP FUNCTION IF EXISTS calculate_node_distance(UUID, UUID) CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;

-- =============================================================================
-- STEP 2: CREATE USER_PREFERENCES TABLE
-- =============================================================================

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_radius_miles INTEGER DEFAULT 10 CHECK (preferred_radius_miles >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =============================================================================
-- STEP 3: CREATE INDEXES
-- =============================================================================

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- =============================================================================
-- STEP 4: ENABLE RLS
-- =============================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: CREATE RLS POLICIES
-- =============================================================================

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================================================
-- STEP 6: CREATE AUTO-UPDATE TRIGGER FOR user_preferences
-- =============================================================================

CREATE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at_trigger
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- =============================================================================
-- STEP 7: CREATE FUNCTION: calculate_node_distance (NODE-007)
-- =============================================================================
-- Calculate distance in miles between two nodes using PostGIS
-- Used to display distance to items from other nodes

CREATE FUNCTION calculate_node_distance(
  node1_id UUID,
  node2_id UUID
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  node1_lat DOUBLE PRECISION;
  node1_lng DOUBLE PRECISION;
  node2_lat DOUBLE PRECISION;
  node2_lng DOUBLE PRECISION;
  distance_meters DOUBLE PRECISION;
BEGIN
  -- Get node 1 coordinates
  SELECT latitude, longitude INTO node1_lat, node1_lng
  FROM geographic_nodes
  WHERE id = node1_id;

  -- Get node 2 coordinates
  SELECT latitude, longitude INTO node2_lat, node2_lng
  FROM geographic_nodes
  WHERE id = node2_id;

  -- Handle case where either node not found
  IF node1_lat IS NULL OR node2_lat IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate distance in meters using PostGIS ST_DistanceSphere
  distance_meters := ST_DistanceSphere(
    ST_MakePoint(node1_lng, node1_lat),
    ST_MakePoint(node2_lng, node2_lat)
  );

  -- Convert meters to miles (1 mile = 1609.34 meters)
  RETURN distance_meters / 1609.34;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify user_preferences table exists
SELECT 'user_preferences table created' AS status
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'user_preferences'
);

-- Verify calculate_node_distance function exists
SELECT 'calculate_node_distance function created' AS status
WHERE EXISTS (
  SELECT 1 FROM pg_proc
  WHERE proname = 'calculate_node_distance'
);

-- Verify RLS policies exist
SELECT COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename = 'user_preferences';
