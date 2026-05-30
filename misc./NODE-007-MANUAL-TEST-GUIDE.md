# NODE-007: Distance Radius Filter - Manual Testing Guide

**Module:** MODULE-03 Node Management  
**Task:** NODE-007 - Distance Radius Filter  
**Date:** December 17, 2025  
**Tester:** (Your name)

---

## Prerequisites

Before starting manual testing, ensure:

- [ ] You have **Supabase prod access** (not local)
- [ ] At least **2 test users** created in different nodes:
  - User A in Norwalk, CT (node: 06850)
  - User B in Little Falls, NJ (node: 07424)
- [ ] Admin access to configure radius settings
- [ ] Mobile app installed on simulator or device
- [ ] Network connectivity confirmed

---

## Database Setup (Required Before Testing)

### Step 1: Apply Migration
Run the SQL migration in Supabase:

```sql
-- In Supabase SQL Editor, run:
-- supabase/migrations/20251217000003_user_preferences_and_distance_NODE007.sql
```

**Verify migration succeeded:**
```sql
-- Check user_preferences table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'user_preferences';

-- Check calculate_node_distance function exists
SELECT proname FROM pg_proc WHERE proname = 'calculate_node_distance';

-- Check RLS policies
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_preferences';
```

**Expected results:**
- ✅ Table exists
- ✅ Function created
- ✅ 4 policies found

### Step 2: Configure Admin Settings

In Supabase, ensure these admin_config values exist:

```sql
INSERT INTO admin_config (key, value) VALUES
  ('default_radius_miles', '10'),
  ('min_user_radius_miles', '5'),
  ('max_user_radius_miles', '25'),
  ('allow_user_radius_adjustment', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## TEST PLAN

### TEST GROUP 1: Radius Slider Display (Local Mode)

#### TEST-001: Slider NOT visible in local node view

**Steps:**
1. Login as User A (Norwalk node)
2. Navigate to Browse Items screen
3. Verify header shows: "My Node: Norwalk Central"
4. Toggle switch shows "Local"

**Expected:**
- ✅ Radius slider NOT visible
- ✅ Only local node items shown

**Result:** _____ (Pass/Fail)

---

#### TEST-002: Slider appears when showing all nodes

**Steps:**
1. Still logged in as User A
2. Toggle switch to "All Nodes"
3. Header now shows: "All Nodes - Items from all communities"

**Expected:**
- ✅ Radius slider appears below toggle
- ✅ Default radius = 10 miles
- ✅ Slider range: 5 mi (min) to 25 mi (max)
- ✅ Current value shows: "10 miles"

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 2: Radius Adjustment & Filtering

#### TEST-003: Adjust radius slider and reload items

**Steps:**
1. Slider visible (from TEST-002)
2. Drag slider LEFT to 5 miles
3. Verify value shows "5 miles"
4. Wait for items to reload

**Expected:**
- ✅ Value updates in real-time
- ✅ Items reload with new radius
- ✅ Only items within 5 miles shown
- ✅ May only show Norwalk items (same node)

**Result:** _____ (Pass/Fail)

---

#### TEST-004: Increase radius to see cross-node items

**Steps:**
1. Drag slider RIGHT to 20 miles
2. Value shows "20 miles"
3. Wait for items to reload

**Expected:**
- ✅ Items from Little Falls now visible
- ✅ Items show distance badge: "~73 mi away"
- ✅ Distance calculated correctly (Norwalk ↔ Little Falls ≈ 73 miles)

**Result:** _____ (Pass/Fail)

---

#### TEST-005: Slider respects min/max boundaries

**Steps:**
1. Try to drag slider BELOW 5 miles

**Expected:**
- ✅ Slider stops at 5 miles (cannot go lower)

**Steps:**
2. Try to drag slider ABOVE 25 miles

**Expected:**
- ✅ Slider stops at 25 miles (cannot go higher)

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 3: Distance Display Accuracy

#### TEST-006: Distance badges show for cross-node items

**Steps:**
1. Set radius to 25 miles
2. Browse items view
3. Look for items from other nodes

**Expected:**
- ✅ Each item from other node shows distance badge
- ✅ Badge format: "X.X mi away" (e.g., "73.2 mi away")
- ✅ Items same node: NO distance badge

**Result:** _____ (Pass/Fail)

---

#### TEST-007: Distance calculations accurate

**Steps:**
1. Note several items from Little Falls with their distances
2. Calculate expected distance using online tool:
   - From: Norwalk, CT (41.1177°N, 73.4079°W)
   - To: Little Falls, NJ (40.8751°N, 74.2163°W)
   - Expected: ~72-74 miles

**Expected:**
- ✅ App shows distance within ±2 miles of expected
- ✅ All items from same node show similar distance

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 4: User Preference Persistence

#### TEST-008: User preference saved to database

**Steps:**
1. Set radius to 18 miles
2. Open Supabase SQL Editor
3. Run query:
   ```sql
   SELECT * FROM user_preferences 
   WHERE user_id = '<User A ID>' 
   LIMIT 1;
   ```

**Expected:**
- ✅ Row exists for User A
- ✅ preferred_radius_miles = 18
- ✅ updated_at is recent timestamp

**Result:** _____ (Pass/Fail)

---

#### TEST-009: Preference persists across app restart

**Steps:**
1. Set radius to 22 miles
2. Close mobile app completely
3. Restart app
4. Login as User A again
5. Navigate to Browse Items > Show All Nodes

**Expected:**
- ✅ Slider loads with value 22 miles (not default 10)
- ✅ Items reflect 22 mile radius

**Result:** _____ (Pass/Fail)

---

#### TEST-010: Different users have different preferences

**Steps:**
1. Logout User A
2. Login as User B (Little Falls)
3. Navigate to Browse > Show All Nodes
4. Set radius to 30 miles (outside 5-25 range? No, stay within bounds)
5. Set radius to 12 miles
6. Logout User B
7. Login as User A
8. Navigate to Browse > Show All Nodes

**Expected:**
- ✅ User A still sees radius = 22 miles (from TEST-009)
- ✅ Preferences are per-user, not global

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 5: Admin Configuration

#### TEST-011: Disable radius adjustment

**Steps:**
1. Assume you have admin access
2. Navigate to Settings (or admin API)
3. Set allow_user_radius_adjustment = false
4. Save

**Steps:**
5. Login as regular user
6. Navigate to Browse > Show All Nodes

**Expected:**
- ✅ Slider NOT visible
- ✅ Default radius (10 miles) still applied

**Result:** _____ (Pass/Fail)

---

#### TEST-012: Admin changes radius limits

**Steps:**
1. Admin sets:
   - min_user_radius_miles = 8
   - max_user_radius_miles = 30
2. Save settings

**Steps:**
3. User logs in
4. Navigate to Browse > Show All Nodes

**Expected:**
- ✅ Slider range updated: 8 mi (min) to 30 mi (max)
- ✅ Previous user radius (22 miles) still valid (within new range)

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 6: Edge Cases & Error Handling

#### TEST-013: No items within small radius

**Steps:**
1. Set radius to 5 miles
2. Assume only Norwalk items exist at this distance

**Expected:**
- ✅ Empty state message shown (if no items)
- ✅ App remains responsive

**Result:** _____ (Pass/Fail)

---

#### TEST-014: Network error during distance calculation

**Steps:**
1. Offline mode: Turn off network on device
2. Set radius to 20 miles
3. Try to view items

**Expected:**
- ✅ Items cached from previous session show
- ✅ Distance badges show as "loading" or unavailable
- ✅ No crash

**Steps:**
4. Turn network back on
5. Refresh items

**Expected:**
- ✅ Distances recalculated
- ✅ Badges now show values

**Result:** _____ (Pass/Fail)

---

#### TEST-015: Rapid slider adjustments

**Steps:**
1. Quickly move slider: 5 → 10 → 15 → 20 → 15
   - (Do NOT wait for reload between each adjustment)
2. Release slider at 15 miles

**Expected:**
- ✅ Final items reflect radius = 15 miles
- ✅ Only one API call made (debounced)
- ✅ UI responsive, no freezing

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 7: Performance & UX

#### TEST-016: Smooth slider interaction

**Steps:**
1. Drag slider smoothly from 5 to 25 miles

**Expected:**
- ✅ Slider responsive
- ✅ Value updates continuously
- ✅ No lag or jank

**Result:** _____ (Pass/Fail)

---

#### TEST-017: Items sorted by distance (if applicable)

**Steps:**
1. Set radius to 50 miles
2. View items in feed

**Expected:**
- ✅ Items from closest nodes appear first
- ✅ Items with distance badges show gradually increasing distances

**Result:** _____ (Pass/Fail)

---

### TEST GROUP 8: Mobile-Specific

#### TEST-018: Slider layout on different screen sizes

**Steps:**
1. Test on iPhone (narrow screen)
2. Test on iPad (wide screen)

**Expected:**
- ✅ Slider visible and usable on both
- ✅ Text not truncated
- ✅ Layout adapts to screen width

**Result:** _____ (Pass/Fail)

---

#### TEST-019: Slider works with keyboard visible

**Steps:**
1. Focus radius value input (if exists)
2. Keyboard appears
3. Try to adjust slider

**Expected:**
- ✅ Slider accessible above keyboard
- ✅ No UI overlap issues

**Result:** _____ (Pass/Fail)

---

## Verification Checklist

| Item | Checklist | Status |
|------|-----------|--------|
| Radius slider appears (if admin allows) | [ ] | _____ |
| Admin-configured min/max limits enforced | [ ] | _____ |
| Default radius from admin settings | [ ] | _____ |
| User's preferred radius saved | [ ] | _____ |
| Preferred radius persists across sessions | [ ] | _____ |
| Items filtered by radius | [ ] | _____ |
| Distance displayed for cross-node items | [ ] | _____ |
| Distance calculated correctly via PostGIS | [ ] | _____ |
| Analytics events tracked | [ ] | _____ |
| Slider hidden if admin disables adjustment | [ ] | _____ |

---

## Test Results Summary

**Total Tests:** 19  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____

### Failed Tests (List details)

```
1. TEST-XXX: [Failure description]
2. TEST-XXX: [Failure description]
```

### Recommendations

```
[Any issues, improvements, or notes]
```

---

## Sign-Off

**Tester Name:** ___________________________  
**Date:** ___________________________  
**Status:** ☐ PASS  ☐ FAIL  ☐ CONDITIONAL PASS  

**Comments:**
```
[Additional notes or observations]
```

---

## Links & Resources

- Supabase Console: https://app.supabase.com
- Module Spec: [MODULE-03-NODE-MANAGEMENT.md](Prompts/MODULE-03-NODE-MANAGEMENT.md)
- Verification: [MODULE-03-Node Management VERIFICATION.md](Prompts/MODULE-03-Node%20Management%20VERIFICATION.md)
- PostGIS Docs: https://postgis.net/documentation/
- Distance Calculator: https://www.distance.to/
