# NODE-007: Quick Setup Guide for Cross-Node Items

## Problem
Items don't show when filtering by "All Nodes" because there are no items in other nodes.

## Solution: 3-Step Setup

### STEP 1: Check Your User's Node & Current User ID

In Supabase SQL Editor, run:

```sql
-- Find your current user ID (logged in user)
SELECT id, email FROM auth.users LIMIT 1;

-- Find your node (where you're assigned)
SELECT DISTINCT n.id, n.name, n.city, n.state, n.zip_code
FROM profiles p
JOIN geographic_nodes n ON p.node_id = n.id
WHERE p.user_id = 'YOUR_USER_ID';  -- Replace with your user ID from above
```

**Write down:**
- Your User ID: _______________
- Your Node Name/City: _______________
- Your Node ID: _______________

---

### STEP 2: Verify Remote Node Exists

The remote node `550e8400-e29b-41d4-a716-446655440002` (Little Falls, NJ) should exist. Verify:

```sql
SELECT id, name, city, state, latitude, longitude 
FROM geographic_nodes 
WHERE id = '550e8400-e29b-41d4-a716-446655440002';
```

**Expected result:**
- Name: Geographic Node
- City: Little Falls
- State: NJ
- Latitude: 40.8751
- Longitude: 74.2163

If NOT found, create it:

```sql
INSERT INTO geographic_nodes (id, name, zip_code, city, state, latitude, longitude, active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Geographic Node',
  '07424',
  'Little Falls',
  'NJ',
  40.8751,
  74.2163,
  true
);
```

---

### STEP 3: Create Test Sellers & Items

Replace the placeholder user IDs in this SQL with YOUR user ID, then run:

```sql
-- Create test seller 1 in remote node (REPLACE YOUR_USER_ID)
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
  'YOUR_USER_ID',  -- ← REPLACE THIS with your user ID
  'Test Seller Remote',
  '550e8400-e29b-41d4-a716-446655440002',
  'https://via.placeholder.com/150?text=Seller',
  'Seller in remote node for testing',
  true,
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  node_id = '550e8400-e29b-41d4-a716-446655440002';

-- Verify profile was updated to remote node
SELECT user_id, full_name, node_id FROM profiles 
WHERE user_id = 'YOUR_USER_ID';

-- Create test items
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  condition,
  status,
  accepts_swap_points
)
VALUES
  (
    'YOUR_USER_ID',
    'Nintendo Switch - Remote Node',
    'Gently used Nintendo Switch, excellent condition',
    250.00,
    'like-new',
    'available',
    true
  ),
  (
    'YOUR_USER_ID',
    'LEGO Star Wars Set - Remote',
    'Complete LEGO Star Wars collection, all pieces included',
    85.00,
    'like-new',
    'available',
    true
  ),
  (
    'YOUR_USER_ID',
    'Soccer Cleats - Remote Node',
    'Youth size 5, worn only a few times',
    45.00,
    'good',
    'available',
    false
  ),
  (
    'YOUR_USER_ID',
    'Percy Jackson Books - Remote',
    'Complete 5-book series in hardcover, never read',
    60.00,
    'like-new',
    'available',
    true
  );

-- Verify items created
SELECT id, title, price, status, seller_id FROM items 
WHERE seller_id = 'YOUR_USER_ID'
ORDER BY created_at DESC LIMIT 5;
```

---

## Testing Distance Filtering

### Test 1: Items appear at correct radius

**Setup:**
1. Open the app and go to Browse Items
2. Toggle **"All Nodes"** ON
3. Radius slider appears

**Test:**
1. Set radius to **5 miles** → You should see ONLY your local node's items
2. Set radius to **20 miles** → Still mostly local items
3. Set radius to **50+ miles** → Remote items appear! (from Little Falls, NJ)
4. Verify items show distance badge: **"~73 mi away"**

**Why 73 miles?**
- Norwalk, CT (06850) to Little Falls, NJ (07424) = ~73 miles

### Test 2: Arrow Buttons Work

**New Feature:**
- Click **+** button to increase radius by 1 mile
- Click **−** button to decrease radius by 1 mile
- Buttons disable at min (5 mi) and max (25 mi)

---

## Troubleshooting

### Items Still Not Showing

**Check 1: User assigned to correct node**
```sql
SELECT user_id, node_id FROM profiles WHERE user_id = 'YOUR_USER_ID';
-- Should show your LOCAL node first
```

**Check 2: Items exist in remote node**
```sql
SELECT COUNT(*) FROM items 
WHERE seller_id IN (
  SELECT user_id FROM profiles 
  WHERE node_id = '550e8400-e29b-41d4-a716-446655440002'
);
-- Should return > 0
```

**Check 3: Items have correct status**
```sql
SELECT title, status FROM items 
WHERE seller_id IN (
  SELECT user_id FROM profiles 
  WHERE node_id = '550e8400-e29b-41d4-a716-446655440002'
);
-- All should show status = 'available'
```

**Check 4: Distance calculation works**
```sql
SELECT calculate_node_distance(
  (SELECT id FROM geographic_nodes WHERE zip_code = '06850' LIMIT 1),
  '550e8400-e29b-41d4-a716-446655440002'
);
-- Should return ~73 (miles)
```

---

## QuickStart Copy-Paste Commands

### For Immediate Testing (Single Command)

Replace `YOUR_USER_ID` with your actual user ID, then run:

```sql
-- Step 1: Update your profile to test remote node
UPDATE profiles 
SET node_id = '550e8400-e29b-41d4-a716-446655440002' 
WHERE user_id = 'YOUR_USER_ID';

-- Step 2: Create test items
INSERT INTO items (seller_id, title, description, price, condition, status, accepts_swap_points)
VALUES
  ('YOUR_USER_ID', 'Nintendo Switch', 'Test item 1', 250, 'like-new', 'available', true),
  ('YOUR_USER_ID', 'LEGO Set', 'Test item 2', 85, 'like-new', 'available', true),
  ('YOUR_USER_ID', 'Soccer Cleats', 'Test item 3', 45, 'good', 'available', true);

-- Step 3: Verify
SELECT COUNT(*) FROM items WHERE seller_id = 'YOUR_USER_ID';
```

**WARNING:** This temporarily moves your profile to the remote node!

**To restore to local node:**
```sql
UPDATE profiles 
SET node_id = (SELECT id FROM geographic_nodes WHERE zip_code = '06850' LIMIT 1)
WHERE user_id = 'YOUR_USER_ID';
```

---

## Next Steps

1. ✅ Run the SQL setup above
2. ✅ Refresh the mobile app (or reload)
3. ✅ Toggle "All Nodes" → slider appears
4. ✅ Drag slider to 50+ miles → items appear
5. ✅ Click +/- buttons → radius updates smoothly
6. ✅ See "~73 mi away" distance badges

Done! 🎉
