# DISCOVERY-V2-002: Category + Text Search Implementation

## Changes Summary

This implementation fixes the issue where **category filtering is not applied when users search within a selected category**. Previously, selecting a category and searching would only apply the search query but ignore the category filter.

### Files Changed

#### 1. **Supabase Migration** (NEW)
- **File:** `supabase/migrations/20251224000001_add_category_text_search_rpc.sql`
- **Purpose:** Creates new RPC function `search_listings_by_category_and_query`
- **Function Signature:**
  ```sql
  search_listings_by_category_and_query(
    p_category_id UUID,
    p_query TEXT,
    p_sp_eligible_only BOOLEAN DEFAULT FALSE,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
  )
  ```
- **Behavior:**
  - If query is empty: returns all items in the category (pagination supported)
  - If query provided: returns items in category matching the text query
  - Respects SP-eligible filter in both cases
  - Ranks results by relevance (title matches = 2.0, description = 1.0, then by creation date)

#### 2. **Discovery Service** (UPDATED)
- **File:** `p2p-kids-marketplace/src/services/discovery.ts`
- **New Function:** `searchListingsByCategoryAndQuery`
  ```typescript
  export async function searchListingsByCategoryAndQuery(
    categoryId: string,
    query: string = '',
    filters?: CategoryFilters
  ): Promise<SearchResult[]>
  ```
- **Behavior:** Calls the new Supabase RPC function with category filtering

#### 3. **Browse Items Screen** (UPDATED)
- **File:** `p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx`
- **Changes:**
  1. Added import for `searchListingsByCategoryAndQuery`
  2. Updated search handler to check if category is selected:
     - If category selected → use `searchListingsByCategoryAndQuery`
     - If no category → use `searchListings`
  3. Added `selectedCategory` to useEffect dependency array for SP filter re-run
  4. Applied logic in TWO places:
     - Initial search with debounce (line ~595)
     - Re-search when SP filter toggles (line ~661)

---

## How It Works

### Scenario 1: User Selects Category "Toys" and Searches for "Lego"
1. Category button "Toys" is tapped → `selectedCategory = toys_uuid`
2. User types "Lego" in search box → debounce 1000ms
3. Screen calls: `searchListingsByCategoryAndQuery(toys_uuid, "Lego", {spEligibleOnly: false})`
4. Server returns only items in "Toys" category matching "Lego"
5. Results: `["Lego Castle", "Lego Duplo Set"]` (if they exist in Toys category)

### Scenario 2: User Searches Without Category Selected
1. `selectedCategory = null`
2. User types "Lego" in search box
3. Screen calls: `searchListings("Lego", {spEligibleOnly: false})`
4. Server returns items matching "Lego" across ALL categories
5. Results: Both Toys AND other categories that have "Lego"

### Scenario 3: User Toggles "SP-Eligible Only" with Category Selected
1. User has searched "Winter" in "Clothing" category
2. User toggles SP filter ON
3. `useEffect([spEligibleOnly, searchQuery, selectedCategory])` triggers
4. Screen re-runs with:
   - If category selected: `searchListingsByCategoryAndQuery(clothing_uuid, "Winter", {spEligibleOnly: true})`
   - If no category: `searchListings("Winter", {spEligibleOnly: true})`
5. Results updated to only SP-eligible items in that category

---

## Database Migration Instructions

### Step 1: Copy SQL
The migration SQL is in `supabase/migrations/20251224000001_add_category_text_search_rpc.sql`

### Step 2: Apply via Supabase Dashboard
1. Open **Supabase Dashboard** → Your Project
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Paste the entire function definition (from `CREATE OR REPLACE FUNCTION` to the closing `$$;`)
5. Click **Execute**

### Step 3: Verify
Run this verification query:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'search_listings_by_category_and_query';
```

Expected result: One row with `search_listings_by_category_and_query`

### Step 4: Test the Function
```sql
-- Test 1: Get all items in Toys category (empty query)
SELECT id, title, category_id 
FROM search_listings_by_category_and_query(
  (SELECT id FROM categories WHERE name = 'Toys' LIMIT 1),
  '',
  false,
  10
);

-- Test 2: Search for "jacket" in Clothing category
SELECT id, title, relevance 
FROM search_listings_by_category_and_query(
  (SELECT id FROM categories WHERE name = 'Clothing' LIMIT 1),
  'jacket',
  false,
  10
);

-- Test 3: SP-eligible items in Toys
SELECT id, title, accepts_swap_points 
FROM search_listings_by_category_and_query(
  (SELECT id FROM categories WHERE name = 'Toys' LIMIT 1),
  '',
  true,
  10
);
```

---

## Testing Checklist

### Manual Testing (In Simulator/App)
- [ ] Browse items without selecting a category
- [ ] Search for "winter" across all categories → should return 3+ results from different categories
- [ ] Select "Clothing" category
- [ ] Search for "winter" in Clothing category → should return only Clothing items with "winter"
- [ ] Toggle "SP-Eligible Only" filter → results should update to only show SP-eligible items in that category
- [ ] Click "All" category button to clear category filter
- [ ] Search again for "winter" → should return from all categories again
- [ ] Select a category with few items, search for non-existent item → should show empty results
- [ ] Verify search results are ranked by relevance (title matches appear first)

### Unit Tests (Recommended)
```typescript
describe('searchListingsByCategoryAndQuery', () => {
  it('should return all items in category when query is empty', async () => {
    const results = await searchListingsByCategoryAndQuery(
      'toys-uuid',
      '',
      { spEligibleOnly: false }
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.category_id === 'toys-uuid')).toBe(true);
  });

  it('should return category items matching search query', async () => {
    const results = await searchListingsByCategoryAndQuery(
      'clothing-uuid',
      'jacket',
      { spEligibleOnly: false }
    );
    expect(results.every(r => r.category_id === 'clothing-uuid')).toBe(true);
    expect(results.every(r => 
      r.title.toLowerCase().includes('jacket') || 
      r.description?.toLowerCase().includes('jacket')
    )).toBe(true);
  });

  it('should filter by SP eligibility when requested', async () => {
    const results = await searchListingsByCategoryAndQuery(
      'toys-uuid',
      'lego',
      { spEligibleOnly: true }
    );
    expect(results.every(r => r.accepts_swap_points === true)).toBe(true);
  });
});
```

---

## Known Limitations / TODOs

1. **RLS Policies:** The RPC function respects `items.status = 'available'` but does NOT filter by user's node. This is intentional for category browsing across nodes. If node-based filtering is required, additional RPC parameters needed.

2. **Performance:** Full-text search uses `ILIKE` (substring matching) rather than PostgreSQL full-text search. For large datasets (10K+ items), consider:
   - Adding `tsvector` column for full-text search
   - Creating indexes on `title` and `description`
   - Implementing pagination (already supported via `p_limit` and `p_offset`)

3. **Search Beyond Titles:** Currently searches title + description. Future enhancements:
   - Search tags/categories names
   - Search seller profiles
   - Implement elasticsearch integration

---

## Regression Testing (Tier 1)

**Impacted Flows:**
- FLOW-06: Discovery – Feed/Search/Filters/Favorites
- FLOW-04: Listings – Create/Edit/Delete/Expire
- FLOW-05: Media Upload (if category affects visibility)

**Required Tests:**
```bash
# Mobile app type check (should pass after migration applied)
cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit

# Functional tests
# 1. Test search without category
# 2. Test category browsing
# 3. Test category + search combination
# 4. Test SP filter with category
# 5. Verify relevance ordering (title > description)
```

---

## Module Alignment

**Module:** MODULE-05-DISCOVERY-V2  
**Task:** DISCOVERY-V2-002 (Combined Category + Text Search)  
**Status:** ✅ COMPLETE (pending Supabase migration)

**Dependencies Met:**
- ✅ MODULE-03 NODE-006 (Node filtering - still available via `getItems`)
- ✅ MODULE-03 NODE-007 (Radius search - still available via `getItemsWithinRadius`)
- ✅ MODULE-04 LISTING-V2-004 (SP-eligible filter - passed through to RPC)
- ✅ DISCOVERY-V2-001 (Basic search - still works, now enhanced with category)

**Next Module (MODULE-06: Trade Flow)** can depend on this search capability for finding items to purchase.

---

## Summary of Fixes

| Issue | Before | After |
|-------|--------|-------|
| **Select category + search** | Search ignores category | Category filter applied in server RPC |
| **Search logic location** | Mobile-side filtering | Server-side filtering (more efficient) |
| **Relevance ranking** | No ranking | Title matches (2.0) > description (1.0) |
| **Pagination support** | Not available | Supported via limit/offset in RPC |
| **Empty category query** | Not handled | Returns all items in category |

---

## Files to Apply

1. **Apply this migration to Supabase:**
   - Copy SQL from `supabase/migrations/20251224000001_add_category_text_search_rpc.sql`
   - Run in Supabase SQL Editor

2. **Already updated in mobile app:**
   - `p2p-kids-marketplace/src/services/discovery.ts` ✅
   - `p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx` ✅

3. **No database schema changes required** (function-only addition)

---

**Created:** 2025-12-24  
**Status:** Ready for deployment  
**Prerequisites:** Supabase migration must be applied before app update
