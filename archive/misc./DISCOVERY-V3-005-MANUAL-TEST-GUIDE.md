# DISCOVERY-V3-005: DiscoverScreen Manual Test Guide

**Module:** MODULE-05-DISCOVERY-V3-FILTERS  
**Task:** DISCOVERY-V3-005 - DiscoverScreen (Unified)  
**Last Updated:** April 22, 2026  
**Test Environment:** iOS Simulator / Android Emulator  

---

## Prerequisites

1. ✅ Ensure staging Supabase is accessible
2. ✅ App is built and running on iOS Simulator or Android Emulator
3. ✅ Test user is logged in
4. ✅ At least 20+ items exist in staging database for pagination testing
5. ✅ Navigation has been updated to show "Discover" tab

---

## Test Cases

### TC-001: Initial Screen Load

**Objective:** Verify the DiscoverScreen loads correctly

**Steps:**
1. Open the app
2. Navigate to the "Discover" tab (bottom navigation)

**Expected Results:**
- ✅ Search input is visible at the top
- ✅ "Filters" button is visible (no badge initially)
- ✅ "Sort: relevance" button is visible
- ✅ Initial results load automatically
- ✅ No full-screen loading spinner after initial load
- ✅ Empty state shows: "Discover Items" / "Search or browse to find items near you" if no results

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-002: Search with Debounce (200ms)

**Objective:** Verify search input debounces correctly at 200ms

**Steps:**
1. Navigate to Discover tab
2. Type "toy" in the search input
3. Observe the timing before search executes

**Expected Results:**
- ✅ Search does NOT execute immediately while typing
- ✅ Search executes ~200ms after last keystroke
- ✅ Previous results remain visible during new search (optimistic UI)
- ✅ Results update after search completes

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-003: Search Results Display

**Objective:** Verify search results display correctly

**Steps:**
1. Navigate to Discover tab
2. Type "toy" in search input
3. Wait for results to load

**Expected Results:**
- ✅ Result cards display item title
- ✅ Result cards display price
- ✅ SP-eligible items show "SP ✓" badge
- ✅ Results are tappable

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-004: Navigate to Item Detail

**Objective:** Verify tapping a result navigates to item detail

**Steps:**
1. Navigate to Discover tab
2. Perform a search (e.g., "toy")
3. Tap on any result card

**Expected Results:**
- ✅ Navigation occurs to ItemDetail screen
- ✅ Correct item is displayed
- ✅ Can navigate back to Discover screen
- ✅ Filter state and search results are preserved on return

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-005: Recent Searches Panel

**Objective:** Verify recent searches are shown when input is focused and empty

**Steps:**
1. Perform a few searches: "bike", "toy", "book"
2. Clear the search input
3. Tap on the search input (focus)

**Expected Results:**
- ✅ "Recent Searches" panel appears
- ✅ Shows most recent searches (up to 8)
- ✅ Searches are in reverse chronological order (newest first)
- ✅ "Clear All" button is visible

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-006: Tap Recent Search

**Objective:** Verify tapping a recent search performs that search

**Steps:**
1. Focus on search input (should show recent searches)
2. Tap on any recent search (e.g., "bike")

**Expected Results:**
- ✅ Search input fills with the tapped search term
- ✅ Search executes automatically
- ✅ Results display for that search term

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-007: Remove Recent Search

**Objective:** Verify removing individual recent search

**Steps:**
1. Focus on search input (should show recent searches)
2. Tap the "✕" button next to any recent search

**Expected Results:**
- ✅ That search is removed from the panel
- ✅ Other searches remain visible
- ✅ Removal persists (check by refocusing input)

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-008: Clear All Recent Searches

**Objective:** Verify clearing all recent searches

**Steps:**
1. Focus on search input (should show recent searches)
2. Tap "Clear All" button

**Expected Results:**
- ✅ All recent searches are removed
- ✅ Recent searches panel disappears (empty)
- ✅ Clearing persists (check by refocusing input)

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-009: Autocomplete Suggestions

**Objective:** Verify autocomplete shows suggestions after 2+ characters

**Steps:**
1. Focus on search input
2. Type "bi" (2 characters)

**Expected Results:**
- ✅ Autocomplete panel appears
- ✅ Shows suggestions matching "bi" from recent searches
- ✅ Maximum 5 suggestions shown
- ✅ Tapping a suggestion fills search input and executes search

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-010: Autocomplete - Single Character

**Objective:** Verify autocomplete does NOT show for single character

**Steps:**
1. Focus on search input
2. Type "b" (1 character)

**Expected Results:**
- ✅ Autocomplete panel does NOT appear
- ✅ Recent searches panel is still visible (if input was empty before typing)

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-023: Autocomplete - Dictionary Suggestions (Non-History)

**Objective:** Verify autocomplete shows dictionary-based suggestions even when the user has no matching search history

**Steps:**
1. Clear all recent searches (use TC-008)
2. Focus on search input
3. Type "bi" (2 characters)
4. Observe autocomplete suggestions

**Expected Results:**
- ✅ Autocomplete panel appears
- ✅ Suggestions include dictionary-driven terms (e.g., "Bicycle") even without matching user history
- ✅ Maximum 5 suggestions shown
- ✅ Tapping a dictionary suggestion fills search input and executes search

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-011: Filter Button (No Active Filters)

**Objective:** Verify filter button displays correctly with no active filters

**Steps:**
1. Navigate to Discover tab
2. Observe the "Filters" button

**Expected Results:**
- ✅ "Filters" button is visible
- ✅ No badge is shown (0 active filters)
- ✅ Accessibility label includes "Filters"

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-012: Infinite Scroll

**Objective:** Verify infinite scroll loads more results

**Steps:**
1. Navigate to Discover tab
2. Perform a search that returns many results (or leave empty)
3. Scroll to the bottom of the results list

**Expected Results:**
- ✅ Loading indicator appears at bottom when reaching 50% from end
- ✅ Next batch of results (20 more) loads automatically
- ✅ Results are appended (not replaced)
- ✅ No duplicate fetch while loading more
- ✅ Scroll position is maintained

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-013: Infinite Scroll - End Reached

**Objective:** Verify behavior when all results have been loaded

**Steps:**
1. Navigate to Discover tab
2. Perform a search with limited results (< 40 items)
3. Scroll to bottom multiple times

**Expected Results:**
- ✅ Loading indicator stops appearing after last batch
- ✅ No error or duplicate fetch attempts
- ✅ User can still scroll freely

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-014: Pull to Refresh

**Objective:** Verify pull-to-refresh reloads results

**Steps:**
1. Navigate to Discover tab
2. Perform a search
3. Pull down from the top of the results list

**Expected Results:**
- ✅ Refresh indicator appears
- ✅ Search is re-executed from offset 0
- ✅ Results are replaced with fresh data
- ✅ Offset is reset to 0

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-015: Network Error Banner

**Objective:** Verify network error displays banner (non-blocking)

**Steps:**
1. Turn off Wi-Fi / cellular data OR use network throttling
2. Navigate to Discover tab
3. Perform a search

**Expected Results:**
- ✅ Error banner appears at top: "⚠️ [error]. Tap to retry."
- ✅ Previous results remain visible (non-blocking)
- ✅ Tapping banner retries the search
- ✅ Error banner disappears on successful retry

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-016: Empty State - No Results (With Filters)

**Objective:** Verify empty state when search returns no results with active filters

**Steps:**
1. Apply filters (use filter modal when implemented, or programmatically)
2. Ensure no results match

**Expected Results:**
- ✅ Empty state shows: "No Results Found"
- ✅ Subtitle: "Try adjusting your filters"
- ✅ "Clear Filters" button is visible
- ✅ Tapping "Clear Filters" resets all filters and re-searches

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-017: Empty State - No Results (Spell Suggestion)

**Objective:** Verify spell suggestion in empty state

**Steps:**
1. Add "bicycle" to recent searches
2. Search for "bycicle" (typo, Levenshtein distance = 1)
3. Ensure no results match

**Expected Results:**
- ✅ Empty state shows: "No Results Found"
- ✅ Subtitle: 'Did you mean "bicycle"?'
- ✅ Button: 'Search for "bicycle"' is visible
- ✅ Tapping button searches for "bicycle"

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-018: Empty State - No Search Performed

**Objective:** Verify initial empty state

**Steps:**
1. Navigate to Discover tab with no prior searches
2. Database is empty or user node has no items

**Expected Results:**
- ✅ Empty state shows: "Discover Items"
- ✅ Subtitle: "Search or browse to find items near you"
- ✅ No action buttons

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-019: Optimistic UI During Search

**Objective:** Verify previous results remain visible during new search

**Steps:**
1. Perform initial search (e.g., "toy")
2. Wait for results to load
3. Type a new search query (e.g., "bike")

**Expected Results:**
- ✅ Previous results ("toy") remain visible while typing
- ✅ Previous results remain visible after debounce (while new search loads)
- ✅ No full-screen loading spinner
- ✅ Results are replaced only when new search completes

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-020: Filter State Persistence

**Objective:** Verify filter state persists across navigation

**Steps:**
1. Apply some filters (when filter modal is implemented)
2. Perform a search
3. Navigate to an item detail
4. Navigate back to Discover

**Expected Results:**
- ✅ Filter state is preserved
- ✅ Search results are still displayed
- ✅ Search query is still in input
- ✅ Active filter count badge is still visible

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-021: Filter State Reset on Tab Change

**Objective:** Verify filter state resets when switching tabs

**Steps:**
1. Apply some filters
2. Perform a search
3. Switch to a different tab (e.g., Dashboard)
4. Switch back to Discover tab

**Expected Results:**
- ✅ Filters are reset to defaults
- ✅ Search query is cleared
- ✅ Results are reloaded with no filters

**Note:** This requirement is from DISCOVERY-V3-005 spec

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

### TC-022: Accessibility Labels

**Objective:** Verify all interactive elements have accessibility labels

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through the Discover screen

**Expected Elements with Labels:**
- ✅ Search input: "Search for items"
- ✅ Filter button: "Filters" (or "Filters, X active" when filters applied)
- ✅ Sort button: "Sort by [option]"
- ✅ Result cards: "[Title], $[Price]"
- ✅ Recent search items: Readable
- ✅ Autocomplete suggestions: Readable

**Result:** ☐ PASS ☐ FAIL

**Notes:**
```


```

---

## Test Summary

**Tester Name:** _________________  
**Date:** _________________  
**Environment:** ☐ iOS Simulator ☐ Android Emulator  
**Build Version:** _________________  

**Overall Results:**
- Total Test Cases: 23
- Passed: _____
- Failed: _____
- Blocked: _____

**Critical Issues Found:**
```




```

**Notes:**
```




```

**Sign-off:**
- ☐ All critical functionality verified
- ☐ Ready for production
- ☐ Issues logged for follow-up

---

## Appendix: Quick Test Commands

### Run Unit Tests
```bash
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern="DiscoverScreen"
```

### Run E2E Integration Tests
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-005
```

### Run Linting & Type Checking (Tier 0)
```bash
cd p2p-kids-marketplace
npm run lint
npm run typecheck
```

---

## Troubleshooting

### Issue: Search doesn't execute
- **Check:** Is the debounce delay set to 200ms?
- **Check:** Are there TypeScript/compile errors?
- **Check:** Is Supabase reachable?

### Issue: Recent searches not showing
- **Check:** Has AsyncStorage been cleared?
- **Check:** Have any searches been performed?
- **Check:** Is the search input focused?

### Issue: Infinite scroll not loading more
- **Check:** Are there more than 20 results available?
- **Check:** Is the `hasMore` flag being set correctly?
- **Check:** Is the `loadingMore` guard preventing duplicate fetches?

### Issue: Navigation broken
- **Check:** Has `HomeTabNavigator.tsx` been updated to use `DiscoverScreen`?
- **Check:** Are old `SearchScreen` and `BrowseItemsScreen` files deleted?
- **Check:** Does the `ItemDetail` route exist in the navigator?

---

**End of Manual Test Guide**
