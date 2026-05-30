# NODE-001 & NODE-002 Implementation - Setup & Testing Guide

**Module:** MODULE-03: Node Management  
**Tasks:** NODE-001 (Create Admin UI) + NODE-002 (Activation Toggle)  
**Status:** ✅ Ready for Testing  
**Date:** December 16, 2025

---

## 📋 Summary

**NODE-001:** Creates admin panel UI to add/edit geographic nodes with automatic ZIP code lookup.  
**NODE-002:** Implements node activation/deactivation toggle with confirmation dialogs and audit logging.

### Files Created/Modified

| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/20251216_create_geographic_nodes_table.sql` | Database schema with RLS policies | ✅ Created |
| `p2p-kids-admin/src/types/nodes.ts` | Node TypeScript interfaces | ✅ Created |
| `p2p-kids-admin/src/app/nodes/page.tsx` | Main nodes management page (NODE-001 + NODE-002) | ✅ Created |
| `p2p-kids-admin/src/app/nodes/NodeFormModal.tsx` | Create/edit node form modal (NODE-001) | ✅ Created |
| `p2p-kids-admin/src/app/nodes/__tests__/nodes.e2e.test.ts` | E2E tests | ✅ Created |
| `p2p-kids-admin/src/app/layout.tsx` | Navigation updated | ✅ Modified |

---

## 🚀 Pre-Implementation Setup

### Step 1: Apply Database Migration (REQUIRED - Must do before testing)

Run this SQL in Supabase console (Production dashboard):

```bash
# Option 1: Use Supabase CLI (if configured)
supabase migration up

# Option 2: Manual SQL execution in Supabase dashboard
# Copy contents of: supabase/migrations/20251216_create_geographic_nodes_table.sql
# Go to: Supabase Dashboard → SQL Editor → New Query
# Paste and execute
```

**What this does:**
- Creates `geographic_nodes` table with all required fields
- Sets up RLS policies for admin access
- Creates `admin_audit_log` table for action tracking
- Creates indexes for performance

**Verify Migration:**
```sql
-- Run in Supabase SQL Editor to verify
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_name IN ('geographic_nodes', 'admin_audit_log');
-- Should return: table_count = 2
```

### Step 2: Verify RLS Policies (IMPORTANT)

The migration assumes you have a `role_based_access_control` table with `admin` role defined.

**Check if table exists:**
```sql
SELECT * FROM role_based_access_control LIMIT 1;
```

**If table doesn't exist, create it:**
```sql
CREATE TABLE IF NOT EXISTS role_based_access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Grant your admin user the admin role
INSERT INTO role_based_access_control (user_id, role)
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT DO NOTHING;
```

**Find your user ID:**
```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

---

## 📦 Installation & Build

### Step 1: Install Dependencies

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm install
# or
yarn install
```

### Step 2: Verify Environment Variables

Check `.env.local` has these Supabase prod keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
SUPABASE_SERVICE_ROLE_KEY=<your-key>
```

### Step 3: TypeScript Type Check

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm run type-check
# or
yarn tsc --noEmit
```

Expected output: No errors for new files

### Step 4: Lint Check

```bash
npm run lint
# or
yarn lint
```

---

## 🧪 E2E Testing

### Option 1: Run All E2E Tests

```bash
# Install Playwright if not already installed
npm install -D @playwright/test

# Run tests
npm test -- nodes.e2e.test.ts

# Or with watch mode
npm test -- --watch nodes.e2e.test.ts
```

### Option 2: Run Tests in Headed Mode (Visual)

```bash
npx playwright test src/app/nodes/__tests__/nodes.e2e.test.ts --headed
```

### Option 3: Run Specific Test

```bash
npx playwright test -g "should create a new node successfully"
```

**Expected Test Results:**
- ✅ 16 tests total
- Stats cards display correctly
- Form validation works
- ZIP code lookup integrates
- Node creation/editing works
- Toggle activation/deactivation
- Audit logging on actions

---

## 🔍 Manual Testing Steps

### Pre-Flight Checklist

Before manual testing:

- [ ] Database migration executed successfully
- [ ] RLS policies applied
- [ ] Admin role assigned to your user
- [ ] `npm install` completed
- [ ] `npm run type-check` passes
- [ ] Admin app running: `npm run dev` in `p2p-kids-admin`

### Manual Test Flows

#### Test 1: Navigate to Nodes Page

**Steps:**
1. Go to `http://localhost:3001` (or your admin URL)
2. Click "Nodes" in navigation menu
3. Verify page loads without errors

**Expected Result:**
- ✅ Page title: "Geographic Nodes"
- ✅ Subtitle: "Manage trading areas and node assignments"
- ✅ Three stat cards visible: Total Nodes, Active Nodes, Total Members
- ✅ "+ Add Node" button visible
- ✅ Empty state if no nodes: "No nodes found"

---

#### Test 2: Create a Node (NODE-001)

**Steps:**
1. Click "+ Add Node" button
2. Modal opens with title "Add New Node"

**Fill Form:**
```
Node Name:        Norwalk Central
ZIP Code:         06850
(Wait 2 seconds for auto-lookup)
Radius:           10
Description:      Central Norwalk area for trading
Active:           Checked ✓
```

3. Click "Create Node" button
4. See alert: "Node created successfully!"
5. Modal closes
6. New node appears in table

**Expected Result:**
- ✅ Node Name: "Norwalk Central"
- ✅ Location: "Norwalk, CT"
- ✅ ZIP: "06850"
- ✅ Coordinates: Auto-populated (41.1177, -73.4079)
- ✅ Radius: 10 mi
- ✅ Members: 0
- ✅ Status: "Active" (green badge)
- ✅ Actions: "Edit" and "Deactivate" buttons

---

#### Test 3: Edit a Node (NODE-001)

**Steps:**
1. Click "Edit" on the node created above
2. Modal opens with title "Edit Node"
3. All fields pre-populated

**Modify:**
```
Radius: Change from 10 to 15
Description: Add more details
```

4. Click "Update Node" button
5. Alert: "Node updated successfully!"
6. Modal closes

**Verify in Table:**
- ✅ Radius now shows: "15 mi"
- ✅ Description updated in row

---

#### Test 4: Node Activation/Deactivation Toggle (NODE-002)

**Steps:**
1. Find "Norwalk Central" node
2. Click "Deactivate" button

**Confirmation Dialog:**
- Title/Text: "Are you sure you want to deactivate \"Norwalk Central\"?"
- Button: "OK" / "Cancel"

3. Click "OK" to confirm

**Expected Result:**
- ✅ Status changes to "Inactive" (gray badge)
- ✅ Button text changes to "Activate"
- ✅ Alert: "Node deactivated successfully!"
- ✅ Audit log entry created

**Database Verification:**
```sql
-- Check node status updated
SELECT id, name, is_active FROM geographic_nodes 
WHERE name = 'Norwalk Central';
-- Should show: is_active = false

-- Check audit log entry
SELECT * FROM admin_audit_log 
WHERE entity_type = 'geographic_node' 
AND action = 'deactivate_node'
ORDER BY created_at DESC LIMIT 1;
-- Should show action recorded
```

---

#### Test 5: Reactivate Node (NODE-002)

**Steps:**
1. Click "Activate" button on deactivated node
2. Confirm dialog
3. Click "OK"

**Expected Result:**
- ✅ Status changes to "Active" (green badge)
- ✅ Button changes to "Deactivate"
- ✅ Alert: "Node activated successfully!"

---

#### Test 6: Warning for Nodes with Members (NODE-002)

**Prerequisites:** Node must have `member_count > 0` (set manually in DB for testing)

**Steps:**
1. Update a node to have members:
```sql
UPDATE geographic_nodes 
SET member_count = 5 
WHERE name = 'Norwalk Central';
```

2. Reload page
3. Click "Deactivate" on node with members

**Expected Result:**
- ✅ Confirmation dialog includes warning:
  - "Warning: This node has 5 active members."
  - "They will remain assigned but new users cannot join this node."

---

#### Test 7: Form Validation (NODE-001)

**Steps:**
1. Click "+ Add Node"
2. Click "Create Node" without filling any fields

**Expected Validation Errors:**
- ✅ "Node name must be at least 2 characters"
- ✅ "City is required"
- ✅ "State must be 2-letter code (e.g., CT)"
- ✅ "ZIP code must be 5 digits"
- ✅ "Valid coordinates are required"
- ✅ "Radius must be between 1 and 100 miles"

**Fix & Retry:**
1. Enter invalid ZIP: "1234" (4 digits)
2. Try to submit
3. ✅ Error: "ZIP code must be 5 digits"

4. Enter invalid state: "Connecticut"
5. Try to submit
6. ✅ Error: "State must be 2-letter code"

---

#### Test 8: ZIP Code Auto-Lookup (NODE-001)

**Steps:**
1. Click "+ Add Node"
2. Enter ZIP: "07424" (Little Falls, NJ)
3. Wait 2 seconds

**Expected Result:**
- ✅ City: Auto-filled to "Little Falls"
- ✅ State: Auto-filled to "NJ"
- ✅ Latitude: Auto-filled (40.8522)
- ✅ Longitude: Auto-filled (-74.2247)

**Alternative (Manual Entry):**
1. If ZIP lookup fails, manually enter:
   - City: Little Falls
   - State: NJ
   - Latitude: 40.8522
   - Longitude: -74.2247

---

#### Test 9: Stats Cards Dynamic Updates (NODE-001)

**Steps:**
1. Note current stats:
   - Total Nodes: X
   - Active Nodes: Y
   - Total Members: Z

2. Add new node: "Test Node"
3. Refresh page

**Expected Result:**
- ✅ Total Nodes: X + 1
- ✅ Active Nodes: Y + 1 (if added as active)

**Steps (Continued):**
4. Deactivate "Test Node"
5. Refresh page

**Expected Result:**
- ✅ Total Nodes: Still X + 1
- ✅ Active Nodes: Back to Y
- ✅ Total Members: Unchanged (unless members added)

---

#### Test 10: Audit Log Entries

**Verify in Supabase:**

```sql
-- Check all node-related audit entries
SELECT 
  action,
  entity_type,
  entity_id,
  created_at,
  changes
FROM admin_audit_log
WHERE entity_type = 'geographic_node'
ORDER BY created_at DESC;
```

**Expected Entries:**
- `create_node` - When node created
- `update_node` - When node edited
- `deactivate_node` - When node deactivated
- `activate_node` - When node reactivated

---

## 🐛 Troubleshooting

### Issue: "Failed to load nodes: undefined"

**Causes:**
1. RLS policies blocking read access
2. `geographic_nodes` table doesn't exist
3. User not authenticated

**Solution:**
```bash
# Check table exists
# In Supabase SQL Editor:
SELECT * FROM geographic_nodes LIMIT 1;

# Check RLS policies enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'geographic_nodes';
-- Should show: rowsecurity = true

# Check admin role
SELECT * FROM role_based_access_control 
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);
```

---

### Issue: "ZIP lookup failed"

**Causes:**
1. Network issue with zippopotam.us API
2. Invalid ZIP code
3. API rate limited

**Solution:**
- Enter coordinates manually (user can edit lat/lng fields)
- Check internet connection
- Wait a minute and retry

---

### Issue: "Form not submitting"

**Causes:**
1. Validation errors present
2. Supabase client not initialized
3. Authentication issue

**Solution:**
```bash
# Check browser console for errors
# Press F12 → Console tab
# Look for any red error messages

# Verify environment variables in .env.local:
# NEXT_PUBLIC_SUPABASE_URL should be set
# NEXT_PUBLIC_SUPABASE_ANON_KEY should be set
```

---

### Issue: "Nodes not persisting after refresh"

**Causes:**
1. Migration not applied
2. RLS policies blocking INSERT
3. Supabase connection issue

**Solution:**
1. Verify migration executed (check migration logs in Supabase)
2. Check admin user has admin role
3. Test direct database insert:
```sql
INSERT INTO geographic_nodes (
  name, city, state, zip_code, latitude, longitude, radius_miles
) VALUES (
  'Test', 'Test City', 'TC', '12345', 40.0, -74.0, 10
);
```

---

## 📊 Verification Checklist

Use this checklist to verify both tasks are complete:

### NODE-001: Create Admin UI to Add/Edit Nodes

- [ ] Nodes list page created at `/nodes`
- [ ] Page displays all nodes from database
- [ ] Stats cards show dynamic totals:
  - [ ] Total Nodes count
  - [ ] Active Nodes count
  - [ ] Total Members sum
- [ ] Add Node button opens form modal
- [ ] Form has all required fields:
  - [ ] Node Name
  - [ ] ZIP Code
  - [ ] City
  - [ ] State
  - [ ] Latitude
  - [ ] Longitude
  - [ ] Search Radius
  - [ ] Description
  - [ ] Active checkbox
- [ ] ZIP code lookup populates city/state/coordinates
- [ ] Form validation works for all fields
- [ ] Can create new nodes
- [ ] Can edit existing nodes
- [ ] Admin actions logged to `admin_audit_log`
- [ ] Success/error messages display
- [ ] Loading states shown during operations

### NODE-002: Node Activation/Deactivation Toggle

- [ ] Toggle button appears in Actions column
- [ ] Deactivate button shown for active nodes
- [ ] Activate button shown for inactive nodes
- [ ] Confirmation dialog shown before toggle
- [ ] Warning message for nodes with members
- [ ] Status badge updates from Active → Inactive (and vice versa)
- [ ] Database `is_active` field updates
- [ ] Admin actions logged:
  - [ ] `deactivate_node` action recorded
  - [ ] `activate_node` action recorded
- [ ] Inactive nodes cannot accept new assignments (validated in NODE-003)
- [ ] Existing users remain assigned (not affected by deactivation)
- [ ] Nodes can be reactivated
- [ ] Error handling for failed toggles

### General

- [ ] No TypeScript errors: `npm run type-check`
- [ ] No lint errors: `npm run lint`
- [ ] E2E tests pass: `npm test -- nodes.e2e.test.ts`
- [ ] Navigation updated to include "Nodes" link
- [ ] All types defined in `types/nodes.ts`
- [ ] Database schema in place
- [ ] RLS policies configured

---

## 📝 Commands Reference

### Development

```bash
# Start admin app
cd p2p-kids-admin
npm run dev

# Visit admin panel
# http://localhost:3001

# Navigate to Nodes
# http://localhost:3001/nodes
```

### Testing

```bash
# Type check
npm run type-check

# Lint check
npm run lint

# E2E tests
npm test -- nodes.e2e.test.ts

# E2E tests headed mode (visual)
npx playwright test --headed src/app/nodes/__tests__/nodes.e2e.test.ts
```

### Database (Supabase)

```sql
-- Check tables
SELECT * FROM geographic_nodes;
SELECT * FROM admin_audit_log WHERE entity_type = 'geographic_node';

-- Reset data (for testing)
DELETE FROM geographic_nodes WHERE name LIKE 'Test%';
DELETE FROM admin_audit_log WHERE entity_type = 'geographic_node';
```

---

## ✅ Success Criteria

Both tasks complete when:

1. **NODE-001:**
   - ✅ Admin panel UI fully functional
   - ✅ Can add nodes with all fields
   - ✅ Can edit existing nodes
   - ✅ ZIP code lookup working
   - ✅ Stats cards display correctly
   - ✅ Admin actions logged

2. **NODE-002:**
   - ✅ Toggle buttons functional
   - ✅ Confirmation dialogs working
   - ✅ Status updates in DB
   - ✅ Audit logging working
   - ✅ Warnings display for nodes with members

3. **Overall:**
   - ✅ No TypeScript errors
   - ✅ No lint errors
   - ✅ E2E tests passing
   - ✅ All database migrations applied
   - ✅ RLS policies configured

---

## 🔗 Related Documentation

- Module: [MODULE-03-NODE-MANAGEMENT.md](../Prompts/MODULE-03-NODE-MANAGEMENT.md)
- Verification: [MODULE-03-Node Management VERIFICATION.md](../Prompts/MODULE-03-Node%20Management%20VERIFICATION.md)
- Next Task: NODE-003 (Automatic Node Assignment on Signup)

---

**Created:** December 16, 2025  
**Last Updated:** December 16, 2025
