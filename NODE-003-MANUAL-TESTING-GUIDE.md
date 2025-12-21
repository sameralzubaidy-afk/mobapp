---
title: NODE-003 Automatic Node Assignment - Navigation & Manual Testing Guide
module: MODULE-03-NODE-MANAGEMENT
task: NODE-003
created: 2025-01-17
---

# NODE-003: Automatic Node Assignment on Signup
## Navigation & Manual Testing Guide

---

## Quick Start

### What's New?
- Users entering ZIP codes during onboarding are automatically assigned to:
  - **Exact match** if an active node exists for that ZIP
  - **Nearest active node** if their ZIP is not yet active
- When assigned to a fallback node, users see a **waitlist popup** offering early access notifications

### Key Files Modified
| File | Purpose |
|------|---------|
| `supabase/migrations/006_resolve_active_node_and_waitlist.sql` | RPC functions + zip_waitlist table |
| `src/services/location.ts` | Node assignment logic (ZIP → coordinates → node) |
| `src/services/waitlist.ts` | Waitlist management (UPSERT, check, list) |
| `src/screens/onboarding/LocationPickerScreen.tsx` | UI: ZIP input + waitlist modal |
| `src/__tests__/services/location.test.ts` | Unit tests for assignment logic |
| `src/__tests__/e2e/signup-node-assignment.e2e.test.ts` | E2E flow tests |

---

## Prerequisites for Testing

### ✅ Before You Start

1. **Supabase Migration Applied**  
   This **MUST** be run in your Supabase prod project before testing:
   ```sql
   -- Run the full migration to add:
   -- - resolve_active_node_for_signup() RPC
   -- - zip_waitlist table + RLS
   -- - increment/decrement node member count RPCs
   ```
   **ACTION REQUIRED**: See "SQL Execution Steps" below

2. **Database Tables Verified**  
   Ensure in Supabase:
   - ✅ `geographic_nodes` table exists with `zip_code`, `is_active`, `latitude`, `longitude`
   - ✅ At least 2 seed nodes (Norwalk CT + Little Falls NJ) are active
   - ✅ PostGIS extension enabled (`CREATE EXTENSION postgis`)

3. **Environment Variables**  
   No new secrets needed - uses existing Supabase keys

---

## SQL Execution Steps
### ⚠️ MUST DO FIRST - Apply Migration in Supabase

1. **Log in to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard

2. **Open SQL Editor**
   - Select your project
   - Click "SQL Editor" in left menu

3. **Create New Query**
   - Click "+ New Query"

4. **Copy & Run Migration**
   ```sql
   -- Paste entire content from:
   -- supabase/migrations/006_resolve_active_node_and_waitlist.sql
   ```
   - Click "Run"
   - **Wait for success** (should say "Query succeeded")

5. **Verify Migration Applied**
   ```sql
   -- Run verification query
   SELECT 'zip_waitlist table' as check_name, COUNT(*) as rows FROM public.zip_waitlist;
   
   SELECT 'RPC exists' as check_name, proname FROM pg_proc 
   WHERE proname IN ('resolve_active_node_for_signup', 'increment_node_member_count', 'decrement_node_member_count');
   ```

---

## Manual Testing Flow

### Test Scenario 1: Exact ZIP Match (ZIP is Active)
**User enters ZIP with existing active node**

**Setup:**
- Precondition: Norwalk Central node exists and is_active = true

**Steps:**
1. Start app → Signup flow
2. Complete phone verification
3. Reach "LocationPickerScreen"
4. Enter ZIP: **06850** (Norwalk, CT)
   - Auto-populates: "Norwalk, CT"
5. Tap "Continue"

**Expected Outcome:**
- ✅ No popup appears
- ✅ User assigned to "Norwalk Central" node
- ✅ Navigates to NodeSelection screen
- ✅ user.node_id = node-norwalk (UUID)
- ✅ Analytics event: `node_assigned` with match_type='zip'

**Verify in DB:**
```sql
SELECT * FROM public.nodes WHERE zip_code = '06850' AND is_active = true;
-- Should show Norwalk Central with member_count incremented
```

---

### Test Scenario 2: Fallback to Nearest Node (ZIP is NOT Active)
**User enters ZIP without active node → assigned to nearest → shows waitlist popup**

**Setup:**
- Precondition: Deactivate one node OR use ZIP that has no active node
  ```sql
  -- Option A: Deactivate Norwalk temporarily for this test
  UPDATE public.nodes SET is_active = false WHERE name = 'Norwalk Central';
  ```

**Steps:**
1. Start app → Signup flow
2. Complete phone verification
3. Reach "LocationPickerScreen"
4. Enter ZIP: **06840** (Darien, CT - ~8 miles from Norwalk)
   - Auto-populates: "Darien, CT"
5. Tap "Continue"

**Expected Outcome:**
- ✅ **Popup appears** with title "We're Coming Soon! 🎉"
- ✅ Message mentions ZIP 06840 + fallback node name
- ✅ Shows 3 waitlist benefits (early access, rewards, founder pricing)
- ✅ Two buttons: "Join Waitlist" + "Continue Trading"

**Test Waitlist Join:**
1. In popup, tap "Join Waitlist"
2. Observe loading state

**Expected Outcome:**
- ✅ Popup closes
- ✅ Alert appears: "Waitlist Confirmed - Thank you!"
- ✅ Tap "Got it" → navigates to NodeSelection
- ✅ User is assigned to nearest active node

**Verify in DB:**
```sql
SELECT * FROM public.zip_waitlist WHERE requested_zip = '06840' AND user_id = <USER_ID>;
-- Should show: status='pending', requested_zip='06840', assigned_node_id=<nearest_node_id>

UPDATE public.nodes SET is_active = true WHERE name = 'Norwalk Central'; -- Re-enable
```

---

### Test Scenario 3: Skip Waitlist
**User skips waitlist and continues with assigned node**

**Setup:**
- Same as Scenario 2 (ZIP without active node)

**Steps:**
1. Enter ZIP that has no active node
2. Waitlist popup appears
3. Tap **"Continue Trading"** button

**Expected Outcome:**
- ✅ Popup closes immediately
- ✅ Navigates directly to NodeSelection (no alert)
- ✅ User assigned to nearest node
- ✅ Analytics event: `waitlist_skipped`

**Verify in DB:**
```sql
-- Waitlist entry should NOT be created
SELECT COUNT(*) FROM public.zip_waitlist 
WHERE user_id = <USER_ID> AND requested_zip = '06840';
-- Should return: 0
```

---

### Test Scenario 4: No Active Nodes Anywhere
**Edge case: System has no active nodes**

**Setup:**
```sql
-- Deactivate ALL nodes
UPDATE public.nodes SET is_active = false;
```

**Steps:**
1. Start signup flow
2. Enter any ZIP (e.g., 06850)
3. Tap "Continue"

**Expected Outcome:**
- ✅ **Error alert** appears:  
  "We are not currently active in your area. Please join the waitlist to be notified when we launch."
- ✅ User stays on LocationPickerScreen
- ✅ Can retry or go back

**Clean up:**
```sql
-- Re-enable nodes
UPDATE public.nodes SET is_active = true;
```

---

### Test Scenario 5: Invalid ZIP Code
**User enters invalid ZIP**

**Steps:**
1. Reach LocationPickerScreen
2. Try entering:
   - Less than 5 digits: "1234" → error "Please enter a valid 5-digit ZIP code"
   - Non-numeric: "ABCDE" → filtered by keyboard (number-pad)
   - Non-existent ZIP: "99999" → error "Invalid ZIP code or unable to lookup coordinates"
3. Tap "Continue"

**Expected Outcome:**
- ✅ Error alert shows appropriate message
- ✅ User stays on screen to retry

---

## Running Tests Locally

### Unit Tests: Location Service
```bash
cd p2p-kids-marketplace

# Run location tests
npm test -- src/__tests__/services/location.test.ts

# Run with coverage
npm test -- src/__tests__/services/location.test.ts --coverage
```

**Expected Output:**
```
PASS  src/__tests__/services/location.test.ts
  Location Service - NODE-003
    getZipCodeCoordinates
      ✓ should return coordinates for valid ZIP code
      ✓ should return null for invalid ZIP code (404)
      ✓ should return null if API returns no places
      ✓ should return null on fetch error
    assignNodeByZipCode
      ✓ should assign user to node with exact ZIP match
      ✓ should assign user to nearest node if requested ZIP not active
      ✓ should throw error if no active nodes exist
      ✓ should throw error if ZIP lookup fails
      ✓ should throw error if ZIP format invalid
      ✓ should log warning if distance >50 miles
      ✓ should handle RPC error
    checkZipCodeHasActiveNode
      ✓ should return true if active node exists for ZIP
      ✓ should return false if no active node for ZIP
      ✓ should return false on error

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### E2E Tests: Full Signup Flow
```bash
# Run E2E tests
npm test -- src/__tests__/e2e/signup-node-assignment.e2e.test.ts

# Run with verbose output
npm test -- src/__tests__/e2e/signup-node-assignment.e2e.test.ts --verbose
```

**Expected Output:**
```
PASS  src/__tests__/e2e/signup-node-assignment.e2e.test.ts
  E2E: Signup with Automatic Node Assignment - NODE-003
    Scenario 1: Exact ZIP Match
      ✓ should assign user to node with exact ZIP match
      ✓ should NOT show waitlist popup for exact ZIP match
    Scenario 2: Fallback to Nearest Node
      ✓ should assign user to nearest node if requested ZIP not active
      ✓ should show waitlist popup when assigned to nearest node
    Scenario 3: Waitlist Opt-In Flow
      ✓ should add user to zip_waitlist when opting in
      ✓ should handle duplicate waitlist entries (upsert)
      ✓ should check if user is on waitlist
    Scenario 4: No Active Nodes Anywhere
      ✓ should throw error if no active nodes exist
    Scenario 5: Full Signup Flow Integration
      ✓ should complete full flow: ZIP → assignment → node increment
      ✓ should complete full flow with waitlist: ZIP → assignment → waitlist → skip

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

### Lint & Type Check
```bash
# TypeScript type check
npm run type-check

# Lint
npm run lint

# Expected: No errors
```

---

## Debugging Tips

### Enable Debug Logging
The code uses `console.log` with emojis for debugging:
```
🗺️  ZIP coords: { zipCode: '06850', latitude: 41.1177, longitude: -73.4079 }
✅ Assigned to node: Norwalk Central (zip, exact mi)
📋 Adding to waitlist: { userId: '...', email: '...', requestedZip: '06840' }
⚠️  Node assignment distance warning: user >50 miles from assigned node
```

Open Chrome DevTools (or React Native Debugger) and check Console for these logs.

### Verify Node Assignment in Real-Time
```sql
-- Check which node user is assigned to
SELECT u.id, u.email, u.node_id, n.name, n.zip_code 
FROM public.users u
LEFT JOIN public.nodes n ON u.node_id = n.id
WHERE u.id = '<TEST_USER_ID>';

-- Check waitlist entries
SELECT * FROM public.zip_waitlist WHERE user_id = '<TEST_USER_ID>';

-- Check node member counts
SELECT id, name, zip_code, member_count, is_active 
FROM public.nodes 
ORDER BY created_at DESC;
```

### Check Analytics Events
If Firebase Analytics is set up, search for:
- `node_assigned` - User got assigned to a node
- `waitlist_opt_in` - User joined waitlist
- `waitlist_skipped` - User skipped waitlist
- `onboarding_location_set` - Location was set during onboarding

---

## Navigation Flow Diagram

```
┌─ Signup Screen
│
├─ Phone Verification
│
├─ Location Picker Screen (NEW - NODE-003)
│  │
│  ├─ User enters ZIP → Zippopotam API lookup
│  │
│  ├─ RPC: resolve_active_node_for_signup()
│  │  │
│  │  ├─ If ZIP has active node:
│  │  │  └─→ match_type = 'zip' → Go to NodeSelection (NO POPUP)
│  │  │
│  │  └─ If ZIP is NOT active:
│  │     └─→ match_type = 'nearest' → SHOW WAITLIST POPUP
│  │
│  ├─ Waitlist Popup (NEW - NODE-003)
│  │  │
│  │  ├─ User taps "Join Waitlist"
│  │  │  └─→ upsertZipWaitlist() → Go to NodeSelection
│  │  │
│  │  └─ User taps "Continue Trading"
│  │     └─→ Go to NodeSelection (no waitlist entry)
│  │
│  └─ Update user: zip_code, city, state, node_id
│
├─ Node Selection Screen
│
├─ Profile Completion Screen
│
└─ Onboarding Complete
```

---

## Common Issues & Solutions

### Issue: "No active nodes found in database"
**Problem:** RPC returns empty array (no active nodes exist)  
**Solution:** 
```sql
-- Verify nodes exist and are active
SELECT * FROM public.nodes WHERE is_active = true;

-- If empty, seed initial nodes (from NODE-001):
INSERT INTO public.nodes (name, city, state, zip_code, latitude, longitude, radius_miles, is_active)
VALUES 
  ('Norwalk Central', 'Norwalk', 'CT', '06850', 41.1177, -73.4079, 10, true),
  ('Little Falls', 'Little Falls', 'NJ', '07424', 40.8751, -74.2163, 10, true);
```

### Issue: Waitlist popup not appearing
**Problem:** Popup doesn't show when ZIP is not active  
**Cause:** Check LocationPickerScreen code - look for:
```tsx
if (result.matchType === 'nearest') {
  setShowWaitlistPopup(true);
}
```
**Solution:** Verify:
1. `assignNodeByZipCode()` returns `matchType: 'nearest'`
2. Modal `visible={showWaitlistPopup}` state is true

### Issue: RPC "resolve_active_node_for_signup" not found
**Problem:** `PGRST404: function not found`  
**Cause:** Migration not applied  
**Solution:** Run migration SQL (see "SQL Execution Steps" above)

### Issue: ZIP coordinates lookup fails (Zippopotam API)
**Problem:** `Invalid ZIP code or unable to lookup coordinates`  
**Cause:** API timeout or 404  
**Solution:**
1. Check ZIP is valid US ZIP
2. Try API directly: `https://api.zippopotam.us/us/06850`
3. If API down, implement fallback (manual lat/lng entry) - add TODO

---

## Verification Checklist

After running all tests & manual scenarios, confirm:

- [ ] Unit tests pass: `npm test -- src/__tests__/services/location.test.ts`
- [ ] E2E tests pass: `npm test -- src/__tests__/e2e/signup-node-assignment.e2e.test.ts`
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Migration applied in Supabase
- [ ] Manual Scenario 1 (Exact ZIP) works end-to-end
- [ ] Manual Scenario 2 (Fallback + Waitlist Popup) works end-to-end
- [ ] Manual Scenario 3 (Skip Waitlist) works end-to-end
- [ ] Manual Scenario 4 (No Active Nodes) error handling works
- [ ] Manual Scenario 5 (Invalid ZIP) validation works
- [ ] Waitlist data verified in DB (`zip_waitlist` table)
- [ ] Node member counts incremented correctly
- [ ] Analytics events tracked (Firebase)

---

## Next Steps After Verification

Once all tests & manual verification pass:

1. **Create Pull Request** with NODE-003 changes
2. **Request Code Review** - ensure RPC logic & RLS policies reviewed
3. **Merge to Main**
4. **Deploy to Staging** - run full regression tests
5. **Deploy to Production** - with monitoring on node assignment RPC

---

## Questions?

Refer to:
- `Prompts/MODULE-03-NODE-MANAGEMENT.md` - Implementation details
- `Prompts/MODULE-03-Node Management VERIFICATION.md` - Acceptance criteria
- `docx/SYSTEM_REQUIREMENTS_V2.md` - Node architecture
