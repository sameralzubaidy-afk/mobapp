# MODULE-05 VERIFICATION CHECKLIST (V3 — Filters, Autocomplete, Unified Discover)

**Module:** Search & Discovery
**Version:** 3.0
**Last Updated:** April 21, 2026
**Traceability:** `POC1/ai-code-generator/modules/docx/SEARCH-FILTER-REQUIREMENTS.md` v1.0

---

## VERIFICATION CHECKLIST

### 1. SCHEMA & INDEXES (DISCOVERY-V3-001)

- [ ] Migration `20260420000001_add_item_filter_columns.sql` applied on staging
  - [ ] Column `items.age_group TEXT` with CHECK `('0-2','3-5','6-8','9-12','13+')`
  - [ ] Column `items.gender TEXT` with CHECK `('boy','girl','unisex')`
  - [ ] Column `items.brand TEXT` with CHECK `LENGTH(brand) <= 100`
  - [ ] Column `items.color TEXT[]` (no CHECK)
  - [ ] All 4 columns NULLABLE (pre-existing rows still valid)
- [ ] 6 indexes created (verify with `\d+ items` or `pg_indexes`):
  - [ ] `idx_items_age_group` (partial, `status='available'`)
  - [ ] `idx_items_gender` (partial, `status='available'`)
  - [ ] `idx_items_brand` (partial)
  - [ ] `idx_items_color` GIN (partial)
  - [ ] `idx_items_price` (partial)
  - [ ] `idx_items_category_price` composite (partial)
- [ ] COMMENT ON COLUMN set for each new column
- [ ] Migration is idempotent (re-running produces no error)

### 2. RPCs (DISCOVERY-V3-002)

- [ ] Migration `20260420000002_update_search_listings_rpc.sql` applied
- [ ] Old 3-param `search_listings` dropped (confirm via `\df search_listings`)
- [ ] New `search_listings` has exactly 13 parameters in the order specified
- [ ] `search_listings` returns all 16 columns including `relevance REAL`
- [ ] Function marked `STABLE`
- [ ] `get_popular_brands(p_limit INT DEFAULT 50)` exists
- [ ] Sample queries (smoke test):
  - [ ] `search_listings()` with all defaults returns results
  - [ ] Multi-category filter returns only items in those categories
  - [ ] `p_colors := ARRAY['blue','red']` returns items whose color[] overlaps
  - [ ] `p_sort_by := 'price_asc'` yields ascending price
- [ ] Performance: p95 < 200ms on staging with ≥ 10k items (record number in PR)

### 3. SERVICES (DISCOVERY-V3-003)

- [ ] `src/services/discovery.ts`
  - [ ] `searchListings(query, filters)` passes all 13 RPC params
  - [ ] Undefined filter fields converted to `null` (not '' or [])
  - [ ] `suggestSpellingCorrection` uses `findClosestMatch` threshold 3
  - [ ] Existing V2 exports still present
- [ ] `src/services/searchHistory.ts`
  - [ ] 5 exported functions as specified
  - [ ] Key `@kids_marketplace:recent_searches`
  - [ ] Max 8 entries; LRU on add; dedupe case-insensitive
- [ ] `src/services/brandAutocomplete.ts`
  - [ ] `PREDEFINED_BRANDS` length === 50, exact casing from spec
  - [ ] `getBrandSuggestions(q)` returns [] when `q.length < 2`
  - [ ] Merges predefined + DB, dedupes, sorts alpha, caps 8
  - [ ] `fetchDatabaseBrands` caches via AsyncStorage, TTL 5 min
- [ ] Unit tests pass (`npm test -- --testPathPattern=services`)

### 4. TYPES & UTILITIES (DISCOVERY-V3-004)

- [ ] `src/types/discovery.ts` exports: `DiscoveryFilters`, `SortOption`, `SearchResult`, `COLOR_PALETTE` (12), `PRICE_PRESETS` (5), `STORAGE_KEYS`
- [ ] `src/utils/fuzzyMatch.ts`
  - [ ] `levenshteinDistance('', 'abc') === 3`
  - [ ] `findClosestMatch('bycicle', ['bicycle','tricycle','scooter'], 3) === 'bicycle'`
  - [ ] `findClosestMatch('xyz', ['bicycle','tricycle'], 2) === null`
- [ ] `src/utils/filterHelpers.ts`
  - [ ] `countActiveFilters(getDefaultFilters()) === 0`
  - [ ] `validatePriceRange(20, 10) === false`
  - [ ] `formatFilterChipLabel('ageGroup', '3-5') === 'Age: 3-5'`
- [ ] Unit tests pass (`npm test -- --testPathPattern=utils`)

### 5. DISCOVERSCREEN (DISCOVERY-V3-005)

- [ ] `src/screens/home/DiscoverScreen.tsx` exists
- [ ] `SEARCH_DEBOUNCE_MS === 200`
- [ ] Optimistic UI: old results remain visible while new fetch in flight
- [ ] Infinite scroll loads next page on `onEndReached`
- [ ] No duplicate fetch while `loadingMore === true`
- [ ] Filter state persists after navigating to ItemDetail and back
- [ ] Filter state resets on tab change away from Discover
- [ ] Navigator updated: `Discover` route maps to `DiscoverScreen`
- [ ] Old files deleted: `SearchScreen.tsx`, `BrowseItemsScreen.tsx`
- [ ] App still builds (`npm run type-check`, `expo start`)

### 6. SEARCHFILTERMODAL (DISCOVERY-V3-006)

- [ ] Component renders 8 sections in order: Category → Condition → Age → Gender → Color → Brand → Price → SP
- [ ] Draft state is local; only committed on "Apply Filters"
- [ ] "Clear All" resets to `getDefaultFilters()`
- [ ] Price validation: Apply disabled when `min > max`; inline error shown
- [ ] Brand autocomplete dropdown functional (min 2 chars)
- [ ] Active filter count visible at top

### 7. SUPPORTING COMPONENTS (DISCOVERY-V3-007)

- [ ] All 9 components exist at specified paths
- [ ] `ActiveFilterChips` returns `null` when no active filters
- [ ] `RecentSearchesPanel` returns `null` when history empty
- [ ] `SearchResultCard` uses `expo-image` with disk cache
- [ ] `SearchResultSkeleton` animates without external lib
- [ ] `SearchEmptyState` handles 3 variants correctly
- [ ] `SortDropdown` shows 4 options (relevance/newest/price_asc/price_desc)
- [ ] `NetworkErrorBanner` appears on network error; doesn't clear results

### 8. TESTS (DISCOVERY-V3-008)

- [ ] All 5 Jest files pass
- [ ] Coverage ≥ 85% for `src/services/*` and `src/utils/*` added in this module
- [ ] 3 Maestro flows run green on a staging build:
  - [ ] `e2e/search-filters.yaml`
  - [ ] `e2e/search-autocomplete.yaml`
  - [ ] `e2e/search-empty-state.yaml`
- [ ] `scripts/perf-search.ts` prints p50/p95/p99; p95 < 200ms

### 9. PERFORMANCE & UX ACCEPTANCE

- [ ] Backend RPC p95 < 200ms
- [ ] First keystroke → first result < 400ms on mid-tier Android
- [ ] Infinite scroll batch < 300ms
- [ ] Filter modal opens < 100ms
- [ ] 2-column grid scrolls at 60fps on iPhone 12 + Pixel 6

### 10. ACCESSIBILITY

- [ ] VoiceOver reads all labels correctly
- [ ] Filter button announces active count
- [ ] Each chip announces its filter type
- [ ] Result cards read `title + price + condition`
- [ ] TalkBack QA completed on Android

### 11. CROSS-TRACK

- [ ] MODULE-04 V3 agent confirmed it can write `age_group`, `gender`, `brand`, `color` on create/edit
- [ ] MODULE-12 V3 agent confirmed `getCategoriesWithCounts` respects `is_active`
- [ ] No regression in V2 personalized recommendations (`get_recommendations` RPC still returns SP-eligible items first for subscribers)

---

**Sign-off:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| QA | | | |
| Product | | | |

**End of MODULE-05-VERIFICATION-V3.md**
