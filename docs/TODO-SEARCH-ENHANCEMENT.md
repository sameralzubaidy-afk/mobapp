# TODO: Search Enhancement — Classic Search + Filters + Autocomplete

**Track:** 1 — Search Enhancement  
**Priority:** MVP  
**Target Weeks:** 2–3  
**Flow IDs:** FLOW-06 (Discovery), FLOW-00 (Infra/Performance)  
**Owner:** @sameralzubaidy-afk  
**Dependencies:** None (items table exists, search_listings RPC exists)

---

## 1. Problem Statement (What Is Broken Today)

| Problem | Location | Severity |
|---------|----------|----------|
| BrowseItemsScreen debounce is 1000ms — user waits 1 second before any search fires | `src/screens/home/BrowseItemsScreen.tsx` | P0 — user frustration |
| `search_listings` RPC only supports text query + SP toggle. No condition, price, age, gender, multi-category filters | `supabase/migrations/20251220000002_search_listings_rpc.sql` | P0 — missing UX |
| `age_group` and `gender` columns do not exist on `items` table | DB schema | P1 — filter not possible |
| No autocomplete / recent searches UX | SearchScreen + BrowseItemsScreen | P1 — discovery gap |
| Filters scattered across two separate screens (SearchScreen vs BrowseItemsScreen) | UX fragmentation | P1 |
| Search only scoped to current node — no cross-node option visible to user | BrowseItemsScreen | P2 |

---

## 2. What We Are Building

### 2.1 Quick Fix (Day 1 — no new screens)
- [ ] Fix BrowseItemsScreen debounce: `1000ms → 200ms`
- [ ] Fix SearchScreen debounce: confirm it is `300ms`, if not set to `300ms`
- [ ] Keep `rawQuery` (immediate TextInput state) separate from `debouncedQuery` (fetch trigger) — already done in BrowseItemsScreen, confirm pattern

### 2.2 DB Schema Addition (Migration Required)
New columns on `items` table:
```sql
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS age_group TEXT
    CHECK (age_group IN ('0-2', '3-5', '6-8', '9-12', '13+')),
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('boy', 'girl', 'unisex')),
  ADD COLUMN IF NOT EXISTS brand TEXT CHECK (LENGTH(brand) <= 100);
```

Add indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_items_age_group ON items(age_group) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_items_gender ON items(gender) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_items_price ON items(price) WHERE status = 'available';
```

Migration file: `supabase/migrations/20260420000001_add_item_filter_columns.sql`

RLS: columns inherit existing item RLS — no new policies needed.

### 2.3 Updated `search_listings` RPC
Replace current 3-parameter RPC with full-filter version:

**New Signature:**
```sql
CREATE OR REPLACE FUNCTION search_listings(
  p_query        TEXT DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit        INT DEFAULT 20,
  p_offset       INT DEFAULT 0,
  -- NEW filter params:
  p_category_ids UUID[] DEFAULT NULL,      -- multi-category array
  p_condition    TEXT DEFAULT NULL,         -- 'new','like_new','good','fair','poor'
  p_min_price    NUMERIC DEFAULT NULL,
  p_max_price    NUMERIC DEFAULT NULL,
  p_age_group    TEXT DEFAULT NULL,         -- '0-2','3-5','6-8','9-12','13+'
  p_gender       TEXT DEFAULT NULL          -- 'boy','girl','unisex'
)
```

**Return columns:** add `age_group`, `gender`, `brand` to RETURNS TABLE.

**Filter logic additions:**
```sql
AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
AND (p_condition IS NULL OR i.condition = p_condition)
AND (p_min_price IS NULL OR i.price >= p_min_price)
AND (p_max_price IS NULL OR i.price <= p_max_price)
AND (p_age_group IS NULL OR i.age_group = p_age_group)
AND (p_gender IS NULL OR i.gender = p_gender)
```

**Important:**  
- ALL parameters use `p_` prefix (mandatory naming convention)  
- ALL column refs are table-qualified: `i.price`, NOT `price`  
- Add `p_offset` for pagination  
- Upgrade ILIKE to `to_tsvector + plainto_tsquery` for better performance:
  ```sql
  AND (
    p_query = '' OR 
    to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
    @@ plainto_tsquery('english', p_query)
    OR i.title ILIKE '%' || p_query || '%'  -- fallback for short queries
  )
  ```

Migration file: `supabase/migrations/20260420000002_update_search_listings_rpc.sql`

Also update `search_listings_by_category` RPC to accept same filter params for consistency.

### 2.4 Updated TypeScript Types
File: `p2p-kids-marketplace/src/types/discovery.ts`

Add to `DiscoveryFilters`:
```typescript
export interface DiscoveryFilters {
  query?: string;
  spEligibleOnly?: boolean;
  limit?: number;
  offset?: number;
  // NEW:
  categoryIds?: string[];
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  minPrice?: number;
  maxPrice?: number;
  ageGroup?: '0-2' | '3-5' | '6-8' | '9-12' | '13+';
  gender?: 'boy' | 'girl' | 'unisex';
}
```

Add to `SearchResult` and `CategoryResult`:
```typescript
  age_group?: string | null;
  gender?: string | null;
  brand?: string | null;
```

### 2.5 Updated `searchListings()` Service Function
File: `p2p-kids-marketplace/src/services/discovery.ts`

Update `searchListings()` to pass all new filter params to RPC:
```typescript
const { data, error } = await supabase.rpc('search_listings', {
  p_query: query.trim(),
  p_sp_eligible_only: spEligibleOnly,
  p_limit: filters?.limit ?? 20,
  p_offset: filters?.offset ?? 0,
  p_category_ids: filters?.categoryIds ?? null,
  p_condition: filters?.condition ?? null,
  p_min_price: filters?.minPrice ?? null,
  p_max_price: filters?.maxPrice ?? null,
  p_age_group: filters?.ageGroup ?? null,
  p_gender: filters?.gender ?? null,
});
```

### 2.6 Filter Modal UI Component
**New file:** `p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx`

Filter modal opens from a "Filters" button in SearchScreen and BrowseItemsScreen.

**Filter groups in modal (in order):**

| Group | UI Type | Values |
|-------|---------|--------|
| Category | Horizontal scrollable pills (multi-select) | All existing categories from `getCategories()` |
| Condition | Horizontal pills (single-select) | New / Like New / Good / Fair / Poor |
| Age Group | Horizontal pills (single-select) | 0-2 / 3-5 / 6-8 / 9-12 / 13+ |
| Gender | Horizontal pills (single-select) | Boy / Girl / Unisex |
| Price Range | Two TextInput fields (min / max) | Dollar values |
| Swap Points only | Toggle switch | On/Off |

**Modal behavior:**
- Opens as bottom sheet (slide up from bottom)
- "Apply Filters" button: closes modal, fires search with filters
- "Clear All" button: resets all filters to null
- Active filter count shown on the "Filters" button (e.g., "Filters (3)")
- Close via swipe down or X button

**Props:**
```typescript
interface SearchFilterModalProps {
  visible: boolean;
  filters: DiscoveryFilters;
  categories: { id: string; name: string }[];
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
}
```

### 2.7 Active Filters Chip Row
**New file:** `p2p-kids-marketplace/src/components/molecules/ActiveFilterChips.tsx`

Horizontal scrollable row of chips showing active filters below the search bar.
Each chip has an ✕ to remove that single filter.
Only renders when at least 1 filter is active.

### 2.8 Recent Searches
**Storage:** AsyncStorage key `@search_recent_queries`  
**Max:** 8 recent queries  
**Show when:** Search bar is focused AND query is empty  
**Logic:** After successful search (≥1 result), prepend query to list. Deduplicate. Cap at 8.

**UI:** Vertical list under search bar, each row has search icon + query text + ✕ to remove.

### 2.9 Search Autocomplete / Suggestions
**Approach:** Client-side suggestions from recent searches (Phase 1 — no additional backend needed)

Show dropdown when:
- Search bar focused
- User has typed ≥ 2 characters
- Query matches prefix of any recent search

Max 5 suggestions shown.  
Tap suggestion → fills search bar and fires search immediately (no debounce wait).

> **TODO(UX): Phase 2 — server-side autocomplete via trigram index on item titles (post-launch)**

### 2.10 Screen Updates

#### BrowseItemsScreen changes:
1. Fix debounce: `1000ms → 200ms`
2. Add "Filters" button in header row (next to search bar)
3. Integrate `SearchFilterModal`
4. Render `ActiveFilterChips` below search bar
5. Pass all active filters through to `searchListings()` / `searchListingsByCategoryAndQuery()`
6. Remove hardcoded single-category selector UI (replace with multi-category via filter modal)

#### SearchScreen changes:
1. Confirm debounce at `300ms`
2. Add "Filters" button
3. Integrate `SearchFilterModal`
4. Render `ActiveFilterChips`
5. Add recent searches display when bar is focused + empty
6. Add autocomplete suggestions when bar focused + ≥2 chars typed

---

## 3. Files to Create / Modify

### New Files:
| File | Purpose |
|------|---------|
| `supabase/migrations/20260420000001_add_item_filter_columns.sql` | Add age_group, gender, brand columns to items |
| `supabase/migrations/20260420000002_update_search_listings_rpc.sql` | Update RPC with all new filter params |
| `p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx` | Filter bottom sheet |
| `p2p-kids-marketplace/src/components/molecules/ActiveFilterChips.tsx` | Active filter chips row |

### Modified Files:
| File | Change |
|------|--------|
| `p2p-kids-marketplace/src/types/discovery.ts` | Add new filter fields + SearchResult fields |
| `p2p-kids-marketplace/src/services/discovery.ts` | Pass new filter params to RPC |
| `p2p-kids-marketplace/src/screens/home/SearchScreen.tsx` | Add filter modal, chips, recent searches, autocomplete |
| `p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx` | Fix debounce, add filter modal, chips |
| `p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx` | Add age_group, gender, brand fields to form |

---

## 4. CreateListingScreen Updates (new fields)
Since we are adding `age_group`, `gender`, `brand` to items, these must be added to the listing creation form.

New fields in `CreateListingScreen`:
- **Age Group** — horizontal pill selector (optional)  
- **Gender** — horizontal pill selector (optional — Boy / Girl / Unisex)  
- **Brand** — plain text input (optional, max 100 chars)  

These three fields are all optional. If seller does not set them, they default to NULL (not filtered out in search unless buyer explicitly filters by them).

Also update `createListing()` in `src/services/listing.ts` to accept and pass these fields.

---

## 5. Acceptance Criteria

### DB:
- [ ] `age_group` column exists on `items` with correct CHECK constraint
- [ ] `gender` column exists on `items` with correct CHECK constraint  
- [ ] `brand` column exists on `items`, max 100 chars
- [ ] `search_listings` RPC accepts all new params with correct defaults
- [ ] RPC returns correct results for each filter (unit-testable with SQL)
- [ ] Partial text search: typing "red wint" returns items with "red winter jacket"
- [ ] Multi-category filter: passing `[cat1_id, cat2_id]` returns items from both categories
- [ ] Price range filter: $5–$20 range returns only items in that range

### Performance:
- [ ] BrowseItemsScreen: first results appear within 300ms of user stopping typing (200ms debounce + ~100ms RPC)
- [ ] SearchScreen: results appear within 400ms
- [ ] No duplicate search fires when user clears the field

### UI:
- [ ] "Filters" button shows active count badge: "Filters (2)"
- [ ] Applying filters via modal fires new search immediately
- [ ] "Clear All" resets all filters and refires search
- [ ] ActiveFilterChips row is hidden when no filters active
- [ ] Each chip correctly removes only its own filter
- [ ] Recent searches show when bar focused + empty
- [ ] Autocomplete shows when ≥2 chars typed and matches recent searches
- [ ] Tapping autocomplete suggestion fires search immediately

### Listing Creation:
- [ ] Age Group, Gender, Brand fields visible in CreateListingScreen
- [ ] All three fields are optional (no validation error if skipped)
- [ ] Submitted listing has correct values in DB

### TypeScript:
- [ ] `yarn typecheck` passes with 0 errors
- [ ] `yarn lint` passes with 0 errors
- [ ] No duplicate exported identifiers

---

## 6. Test Coverage Required

### Unit tests (Jest):
- [ ] `src/__tests__/services/discovery.test.ts` — test filter combinations passed to RPC
- [ ] `src/__tests__/utils/recentSearches.test.ts` — add, deduplicate, cap at 8, remove one

### Maestro E2E (new file):
- [ ] `p2p-kids-marketplace/e2e/search-filters.yaml` — open filters → select Condition=New + Age=3-5 → verify results filtered
- [ ] `p2p-kids-marketplace/e2e/search-autocomplete.yaml` — type 2 chars → tap recent suggestion → verify search fires

### Manual verification queries:
```sql
-- Verify new columns exist
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'items' AND column_name IN ('age_group', 'gender', 'brand');

-- Verify updated RPC signature
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc WHERE proname = 'search_listings';

-- Spot check: filter by age_group
SELECT id, title, age_group FROM search_listings(
  p_query := 'jacket',
  p_age_group := '3-5'
);

-- Spot check: multi-category (replace UUIDs with real ones)
SELECT id, title, category_id FROM search_listings(
  p_query := '',
  p_category_ids := ARRAY['uuid1'::uuid, 'uuid2'::uuid]
);
```

---

## 7. Out of Scope for This TODO
- NLP / natural language search ("blue coat for 4yr old") — POST-LAUNCH
- Server-side autocomplete (trigram) — POST-LAUNCH
- AI-powered filter suggestions — POST-LAUNCH
- Saved search presets — POST-LAUNCH

---

## 8. Preflight Gate (Before Merging)
```bash
cd p2p-kids-marketplace
yarn typecheck    # must exit 0
yarn lint         # must exit 0

# Verify no duplicate exports
rg -n "export (const|function) searchListings" src/
rg -n "export (const|function|interface) DiscoveryFilters" src/
```

---

## Definition of Done
- [ ] DB migration applied on staging
- [ ] All acceptance criteria above checked
- [ ] Maestro E2E tests pass on staging
- [ ] BrowseItemsScreen debounce fix verified (stopwatch test: type, wait < 300ms, results appear)
- [ ] Typecheck + lint PASS
- [ ] FLOW-06 smoke test passing
