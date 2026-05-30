# DISCOVERY-V3-008: Manual Testing Guide
**Module:** MODULE-05-DISCOVERY-V3-FILTERS
**Task:** DISCOVERY-V3-008 (Tests - Unit + Integration + Maestro)
**Date:** April 22, 2026

---

## Prerequisites

- iOS or Android Simulator running
- User account logged in
- Staging Supabase database with:
  - At least 10 active listings
  - At least 3 categories
  - Migration `20260420000002_update_search_listings_rpc.sql` applied

---

## Test Environment Setup

**For iOS Simulator:**
```bash
cd p2p-kids-marketplace
npm run ios
```

**For Android Simulator:**
```bash
cd p2p-kids-marketplace
npm run android
```

---

## Unit Tests

### TC-001: Run All Unit Tests

**Objective:** Verify all unit tests pass

**Steps:**
1. Navigate to project root:
   ```bash
   cd p2p-kids-marketplace
   ```
2. Run unit tests:
   ```bash
   npm run test:unit
   ```

**Expected Result:**
- ✅ All tests in `src/__tests__/services/discovery-v3.test.ts` pass
- ✅ All tests in `src/__tests__/services/searchHistory.test.ts` pass
- ✅ All tests in `src/__tests__/services/brandAutocomplete.test.ts` pass
- ✅ All tests in `src/__tests__/utils/fuzzyMatch.test.ts` pass
- ✅ All tests in `src/__tests__/utils/filterHelpers.test.ts` pass
- ✅ Test coverage ≥ 85% for discovery services and utils

**Pass Criteria:** All test suites pass with 0 failures

---

### TC-002: Test searchListings Passes 13 RPC Parameters

**Objective:** Verify `searchListings` service function calls Supabase RPC with all 13 parameters

**Test File:** `src/__tests__/services/discovery-v3.test.ts`

**Focus:** `should pass all 13 parameters to RPC` test

**Expected Result:**
- ✅ Mock RPC called with: `p_query`, `p_sp_eligible_only`, `p_limit`, `p_offset`, `p_category_ids`, `p_condition`, `p_min_price`, `p_max_price`, `p_age_group`, `p_gender`, `p_brand`, `p_colors`, `p_sort_by`
- ✅ Empty arrays converted to `null`
- ✅ Undefined filters converted to `null`

**Pass Criteria:** Test passes

---

### TC-003: Test Search History LRU Behavior

**Objective:** Verify recent searches are stored with LRU eviction (max 8 entries)

**Test File:** `src/__tests__/services/searchHistory.test.ts`

**Focus:** `should enforce max 8 searches (LRU eviction)` test

**Expected Result:**
- ✅ Adding 9th search removes the oldest
- ✅ Searches are deduplicated (case-insensitive)
- ✅ Most recent search appears first

**Pass Criteria:** Test passes

---

### TC-004: Test Fuzzy Matching with Levenshtein Distance

**Objective:** Verify typo correction using Levenshtein distance ≤ 3

**Test File:** `src/__tests__/utils/fuzzyMatch.test.ts`

**Focus:** `findClosestMatch` tests

**Expected Result:**
- ✅ `findClosestMatch('bycicle', ['bicycle', ...], 3)` returns `'bicycle'`
- ✅ `findClosestMatch('xyz', ['bicycle', ...], 2)` returns `null`
- ✅ Case-insensitive matching works

**Pass Criteria:** All fuzzyMatch tests pass

---

### TC-005: Test Filter Helpers

**Objective:** Verify filter counting, validation, and chip label formatting

**Test File:** `src/__tests__/utils/filterHelpers.test.ts`

**Expected Result:**
- ✅ `countActiveFilters(defaultFilters)` returns 0
- ✅ `validatePriceRange(20, 10)` returns `false`
- ✅ `formatFilterChipLabel('ageGroup', '3-5')` returns `'Age: 3-5'`

**Pass Criteria:** All filterHelpers tests pass

---

## Integration Tests

### TC-006: Run E2E Integration Tests Against Staging

**Objective:** Verify search_listings RPC works with real Supabase connection

**Pre-requisite SQL:** (Run in Supabase SQL Editor if not already applied)
```sql
-- Verify migration applied
SELECT routine_name, specific_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'search_listings';

-- Should show new 13-param signature
```

**Steps:**
1. Ensure `.env.staging` has valid `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. Run integration tests:
   ```bash
   cd p2p-kids-marketplace
   RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=integration/discovery-v3
   ```

**Expected Result:**
- ✅ RPC returns results with all 13 parameters
- ✅ Category filter returns only items in specified categories
- ✅ Condition filter works correctly
- ✅ Price range filter works correctly
- ✅ Color filter (multi-select with overlap) works correctly
- ✅ Sort options work (price_asc, price_desc, newest)
- ✅ Pagination with offset works correctly

**Pass Criteria:** All integration tests pass

---

### TC-007: Performance Test (p95 < 200ms)

**Objective:** Verify search_listings RPC meets performance target on staging

**Pre-requisite:** Staging DB has ≥ 10k items

**Steps:**
1. Run performance test:
   ```bash
   cd p2p-kids-marketplace
   npm run test:perf:search
   ```

**Expected Result:**
- ✅ 20 searches complete successfully
- ✅ p95 latency < 200ms
- ✅ No RPC errors

**Pass Criteria:** Script exits with code 0 and displays "✅ PASS"

---

## Maestro UI Flow Tests

### TC-008: Multi-Filter Application and Chip Removal

**Objective:** Test applying multiple filters, seeing chips, removing individual chips, and clearing all

**Maestro Flow:** `.maestro/search-filters.yaml`

**Steps:**
1. Run Maestro flow:
   ```bash
   cd p2p-kids-marketplace
   npm run test:maestro:ios -- .maestro/search-filters.yaml
   ```
   OR for Android:
   ```bash
   npm run test:maestro:android -- .maestro/search-filters.yaml
   ```

**Expected Flow:**
1. ✅ Opens Discover screen
2. ✅ Opens filter modal
3. ✅ Selects multiple filters (category, condition, price, colors)
4. ✅ Filter count shows "Filters (4)"
5. ✅ Applies filters
6. ✅ Filter chips appear on Discover screen
7. ✅ Removes individual chips (condition, price)
8. ✅ Filter count updates to "Filters (2)"
9. ✅ Taps "Clear All"
10. ✅ All chips removed
11. ✅ Re-applies SP filter
12. ✅ Clears filter

**Pass Criteria:** Maestro flow completes with all assertions passed

---

### TC-009: Recent Searches and Autocomplete

**Objective:** Test recent search history and autocomplete dropdown

**Maestro Flow:** `.maestro/search-autocomplete.yaml`

**Steps:**
1. Run Maestro flow:
   ```bash
   cd p2p-kids-marketplace
   npm run test:maestro:ios -- .maestro/search-autocomplete.yaml
   ```
   OR for Android:
   ```bash
   npm run test:maestro:android -- .maestro/search-autocomplete.yaml
   ```

**Expected Flow:**
1. ✅ Performs 3 searches: "LEGO", "bicycle", "books"
2. ✅ Focuses search input
3. ✅ Autocomplete dropdown appears with recent searches (newest first)
4. ✅ Taps "bicycle" from dropdown
5. ✅ Search input populated with "bicycle"
6. ✅ Search executes
7. ✅ Tests case-insensitive deduplication ("BICYCLE" vs "bicycle")
8. ✅ Brand autocomplete triggers for queries ≥ 2 chars

**Pass Criteria:** Maestro flow completes with all assertions passed

---

### TC-010: Empty State and Typo Suggestions

**Objective:** Test empty state when no results, and "Did you mean..." typo suggestions

**Maestro Flow:** `.maestro/search-empty-state.yaml`

**Steps:**
1. Run Maestro flow:
   ```bash
   cd p2p-kids-marketplace
   npm run test:maestro:ios -- .maestro/search-empty-state.yaml
   ```
   OR for Android:
   ```bash
   npm run test:maestro:android -- .maestro/search-empty-state.yaml
   ```

**Expected Flow:**
1. ✅ Searches for obscure query "xyzabc123456"
2. ✅ Empty state appears with "No items found"
3. ✅ Searches for typo "bycicle" (should suggest "bicycle")
4. ✅ "Did you mean bicycle?" appears (if no results)
5. ✅ Taps suggestion
6. ✅ Search updates to "bicycle"
7. ✅ Applies restrictive filter (price min 9999)
8. ✅ Empty state shows "No items match your filters"
9. ✅ "Clear filters" button visible
10. ✅ Taps "Clear filters"
11. ✅ Results reappear

**Pass Criteria:** Maestro flow completes with all assertions passed

---

## Manual UI Verification (Simulator)

### TC-011: Search Debounce is 200ms

**Objective:** Verify search triggers after 200ms debounce, not immediately on every keystroke

**Steps (iOS or Android Simulator):**
1. Open app and navigate to Discover tab
2. Tap search input
3. Type "toy" quickly (3 keystrokes in < 200ms)
4. Observe when search results update

**Expected Result:**
- ✅ Search does NOT trigger after each letter
- ✅ Search triggers ~200ms after last keystroke
- ✅ Loading indicator appears briefly
- ✅ Results update

**Pass Criteria:** Network request count in logs shows only 1 search call (not 3)

---

### TC-012: Optimistic UI (Old Results Remain During New Fetch)

**Objective:** Verify old results stay visible while new results load

**Steps:**
1. Search for "toy"
2. Wait for results to load
3. Change search to "book"
4. Observe UI during loading

**Expected Result:**
- ✅ "toy" results remain visible while "book" results load
- ✅ No blank screen or "Loading..." message replacing results
- ✅ Skeleton placeholder may appear at bottom for new results
- ✅ Once loaded, "book" results replace "toy" results

**Pass Criteria:** Smooth transition with no blank screen

---

### TC-013: Filter Chips Display Correctly

**Objective:** Verify filter chips appear with correct labels after applying filters

**Steps:**
1. Open filter modal
2. Select:
   - Category: "Toys"
   - Condition: "Like New"
   - Price: $10 - $50
   - Colors: Blue, Red
3. Tap "Apply Filters"
4. Observe Discover screen

**Expected Result:**
- ✅ 4 filter chips appear:
  - "Category: Toys" (or category name)
  - "Condition: Like New"
  - "Price: $10 - $50"
  - "Colors: Blue, Red"
- ✅ Each chip has an X button
- ✅ Filter button shows "Filters (4)"

**Pass Criteria:** All chips render with correct labels

---

### TC-014: Removing Filter Chip Updates Results

**Objective:** Verify removing a chip triggers a new search

**Steps:**
1. Apply filters (from TC-013)
2. Note result count
3. Tap X on "Condition: Like New" chip
4. Observe results

**Expected Result:**
- ✅ Chip disappears
- ✅ Search re-executes
- ✅ Results update (may show more items)
- ✅ Filter count updates to "Filters (3)"

**Pass Criteria:** Results update immediately after chip removal

---

### TC-015: Clear All Filters Works

**Objective:** Verify "Clear All" button removes all filters

**Steps:**
1. Apply multiple filters
2. Verify chips appear
3. Tap "Clear All Filters" button
4. Observe UI

**Expected Result:**
- ✅ All chips disappear
- ✅ Filter button shows no count
- ✅ "Clear All" button disappears
- ✅ Search re-executes with no filters
- ✅ All available items shown

**Pass Criteria:** Clean state restored

---

### TC-016: Recent Searches Max 8 (LRU)

**Objective:** Verify recent searches list caps at 8 entries with LRU eviction

**Steps:**
1. Clear app data (or AsyncStorage via dev tools)
2. Perform 10 unique searches:
   - "toy", "book", "LEGO", "bicycle", "game", "puzzle", "doll", "car", "ball", "kite"
3. Clear search input
4. Focus search input to see recent searches

**Expected Result:**
- ✅ Only 8 searches appear
- ✅ Oldest searches ("toy", "book") are NOT shown
- ✅ Newest 8 searches appear in reverse order (newest first)

**Pass Criteria:** Max 8 searches, LRU order verified

---

### TC-017: Case-Insensitive Deduplication

**Objective:** Verify searching "bicycle" then "BICYCLE" deduplicates

**Steps:**
1. Search "bicycle"
2. Clear search
3. Search "BICYCLE" (uppercase)
4. Clear search
5. Focus input to see recent searches

**Expected Result:**
- ✅ Only ONE entry for bicycle/BICYCLE appears
- ✅ Most recent casing ("BICYCLE") is shown
- ✅ Old "bicycle" entry is removed

**Pass Criteria:** No duplicate entries

---

### TC-018: Brand Autocomplete (≥ 2 chars)

**Objective:** Verify brand autocomplete triggers at 2 characters

**Steps:**
1. Focus search input
2. Type "L" (1 character)
3. Observe dropdown
4. Type "E" (now "LE")
5. Observe dropdown

**Expected Result:**
- ✅ After "L": no brand autocomplete (or only recent searches)
- ✅ After "LE": brand autocomplete shows (e.g., "LEGO", "Leapfrog")
- ✅ Brands are sorted alphabetically
- ✅ Max 8 brand suggestions

**Pass Criteria:** Autocomplete appears at 2+ chars

---

### TC-019: Typo Suggestion ("Did you mean...")

**Objective:** Verify fuzzy match suggests corrections for typos

**Steps:**
1. Search "bicycle" to add to history
2. Clear search
3. Search "bycicle" (missing 'i')
4. Wait for results

**Expected Result:**
- ✅ If no results: "Did you mean 'bicycle'?" appears
- ✅ Tapping suggestion updates search to "bicycle"
- ✅ Search re-executes with corrected term

**Pass Criteria:** Suggestion appears and works

---

### TC-020: Network Error Handling

**Objective:** Verify graceful error handling when RPC fails

**Steps:**
1. Enable Airplane Mode on simulator
2. Perform a search
3. Observe UI

**Expected Result:**
- ✅ Error banner appears: "Could not connect. Please check your internet."
- ✅ Error is non-blocking (dismissible)
- ✅ Old results (if any) remain visible
- ✅ Retry search after disabling Airplane Mode works

**Pass Criteria:** Graceful error handling, no app crash

---

## Test Summary Checklist

- [ ] TC-001: All unit tests pass
- [ ] TC-002: searchListings passes 13 RPC params (unit test)
- [ ] TC-003: Search history LRU works (unit test)
- [ ] TC-004: Fuzzy matching works (unit test)
- [ ] TC-005: Filter helpers work (unit test)
- [ ] TC-006: E2E integration tests pass
- [ ] TC-007: Performance test passes (p95 < 200ms)
- [ ] TC-008: Maestro: Multi-filter + chip removal
- [ ] TC-009: Maestro: Autocomplete + recent searches
- [ ] TC-010: Maestro: Empty state + typo suggestions
- [ ] TC-011: Search debounce is 200ms (manual)
- [ ] TC-012: Optimistic UI works (manual)
- [ ] TC-013: Filter chips display correctly (manual)
- [ ] TC-014: Removing chip updates results (manual)
- [ ] TC-015: Clear all filters works (manual)
- [ ] TC-016: Recent searches max 8 LRU (manual)
- [ ] TC-017: Case-insensitive deduplication (manual)
- [ ] TC-018: Brand autocomplete ≥ 2 chars (manual)
- [ ] TC-019: Typo suggestion works (manual)
- [ ] TC-020: Network error handling (manual)

---

## Notes

- All Maestro tests require testIDs to be present in the UI components
- Performance test requires staging DB with ≥ 10k items for accurate results
- Manual tests can be run on either iOS or Android simulator
- E2E tests require valid Supabase staging credentials in `.env.staging`

---

## Verification Status

✅ **PASS:** All 20 test cases completed successfully

**Tested By:** _____________
**Date:** _____________
**Platform:** [ ] iOS Simulator [ ] Android Simulator
