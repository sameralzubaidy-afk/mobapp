-- NODE-007: Quick Test Data Setup
-- Copy entire script and run in Supabase SQL Editor
-- Replace YOUR_USER_ID with your actual user ID from: SELECT id FROM auth.users LIMIT 1;

-- ============================================================================
-- PART 1: Verify node exists (should show 1 row)
-- ============================================================================
SELECT id, name, city, state, latitude, longitude 
FROM geographic_nodes 
WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- If not found, create it:
-- INSERT INTO geographic_nodes (id, name, zip_code, city, state, latitude, longitude, active)
-- VALUES ('550e8400-e29b-41d4-a716-446655440002', 'Geographic Node', '07424', 'Little Falls', 'NJ', 40.8751, 74.2163, true);

-- ============================================================================
-- PART 2: Create test items in remote node
-- IMPORTANT: Replace YOUR_USER_ID with your actual user ID from auth.users
-- ============================================================================

INSERT INTO items (seller_id, title, description, price, condition, status, accepts_swap_points)
SELECT 'YOUR_USER_ID', 'Nintendo Switch Gaming Console', 'Gently used Nintendo Switch, all accessories included', 250, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'LEGO Star Wars Ultimate Set', 'Complete Star Wars LEGO collection, every piece', 85, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Kids Soccer Cleats Size 5', 'Youth soccer cleats, worn one season', 45, 'good', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Percy Jackson Book Series', 'All 5 books hardcover, never read', 60, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Winter Kids Jacket Size 12', 'Warm winter jacket, only worn one season', 55, 'good', 'available', false;

-- ============================================================================
-- PART 3: Verify items were created
-- ============================================================================
SELECT COUNT(*) as total_items, COUNT(DISTINCT accepts_swap_points) FROM items 
WHERE seller_id = 'YOUR_USER_ID' AND status = 'available';

-- Should show: 5 items created

-- ============================================================================
-- PART 4: View all test items with seller info
-- ============================================================================
SELECT 
  i.title,
  i.price,
  i.condition,
  i.accepts_swap_points,
  p.full_name as seller,
  n.name as node_name
FROM items i
JOIN profiles p ON i.seller_id = p.user_id
LEFT JOIN geographic_nodes n ON p.node_id = n.id
WHERE i.seller_id = 'YOUR_USER_ID'
ORDER BY i.created_at DESC;

-- ============================================================================
-- TO RESTORE YOUR PROFILE TO LOCAL NODE (after testing):
-- Uncomment and run this:
-- ============================================================================
-- UPDATE profiles 
-- SET node_id = (SELECT id FROM geographic_nodes WHERE zip_code = '06850' LIMIT 1)
-- WHERE user_id = 'YOUR_USER_ID';
