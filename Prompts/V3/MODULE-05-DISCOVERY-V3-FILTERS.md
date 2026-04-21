# MODULE 05: SEARCH & DISCOVERY (V3 — Filters, Autocomplete, Unified Discover)

**Version:** 3.0 (Enhanced Discovery — Multi-Filter + Autocomplete + Unified Screen)
**Status:** Ready for Implementation
**Last Updated:** April 21, 2026
**Dependencies:** MODULE-04 (Item Listing V2), MODULE-05 (Discovery V2)
**Target Release:** Week 2-3 (MVP Track 1)
**Traceability Source:** `POC1/ai-code-generator/modules/docx/SEARCH-FILTER-REQUIREMENTS.md` v1.0

---

## V3 OVERVIEW

This module **extends MODULE-05 V2** with the new discovery experience defined in `SEARCH-FILTER-REQUIREMENTS.md`. V2 delivered SP-eligible search, basic relevance ranking and personalized recommendations. V3 replaces the dual-screen `SearchScreen` + `BrowseItemsScreen` with a single unified `DiscoverScreen`, adds 9 filters and 4 sort options, and brings search latency from ~1300ms down to < 400ms.

V3 is a **Track 1 foundation** — the new item columns (`age_group`, `gender`, `brand`, `color`) introduced here are consumed by MODULE-04 V3 (Bulk Listing + AI Auto-Fill), MODULE-12 V3 (Admin Category Management) and MODULE-18 (Trading Education).

V3 scope:

- **Unified DiscoverScreen** replacing `SearchScreen` + `BrowseItemsScreen`.
- **Debounce reduced to 200ms** + optimistic UI (keep old results while new load).
- **9 filters**: multi-category, condition, age group, gender, brand, color (multi), price range, SP toggle, search query.
- **4 sort options**: Relevance (default), Newest, Price Low→High, Price High→Low.
- **Recent searches** (AsyncStorage, max 8).
- **Client-side autocomplete** from recent searches.
- **Client-side "Did you mean…?"** via Levenshtein distance < 3.
- **Brand autocomplete** (hybrid: 50 predefined + DB via `get_popular_brands`).
- **Smart empty states** with fallback suggestions.
- **Infinite scroll** (20 per batch, `FlatList onEndReached`).
- **Skeleton placeholders** + network error banner (non-blocking).

V3 **does not** change MODULE-04 V2 listing lifecycle or MODULE-05 V2 personalized recommendations (they continue to operate using the new enriched columns).

---

## CHANGELOG FROM V2 → V3

### V2 Limitations (carried over from MODULE-05 V2)

- Debounce was **1000ms** in `BrowseItemsScreen` → search felt slow.
- `search_listings` RPC had only **3 params** (`p_query`, `p_sp_eligible_only`, `p_limit`).
- Two parallel screens (`SearchScreen` + `BrowseItemsScreen`) with duplicate logic.
- No filters for age, gender, price range, condition, brand or color.
- No autocomplete, no typo tolerance, no sort options, no recent searches.
- No skeleton placeholders, no optimistic UI.

### V3 Enhancements

1. **Schema additions** (non-breaking): `items.age_group`, `items.gender`, `items.brand`, `items.color TEXT[]` + partial indexes on `status = 'available'`.
2. **RPC rewrite**: `search_listings` now accepts 13 parameters (query + 9 filters + 2 paging + sort). V2 callers must be updated — a migration `DROP FUNCTION` is required because of signature change.
3. **New RPC** `get_popular_brands(p_limit)` for hybrid brand autocomplete.
4. **Unified `DiscoverScreen`** (replaces `SearchScreen` + `BrowseItemsScreen`).
5. **New services**: `searchHistory.ts`, `brandAutocomplete.ts`.
6. **New utils**: `fuzzyMatch.ts` (Levenshtein), `filterHelpers.ts`.
7. **10 new components** (filter modal, chips, autocomplete, sort dropdown, result card, empty state, skeleton, network banner, etc.).
8. **Performance targets**: backend RPC < 200ms, full keystroke→result < 400ms.

---

## CRITICAL V3 RULES FOR DISCOVERY MODULE

### Rule 1: Filter Persistence
- Filters are **session-only**. They persist while navigating to `ItemDetailScreen` and back, but reset on app restart or tab switch away from Discover.

### Rule 2: Backward Compatibility for Items
- All 4 new columns (`age_group`, `gender`, `brand`, `color`) are **NULLABLE**. Existing items without values must still appear in search when no filter for that dimension is active.

### Rule 3: RPC Parameter Contract
- `search_listings` params with `NULL` mean "no filter on this dimension". Callers MUST NOT pass empty strings or empty arrays to signal "no filter" — use `NULL`.
- `p_category_ids` is `UUID[]` — multi-category OR semantics.
- `p_colors` is `TEXT[]` — item matches if **any** of its `color[]` values overlap with `p_colors` (uses `&&` operator).
- `p_brand` is case-insensitive exact match (`LOWER(brand) = LOWER(p_brand)`).

### Rule 4: Empty Category Handling
- V3 does **not** hide empty categories here. Category filtering by item count is the responsibility of MODULE-12 V3 (Admin Category Management). `search_listings` returns results for any category_id passed.

### Rule 5: Privacy / History Scope
- Recent searches are stored **only in AsyncStorage** (client-side). No DB table. Key: `@kids_marketplace:recent_searches`. Max 8 entries, LRU eviction.

### Rule 6: Performance Budgets (enforced in tests)
- Debounce: exactly **200ms** (constant `SEARCH_DEBOUNCE_MS`).
- Backend RPC p95: < 200ms on staging with 10k items.
- First result render after last keystroke: < 400ms on mid-tier Android.
- Next infinite-scroll batch: < 300ms.

### Rule 7: Accessibility
- Every interactive element has `accessibilityLabel`. Filter button must announce active count. Removing a filter chip must announce "`<filter> filter removed`".

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT IMPLEMENTING MODULE-05 DISCOVERY V3 (FILTERS & AUTOCOMPLETE).

CONTEXT:
- Kids P2P Marketplace. React Native (Expo) app + Supabase backend.
- MODULE-05 V2 is already implemented (basic search_listings with 3 params,
  personalized recommendations, category browse).
- MODULE-04 V2 items table exists (id, title, description, price,
  accepts_swap_points, status, seller_id, category_id, condition,
  created_at, updated_at).
- V3 adds 4 new item columns and replaces the search RPC.
- Source of truth: POC1/ai-code-generator/modules/docx/SEARCH-FILTER-REQUIREMENTS.md

YOUR INSTRUCTIONS:
1. Read the entire module before generating any code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Implement tasks in the order DISCOVERY-V3-001 … DISCOVERY-V3-008.
4. For each task: generate files at the exact filepath given; run type-check
   and unit tests; do NOT commit.
5. Migrations run in lexicographic order. Name them 20260420000001_* and
   20260420000002_* exactly as specified.
6. If a file already exists from V2 (e.g. src/services/discovery.ts),
   MODIFY it in place — do not delete V2 exports; ADD the new signatures.
7. Delete the old SearchScreen and BrowseItemsScreen only after wiring
   DiscoverScreen into the navigator and confirming the app still builds.
8. Stop and report to the user before running any `supabase db push` or
   similar destructive command.

VERIFICATION STEPS (agent must print results after each task):
- TypeScript type-check: `npm run type-check`
- Linting: `npm run lint`
- Unit tests (only the new ones): `npm test -- --testPathPattern=discovery|search|filter|fuzzy`
- Maestro flows (manual run on device): see DISCOVERY-V3-008.

ERROR HANDLING:
- If a required file is missing, STOP and report exact missing paths.
- If DROP FUNCTION fails because V2 signature is different, reconcile by
  reading current pg_proc before writing migration 002.

==================================================
NEXT TASK: DISCOVERY-V3-001 (Schema & Indexes)
==================================================
*/
```

---

## TASK DISCOVERY-V3-001: Schema Migration — Filter Columns & Indexes

**Duration:** 1.5 hours
**Priority:** Critical (foundational — blocks all other V3 tasks + MODULE-04 V3)
**Dependencies:** MODULE-04 V2 (items table must exist)

### Description

Add 4 nullable columns (`age_group`, `gender`, `brand`, `color TEXT[]`) to `items` with `CHECK` constraints, then create 6 partial/GIN indexes for filter performance. All indexes are partial on `status = 'available'` (keeps index size ~80% smaller than a full index; most queries filter for active listings only).

### Acceptance Criteria

- [ ] Migration file exists at `supabase/migrations/20260420000001_add_item_filter_columns.sql`.
- [ ] 4 columns added, all nullable, with correct CHECK constraints.
- [ ] 6 indexes created (`age_group`, `gender`, `brand`, `color` GIN, `price`, `(category_id, price)`).
- [ ] Migration is idempotent (`IF NOT EXISTS` on columns and indexes).
- [ ] Column comments added for each new column.
- [ ] Verification query at the bottom of the file confirms columns exist.

### AI Prompt for Cursor

````text
TASK: Generate Supabase migration to add filter columns and indexes to items table.

CONTEXT:
- Project is a P2P kids marketplace on Supabase.
- items table already exists with: id, title, description, price, accepts_swap_points,
  status, seller_id, category_id, condition, created_at, updated_at.
- Status enum values include 'available'. We filter for that in partial indexes.
- All new columns must be NULLABLE so existing rows remain valid.

REQUIREMENTS (verbatim from SEARCH-FILTER-REQUIREMENTS.md § Migration 1):
- age_group TEXT, CHECK age_group IN ('0-2','3-5','6-8','9-12','13+')
- gender TEXT, CHECK gender IN ('boy','girl','unisex')
- brand TEXT, CHECK LENGTH(brand) <= 100
- color TEXT[]  (no CHECK; 12 allowed values enforced client-side)
- Partial indexes on status='available' for age_group, gender, brand, price
- GIN index on color
- Composite partial index on (category_id, price)
- COMMENT ON COLUMN for each new column

OUTPUT ONE FILE ONLY:
--- FILE: supabase/migrations/20260420000001_add_item_filter_columns.sql ---

(full SQL body)

VERIFICATION QUERY AT END (commented-out):
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='items' AND column_name IN ('age_group','gender','brand','color');
````

---

## TASK DISCOVERY-V3-002: Rewrite `search_listings` RPC + Add `get_popular_brands`

**Duration:** 3 hours
**Priority:** Critical
**Dependencies:** DISCOVERY-V3-001

### Description

Replace the V2 3-param `search_listings(TEXT, BOOLEAN, INT)` with a 13-param version supporting 9 filters, pagination and 4 sort modes. Add `get_popular_brands(p_limit INT)` for the brand autocomplete dropdown.

### Acceptance Criteria

- [ ] Migration file exists at `supabase/migrations/20260420000002_update_search_listings_rpc.sql`.
- [ ] `DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);` executed first.
- [ ] New `search_listings` function created with the exact signature in § Backend Functions below.
- [ ] Function is `STABLE` (not `VOLATILE`).
- [ ] Relevance score: title FTS match > partial title ILIKE > partial description ILIKE > fallback.
- [ ] Color filter uses array overlap operator `&&`.
- [ ] Multi-category uses `= ANY(p_category_ids)`.
- [ ] Brand filter is case-insensitive (`LOWER(brand) = LOWER(p_brand)`).
- [ ] Sort applied via nested `CASE p_sort_by` clauses with fallback `created_at DESC`.
- [ ] `get_popular_brands(p_limit INT DEFAULT 50)` returns `(brand TEXT, item_count BIGINT)` ordered by count DESC.
- [ ] Integration test passes: search with 3 filters + sort returns < 200ms on staging (10k items).

### Target Function Signature (must match exactly)

```sql
CREATE OR REPLACE FUNCTION search_listings(
  p_query            TEXT    DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit            INT     DEFAULT 20,
  p_offset           INT     DEFAULT 0,
  p_category_ids     UUID[]  DEFAULT NULL,
  p_condition        TEXT    DEFAULT NULL,
  p_min_price        NUMERIC DEFAULT NULL,
  p_max_price        NUMERIC DEFAULT NULL,
  p_age_group        TEXT    DEFAULT NULL,
  p_gender           TEXT    DEFAULT NULL,
  p_brand            TEXT    DEFAULT NULL,
  p_colors           TEXT[]  DEFAULT NULL,
  p_sort_by          TEXT    DEFAULT 'relevance'
) RETURNS TABLE (
  id UUID, title TEXT, description TEXT, price NUMERIC,
  accepts_swap_points BOOLEAN, status TEXT, seller_id UUID,
  category_id UUID, condition TEXT, age_group TEXT, gender TEXT,
  brand TEXT, color TEXT[], created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ, relevance REAL
) LANGUAGE plpgsql STABLE
```

### AI Prompt for Cursor

````text
TASK: Replace V2 search_listings RPC with 13-param V3 version and add get_popular_brands.

CONTEXT:
- V2 signature: search_listings(TEXT, BOOLEAN, INT) — must be DROPped first.
- New columns: age_group, gender, brand, color[] (added in 20260420000001).
- Status filter is fixed at 'available'.
- Full-text search uses to_tsvector('english', title || ' ' || description)
  with plainto_tsquery. If V2 had a stored search_vector column, you may
  use it; otherwise compute inline (SEARCH-FILTER-REQUIREMENTS.md uses inline).

REQUIREMENTS (verbatim from SEARCH-FILTER-REQUIREMENTS.md § Migration 2):
1. DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);
2. CREATE FUNCTION with the 13-param signature shown in the module.
3. Build the WHERE clause with NULL-safe filters:
      AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
      AND (p_colors IS NULL OR i.color && p_colors)
      AND (p_brand IS NULL OR LOWER(i.brand) = LOWER(p_brand))
      ... etc for each filter.
4. ORDER BY uses nested CASE on p_sort_by (relevance | newest | price_asc | price_desc)
   with NULLS LAST and final fallback `i.created_at DESC`.
5. Relevance CASE returns 2.0 | 1.5 | 1.0 | 0.5 as in the spec.
6. Add get_popular_brands(p_limit INT DEFAULT 50) returning (brand, item_count).
7. COMMENT ON FUNCTION for both.

OUTPUT ONE FILE ONLY:
--- FILE: supabase/migrations/20260420000002_update_search_listings_rpc.sql ---
````

---

## TASK DISCOVERY-V3-003: Services Layer — discovery, searchHistory, brandAutocomplete

**Duration:** 3 hours
**Priority:** High
**Dependencies:** DISCOVERY-V3-002

### Description

Update existing `src/services/discovery.ts` and create two new service modules. All functions must match the exact signatures in the source doc so components can import them directly.

### Files to Create / Modify

| Path | Action | Exports |
|---|---|---|
| `p2p-kids-marketplace/src/services/discovery.ts` | MODIFY | `searchListings(query, filters) => Promise<SearchResult[]>`, `searchListingsByCategory(categoryId, filters)`, `suggestSpellingCorrection(query, recent)` |
| `p2p-kids-marketplace/src/services/searchHistory.ts` | NEW | `getRecentSearches()`, `addSearchToHistory(q)`, `removeSearchFromHistory(q)`, `clearSearchHistory()`, `getAutocompleteSuggestions(q, max?)` |
| `p2p-kids-marketplace/src/services/brandAutocomplete.ts` | NEW | `PREDEFINED_BRANDS` (const array of 50), `getBrandSuggestions(q) => Promise<string[]>`, `fetchDatabaseBrands()` (cached 5 min) |

### Acceptance Criteria

- [ ] `searchListings` passes **all 13 params** to the `search_listings` RPC, converting undefined filter fields to `null` (not empty string / empty array).
- [ ] `suggestSpellingCorrection` calls `findClosestMatch` (util from DISCOVERY-V3-004) with threshold 3.
- [ ] `searchHistory` uses key `@kids_marketplace:recent_searches`, max 8, dedupe case-insensitive, LRU (prepend on add).
- [ ] `getAutocompleteSuggestions` filters recent searches by `startsWith` (case-insensitive) and returns max 5.
- [ ] `PREDEFINED_BRANDS` contains all 50 brands listed in `SEARCH-FILTER-REQUIREMENTS.md` § Section 11 (exact casing).
- [ ] `getBrandSuggestions(q)` returns only when `q.length >= 2`, merges predefined + DB, dedupes case-insensitive, sorts alphabetically, caps at 8.
- [ ] `fetchDatabaseBrands` caches via `AsyncStorage` key `@kids_marketplace:brand_cache` with TTL 5 minutes.
- [ ] Unit tests in `src/__tests__/services/` for each service (see DISCOVERY-V3-008).

### AI Prompt for Cursor

````text
TASK: Implement the Discovery services layer.

CONTEXT:
- Supabase client exists at src/lib/supabase.ts with a typed `supabase` export.
- AsyncStorage from @react-native-async-storage/async-storage.
- Types live in src/types/discovery.ts (create/extend in DISCOVERY-V3-004).

PRODUCE THREE FILES, each beginning with a `--- FILE: <path> ---` line.

FILE 1: p2p-kids-marketplace/src/services/discovery.ts
  - MODIFY: keep any existing V2 exports; ADD or REPLACE searchListings with the
    13-param version. Convert `filters.categoryIds` undefined/[]→null, etc.
  - Export `searchListings(query: string, filters: DiscoveryFilters): Promise<SearchResult[]>`.
  - Export `searchListingsByCategory(categoryId: string, filters: Omit<DiscoveryFilters,'categoryIds'>)`.
  - Export `suggestSpellingCorrection(query: string, recent: string[]): string | null`.

FILE 2: p2p-kids-marketplace/src/services/searchHistory.ts
  - 5 functions as listed. Use AsyncStorage. Dedup case-insensitive. Cap 8.

FILE 3: p2p-kids-marketplace/src/services/brandAutocomplete.ts
  - export const PREDEFINED_BRANDS = [... exact list from the module ...];
  - getBrandSuggestions + fetchDatabaseBrands (5-min cache, invalidate via key
    @kids_marketplace:brand_cache storing {ts:number, brands:string[]}).

Do not generate component code. Services only.
````

---

## TASK DISCOVERY-V3-004: Types & Utilities

**Duration:** 1.5 hours
**Priority:** High
**Dependencies:** DISCOVERY-V3-003

### Description

Define `DiscoveryFilters`, `SortOption`, `SearchResult` types and two utility modules.

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/types/discovery.ts` | MODIFY: add `DiscoveryFilters`, `SortOption`, `SearchResult`, `BrandSuggestion`, `PricePreset` |
| `p2p-kids-marketplace/src/utils/fuzzyMatch.ts` | NEW: `levenshteinDistance(a,b)`, `findClosestMatch(query, candidates, threshold=3)` |
| `p2p-kids-marketplace/src/utils/filterHelpers.ts` | NEW: `countActiveFilters(f)`, `formatFilterChipLabel(key,value)`, `validatePriceRange(min?,max?)`, `getDefaultFilters()` |

### `DiscoveryFilters` (exact shape)

```ts
export type SortOption = 'relevance' | 'newest' | 'price_asc' | 'price_desc';

export interface DiscoveryFilters {
  categoryIds?: string[];      // UUID[]
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'worn';
  minPrice?: number;
  maxPrice?: number;
  ageGroup?: '0-2' | '3-5' | '6-8' | '9-12' | '13+';
  gender?: 'boy' | 'girl' | 'unisex';
  brand?: string;
  colors?: string[];           // from the 12-color palette
  spEligibleOnly?: boolean;
  sortBy?: SortOption;         // default 'relevance'
}
```

### Acceptance Criteria

- [ ] `levenshteinDistance` handles empty strings and returns `max(a.length, b.length)` when either is empty.
- [ ] `findClosestMatch` returns `null` if no candidate within threshold; returns the **single** best (lowest distance) otherwise.
- [ ] `countActiveFilters` returns 0 for `getDefaultFilters()` output.
- [ ] `validatePriceRange(min, max)` returns `false` when `min > max`, `true` otherwise (including when either is undefined).
- [ ] `formatFilterChipLabel('ageGroup', '3-5')` returns `'Age: 3-5'` and handles all 9 filter keys.

### AI Prompt for Cursor

````text
TASK: Generate types + utilities for Discovery V3.

Produce 3 files. Use strict TypeScript. No external deps beyond what's already
in package.json.

FILE 1: p2p-kids-marketplace/src/types/discovery.ts
  - Add DiscoveryFilters, SortOption, SearchResult (all 16 fields from the RPC
    return type), BrandSuggestion, PricePreset.
  - Export COLOR_PALETTE (12 colors with id/label/hex as per spec Appendix).
  - Export PRICE_PRESETS (5 presets as per spec Appendix).
  - Export STORAGE_KEYS constant.

FILE 2: p2p-kids-marketplace/src/utils/fuzzyMatch.ts
  - levenshteinDistance(a, b) using DP (O(n*m)).
  - findClosestMatch(query, candidates, threshold=3) returning the best match
    or null. Ignore case when computing distance.

FILE 3: p2p-kids-marketplace/src/utils/filterHelpers.ts
  - countActiveFilters, formatFilterChipLabel, validatePriceRange, getDefaultFilters.
  - getDefaultFilters() returns an object where every field is undefined except
    sortBy: 'relevance' and spEligibleOnly: false.
````

---

## TASK DISCOVERY-V3-005: DiscoverScreen (Unified)

**Duration:** 6 hours
**Priority:** High
**Dependencies:** DISCOVERY-V3-003, DISCOVERY-V3-004

### Description

Replace `SearchScreen` and `BrowseItemsScreen` with a single `DiscoverScreen`. The screen owns search state, debounced query, filter state, sort state, results list, pagination and optimistic UI behavior. `CategoryBrowseScreen` is kept for deep-linking by category.

### File

`p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx`

### State Shape

```ts
interface DiscoverState {
  query: string;                 // controlled input
  debouncedQuery: string;        // drives fetch (200ms debounce)
  filters: DiscoveryFilters;
  sortBy: SortOption;
  results: SearchResult[];
  loading: boolean;              // first load or after filter change
  loadingMore: boolean;          // infinite scroll batch
  hasMore: boolean;
  filterModalVisible: boolean;
  recentSearches: string[];
  autocompleteVisible: boolean;
  autocompleteSuggestions: string[];
  error: string | null;
}
```

### Acceptance Criteria

- [ ] Debounce constant `SEARCH_DEBOUNCE_MS = 200`.
- [ ] Optimistic UI: when `query`/`filters`/`sort` changes, previous results stay on screen until new results arrive. No full-screen spinner after the first load.
- [ ] Infinite scroll: `FlatList.onEndReached` (threshold 0.5) loads next batch via `offset += 20`; guards against duplicate fetches while `loadingMore = true`.
- [ ] Filter state persists across navigation to `ItemDetailScreen` and back (use `useFocusEffect` + screen-scoped state, NOT AsyncStorage).
- [ ] On mount: load first page with no filters; fetch recent searches; pre-warm `fetchDatabaseBrands()`.
- [ ] Tapping filter button opens `SearchFilterModal`; active count shown in badge on button.
- [ ] Tapping a result card calls `navigation.navigate('ItemDetail', { id })`.
- [ ] Network error → shows `NetworkErrorBanner` at top; does NOT clear existing results.
- [ ] Deletes `SearchScreen.tsx` and `BrowseItemsScreen.tsx` files and updates the navigator to point to `DiscoverScreen`.
- [ ] Maintains all existing accessibility labels from V2 where applicable.

### AI Prompt for Cursor

````text
TASK: Build the unified DiscoverScreen for React Native (Expo).

CONTEXT:
- Uses @react-navigation/native. Current Discover tab currently points to SearchScreen.
- Use useCallback + useMemo to keep FlatList stable.
- Debounce via a custom hook useDebouncedValue(value, 200).
- Components used inside (see DISCOVERY-V3-007):
    SearchFilterModal, ActiveFilterChips, RecentSearchesPanel,
    SearchAutocomplete, SortDropdown, SearchResultCard,
    SearchEmptyState, SearchResultSkeleton, NetworkErrorBanner.

DELIVERABLES:
FILE: p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx
FILE: p2p-kids-marketplace/src/hooks/useDebouncedValue.ts  (if not present)
FILE UPDATE: the navigator file that currently routes 'Search' / 'Browse' →
             route 'Discover' to DiscoverScreen and remove the old two routes.
FILE DELETE: p2p-kids-marketplace/src/screens/home/SearchScreen.tsx
FILE DELETE: p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx

(Do not touch CategoryBrowseScreen.tsx.)

BEHAVIOR CHECKLIST (encode in code + comments):
- 200ms debounce on query input.
- Optimistic UI: previous results remain while new fetch is in flight.
- Infinite scroll at 50% viewport end.
- Pull-to-refresh resets offset to 0.
- Autocomplete panel visible when search is focused AND query.length < 2 AND
  recentSearches.length > 0.
- After 2 chars, autocomplete panel shows getAutocompleteSuggestions(query).
- On search submit: addSearchToHistory(query) then fetch.
- If result count === 0 AND countActiveFilters === 0: try
  suggestSpellingCorrection(query, recentSearches) and pass to SearchEmptyState.
````

---

## TASK DISCOVERY-V3-006: SearchFilterModal

**Duration:** 5 hours
**Priority:** High
**Dependencies:** DISCOVERY-V3-004

### Description

Bottom-sheet modal exposing all 8 filter sections in the exact order defined in `SEARCH-FILTER-REQUIREMENTS.md` § Component Specifications.

### File

`p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx`

### Sections (in order)

1. **Category** — multi-select pills (horizontal scroll). Loaded from existing `getCategories()` service.
2. **Condition** — single-select pills (`new | like_new | good | fair | worn`).
3. **Age Group** — single-select pills (`0-2 | 3-5 | 6-8 | 9-12 | 13+`).
4. **Gender** — single-select pills (`boy | girl | unisex | Any`). "Any" maps to `undefined`.
5. **Color** — multi-select chips with 12-color swatches (`COLOR_PALETTE`).
6. **Brand** — text input with dropdown using `getBrandSuggestions(q)` (min 2 chars).
7. **Price Range** — 5 preset chips (`PRICE_PRESETS`) + custom `min` / `max` inputs.
8. **Swap Points Only** — toggle switch (wraps `spEligibleOnly`).

### Acceptance Criteria

- [ ] Local draft state — changes only apply to parent on "Apply Filters" tap.
- [ ] "Clear All" button resets local draft to `getDefaultFilters()`.
- [ ] Apply button disabled when `validatePriceRange(minPrice, maxPrice) === false`; shows inline error.
- [ ] Brand autocomplete dropdown closes when user taps outside or selects.
- [ ] Modal is keyboard-aware (avoids inputs being hidden).
- [ ] Active filter count live-updated at top of modal (e.g. "3 filters").
- [ ] Full a11y: each pill `accessibilityState={selected}`; toggle announced.

### AI Prompt for Cursor

````text
TASK: Build SearchFilterModal (bottom sheet) with 8 filter sections.

DELIVERABLE: p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx

PROPS:
  visible: boolean;
  filters: DiscoveryFilters;
  categories: Category[];
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;

IMPLEMENTATION NOTES:
- Internal state `draft: DiscoveryFilters = filters` (reset when `visible`
  transitions false→true).
- Use a library-free BottomSheet-ish Modal: `react-native` Modal with
  animationType="slide", presentationStyle "overFullScreen".
- Category chips: multi-select, toggle by tap.
- Age group / condition / gender: single-select.
- Color swatches: show hex dot + label, tappable, multi-select.
- Brand: TextInput with debounced (200ms) getBrandSuggestions dropdown.
- Price presets: tapping a preset sets minPrice/maxPrice. Custom min/max
  inputs are numeric and override preset selection.
- SP toggle: Switch component.
- Validate price on change; if invalid, show text error and disable Apply.

Provide full styles (StyleSheet.create). Use existing theme if available;
otherwise use clear semantic names (COLORS, SPACING) so they can be swapped.
````

---

## TASK DISCOVERY-V3-007: Supporting Components

**Duration:** 5 hours
**Priority:** Medium
**Dependencies:** DISCOVERY-V3-004

### Description

9 smaller components wired into `DiscoverScreen`.

### Files

| Path | Role |
|---|---|
| `components/molecules/ActiveFilterChips.tsx` | Horizontal scroll of removable chips; renders only when `countActiveFilters > 0` |
| `components/molecules/RecentSearchesPanel.tsx` | Shown when search focused + empty + history exists; tap = run; X = remove; "Clear All" |
| `components/molecules/SearchAutocomplete.tsx` | Dropdown of `getAutocompleteSuggestions(q)`, max 5, tap fills & fires search |
| `components/molecules/SearchResultCard.tsx` | 2-col grid card: square image, title (2 lines), price overlay bottom-left, SP badge |
| `components/molecules/SearchEmptyState.tsx` | Conditional: filters-active vs typo-suggestion vs popular-items fallback |
| `components/molecules/BrandAutocompleteInput.tsx` | Reusable text input + brand dropdown (used inside filter modal) |
| `components/atoms/SortDropdown.tsx` | 4-option dropdown (relevance/newest/price_asc/price_desc) |
| `components/atoms/SearchResultSkeleton.tsx` | Animated skeleton card + grid renderer |
| `components/atoms/NetworkErrorBanner.tsx` | Top banner "Can't connect. Tap to retry" + onRetry |

### Acceptance Criteria

- [ ] All components are function components with typed props.
- [ ] No component imports from screen layer (keep layering clean).
- [ ] `SearchResultCard` uses `expo-image` with `cachePolicy="memory-disk"`.
- [ ] `SearchResultSkeleton` uses `Animated.Value` for shimmer (no external lib required).
- [ ] `ActiveFilterChips` and `RecentSearchesPanel` gracefully handle empty state by returning `null`.
- [ ] `SearchEmptyState` takes `{ hasActiveFilters: boolean; spellSuggestion: string | null; onClearFilters(); onTryCorrection(q) }` and renders the 3 variants.

### AI Prompt for Cursor

````text
TASK: Generate the 9 supporting components for DiscoverScreen.

Produce 9 files, one per component as listed in DISCOVERY-V3-007.
Each file starts with `--- FILE: <path> ---`.

CROSS-CUTTING RULES:
- Strict TS. Props typed. No `any`.
- No external libs beyond: react, react-native, expo-image,
  @react-native-async-storage/async-storage, react-native-safe-area-context.
- Accessibility labels on every touchable.
- Each component no longer than ~150 lines.

Use the layouts from SEARCH-FILTER-REQUIREMENTS.md § Component Specifications
for reference (ASCII mocks in that doc are the source of truth).
````

---

## TASK DISCOVERY-V3-008: Tests (Unit + Integration + Maestro)

**Duration:** 4 hours
**Priority:** High
**Dependencies:** DISCOVERY-V3-005, 006, 007

### Test Files

| Path | Covers |
|---|---|
| `src/__tests__/services/discovery.test.ts` | `searchListings` passes all 13 RPC params; null vs empty handling |
| `src/__tests__/services/searchHistory.test.ts` | max 8, LRU, dedupe case-insensitive, clear |
| `src/__tests__/services/brandAutocomplete.test.ts` | merge/dedupe/sort, 5-min cache |
| `src/__tests__/utils/fuzzyMatch.test.ts` | Levenshtein edge cases, closest match, no-match → null |
| `src/__tests__/utils/filterHelpers.test.ts` | count, validate, default, chip labels |
| `e2e/search-filters.yaml` | Maestro: multi-filter, chip removal, clear all |
| `e2e/search-autocomplete.yaml` | Maestro: recent searches, autocomplete tap |
| `e2e/search-empty-state.yaml` | Maestro: no results + filters, typo suggestion |

### Acceptance Criteria

- [ ] All Jest tests pass (`npm test`).
- [ ] Test coverage for `src/services/*` and `src/utils/*` files in this module ≥ 85%.
- [ ] 3 Maestro flows run against a staging build (documented in the PR, not gated in CI).
- [ ] Integration test (separate file, opt-in): `scripts/perf-search.ts` runs 20 `search_listings` calls with 3 random filters each and asserts p95 < 200ms on a dataset of ≥ 10k staging rows.

### AI Prompt for Cursor

````text
TASK: Generate unit tests, mocks and Maestro flows for Discovery V3.

OUTPUT:
- 5 Jest test files (discovery, searchHistory, brandAutocomplete,
  fuzzyMatch, filterHelpers). Use jest.mock for @supabase and AsyncStorage.
- 3 Maestro YAML flows under p2p-kids-marketplace/e2e/.
- 1 perf script scripts/perf-search.ts that runs against SUPABASE_URL
  + SUPABASE_ANON_KEY from env and prints p50/p95/p99.

For the Jest tests use the sample data structures from
SEARCH-FILTER-REQUIREMENTS.md (Section "Testing Requirements") verbatim where
they appear.

Each test file must be self-contained with its own beforeEach resetting mocks.
````

---

## CROSS-TRACK INTEGRATION NOTES

- **MODULE-04 V3 (Bulk Listing & AI):** consumes the new `age_group`, `gender`, `brand`, `color` columns. Bulk-upload forms must write these values. AI auto-fill must populate them when confidence ≥ 70%.
- **MODULE-12 V3 (Admin Categories):** admin CRUD on categories. `search_listings` accepts `p_category_ids` — ensure the Discover UI uses `getCategoriesWithCounts(includeInactive=false)` so deactivated categories are hidden.
- **MODULE-18 (Trading Education):** SP calculator in Help relies on `categories.sp_earning_multiplier` / `sp_spending_cap_percent` (added in MODULE-12 V3) — no changes needed here.

---

## OUT OF SCOPE (Post-MVP, for later modules)

Server-side autocomplete (trigram index), `pg_trgm` fuzzy search, NLP natural-language search, saved searches, live filter count preview, location/distance filter, clothing size filter, hierarchical categories, ElasticSearch, Redis, analytics dashboards, swipe-to-dismiss chips, haptics, cross-device search history sync.

---

## IMPLEMENTATION CHECKLIST (high-level)

- [ ] DISCOVERY-V3-001 — schema migration + indexes
- [ ] DISCOVERY-V3-002 — RPC rewrite + `get_popular_brands`
- [ ] DISCOVERY-V3-003 — services (`discovery`, `searchHistory`, `brandAutocomplete`)
- [ ] DISCOVERY-V3-004 — types + utils (`fuzzyMatch`, `filterHelpers`)
- [ ] DISCOVERY-V3-005 — `DiscoverScreen` + navigator wiring + V2 screen deletion
- [ ] DISCOVERY-V3-006 — `SearchFilterModal`
- [ ] DISCOVERY-V3-007 — 9 supporting components
- [ ] DISCOVERY-V3-008 — unit tests + Maestro + perf script
- [ ] Run migrations on staging, seed realistic data, verify RPC p95 < 200ms
- [ ] Manual QA with screen reader (VoiceOver + TalkBack)
- [ ] Update `PROMPTS_USAGE_GUIDE.md` with a pointer to this module

---

*Document version: 1.0 | Generated from SEARCH-FILTER-REQUIREMENTS.md v1.0 | Next review: after Track 1 implementation*
