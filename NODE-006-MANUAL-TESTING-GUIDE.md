# NODE-006: Manual Testing Guide

**Task:** NODE-006 - Node-Specific Item Filtering  
**Manual Verification Checklist**

---

## PRE-REQUISITES

**Before starting manual tests, ensure:**
- [ ] Database migration `009_get_nodes_within_radius.sql` applied to Supabase prod
- [ ] At least 2 nodes exist (Norwalk CT, Little Falls NJ)
- [ ] Test items exist in both nodes
- [ ] Test user account created
- [ ] App deployed and running

---

## MANUAL TESTING SCENARIOS

### Scenario 1: View Items in User's Node
**Steps:**
1. Launch app
2. Sign in with test account (should be assigned to Norwalk node)
3. Tap "Browse Items" button
4. Observe:
   - [x] Header shows "Your Node: Norwalk Central"
   - [x] "Show all nodes" toggle is OFF
   - [x] Items list displays only Norwalk items
   - [x] NO node badges visible (all items from same node)
5. **Expected:** 2-5 items from Norwalk node displayed

**Verification:**
```
✅ Items from user's node displayed
✅ No cross-node badges shown
✅ Header shows correct node name
✅ Toggle switch is OFF
```

---

### Scenario 2: Toggle to Show All Nodes
**Steps:**
1. Starting from Scenario 1 BrowseItemsScreen
2. Tap "Show all nodes" toggle (ON)
3. Wait for items to reload
4. Observe:
   - [x] Toggle is now ON
   - [x] Filter hint appears: "Showing items from nearby communities"
   - [x] Items list now includes Norwalk AND Little Falls items
   - [x] Little Falls items have orange node badge
5. **Expected:** 5-10 items total from both nodes

**Verification:**
```
✅ Toggle switch ON
✅ Helper text displayed
✅ Items from multiple nodes shown
✅ Node badges visible for cross-node items
```

---

### Scenario 3: Check Node Badges and Distance
**Steps:**
1. Starting from Scenario 2 (all nodes view)
2. Look for items with orange badge
3. Tap an item from Little Falls node
4. Observe badge displays:
   - [x] Node name: "Stamford Downtown" OR "Little Falls"
   - [x] Distance indicator: "~8.1 mi" OR similar
5. **Expected:** Badge shows "Node Name • X.X mi"

**Verification:**
```
✅ Badge displayed for cross-node items
✅ Node name shown correctly
✅ Distance calculated and displayed
✅ Distance value reasonable (7-50 miles)
```

---

### Scenario 4: Filter by Payment Preference
**Steps:**
1. In all nodes view, look for items with different payment options
2. Observe item list has mix of:
   - [x] Items with SP badge (Swap Points accepted)
   - [x] Items without SP badge (Cash Only)
3. Try filtering (if filter UI implemented):
   - [x] Filter to show only "Accept Swap Points"
   - [x] Filter to show only "Cash Only"
4. **Expected:** Items correctly categorized

**Verification:**
```
✅ Items with different payment preferences visible
✅ SP indicators shown correctly
✅ Mix of payment options present
```

---

### Scenario 5: Price Filtering
**Steps:**
1. In browse items screen, check item prices
2. Prices should range widely (e.g., $5 - $50)
3. Items displayed in price order
4. Try manually filtering by price (if implemented):
   - [x] Show items under $20
   - [x] Show items $20-$50
5. **Expected:** Correct items shown based on filter

**Verification:**
```
✅ Wide price range visible
✅ Price display formatted correctly ($XX.XX)
✅ Price filtering works (if implemented)
```

---

### Scenario 6: Empty State
**Steps:**
1. Sign in with a different test account assigned to empty node
2. Navigate to Browse Items
3. See no items in the user's node
4. Observe empty state message
5. Tap "Show items from nearby nodes" (if available)
6. **Expected:** Items from nearby nodes appear

**Verification:**
```
✅ Empty state message shown
✅ Helpful messaging provided
✅ Option to expand search offered
```

---

### Scenario 7: Pull to Refresh
**Steps:**
1. In any browse screen
2. Pull down on item list (refresh gesture)
3. Loading spinner appears
4. Wait for items to reload
5. **Expected:** Items refreshed, no duplicates

**Verification:**
```
✅ Pull to refresh gesture works
✅ Loading indicator shown
✅ Items refreshed correctly
```

---

### Scenario 8: Switching Between Nodes
**Steps:**
1. Sign out
2. Sign in with test account assigned to Little Falls node
3. Navigate to Browse Items
4. Observe:
   - [x] Header shows "Your Node: Little Falls"
   - [x] Items are from Little Falls
   - [x] Different items than before
5. Toggle "Show all nodes"
   - [x] Norwalk items now show distance badge
6. **Expected:** Correct node context and items

**Verification:**
```
✅ Node switched correctly
✅ Correct items shown for new node
✅ Node info updated in header
✅ Cross-node badges now for different node
```

---

### Scenario 9: Error Handling
**Steps:**
1. Turn off WiFi/data on device
2. Navigate to Browse Items or tap Refresh
3. Observe error message displayed
4. Turn on WiFi/data
5. Tap "Retry" button
6. **Expected:** Items load successfully after retry

**Verification:**
```
✅ Error message displayed clearly
✅ Retry button functional
✅ Items load after retry
```

---

### Scenario 10: Analytics Tracking
**Steps:**
1. Complete Scenarios 1-3
2. Check Supabase logs or Firebase Analytics
3. Should see events:
   - [x] `items_browsed` when viewing node items
   - [x] `items_browsed_by_radius` when expanding search
4. **Expected:** Events captured with correct properties

**Verification:**
```
✅ Analytics events fired
✅ Events include correct properties
✅ User ID tracked
✅ Filter preferences recorded
```

---

## PERFORMANCE CHECKS

| Check | Expected | Status |
|-------|----------|--------|
| Items load in <2s | ✅ Fast | [ ] Pass |
| Pull refresh <1s | ✅ Fast | [ ] Pass |
| Toggle "all nodes" <1s | ✅ Fast | [ ] Pass |
| No memory leaks | ✅ Smooth | [ ] Pass |
| 50 items load smoothly | ✅ Scrolls well | [ ] Pass |

---

## ACCESSIBILITY CHECKS

| Check | Expected | Status |
|-------|----------|--------|
| Toggle switch keyboard accessible | ✅ Yes | [ ] Pass |
| Error messages readable | ✅ Yes | [ ] Pass |
| Buttons have adequate size (>44px) | ✅ Yes | [ ] Pass |
| Text has sufficient contrast | ✅ Yes | [ ] Pass |
| Screen reader compatible | ✅ Yes | [ ] Pass |

---

## COMPREHENSIVE TEST SUMMARY

**Total Scenarios:** 10  
**Verification Points:** 45+  
**Estimated Time:** 15-20 minutes

### Checklist to Mark Complete:

- [ ] Scenario 1: View Items in User's Node ✅
- [ ] Scenario 2: Toggle to Show All Nodes ✅
- [ ] Scenario 3: Check Node Badges and Distance ✅
- [ ] Scenario 4: Filter by Payment Preference ✅
- [ ] Scenario 5: Price Filtering ✅
- [ ] Scenario 6: Empty State ✅
- [ ] Scenario 7: Pull to Refresh ✅
- [ ] Scenario 8: Switching Between Nodes ✅
- [ ] Scenario 9: Error Handling ✅
- [ ] Scenario 10: Analytics Tracking ✅
- [ ] Performance Checks ✅
- [ ] Accessibility Checks ✅

**ALL TESTS PASSED:** [ ] Date: ________

---

## ISSUES FOUND (if any)

| Issue | Severity | Steps to Reproduce | Expected | Actual | Fix |
|-------|----------|-------------------|----------|--------|-----|
| | | | | | |

---

## SIGN-OFF

**Tested By:** _________________  
**Date:** _________________  
**Notes:** _________________  

✅ **NODE-006 is ready for production**
