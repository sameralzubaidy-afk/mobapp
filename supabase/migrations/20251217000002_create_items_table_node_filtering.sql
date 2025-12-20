-- ================================================================
-- Migration: 20251217000002_create_items_table_node_filtering.sql
-- Module: MODULE-03 NODE-006 - Node-Specific Item Filtering
-- Description: Creates items table with node-based filtering support
-- ================================================================

-- =============================================================================
-- STEP 1: DROP EXISTING OBJECTS (if re-running)
-- =============================================================================

DROP VIEW IF EXISTS items_with_node_info CASCADE;
DROP FUNCTION IF EXISTS get_nodes_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS update_items_updated_at() CASCADE;
DROP TABLE IF EXISTS item_images CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- =============================================================================
-- STEP 2: CREATE CATEGORIES TABLE
-- =============================================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: CREATE ITEMS TABLE
-- =============================================================================

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (LENGTH(title) >= 3 AND LENGTH(title) <= 100),
  description TEXT CHECK (LENGTH(description) <= 1000),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0 AND price <= 10000),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted', 'paused')),
  accepts_swap_points BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ
);

-- =============================================================================
-- STEP 4: CREATE INDEXES
-- =============================================================================

CREATE INDEX idx_items_seller_id ON items(seller_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_accepts_swap_points ON items(accepts_swap_points) WHERE status = 'available';

-- =============================================================================
-- STEP 5: CREATE ITEM_IMAGES TABLE
-- =============================================================================

CREATE TABLE item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_item_images_item_id ON item_images(item_id);
CREATE INDEX idx_item_images_display_order ON item_images(item_id, display_order);

-- =============================================================================
-- STEP 6: ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 7: CREATE RLS POLICIES
-- =============================================================================

CREATE POLICY "Anyone can view available items" ON items
  FOR SELECT USING (status = 'available' OR seller_id = auth.uid());

CREATE POLICY "Users can insert own items" ON items
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own items" ON items
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete own items" ON items
  FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Anyone can view item images" ON item_images
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert images for own items" ON item_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = item_images.item_id 
      AND items.seller_id = auth.uid()
    )
  );

-- =============================================================================
-- STEP 8: CREATE FUNCTION: get_nodes_within_radius (NODE-006)
-- =============================================================================

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
    ) / 1609.34 <= v_radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 9: CREATE VIEW: items_with_node_info (NODE-006)
-- =============================================================================

CREATE VIEW items_with_node_info AS
SELECT 
  i.*,
  p.node_id AS seller_node_id,
  gn.name AS seller_node_name,
  gn.city AS seller_node_city,
  gn.state AS seller_node_state,
  gn.latitude AS seller_node_latitude,
  gn.longitude AS seller_node_longitude
FROM items i
JOIN profiles p ON i.seller_id = p.user_id
LEFT JOIN geographic_nodes gn ON p.node_id = gn.id
WHERE i.status = 'available';

-- =============================================================================
-- STEP 10: SEED INITIAL CATEGORIES
-- =============================================================================

INSERT INTO categories (name, icon, display_order, is_active)
VALUES 
  ('Toys', '🧸', 1, TRUE),
  ('Games', '🎮', 2, TRUE),
  ('Books', '📚', 3, TRUE),
  ('Sports', '⚽', 4, TRUE),
  ('Electronics', '💻', 5, TRUE),
  ('Clothing', '👕', 6, TRUE),
  ('Art & Crafts', '🎨', 7, TRUE),
  ('Other', '📦', 8, TRUE)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- STEP 11: CREATE AUTO-UPDATE TRIGGER FOR ITEMS
-- =============================================================================

CREATE FUNCTION update_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_items_updated_at();
