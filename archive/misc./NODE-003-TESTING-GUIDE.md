# NODE-003 TESTING GUIDE

**Date:** December 17, 2025
**Feature:** Automatic Node Assignment on Signup with Inactive ZIP Handling
**Duration:** ~15 minutes per scenario

---

## Pre-Test Setup

### 1. Verify Database Migrations Applied

Check Supabase Studio SQL Editor:

```sql
-- Check 1: zip_waitlist table exists
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'zip_waitlist';

-- Check 2: RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'resolve_active_node_for_signup',
  'increment_node_member_count',
  'decrement_node_member_count'
);

-- Check 3: Geographic nodes exist
SELECT id, name, zip_code, is_active, member_count FROM public.nodes LIMIT 5;
```

**Expected Output:**
- ✅ zip_waitlist table exists
- ✅ All 3 RPC functions exist
- ✅ At least 1 node with `is_active = true`

---

### 2. Identify Test Nodes

Note the following from your database:

| ZIP | Node Name | is_active | Purpose |
|-----|-----------|-----------|---------|
| 06850 | Norwalk, CT | ✅ TRUE | Exact ZIP match test |
| 60131 | (or missing) | ❌ FALSE/NULL | Inactive ZIP test |
| (Any) | Nearest Active Node | ✅ TRUE | Fallback assignment |

---

## Test Scenario 1: Exact ZIP Match (Active Node)

### Scenario
User enters a ZIP code that **has an ACTIVE node**.

### Test Steps

1. **Start App**
   - Run: `cd p2p-kids-marketplace && npx expo start`
   - Load on iOS simulator or physical device

2. **Navigate to Signup**
   - Tap "Create Account" or similar
   - Complete phone signup flow
   - Reach **Location Picker Screen** ("Where are you located?")

3. **Enter Active ZIP**
   - Input: `06850` (or your active node ZIP)
   - ✅ City/State auto-populates (e.g., "Norwalk, CT")

4. **Click Continue**
   - Watch console logs in Expo

5. **Verify Expected Behavior**

   **Console Logs Should Show:**
   ```
   🔍 [NODE-003] Looking up node for zip code: 06850
   ✅ [NODE-003] Node assignment result: {
     nodeId: "...",
     nodeName: "Norwalk, CT",
     matchType: "zip",           ← EXACT MATCH
     distanceMiles: null         ← null for exact match
   }
   ✅ Node member count incremented: ...
   ```

   **UI Behavior:**
   - ✅ NO waitlist popup shown
   - ✅ Proceeds directly to **Node Selection** screen
   - ✅ Pre-selected node: "Norwalk, CT"

6. **Verify Database**
   ```sql
   -- Check user profile updated
   SELECT zip_code, node_id FROM public.profiles 
   WHERE user_id = '<test-user-id>';
   
   -- Check node member count incremented
   SELECT id, member_count FROM public.nodes WHERE zip_code = '06850';
   
   -- Check NO waitlist entry created
   SELECT COUNT(*) FROM public.zip_waitlist 
   WHERE requested_zip = '06850';  -- Should be 0
   ```

---

## Test Scenario 2A: Inactive ZIP with Waitlist Opt-In

### Scenario
User enters a ZIP code **WITHOUT an active node** and **JOINS waitlist**.

### Pre-Test
Ensure database has:
- Node with `zip_code = '60131'` and `is_active = false`
- OR: ZIP 60131 has no node at all
- At least one ACTIVE node elsewhere (e.g., Norwalk CT at 06850)

### Test Steps

1. **Navigate to Location Picker**
   - Complete signup flow again (new test user)
   - Reach **Location Picker Screen**

2. **Enter Inactive ZIP**
   - Input: `60131`
   - ✅ City/State auto-populates (e.g., "Chicago, IL")

3. **Click Continue**
   - Watch console and UI

4. **Verify Assignment Logic**

   **Console Logs Should Show:**
   ```
   🔍 [NODE-003] Looking up node for zip code: 60131
   🗺️ ZIP coords: { zipCode: "60131", latitude: 41.xxx, longitude: -87.xxx }
   ✅ [NODE-003] Node assignment result: {
     nodeId: "...",
     nodeName: "Norwalk CT Community",     ← FALLBACK NODE
     matchType: "nearest",                  ← NOT EXACT MATCH
     distanceMiles: 823.5                   ← Distance in miles
   }
   ⚠️ User assigned to fallback node - showing waitlist popup
   ```

5. **Waitlist Popup Appears**
   - ✅ Title: "We're Coming Soon! 🎉"
   - ✅ Message: "We're not quite active in 60131 yet..."
   - ✅ Shows assigned fallback node: "Norwalk CT Community"
   - ✅ Features list visible:
     - ✓ Early access to 60131
     - ✓ Exclusive launch-day rewards
     - ✓ Special founder pricing
   - ✅ Two buttons:
     - "Join Waitlist" (primary blue)
     - "Continue Trading" (secondary gray)

6. **Tap "Join Waitlist"**
   - Loading spinner appears
   - Console logs:
     ```
     📋 Adding to waitlist: { userId: "...", email: "...", requestedZip: "60131", ... }
     ✅ Waitlist entry: { wasNewEntry: true, id: "..." }
     ```

7. **Confirmation Alert Shown**
   - ✅ Title: "Waitlist Confirmed"
   - ✅ Message mentions:
     - "Thank you! We've added you to the waitlist for 60131"
     - "We'll notify you as soon as we launch"
     - "You can trade items in Norwalk CT Community"
   - Button: "Got it"

8. **Tap "Got it"**
   - ✅ Proceeds to **Node Selection Screen**
   - ✅ Fallback node pre-selected: "Norwalk CT Community"

9. **Verify Database**

   ```sql
   -- Check zip_waitlist entry created
   SELECT id, user_id, email, requested_zip, assigned_node_id, status 
   FROM public.zip_waitlist 
   WHERE requested_zip = '60131' 
   ORDER BY created_at DESC 
   LIMIT 1;
   
   -- Should show:
   -- - status = 'pending'
   -- - assigned_node_id = Norwalk CT node UUID
   ```

   **Analytics Event Fired:**
   - Event: `waitlist_opt_in`
   - Payload: `{ requested_zip: "60131", assigned_node_id: "...", was_new_entry: true }`

---

## Test Scenario 2B: Inactive ZIP with Waitlist Skip

### Scenario
User enters inactive ZIP but **SKIPS waitlist** (taps "Continue Trading").

### Pre-Test
Same as Scenario 2A

### Test Steps

1-5. **Same as Scenario 2A** (up to waitlist popup)

6. **Tap "Continue Trading"** (instead of "Join Waitlist")
   - ✅ Popup closes immediately
   - ✅ NO loading spinner
   - ✅ Proceeds directly to **Node Selection Screen**
   - ✅ Console logs:
     ```
     waitlist_skipped: { requested_zip: "60131", assigned_node_id: "..." }
     ```

7. **Verify Database**

   ```sql
   -- Check NO waitlist entry created for this user + ZIP
   SELECT COUNT(*) FROM public.zip_waitlist 
   WHERE requested_zip = '60131' AND user_id = '<test-user-id>';
   -- Should be 0
   
   -- Check profile still updated with fallback node
   SELECT zip_code, node_id FROM public.profiles 
   WHERE user_id = '<test-user-id>';
   ```

   **Analytics Event Fired:**
   - Event: `waitlist_skipped`
   - Payload: `{ requested_zip: "60131", assigned_node_id: "..." }`

---

## Test Scenario 3: No Active Nodes

### Scenario
All nodes have `is_active = false` (or no nodes exist).

### Pre-Test

```sql
-- Temporarily disable all nodes (careful in prod!)
UPDATE public.nodes SET is_active = false;
```

### Test Steps

1-3. **Same as Scenarios 1-2** (enter any ZIP, click Continue)

4. **Error Alert Shown**
   - ✅ Title: "Error"
   - ✅ Message: "We are not currently active in your area yet. Would you like to join our waitlist?"
   - Button: "OK"

5. **Tap "OK"**
   - Alert closes
   - User returns to Location Picker
   - Can retry with different ZIP

6. **Clean Up Database**

   ```sql
   -- Re-enable nodes
   UPDATE public.nodes SET is_active = true;
   ```

---

## Test Scenario 4: Invalid ZIP Input

### Scenario
User enters invalid ZIP format.

### Test Steps

1. **Navigate to Location Picker**
2. **Try Invalid Entries**

   | Input | Expected | Result |
   |-------|----------|--------|
   | `123` | Error | ✅ "Must be 5 digits" |
   | `ABCDE` | Error | ✅ "Must be 5 digits" |
   | `00000` | Lookup | API tries lookup |
   | (blank) | Disabled | ✅ Button disabled until 5 digits |

3. **For Valid-Format Invalid-ZIP** (e.g., `00000`):
   - Zippopotam API returns not found
   - Error alert: "Invalid ZIP code or unable to lookup coordinates..."
   - User can retry

---

## Test Scenario 5: Duplicate Waitlist Entry

### Scenario
User joins waitlist for a ZIP, then signs up again and requests same ZIP.

### Pre-Test
- Complete Scenario 2A successfully (user on waitlist for 60131)

### Test Steps

1. **Create Second Test User**
2. **Reach Location Picker**
3. **Enter Same ZIP: `60131`**
4. **Join Waitlist Again**

5. **Verify Idempotent Behavior**
   ```sql
   -- Check only ONE entry for user + ZIP combo
   SELECT COUNT(*) FROM public.zip_waitlist 
   WHERE user_id = '<test-user-id>' AND requested_zip = '60131';
   -- Should be 1 (not 2)
   
   -- Check status and timestamps
   SELECT id, status, created_at, updated_at FROM public.zip_waitlist 
   WHERE user_id = '<test-user-id>' AND requested_zip = '60131';
   ```

   **Expected:**
   - ✅ UPSERT updated existing row (not inserted new)
   - ✅ `updated_at` timestamp is newer
   - ✅ `created_at` is original

---

## Analytics Validation

### In Firebase Console or Terminal

```bash
# Check analytics events (if using test device)
# Filter for:
# - onboarding_location_set (all scenarios)
# - waitlist_opt_in (scenario 2A)
# - waitlist_skipped (scenario 2B)
# - node_assigned (all scenarios)
```

**Expected Events:**

| Scenario | Events | User Count |
|----------|--------|-----------|
| 1 (Exact ZIP) | `onboarding_location_set` + `node_assigned` | 1 |
| 2A (Inactive + Join) | + `waitlist_opt_in` | +1 |
| 2B (Inactive + Skip) | + `waitlist_skipped` | +1 |
| 3 (No Nodes) | Error (no event) | 0 |
| 4 (Invalid) | Error (no event) | 0 |
| 5 (Duplicate) | Same as 2A | +1 |

---

## Troubleshooting

### Issue: Waitlist Popup Not Showing

**Checklist:**
- [ ] Migration applied? Check `zip_waitlist` table exists
- [ ] RPC exists? Check `resolve_active_node_for_signup` RPC
- [ ] LocationPickerScreen updated? Check import has `incrementNodeMemberCount`
- [ ] ZIP is actually inactive? Check `nodes` table: `WHERE zip_code='60131' AND is_active=true` should return 0 rows
- [ ] Fallback node exists and is active? Check any node with `is_active=true`

**Fix:**
```typescript
// In LocationPickerScreen console.log for debugging:
console.log('matchType:', result.matchType);  // Should be 'nearest' for popup
console.log('showWaitlistPopup:', result.matchType === 'nearest');
```

### Issue: Member Count Not Incrementing

**Checklist:**
- [ ] `incrementNodeMemberCount()` called in LocationPickerScreen?
- [ ] After profile update, before checking? (timing)
- [ ] RPC function exists? Test in SQL:
  ```sql
  SELECT public.increment_node_member_count('node-uuid'::uuid);
  ```

### Issue: Waitlist Entry Not Created

**Checklist:**
- [ ] `upsertZipWaitlist()` called?
- [ ] User ID and email available?
- [ ] RLS policies allow INSERT? (test with different users)
  ```sql
  SELECT * FROM public.zip_waitlist LIMIT 1;  -- Can you see it?
  ```

### Issue: TypeScript Errors

**Expected (ignore):**
- `Property does not exist on type 'never'` for `.rpc()` calls
  - Reason: Supabase client doesn't have types for custom RPCs
  - Fix: Add `@ts-ignore` if blocking

**Unexpected:**
- Any actual syntax errors in `.tsx` files
- Run: `npx eslint src/screens/onboarding/LocationPickerScreen.tsx`

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Exact ZIP match → no popup | ✅ |
| Inactive ZIP → popup shown | ✅ |
| Join waitlist → entry created | ✅ |
| Skip waitlist → no entry | ✅ |
| Analytics events fired | ✅ |
| Member count incremented | ✅ |
| Node assignment persisted | ✅ |
| RLS policies working | ✅ |
| Error handling for invalid ZIP | ✅ |
| Error handling for no nodes | ✅ |

---

## Sign-Off

**Tester:** ________________  
**Date:** ________________  
**All Tests Passed:** ☐ YES ☐ NO  
**Issues Found:** ___________________________________________________

