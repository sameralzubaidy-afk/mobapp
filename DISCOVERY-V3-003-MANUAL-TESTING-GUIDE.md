# Manual Testing Guide - DISCOVERY-V3-003
## Services Layer Testing

**MODULE:** 05-DISCOVERY-V3-FILTERS
**TASK:** DISCOVERY-V3-003 - Services Layer
**Date:** April 21, 2026
**Tester:** QA Team / Developer

---

## Prerequisites

✅ **Before starting:**
1. SQL migrations run on production Supabase:
   - `20260420000001_add_item_filter_columns.sql` (adds columns + indexes)
   - `20260420000002_update_search_listings_rpc.sql` (updates RPC)
2. App built and running on iOS/Android simulator
3. Test user logged in
4. At least 10 test items with varied attributes in database

---

## Test Suite 1: Search History (searchHistory.ts)

### TC-SH-001: Add Search to History
**Steps:**
1. Open app on Discover screen
2. Tap search bar
3. Type "LEGO" and press Enter
4. Type "bicycle" and press Enter
5. Tap search bar again (empty query)

**Expected:**
- Recent searches list appears
- "bicycle" appears FIRST (most recent)
- "LEGO" appears SECOND

**Result:** ☐ Pass ☐ Fail

---

### TC-SH-002: Deduplicate Case-Insensitive
**Steps:**
1. Clear search history (via debug menu or manual)
2. Search for "lego"
3. Search for "LEGO"
4. Search for "LeGo"
5. Check recent searches

**Expected:**
- Only ONE "LeGo" appears (latest casing)
- No duplicates

**Result:** ☐ Pass ☐ Fail

---

### TC-SH-003: LRU Eviction (Max 8)
**Steps:**
1. Clear search history
2. Perform 10 unique searches: "s1", "s2", ..., "s10"
3. Check recent searches

**Expected:**
- Only 8 searches shown
- "s10" is first, "s9" is second, ..., "s3" is last
- "s1" and "s2" are NOT shown (evicted)

**Result:** ☐ Pass ☐ Fail

---

### TC-SH-004: Autocomplete Suggestions
**Steps:**
1. Clear search history
2. Add searches: "LEGO Star Wars", "LEGO City", "bicycle", "LEGO Friends"
3. Tap search bar
4. Type "lego" (lowercase, partial)

**Expected:**
- Autocomplete dropdown shows 3 suggestions:
  - "LEGO Star Wars"
  - "LEGO City"
  - "LEGO Friends"
- "bicycle" NOT shown (doesn't start with "lego")
- Max 5 suggestions (if more exist)

**Result:** ☐ Pass ☐ Fail

---

### TC-SH-005: Clear History
**Steps:**
1. Add 5 searches
2. Tap "Clear All History" button
3. Tap search bar

**Expected:**
- Recent searches list is EMPTY
- No autocomplete suggestions appear

**Result:** ☐ Pass ☐ Fail

---

## Test Suite 2: Brand Autocomplete (brandAutocomplete.ts)

### TC-BA-001: Predefined Brands Count
**Steps:**
1. Code inspection: Check `PREDEFINED_BRANDS` array in `src/services/brandAutocomplete.ts`

**Expected:**
- Array length === 50
- Contains: "LEGO", "Nike", "Disney", "Carter's", "OshKosh B'Gosh", "BabyBjörn", "Lands' End"

**Result:** ☐ Pass ☐ Fail

---

### TC-BA-002: Brand Suggestions (Min 2 Chars)
**Steps:**
1. Open filter modal
2. Tap "Brand" filter
3. Type "a" (1 character)

**Expected:**
- NO suggestions shown (query too short)

**Result:** ☐ Pass ☐ Fail

---

### TC-BA-003: Brand Suggestions (Valid Query)
**Steps:**
1. Open filter modal
2. Tap "Brand" filter
3. Type "lego" (4 characters)

**Expected:**
- Dropdown shows up to 8 brand suggestions
- "LEGO" is included
- All suggestions contain "lego" (case-insensitive)
- Sorted alphabetically

**Result:** ☐ Pass ☐ Fail

---

### TC-BA-004: Hybrid Merge (Predefined + DB)
**Steps:**
1. Ensure staging DB has a custom brand "My Custom Brand" on at least 1 item
2. Open filter modal
3. Tap "Brand" filter
4. Type "brand"

**Expected:**
- Suggestions include BOTH:
  - Predefined brands containing "brand"
  - "My Custom Brand" from database
- Deduped (no duplicates)
- Max 8 total

**Result:** ☐ Pass ☐ Fail

---

### TC-BA-005: Cache Behavior (5-Min TTL)
**Steps:**
1. Open filter modal, type "lego" → note suggestions
2. Immediately repeat (within 5 min)
3. Check network tab/logs

**Expected:**
- First call: RPC `get_popular_brands` executed
- Second call: NO RPC call (served from AsyncStorage cache)

**Result:** ☐ Pass ☐ Fail

---

## Test Suite 3: Enhanced Search (discovery.ts)

### TC-DS-001: Search with All 13 Params
**Steps:**
1. Open Discover screen
2. Tap "Filters" button
3. Set filters:
   - Category: Toys (select 1 category)
   - Condition: Like New
   - Age Group: 6-8
   - Gender: Unisex
   - Brand: LEGO
   - Color: Blue, Red (multi-select)
   - Price Range: $10 - $50
   - SP Eligible: ON
4. Tap "Apply Filters"
5. Type "star wars" in search bar
6. Select sort: "Price: Low to High"

**Expected:**
- Results match ALL filters:
  - Category = Toys
  - Condition = Like New
  - Age Group = 6-8
  - Gender = Unisex
  - Brand = LEGO (case-insensitive)
  - Color contains Blue OR Red
  - Price between $10-$50
  - accepts_swap_points = true
  - Title/description contains "star wars"
- Results sorted by price ascending

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-002: Undefined Filters Convert to Null
**Steps:**
1. Code inspection: Review `searchListings()` in `src/services/discovery.ts`
2. Check RPC call when filters are empty `{}`

**Expected:**
- Empty `categoryIds` array → passed as `null`
- Empty `colors` array → passed as `null`
- Undefined `brand` → passed as `null`
- NOT empty string or empty array

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-003: Sort by Relevance (Default)
**Steps:**
1. Open Discover screen
2. Type "bicycle" in search
3. Do NOT change sort option

**Expected:**
- Results sorted by relevance (highest first)
- Items with "bicycle" in title appear before items with "bicycle" in description

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-004: Sort by Newest
**Steps:**
1. Open Discover screen
2. Tap "Sort" dropdown
3. Select "Newest"

**Expected:**
- Results sorted by `created_at DESC`
- Most recently created item appears first

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-005: Sort by Price Low → High
**Steps:**
1. Open Discover screen
2. Tap "Sort" dropdown
3. Select "Price: Low to High"

**Expected:**
- Results sorted by price ascending
- $5 item appears before $50 item

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-006: Sort by Price High → Low
**Steps:**
1. Open Discover screen
2. Tap "Sort" dropdown
3. Select "Price: High to Low"

**Expected:**
- Results sorted by price descending
- $50 item appears before $5 item

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-007: Color Filter (Array Overlap)
**Steps:**
1. Open filter modal
2. Select colors: "Blue", "Red"
3. Apply filters

**Expected:**
- Results have `color` array containing Blue OR Red
- Item with color = ["blue", "gray"] → SHOWN
- Item with color = ["green"] → NOT SHOWN

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-008: Multi-Category Filter (OR Semantics)
**Steps:**
1. Open filter modal
2. Select categories: "Toys", "Books"
3. Apply filters

**Expected:**
- Results have `category_id` matching "Toys" OR "Books"
- Item in "Toys" → SHOWN
- Item in "Books" → SHOWN
- Item in "Clothing" → NOT SHOWN

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-009: Spelling Suggestion
**Steps:**
1. Add search history: "bicycle", "tricycle", "scooter"
2. Clear search bar
3. Type "bycicle" (typo, distance 1 from "bicycle")
4. Press Enter
5. Check if suggestion appears

**Expected:**
- "Did you mean 'bicycle'?" message appears
- Can tap suggestion to search for "bicycle"

**Result:** ☐ Pass ☐ Fail

---

### TC-DS-010: No Suggestion for Large Distance
**Steps:**
1. Add search history: "bicycle", "tricycle"
2. Type "xyz" (distance > 3 from all)
3. Press Enter

**Expected:**
- NO "Did you mean...?" suggestion
- Shows empty state or partial results

**Result:** ☐ Pass ☐ Fail

---

## Test Suite 4: Performance

### TC-PF-001: Search Latency (200ms Debounce)
**Steps:**
1. Open Discover screen
2. Type "lego" quickly
3. Measure time from last keystroke to results appearing

**Expected:**
- Debounce delay: ~200ms (not 1000ms like V2)
- Full latency: < 400ms on mid-tier device

**Result:** ☐ Pass ☐ Fail
**Actual Latency:** ______ ms

---

### TC-PF-002: Infinite Scroll (Next Page)
**Steps:**
1. Open Discover screen
2. Scroll to bottom of results
3. Wait for loading indicator

**Expected:**
- Next 20 items load automatically
- No duplicate items
- Loading time < 300ms

**Result:** ☐ Pass ☐ Fail

---

## Summary

**Total Tests:** 21
**Passed:** ☐
**Failed:** ☐
**Blocked:** ☐

**Critical Failures:**
- List any critical issues here

**Notes:**
- Additional observations

**Sign-off:**
- Tester: __________________
- Date: __________________
