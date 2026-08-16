# NODE-001 & NODE-002 Verification Checklist

**Status:** ✅ IMPLEMENTATION COMPLETE  
**Ready for Testing:** YES  
**Estimated Testing Time:** 1-2 hours  
**Target Completion Date:** December 16, 2025

---

## 📋 Pre-Testing Verification

### Step 1: Database Migration (CRITICAL - DO FIRST)

**Action Required:** Apply SQL migration in Supabase

```bash
# Go to Supabase Dashboard → SQL Editor
# Copy and paste SQL from:
# File: supabase/migrations/20251216_create_geographic_nodes_table.sql
# Execute in Supabase production
```

**After executing, verify:**
```sql
-- Check tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('geographic_nodes', 'admin_audit_log');
-- Expected: 2

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('geographic_nodes', 'admin_audit_log');
-- Expected: Both should have rowsecurity = true
```

### Step 2: Admin Role Setup

```sql
-- Check if admin role exists for your user
SELECT user_id, role FROM role_based_access_control 
WHERE role = 'admin' LIMIT 1;

-- If not found, add admin role:
-- First, find your user ID:
SELECT id, email FROM auth.users WHERE email = 'your.email@example.com';

-- Then insert admin role:
INSERT INTO role_based_access_control (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'admin')
ON CONFLICT DO NOTHING;
```

### Step 3: Build Verification

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Install dependencies
npm install

# Type check (should pass)
npm run type-check

# Lint check (should pass)
npm run lint

# Expected: No errors
```

### Step 4: Start Development Server

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run dev

# Navigate to: http://localhost:3001/nodes
# Page should load without errors
```

---

## 🎯 Files to Verify

| File | Must Exist | Size | Purpose |
|------|-----------|------|---------|
| `supabase/migrations/20251216_create_geographic_nodes_table.sql` | ✅ | 56 lines | DB schema |
| `p2p-kids-admin/src/types/nodes.ts` | ✅ | 48 lines | TypeScript types |
| `p2p-kids-admin/src/app/nodes/page.tsx` | ✅ | 254 lines | Main UI + NODE-002 toggle |
| `p2p-kids-admin/src/app/nodes/NodeFormModal.tsx` | ✅ | 298 lines | Add/edit form |
| `p2p-kids-admin/src/app/nodes/__tests__/nodes.e2e.test.ts` | ✅ | 307 lines | E2E tests |
| Navigation link in `layout.tsx` | ✅ | Updated | Menu link |

---

## ✅ NODE-001 Verification Items

### Feature: Nodes List Page
- [ ] Page loads at `/nodes` without errors
- [ ] Title: "Geographic Nodes"
- [ ] Subtitle: "Manage trading areas and node assignments"
- [ ] "+ Add Node" button visible and clickable

### Feature: Stats Cards
- [ ] **Total Nodes** card displays
  - [ ] Label: "Total Nodes"
  - [ ] Shows count (number)
  - [ ] Is dynamic (count = table rows)
- [ ] **Active Nodes** card displays
  - [ ] Label: "Active Nodes"
  - [ ] Shows count of active nodes only
  - [ ] Green colored
- [ ] **Total Members** card displays
  - [ ] Label: "Total Members"
  - [ ] Shows sum of all member counts
  - [ ] Blue colored

### Feature: Nodes Table
- [ ] Table has all columns: Name, Location, Coordinates, Radius, Members, Status, Actions
- [ ] Displays existing nodes (if any)
- [ ] Empty state message if no nodes
- [ ] Responsive (works on mobile)
- [ ] Hover effects on rows

### Feature: Add Node Form Modal
- [ ] Modal opens when clicking "+ Add Node"
- [ ] Title: "Add New Node"
- [ ] All form fields visible:
  - [ ] Node Name (text input)
  - [ ] ZIP Code (text input)
  - [ ] City (text input)
  - [ ] State (text input, 2 char max)
  - [ ] Latitude (number input)
  - [ ] Longitude (number input)
  - [ ] Search Radius (number input)
  - [ ] Description (textarea)
  - [ ] Active checkbox

### Feature: ZIP Code Lookup
- [ ] ZIP code field accepts input
- [ ] After entering 5-digit ZIP (e.g., 06850):
  - [ ] Shows "Looking up ZIP code..." message
  - [ ] Waits ~2 seconds
  - [ ] Auto-populates City field
  - [ ] Auto-populates State field
  - [ ] Auto-populates Latitude field
  - [ ] Auto-populates Longitude field
- [ ] Manual entry possible if lookup fails
- [ ] Does NOT lookup if less than 5 digits

### Feature: Form Validation
Test by clicking "Create Node" with invalid data:
- [ ] Missing name → Error: "Node name must be at least 2 characters"
- [ ] Missing city → Error: "City is required"
- [ ] Invalid state → Error: "State must be 2-letter code"
- [ ] Invalid ZIP → Error: "ZIP code must be 5 digits"
- [ ] Zero coordinates → Error: "Valid coordinates are required"
- [ ] Invalid radius → Error: "Radius must be between 1 and 100 miles"

### Feature: Create Node
- [ ] Can enter valid node data
- [ ] Click "Create Node" button
- [ ] Alert appears: "Node created successfully!"
- [ ] Modal closes
- [ ] New node appears in table
- [ ] Node persists after page reload

### Feature: Edit Node
- [ ] Click "Edit" button on existing node
- [ ] Modal title changes to: "Edit Node"
- [ ] All fields pre-populated with node data
- [ ] Can modify any field
- [ ] Click "Update Node"
- [ ] Alert appears: "Node updated successfully!"
- [ ] Changes persist in table

### Feature: Audit Logging
```sql
-- In Supabase SQL Editor:
SELECT * FROM admin_audit_log 
WHERE entity_type = 'geographic_node'
ORDER BY created_at DESC LIMIT 5;

-- Should see entries for:
-- - action: 'create_node' (when created)
-- - action: 'update_node' (when edited)
-- With changes recorded in JSONB
```

---

## ✅ NODE-002 Verification Items

### Feature: Activation Toggle Buttons
- [ ] Active nodes show "Deactivate" button (red text)
- [ ] Inactive nodes show "Activate" button (green text)
- [ ] Buttons in Actions column
- [ ] Buttons disabled during update (show "Updating...")

### Feature: Confirmation Dialog
Test activation toggle:
- [ ] Click "Deactivate" on active node
- [ ] Dialog appears: "Are you sure you want to deactivate \"[node name]\"?"
- [ ] Dialog has OK and Cancel buttons
- [ ] Clicking Cancel dismisses dialog without changes
- [ ] Clicking OK proceeds with toggle

### Feature: Member Warning
Test with node that has members:
```sql
-- In Supabase, set a node's member count:
UPDATE geographic_nodes SET member_count = 5 
WHERE name = '[your test node]';
-- Reload page
```

- [ ] Click "Deactivate" on node with members
- [ ] Dialog shows warning: "Warning: This node has 5 active members"
- [ ] Dialog explains: "They will remain assigned but new users cannot join"

### Feature: Status Updates
- [ ] Active node → Deactivate → Status changes to "Inactive" (gray badge)
- [ ] Inactive node → Activate → Status changes to "Active" (green badge)
- [ ] Status persists after page reload
- [ ] Alert shows success message

### Feature: Audit Logging
```sql
-- Check deactivation logged:
SELECT action, entity_id, changes FROM admin_audit_log 
WHERE action IN ('deactivate_node', 'activate_node')
ORDER BY created_at DESC LIMIT 2;

-- Should show both actions with node details
```

### Feature: Database Updates
```sql
-- Check is_active field updated:
SELECT id, name, is_active FROM geographic_nodes;
-- is_active should be true/false based on toggle state

-- Check updated_at timestamp:
SELECT name, is_active, updated_at FROM geographic_nodes 
WHERE name = '[your test node]'
ORDER BY updated_at DESC;
```

---

## 🧪 E2E Testing

### Run Full Test Suite

```bash
# Install test dependencies if not done
npm install -D @playwright/test

# Run all NODE tests
npm test -- nodes.e2e.test.ts

# Or run specific test
npm test -- -g "should create a new node successfully"

# Run with visual output (headed mode)
npx playwright test --headed src/app/nodes/__tests__/nodes.e2e.test.ts
```

### Expected Test Results
- ✅ 16-18 tests total
- ✅ All tests should PASS
- ✅ No timeouts
- ✅ No element not found errors

### If Tests Fail
1. Check admin app is running: `npm run dev`
2. Check database migration applied
3. Check RLS policies enabled
4. Check admin user has admin role
5. Check environment variables set

---

## 📊 Stats Card Verification

### Test Dynamic Counts

1. **Note initial stats:**
   - Total Nodes: ___ (count)
   - Active Nodes: ___ (count)
   - Total Members: ___ (sum)

2. **Create new active node:**
   - Click "+ Add Node"
   - Fill: Name="Test Node", ZIP="06850", Radius=10, Active=✓
   - Click "Create Node"
   - Reload page

3. **Expected:** 
   - Total Nodes: increased by 1
   - Active Nodes: increased by 1
   - Total Members: unchanged (new node has 0 members)

4. **Deactivate the test node:**
   - Click "Deactivate" on "Test Node"
   - Confirm dialog
   - Reload page

5. **Expected:**
   - Total Nodes: still increased by 1 (count doesn't change)
   - Active Nodes: back to original count
   - Total Members: unchanged

6. **Clean up:**
   ```sql
   DELETE FROM geographic_nodes WHERE name = 'Test Node';
   ```

---

## 🔍 Database Verification Queries

Run these in Supabase SQL Editor to verify data integrity:

### Check Tables Exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('geographic_nodes', 'admin_audit_log')
ORDER BY table_name;
```

### Check Nodes Created
```sql
SELECT id, name, city, state, is_active, member_count 
FROM geographic_nodes
ORDER BY created_at DESC;
```

### Check Audit Log Entries
```sql
SELECT 
  created_at,
  admin_id,
  action,
  entity_type,
  changes
FROM admin_audit_log
WHERE entity_type = 'geographic_node'
ORDER BY created_at DESC
LIMIT 10;
```

### Check RLS Policies
```sql
SELECT tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('geographic_nodes', 'admin_audit_log')
ORDER BY tablename, policyname;
```

### Verify Constraints
```sql
SELECT constraint_name, table_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('geographic_nodes', 'admin_audit_log')
ORDER BY table_name;
```

---

## 🚨 Common Issues & Solutions

### Issue: Page shows "Loading nodes..." forever

**Solution:**
1. Check database migration executed
2. Check RLS policies enabled
3. Check admin user has admin role
4. Check Supabase connection in browser DevTools (F12 → Network)

### Issue: "Failed to load nodes" error

**Solution:**
```bash
# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'geographic_nodes';

# If no policies, re-run migration
# If policies exist, verify admin role:
SELECT * FROM role_based_access_control 
WHERE user_id = (SELECT auth.uid());
```

### Issue: ZIP lookup not working

**Solution:**
1. Check internet connection
2. Check browser DevTools (F12 → Network) for failed requests
3. Check if zippopotam.us API is accessible
4. Enter coordinates manually as fallback
5. Try different ZIP code (e.g., 06850, 07424)

### Issue: Form not submitting

**Solution:**
1. Check browser console (F12 → Console) for errors
2. Verify all required fields filled
3. Check Supabase connection
4. Try refreshing page and retry

### Issue: Toggle not working

**Solution:**
1. Check browser console for errors
2. Verify admin role assigned
3. Check RLS policy allows UPDATE
4. Check admin_audit_log table exists

---

## 📝 Manual Test Scenarios

### Scenario 1: Complete User Flow (15 min)
1. Navigate to `/nodes` ✅
2. Create node "Norwalk Central" with ZIP 06850 ✅
3. Verify stats updated ✅
4. Edit node, change radius to 15 ✅
5. Verify change persisted ✅
6. Deactivate node ✅
7. Verify status changed ✅
8. Reactivate node ✅
9. Verify status changed back ✅

### Scenario 2: Validation Testing (10 min)
1. Click "+ Add Node"
2. Try invalid inputs for each field
3. Verify error messages appear
4. Fix each error one by one
5. Successfully submit form

### Scenario 3: Multiple Nodes (10 min)
1. Create 3 different nodes
2. Verify stats sum correctly
3. Verify table displays all
4. Deactivate middle node
5. Verify stats updated
6. Reactivate node
7. Verify all still there

### Scenario 4: Audit Trail (5 min)
1. Create node
2. Edit node
3. Deactivate node
4. Check admin_audit_log table
5. Verify all 3 actions logged

---

## ✅ Final Sign-Off Checklist

Before marking complete:

- [ ] Database migration applied ✓
- [ ] Admin role configured ✓
- [ ] App builds without errors ✓
- [ ] No TypeScript errors ✓
- [ ] No lint errors ✓
- [ ] E2E tests passing ✓
- [ ] Nodes page loads ✓
- [ ] Stats cards display ✓
- [ ] Can create nodes ✓
- [ ] Can edit nodes ✓
- [ ] ZIP lookup works ✓
- [ ] Can toggle activation ✓
- [ ] Audit logging works ✓
- [ ] Confirmation dialogs show ✓
- [ ] Member warnings display ✓
- [ ] Changes persist ✓
- [ ] Navigation link works ✓
- [ ] All manual tests pass ✓

---

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| [NODE-001-002-SETUP-AND-TESTING.md](NODE-001-002-SETUP-AND-TESTING.md) | Complete setup and step-by-step testing guide |
| [NODE-001-002-IMPLEMENTATION-SUMMARY.md](NODE-001-002-IMPLEMENTATION-SUMMARY.md) | Technical summary of implementation |
| [Prompts/MODULE-03-NODE-MANAGEMENT.md](Prompts/MODULE-03-NODE-MANAGEMENT.md) | Original task requirements |
| [Prompts/MODULE-03-Node Management VERIFICATION.md](Prompts/MODULE-03-Node%20Management%20VERIFICATION.md) | Module verification checklist |

---

## 🎉 Success Criteria

✅ **Both NODE-001 and NODE-002 are COMPLETE when:**

1. ✅ Admin UI fully functional
2. ✅ Stats cards update dynamically
3. ✅ Nodes can be added/edited
4. ✅ ZIP code lookup works
5. ✅ Nodes can be activated/deactivated
6. ✅ Confirmation dialogs work
7. ✅ Member warnings display
8. ✅ Audit logging functional
9. ✅ E2E tests passing
10. ✅ Manual testing complete
11. ✅ No errors in console
12. ✅ Data persists

---

**Checklist Created:** December 16, 2025  
**Implementation Status:** ✅ COMPLETE  
**Ready for Testing:** YES  
**Estimated Testing Duration:** 1-2 hours
