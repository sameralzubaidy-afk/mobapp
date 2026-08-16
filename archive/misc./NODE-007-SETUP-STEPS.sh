#!/bin/bash
# NODE-007: Add Test Items - Step by Step Instructions

echo "NODE-007: Cross-Node Items Setup"
echo "=================================="
echo ""
echo "STEP 1: Find your User ID"
echo "→ Go to Supabase Console"
echo "→ Authentication → Users"
echo "→ Copy your User ID (UUID format)"
echo ""
echo "STEP 2: Copy this entire SQL command"
echo "→ Replace YOUR_USER_ID with your actual user ID"
echo ""

cat << 'EOF'

================================================================================
SQL TO RUN IN SUPABASE SQL EDITOR
================================================================================

-- Replace YOUR_USER_ID with your actual UUID
-- Example: 8f4d3b2a-1c9e-4f7b-9d2e-5a6c7b8e9f0a

INSERT INTO items (seller_id, title, description, price, condition, status, accepts_swap_points)
SELECT 'YOUR_USER_ID', 'Nintendo Switch Gaming Console', 'Gently used, all accessories included, excellent condition', 250, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'LEGO Star Wars Ultimate Set', 'Complete collection, every single piece', 85, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Kids Soccer Cleats Size 5', 'Youth soccer cleats, worn one season', 45, 'good', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Percy Jackson 5-Book Series', 'All books hardcover, never read', 60, 'like-new', 'available', true
UNION ALL
SELECT 'YOUR_USER_ID', 'Winter Kids Jacket Size 12', 'Warm jacket, only worn one season', 55, 'good', 'available', false;

================================================================================

STEP 3: After running SQL, verify items created

SELECT COUNT(*) as items_created FROM items 
WHERE seller_id = 'YOUR_USER_ID' AND status = 'available';

Expected result: 5 rows

================================================================================

STEP 4: Test in the Mobile App

1. Refresh app (or reload)
2. Go to Browse Items
3. Toggle "All Nodes" ON
4. Click + button 10 times to reach 50+ miles
5. See test items with "~73 mi away" badge ✅

================================================================================

STEP 5: To restore your profile to LOCAL node after testing

UPDATE profiles 
SET node_id = (SELECT id FROM geographic_nodes WHERE zip_code = '06850' LIMIT 1)
WHERE user_id = 'YOUR_USER_ID';

================================================================================
EOF

echo ""
echo "STEP 3: Test in App"
echo "→ Toggle 'All Nodes' ON"
echo "→ Click + button 10 times"
echo "→ See test items appear! ✅"
echo ""
echo "Done! 🎉"
