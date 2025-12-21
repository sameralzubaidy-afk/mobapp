/**
 * FILE: NODE-007-TEST-DATA.sql
 * NODE-007: Distance Radius Filter - Test Data
 * 
 * This SQL creates test items in remote nodes to test distance filtering
 * Run this in Supabase SQL Editor to create items that will show when users
 * select radius > 20 miles
 * 
 * Prerequisite: 
 * - Run: supabase/migrations/20251217000003_user_preferences_and_distance_NODE007.sql
 * - Have at least 2 nodes setup
 */

-- ============================================================================
-- STEP 1: Create or use existing remote node
-- ============================================================================

-- Option A: If you want to add items to node ID: 550e8400-e29b-41d4-a716-446655440002
-- (skip if node already exists)

-- Option B: If you need to create a test node first:
-- Uncomment and run if the node doesn't exist:

/*
INSERT INTO geographic_nodes (id, name, zip_code, city, state, latitude, longitude, active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Far Away Test Node',
  '07424',
  'Little Falls',
  'NJ',
  40.8751,
  74.2163,
  true
);
*/

-- Verify the node exists
SELECT id, name, city, state, latitude, longitude FROM geographic_nodes 
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- ============================================================================
-- STEP 2: Create test sellers in the remote node
-- ============================================================================

-- Get your current user ID first (replace with actual value)
-- SELECT id FROM auth.users LIMIT 1;

-- Create test seller 1 in remote node
INSERT INTO profiles (
  user_id,
  full_name,
  node_id,
  avatar_url,
  bio,
  phone_verified,
  onboarding_completed
)
VALUES (
  'test-seller-far-1', -- Replace with actual user ID
  'Far Away Seller 1',
  '550e8400-e29b-41d4-a716-446655440002',
  'https://via.placeholder.com/150?text=Seller1',
  'Seller in remote node',
  true,
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  node_id = '550e8400-e29b-41d4-a716-446655440002',
  full_name = 'Far Away Seller 1';

-- Create test seller 2 in remote node
INSERT INTO profiles (
  user_id,
  full_name,
  node_id,
  avatar_url,
  bio,
  phone_verified,
  onboarding_completed
)
VALUES (
  'test-seller-far-2', -- Replace with actual user ID
  'Far Away Seller 2',
  '550e8400-e29b-41d4-a716-446655440002',
  'https://via.placeholder.com/150?text=Seller2',
  'Another seller in remote node',
  true,
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  node_id = '550e8400-e29b-41d4-a716-446655440002',
  full_name = 'Far Away Seller 2';

-- ============================================================================
-- STEP 3: Create test items in the remote node
-- ============================================================================

-- Item 1: Electronics (visible at 20+ miles)
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status,
  accepts_swap_points
)
VALUES (
  'test-seller-far-1',
  'Nintendo Switch (Remote Node)',
  'Gently used Nintendo Switch in excellent condition. Perfect for gaming on the go!',
  250.00,
  NULL, -- Set to actual category_id if needed
  'like-new',
  'available',
  true
);

-- Item 2: Toys (visible at 20+ miles)
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status,
  accepts_swap_points
)
VALUES (
  'test-seller-far-1',
  'LEGO Star Wars Set (Remote)',
  'Complete LEGO Star Wars collection set. All pieces included!',
  85.00,
  NULL, -- Set to actual category_id if needed
  'like-new',
  'available',
  false
);

-- Item 3: Sports Equipment (visible at 20+ miles)
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status,
  accepts_swap_points
)
VALUES (
  'test-seller-far-2',
  'Youth Soccer Cleats (Remote Node)',
  'Size 5 youth soccer cleats, worn only a few times. Great for young soccer players!',
  45.00,
  NULL, -- Set to actual category_id if needed
  'good',
  'available',
  true
);

-- Item 4: Books (visible at 20+ miles)
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status,
  accepts_swap_points
)
VALUES (
  'test-seller-far-2',
  'Percy Jackson Book Series (Remote)',
  'Complete 5-book series in hardcover. Perfect condition, never read!',
  60.00,
  NULL, -- Set to actual category_id if needed
  'like-new',
  'available',
  true
);

-- Item 5: Clothing (visible at 20+ miles)
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status,
  accepts_swap_points
)
VALUES (
  'test-seller-far-1',
  'Kids Winter Jacket (Remote Node)',
  'Warm winter jacket, size 12. Only worn one season.',
  55.00,
  NULL, -- Set to actual category_id if needed
  'good',
  'available',
  false
);

-- ============================================================================
-- STEP 4: Verify items were created
-- ============================================================================

SELECT 
  i.id,
  i.title,
  i.price,
  i.status,
  i.created_at,
  p.full_name,
  n.name as node_name,
  n.city,
  n.state
FROM items i
JOIN profiles p ON i.seller_id = p.user_id
JOIN geographic_nodes n ON p.node_id = n.id
WHERE p.node_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY i.created_at DESC;

-- ============================================================================
-- STEP 5: Test distance calculation
-- ============================================================================

-- Get distance between your node and the remote node
-- Replace '06850' with your actual node zip code

SELECT 
  n1.name as your_node,
  n1.city as your_city,
  n2.name as remote_node,
  n2.city as remote_city,
  public.calculate_node_distance(n1.id, n2.id) as distance_miles
FROM geographic_nodes n1
CROSS JOIN geographic_nodes n2
WHERE n1.zip_code = '06850'  -- Replace with your zip code
  AND n2.id = '550e8400-e29b-41d4-a716-446655440002';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 
-- 1. The distance between Norwalk, CT (06850) and Little Falls, NJ (07424) is ~73 miles
--    So these items will ONLY appear when user sets radius >= 73 miles
--
-- 2. If you need items visible at 20-50 miles, use a node that is 20-50 miles away
--    Example: Use Jersey City, NJ (07310) which is ~25 miles from Norwalk, CT
--
-- 3. The sellers must have:
--    - node_id set to the remote node
--    - onboarding_completed = true
--    - phone_verified = true (for best results)
--
-- 4. Items must have status = 'available' to appear in browse
--
-- 5. When you set radius to 20+ miles in the app:
--    - Toggle "All Nodes" ON
--    - Drag slider to > 20 miles
--    - These test items should appear with distance badges
--
-- ============================================================================
