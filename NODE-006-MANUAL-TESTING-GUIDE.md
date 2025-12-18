# NODE-006: Manual Testing Guide

## Prerequisites

Before you can test NODE-006, you need to:

### 1. Run the Database Migration (REQUIRED)

**In Supabase SQL Editor:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy the entire contents of `supabase/migrations/20251217000002_create_items_table_node_filtering.sql`
6. Paste into the editor
7. Click "Run" or press Cmd+Enter

**Expected Output:**
- Tables created: `items`, `categories`, `item_images`
- Function created: `get_nodes_within_radius()`
- View created: `items_with_node_info`
- 8 categories seeded
- RLS policies enabled

### 2. Verify Nodes Exist

**In Supabase Table Editor:**

1. Go to Table Editor → `geographic_nodes`
2. Verify you have at least 2 active nodes:
   - Norwalk Central (Norwalk, CT, ZIP: 06850)
   - Little Falls (Little Falls, NJ, ZIP: 07424)

If not, run `supabase/migrations/20251217000001_seed_initial_nodes.sql`

### 3. Create Test Items

**In Supabase SQL Editor:**

```sql
-- Get a test user ID (replace with your actual user ID)
SELECT id, email FROM auth.users LIMIT 5;

-- Create test item in Norwalk node
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
SELECT 
  (SELECT id FROM auth.users WHERE email = 'your-test-user@example.com'),
  'Lego Star Wars Set',
  'Barely used, complete set with all pieces and instructions',
  25.99,
  (SELECT id FROM categories WHERE name = 'Toys'),
  'like_new',
  'available',
  true;

-- Create another test item
INSERT INTO items (
  seller_id,
  title,
  description,
  price,
  category_id,
  condition,
  status
) 
SELECT 
  (SELECT id FROM auth.users WHERE email = 'another-user@example.com'),
  'Nintendo Switch Game',
  'Pokemon Sword - great condition',
  35.00,
  (SELECT id FROM categories WHERE name = 'Games'),
  'good',
  'available';
```

### 4. Ensure User is Assigned to a Node

**In Supabase Table Editor:**

1. Go to Table Editor → `profiles`
2. Find your test user
3. Verify `node_id` is set (should be Norwalk or Little Falls UUID)
4. If not set, run signup flow or manually update:

```sql
UPDATE profiles 
SET node_id = (SELECT id FROM geographic_nodes WHERE name = 'Norwalk Central')
WHERE user_id = 'your-user-id-here';
```

---

## Manual Test Steps

### Test 1: Basic Item Browsing

1. **Start the app:**
   ```bash
   cd p2p-kids-marketplace
   npm start
   ```

2. **Navigate to Browse Items screen**
   - Currently needs to be added to navigation
   - Direct import for testing: Open BrowseItemsScreen.tsx

3. **Expected Results:**
   - ✅ Screen loads without errors
   - ✅ Header shows "Browse Items"
   - ✅ Subtitle shows "My Node: [Your Node Name]"
   - ✅ Filter info shows "Items from [City], [State]"
   - ✅ Toggle switch shows "Local" label

### Test 2: Node-Specific Filtering (Default)

1. **With toggle set to "My Node" (default):**
   - View the items list

2. **Expected Results:**
   - ✅ Only items from your assigned node are shown
   - ✅ Each item shows node name: "📍 [Node Name]"
   - ✅ NO "Other Node" badges visible
   - ✅ If no items in your node → Empty state message

### Test 3: Cross-Node Filtering

1. **Toggle "Show All Nodes" switch ON:**
   - Flip the switch to enable all nodes

2. **Expected Results:**
   - ✅ Header updates to "All Nodes"
   - ✅ Subtitle changes to "Items from all communities"
   - ✅ Items from ALL nodes are shown
   - ✅ Items from other nodes show "Other Node" badge (yellow background)
   - ✅ Your node items still show node name but NO badge

### Test 4: Empty State

1. **Scenario A - No items in your node:**
   - Toggle OFF (My Node only)
   - If your node has no items

2. **Expected Results:**
   - ✅ Empty state icon: 📦
   - ✅ Title: "No items in your node yet"
   - ✅ Text: "Try toggling 'Show All Nodes' to see items from nearby communities"

3. **Scenario B - No items anywhere:**
   - Toggle ON (All Nodes)
   - If no items exist in database

4. **Expected Results:**
   - ✅ Empty state icon: 📦
   - ✅ Title: "No items available"
   - ✅ Text: "Be the first to list an item!"

### Test 5: Item Display

1. **Check each item card displays:**
   - ✅ Item image (or placeholder 📦 if no image)
   - ✅ Item title (2 lines max)
   - ✅ Price (formatted as $XX.XX)
   - ✅ Node location: "📍 [Node Name]"
   - ✅ "Other Node" badge (if from different node and toggle ON)
   - ✅ "⚡ SP Eligible" badge (if accepts_swap_points = true)

### Test 6: Pull to Refresh

1. **Pull down on the items list:**
   - Drag screen down from top

2. **Expected Results:**
   - ✅ Spinner shows while refreshing
   - ✅ Items reload
   - ✅ Current toggle state preserved (Local or All Nodes)

### Test 7: Toggle Persistence

1. **Toggle to "All Nodes"**
2. **Scroll through items**
3. **Toggle back to "Local"**

4. **Expected Results:**
   - ✅ Toggle switches smoothly
   - ✅ Items reload each time
   - ✅ Filter applies correctly each time
   - ✅ No crashes or errors

---

## Troubleshooting

### "No items shown" even when items exist

**Check:**
1. User's `node_id` is set in `profiles` table
2. Items exist with sellers who have `node_id` set
3. Item `status` = 'available'
4. Check console logs for errors

**Fix:**
```sql
-- Verify user node assignment
SELECT p.user_id, p.name, p.node_id, gn.name as node_name
FROM profiles p
LEFT JOIN geographic_nodes gn ON p.node_id = gn.id
WHERE p.user_id = 'your-user-id';

-- Verify item sellers have nodes
SELECT i.id, i.title, p.name as seller, gn.name as node
FROM items i
JOIN profiles p ON i.seller_id = p.user_id
LEFT JOIN geographic_nodes gn ON p.node_id = gn.id
WHERE i.status = 'available';
```

### "TypeError: Cannot read property 'node' of undefined"

**Cause:** User store not populated with node data

**Fix:** Ensure user profile is fetched with node data:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select(`
    *,
    node:geographic_nodes(*)
  `)
  .eq('user_id', user.id)
  .single();
```

### Toggle doesn't change items

**Check:**
1. `showAllNodes` state is updating
2. `loadItems()` is called in `useEffect` with `showAllNodes` dependency
3. No JavaScript errors in console

### Database Error: "relation 'items' does not exist"

**Fix:** Run the migration first! See Prerequisites section.

---

## Expected Console Logs

When everything works correctly, you should see:

```
🔍 Loading items with filters: { node_id: 'uuid...', include_all_nodes: false }
✅ Loaded 5 items
```

When toggling to All Nodes:

```
🔍 Loading items with filters: { node_id: 'uuid...', include_all_nodes: true }
✅ Loaded 12 items
```

---

## Success Criteria

- [ ] Migration ran successfully
- [ ] Test items created
- [ ] BrowseItemsScreen loads without errors
- [ ] Items filtered by node by default
- [ ] Toggle switches between local and all nodes
- [ ] "Other Node" badge appears on cross-node items
- [ ] Empty states show appropriate messages
- [ ] SP Eligible badge shows for eligible items
- [ ] Pull-to-refresh works
- [ ] No console errors

---

## Next Steps After Manual Testing

1. Add BrowseItemsScreen to app navigation
2. Create item details screen (MODULE-04)
3. Add item creation flow (MODULE-04)
4. Test with multiple users across different nodes
5. Verify analytics events are tracked
