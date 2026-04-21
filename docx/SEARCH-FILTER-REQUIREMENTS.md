# Search + Filters + Autocomplete — Complete Requirements Document

**Project:** Kids P2P Marketplace  
**Feature:** Enhanced Discovery (Search, Filters, Autocomplete)  
**Version:** 1.0  
**Date:** April 19, 2026  
**Owner:** @sameralzubaidy-afk  
**Target Release:** Week 2-3 (MVP)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [UX Decisions & Competitor Benchmarks](#ux-decisions--competitor-benchmarks)
3. [User Stories](#user-stories)
4. [Database Schema Changes](#database-schema-changes)
5. [Backend Functions (RPCs)](#backend-functions-rpcs)
6. [Frontend Architecture](#frontend-architecture)
7. [Complete Function Reference](#complete-function-reference)
8. [Component Specifications](#component-specifications)
9. [Performance Requirements](#performance-requirements)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Testing Requirements](#testing-requirements)
12. [Acceptance Criteria](#acceptance-criteria)
13. [Out of Scope (Post-MVP)](#out-of-scope-post-mvp)
14. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### **Problem Statement**

Current search experience has critical UX gaps:
- ❌ BrowseItemsScreen has **1000ms debounce** (users wait 1 second before any results)
- ❌ Only 3 search parameters: query, SP toggle, limit (no filters for age, gender, price, condition)
- ❌ Two separate screens (SearchScreen + BrowseItemsScreen) with duplicate functionality
- ❌ No autocomplete or search suggestions
- ❌ No sort options
- ❌ Missing filters: Color, Brand, Age Group, Gender, Price Range, Multi-Category

### **Solution Overview**

**Phase 1 (MVP — Weeks 2-3):**
- ✅ Merge SearchScreen + BrowseItemsScreen → **unified DiscoverScreen**
- ✅ Fix debounce: **200ms** (instant feel)
- ✅ Add **9 new filters**: Category (multi), Condition, Age Group, Gender, Brand, Color (multi), Price Range, SP toggle
- ✅ Add **4 sort options**: Relevance, Newest, Price (Low/High)
- ✅ Recent searches (8 max, AsyncStorage)
- ✅ Autocomplete from recent searches
- ✅ "Did you mean...?" typo suggestions
- ✅ Smart empty states with fallback suggestions
- ✅ 2-column grid results, infinite scroll
- ✅ Optimistic UI (keep old results while loading new)

**Phase 2 (Post-MVP):**
- Server-side autocomplete (trigram index)
- PostgreSQL fuzzy search (pg_trgm)
- Live filter count preview
- Saved searches
- NLP natural language search

### **Success Metrics**

| Metric | Current | Target (MVP) |
|--------|---------|--------------|
| Search response time | 1300ms (1000ms debounce + 300ms backend) | < 400ms (200ms debounce + 200ms backend) |
| User can filter by | 2 options (SP, query) | 9 options (all filters) |
| Zero results rate | Unknown | < 15% with smart fallbacks |
| Typo handling | None (user stuck) | Suggestions offered |
| Search abandonment | Unknown | Track post-launch |

---

## UX Decisions & Competitor Benchmarks

### **1. Search Bar Placement**
**Decision:** Unified DiscoverScreen with always-visible search bar at top

**Rationale:** 
- Facebook Marketplace, OfferUp, Mercari all use single unified browse/search screen
- Reduces cognitive load (one place to search)
- Eliminates duplicate code across two screens

**Pattern:** 
- Default view: shows all/recommended items
- Typing triggers search
- Same screen, different content based on query state

---

### **2. Filter Button Strategy**
**Decision:** Single "Filters" button → all filters in one bottom sheet modal

**Rationale:**
- Cleaner UI (less clutter)
- Better for kids/parents (all filters in one place)
- Matches eBay, Mercari pattern

**Active filter display:**
- Badge on button: `Filters (3)`
- Chip row below search bar (dismissible per-chip)

---

### **3. Search Speed & Response**
**Decision:** 200ms debounce + optimistic UI

**Benchmark:**
| App | Debounce | Total Latency | Pattern |
|-----|----------|---------------|---------|
| Amazon | 250ms | < 300ms | Instant dropdown |
| Facebook | 200ms | < 400ms | Inline results |
| eBay | 300ms | < 500ms | Spinner |
| **Kids Marketplace** | **200ms** | **< 400ms** | **Optimistic UI** |

**Implementation:**
- Show previous results while fetching new ones (no blank screen)
- No spinner unless first search
- Feels instant even with network delay

---

### **4. Results Display Layout**
**Decision:** 2-column grid, square images, price overlay bottom-left

**Rationale:** All competitors use 2-column grid (easier to scan, more items per screen)

**Card design:**
- Square image fills card width
- Price: large, bottom-left corner overlay on image
- Title: 2 lines max, truncated with "..."
- SP badge: small corner badge if accepts_swap_points
- Seller info: optional (hide if space tight)

---

### **5. Sort Options**
**Decision:** 4 options (Relevance default, Newest, Price Low/High)

**Benchmark:**
| App | Sort Options |
|-----|--------------|
| eBay | Best Match, Price+Shipping, Newest, Distance |
| Facebook | Recommended, Distance, Price, Date Listed |
| Mercari | Recommended, Price Low, Price High, Recently Listed |
| **Kids Marketplace** | **Relevance, Newest, Price Low, Price High** |

---

### **6. Pagination**
**Decision:** Infinite scroll (20 results per batch)

**Rationale:** Industry standard (seamless UX, reduces decision fatigue)

**Implementation:** FlatList `onEndReached` auto-loads next batch

---

### **7. Typo Handling**
**Decision (MVP):** Client-side "Did you mean...?" from recent searches

**Benchmark:**
| App | Approach |
|-----|----------|
| Amazon | Auto-correct + "Did you mean?" banner |
| eBay | Fuzzy matching (pg_trgm) |
| Etsy | Related searches |
| **Kids Marketplace (MVP)** | **Suggestions from recent searches** |
| **Kids Marketplace (Phase 2)** | **pg_trgm fuzzy search** |

**Algorithm:** Levenshtein distance < 3 → suggest correction

---

### **8. Empty State Strategy**
**Decision:** Tiered fallbacks based on context

**Scenario 1: No results + filters active**
- Show: "No items match all your filters"
- Action: "Clear filters" button (prominent)
- Show: Filter impact hints ("23 items if you remove 'Brand: Nike'")

**Scenario 2: No results + no filters (query issue)**
- Show: "No items found for '[query]'"
- Action: "Did you mean [suggestion]?" (if match found)
- Show: "Browse [closest category]" button
- Fallback: "Popular items near you" (3-6 items)

---

### **9. Filter Persistence**
**Decision:** Session-only (resets on app restart)

**Rationale:**
- Fresh experience on app open
- Avoids confusion ("why am I only seeing pink toys?")
- Keep filters when viewing item detail and coming back

---

### **10. Search History**
**Decision:** AsyncStorage (client-side, max 8, logged-in users only)

**Features:**
- "Clear All History" button
- Individual searches deletable (X button)
- No auto-expiry (keeps forever until cleared)

**Storage key:** `@kids_marketplace:recent_searches`

---

### **11. Brand Autocomplete**
**Decision:** Hybrid (predefined list + database brands)

**Predefined brands (50 popular kids brands):**
```
LEGO, Nike, Carter's, OshKosh B'Gosh, Melissa & Doug, Fisher-Price, 
Little Tikes, Barbie, Hot Wheels, Disney, Marvel, Star Wars, Pokemon,
Gap Kids, Old Navy, Target, Cat & Jack, H&M, Zara Kids, Gymboree,
Graco, Chicco, BabyBjörn, Ergobaby, Skip Hop, Vans, Converse, Adidas,
Crayola, Play-Doh, Nerf, American Girl, Baby Einstein, VTech, LeapFrog,
Paw Patrol, Frozen, Minnie Mouse, Thomas & Friends, Sesame Street,
The North Face, Columbia, Patagonia, Ralph Lauren, Tommy Hilfiger,
Hanna Andersson, Mini Boden, Tea Collection, Primary, Lands' End
```

**Logic:** Merge predefined + DB brands, deduplicate, sort alphabetically, show max 8 suggestions

---

### **12. Color Filter**
**Decision:** Multi-select from 12 predefined colors, stored as TEXT[] array

**Colors:**
```
Red, Blue, Green, Yellow, Pink, Purple, Black, White, 
Gray, Brown, Orange, Multicolor
```

---

### **13. Loading States**
**Decision:** Skeleton placeholders (animated gray boxes)

**Rationale:** Modern, matches competitor apps, provides visual feedback during load

---

### **14. Network Error Handling**
**Decision:** Top banner with "Can't connect. Tap to retry" + keep old results visible

**Rationale:** Less disruptive than full-screen error, allows browsing cached results

---

## User Stories

### **US-001: Fast Search (Critical)**
**As a** parent looking for kids' items  
**I want** search results to appear instantly as I type  
**So that** I don't waste time waiting

**Acceptance Criteria:**
- First results appear < 400ms after I stop typing
- No blank screen (shows previous results while loading)
- Debounce is 200ms (fast enough to feel instant)

---

### **US-002: Multi-Filter Discovery**
**As a** parent shopping for my 5-year-old daughter  
**I want** to filter by age, gender, condition, and price  
**So that** I only see relevant items

**Acceptance Criteria:**
- Can select Age Group: 3-5
- Can select Gender: Girl
- Can select Condition: Like New
- Can set Price Range: $10-$25
- Results update immediately after applying filters
- Active filters show as removable chips

---

### **US-003: Brand Search**
**As a** parent who knows which brands I trust  
**I want** to search for items by brand name  
**So that** I find quality items faster

**Acceptance Criteria:**
- Can type "LEGO" in brand filter
- Autocomplete shows matching brands after 2 characters
- Can select from predefined brands or type custom brand
- Results show only items from selected brand

---

### **US-004: Color Filter**
**As a** parent whose child has favorite colors  
**I want** to filter items by color  
**So that** I find items my child will like

**Acceptance Criteria:**
- Can select multiple colors (Pink + Purple)
- Results show items tagged with any selected color
- Color chips are visually distinct (match actual colors)

---

### **US-005: Sort by Price**
**As a** budget-conscious parent  
**I want** to sort results by price  
**So that** I find affordable items first

**Acceptance Criteria:**
- Can select "Price: Low to High" or "Price: High to Low"
- Results re-sort immediately
- Current sort option is clearly indicated

---

### **US-006: Recent Searches**
**As a** frequent user  
**I want** to see my recent searches  
**So that** I can quickly repeat common searches

**Acceptance Criteria:**
- Recent searches appear when I tap search bar (before typing)
- Shows max 8 recent searches
- Can tap a recent search to run it again
- Can delete individual searches or clear all

---

### **US-007: Typo Correction**
**As a** user who makes typos  
**I want** the app to suggest corrections  
**So that** I still find what I'm looking for

**Acceptance Criteria:**
- If I type "bycicle" and get 0 results, app suggests "bicycle"
- Suggestion appears as "Did you mean 'bicycle'?" with tap-to-search
- Only suggests if Levenshtein distance < 3

---

### **US-008: Smart Empty State**
**As a** user with very specific filters  
**I want** helpful suggestions when no results found  
**So that** I can adjust my search effectively

**Acceptance Criteria:**
- If filters active: shows "Clear filters" button + impact hints
- If no filters: shows "Did you mean...?" + browse category CTA
- Always shows 3-6 popular items as fallback

---

### **US-009: Infinite Scroll**
**As a** user browsing many items  
**I want** more results to load automatically  
**So that** I don't have to tap "Load More"

**Acceptance Criteria:**
- First 20 results load immediately
- When I scroll near bottom, next 20 load automatically
- Loading indicator appears at bottom
- No duplicate items

---

### **US-010: Filter Persistence in Session**
**As a** user viewing item details  
**I want** my filters to stay active when I go back  
**So that** I don't have to re-apply them

**Acceptance Criteria:**
- Filters persist when navigating to item detail and back
- Filters reset when app restarts
- Filters reset when switching to different tab and back to Discover

---

## Database Schema Changes

### **Migration 1: Add Filter Columns to Items Table**

**File:** `supabase/migrations/20260420000001_add_item_filter_columns.sql`

```sql
-- ================================================================
-- Migration: Add Filter Columns to Items Table
-- Date: 2026-04-20
-- Description: Adds age_group, gender, brand, color columns for 
--              enhanced search filtering
-- ================================================================

-- Add new columns
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS age_group TEXT
    CHECK (age_group IN ('0-2', '3-5', '6-8', '9-12', '13+')),
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('boy', 'girl', 'unisex')),
  ADD COLUMN IF NOT EXISTS brand TEXT 
    CHECK (LENGTH(brand) <= 100),
  ADD COLUMN IF NOT EXISTS color TEXT[];

-- Add indexes for filter performance
-- Partial indexes: only index available items (most queries filter by status)
CREATE INDEX IF NOT EXISTS idx_items_age_group 
  ON items(age_group) 
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_items_gender 
  ON items(gender) 
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_items_brand 
  ON items(brand) 
  WHERE status = 'available';

-- GIN index for array column (color)
CREATE INDEX IF NOT EXISTS idx_items_color 
  ON items USING GIN(color) 
  WHERE status = 'available';

-- Add price index for range queries
CREATE INDEX IF NOT EXISTS idx_items_price 
  ON items(price) 
  WHERE status = 'available';

-- Composite index for common filter combinations
-- (category + price is very common)
CREATE INDEX IF NOT EXISTS idx_items_category_price 
  ON items(category_id, price) 
  WHERE status = 'available';

-- Add comment for documentation
COMMENT ON COLUMN items.age_group IS 'Target age group for item (0-2, 3-5, 6-8, 9-12, 13+)';
COMMENT ON COLUMN items.gender IS 'Gender specification (boy, girl, unisex)';
COMMENT ON COLUMN items.brand IS 'Brand name (max 100 chars)';
COMMENT ON COLUMN items.color IS 'Array of colors (red, blue, green, etc.)';

-- Verification query
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'items' 
-- AND column_name IN ('age_group', 'gender', 'brand', 'color');
```

---

### **Migration 2: Update search_listings RPC**

**File:** `supabase/migrations/20260420000002_update_search_listings_rpc.sql`

```sql
-- ================================================================
-- Migration: Enhanced search_listings RPC with Multi-Filter Support
-- Date: 2026-04-20
-- Description: Replaces 3-param search with 12-param version
--              Adds: multi-category, condition, price range, age,
--              gender, brand, color, sort options
-- ================================================================

-- Drop old function (3-param version)
DROP FUNCTION IF EXISTS search_listings(TEXT, BOOLEAN, INT);

-- Create new enhanced version
CREATE OR REPLACE FUNCTION search_listings(
  p_query        TEXT DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit        INT DEFAULT 20,
  p_offset       INT DEFAULT 0,
  -- NEW FILTER PARAMS:
  p_category_ids UUID[] DEFAULT NULL,
  p_condition    TEXT DEFAULT NULL,
  p_min_price    NUMERIC DEFAULT NULL,
  p_max_price    NUMERIC DEFAULT NULL,
  p_age_group    TEXT DEFAULT NULL,
  p_gender       TEXT DEFAULT NULL,
  p_brand        TEXT DEFAULT NULL,
  p_colors       TEXT[] DEFAULT NULL,
  -- SORT OPTION:
  p_sort_by      TEXT DEFAULT 'relevance'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  accepts_swap_points BOOLEAN,
  status TEXT,
  seller_id UUID,
  category_id UUID,
  condition TEXT,
  age_group TEXT,
  gender TEXT,
  brand TEXT,
  color TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  relevance REAL
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_query TEXT;
BEGIN
  v_search_query := TRIM(p_query);

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.description,
    i.price,
    i.accepts_swap_points,
    i.status,
    i.seller_id,
    i.category_id,
    i.condition,
    i.age_group,
    i.gender,
    i.brand,
    i.color,
    i.created_at,
    i.updated_at,
    -- Relevance scoring
    CAST(
      CASE 
        WHEN v_search_query = '' THEN 1.0
        WHEN to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
             @@ plainto_tsquery('english', v_search_query) THEN 2.0
        WHEN i.title ILIKE '%' || v_search_query || '%' THEN 1.5
        WHEN i.description ILIKE '%' || v_search_query || '%' THEN 1.0
        ELSE 0.5
      END
    AS REAL) AS relevance
  FROM items i
  WHERE
    -- Only search active listings
    i.status = 'available'
    
    -- FULL-TEXT SEARCH (if query provided)
    AND (
      v_search_query = '' 
      OR to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
         @@ plainto_tsquery('english', v_search_query)
      OR i.title ILIKE '%' || v_search_query || '%'
      OR i.description ILIKE '%' || v_search_query || '%'
    )
    
    -- FILTER: SP eligible
    AND (NOT p_sp_eligible_only OR i.accepts_swap_points = TRUE)
    
    -- FILTER: Multi-category (array)
    AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
    
    -- FILTER: Condition
    AND (p_condition IS NULL OR i.condition = p_condition)
    
    -- FILTER: Price range
    AND (p_min_price IS NULL OR i.price >= p_min_price)
    AND (p_max_price IS NULL OR i.price <= p_max_price)
    
    -- FILTER: Age group
    AND (p_age_group IS NULL OR i.age_group = p_age_group)
    
    -- FILTER: Gender
    AND (p_gender IS NULL OR i.gender = p_gender)
    
    -- FILTER: Brand (case-insensitive)
    AND (p_brand IS NULL OR LOWER(i.brand) = LOWER(p_brand))
    
    -- FILTER: Color (array overlap - item has ANY of the selected colors)
    AND (p_colors IS NULL OR i.color && p_colors)
    
  ORDER BY 
    CASE p_sort_by
      WHEN 'relevance' THEN relevance
      ELSE 0
    END DESC,
    CASE p_sort_by
      WHEN 'newest' THEN i.created_at
      ELSE NULL
    END DESC NULLS LAST,
    CASE p_sort_by
      WHEN 'price_asc' THEN i.price
      ELSE NULL
    END ASC NULLS LAST,
    CASE p_sort_by
      WHEN 'price_desc' THEN i.price
      ELSE NULL
    END DESC NULLS LAST,
    -- Fallback: newest first
    i.created_at DESC
    
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_listings IS 'Enhanced search with 9 filters + 4 sort options. Returns paginated results with relevance scoring.';

-- =============================================================================
-- HELPER RPC: Get Popular Brands
-- =============================================================================

CREATE OR REPLACE FUNCTION get_popular_brands(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  brand TEXT,
  item_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.brand,
    COUNT(*) AS item_count
  FROM items i
  WHERE 
    i.status = 'available'
    AND i.brand IS NOT NULL
    AND i.brand != ''
  GROUP BY i.brand
  ORDER BY item_count DESC, i.brand ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_popular_brands IS 'Returns top N brands by item count for autocomplete.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify new function signature:
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc WHERE proname = 'search_listings';

-- Test multi-category filter:
-- SELECT id, title, category_id FROM search_listings(
--   p_query := '',
--   p_category_ids := ARRAY['uuid1'::uuid, 'uuid2'::uuid]
-- );

-- Test price range + age group:
-- SELECT id, title, price, age_group FROM search_listings(
--   p_query := 'toy',
--   p_min_price := 10,
--   p_max_price := 50,
--   p_age_group := '3-5'
-- );

-- Test sort options:
-- SELECT id, title, price FROM search_listings(
--   p_query := '',
--   p_sort_by := 'price_asc',
--   p_limit := 10
-- );
```

---

## Backend Functions (RPCs)

### **RPC 1: search_listings() — Enhanced Multi-Filter Search**

**Signature:**
```sql
search_listings(
  p_query TEXT DEFAULT '',
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_category_ids UUID[] DEFAULT NULL,
  p_condition TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_age_group TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_colors TEXT[] DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'relevance'
)
```

**Returns:** Table with 16 columns (all item fields + relevance score)

**Performance:** 
- Uses partial indexes (status = 'available')
- Full-text search via `to_tsvector` + `plainto_tsquery`
- Target: < 200ms for 20 results with 3 active filters

---

### **RPC 2: get_popular_brands() — Brand Autocomplete Data**

**Signature:**
```sql
get_popular_brands(p_limit INT DEFAULT 50)
```

**Returns:** Table with (brand TEXT, item_count BIGINT)

**Usage:** Called on DiscoverScreen mount, cached for 5 minutes

**Performance:** < 50ms (indexed brand column, pre-aggregated)

---

## Frontend Architecture

### **File Structure**

```
p2p-kids-marketplace/src/
├── screens/
│   └── home/
│       ├── DiscoverScreen.tsx          (NEW - replaces SearchScreen + BrowseItemsScreen)
│       └── CategoryBrowseScreen.tsx    (KEEP - category-only browsing)
├── components/
│   ├── molecules/
│   │   ├── SearchFilterModal.tsx       (NEW)
│   │   ├── ActiveFilterChips.tsx       (NEW)
│   │   ├── RecentSearchesPanel.tsx     (NEW)
│   │   ├── SearchAutocomplete.tsx      (NEW)
│   │   ├── SearchResultCard.tsx        (NEW)
│   │   ├── SearchEmptyState.tsx        (NEW)
│   │   └── BrandAutocompleteInput.tsx  (NEW)
│   └── atoms/
│       ├── SortDropdown.tsx            (NEW)
│       ├── SearchResultSkeleton.tsx    (NEW)
│       └── NetworkErrorBanner.tsx      (NEW)
├── services/
│   ├── discovery.ts                    (MODIFY)
│   ├── searchHistory.ts                (NEW)
│   └── brandAutocomplete.ts            (NEW)
├── types/
│   └── discovery.ts                    (MODIFY)
└── utils/
    ├── fuzzyMatch.ts                   (NEW)
    └── filterHelpers.ts                (NEW)
```

---

## Complete Function Reference

### **Layer 1: Database Functions**

| Function | File | Purpose |
|----------|------|---------|
| `search_listings()` | Migration 002 | Main search RPC with 12 params |
| `get_popular_brands()` | Migration 002 | Returns top 50 brands for autocomplete |

**Total DB Functions:** 2

---

### **Layer 2: Frontend Services**

#### **discovery.ts (MODIFY)**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `searchListings()` | `(query: string, filters: DiscoveryFilters) => Promise<SearchResult[]>` | Calls search_listings RPC with all filters |
| `searchListingsByCategory()` | `(categoryId: string, filters: CategoryFilters) => Promise<CategoryResult[]>` | Category-specific search |
| `suggestSpellingCorrection()` | `(query: string, recentSearches: string[]) => string \| null` | Client-side fuzzy match for typos |

#### **searchHistory.ts (NEW)**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getRecentSearches()` | `() => Promise<string[]>` | Reads from AsyncStorage |
| `addSearchToHistory()` | `(query: string) => Promise<void>` | Prepends, dedupes, caps at 8 |
| `removeSearchFromHistory()` | `(query: string) => Promise<void>` | Removes one entry |
| `clearSearchHistory()` | `() => Promise<void>` | Clears all |
| `getAutocompleteSuggestions()` | `(query: string, maxResults?: number) => Promise<string[]>` | Filters by prefix |

#### **brandAutocomplete.ts (NEW)**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `PREDEFINED_BRANDS` | `string[]` | Constant: 50 popular brands |
| `getBrandSuggestions()` | `(query: string) => Promise<string[]>` | Merges predefined + DB, filters, returns top 8 |
| `fetchDatabaseBrands()` | `() => Promise<string[]>` | Calls get_popular_brands RPC, caches 5min |

**Total Service Functions:** 11

---

### **Layer 3: React Components**

#### **DiscoverScreen.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `DiscoverScreen()` | Main component |
| `useSearchWithFilters()` | Custom hook: manages search state |
| `handleSearchChange()` | Debounced (200ms) search trigger |
| `handleFilterApply()` | Applies filters, triggers search |
| `handleSortChange()` | Changes sort, refetches |
| `handleLoadMore()` | Infinite scroll trigger |
| `handleItemPress()` | Navigate to item detail |
| `renderResultCard()` | 2-column grid card |
| `renderEmptyState()` | No results UI |
| `renderLoadingState()` | Skeleton placeholders |
| `renderNetworkError()` | Error banner |

#### **SearchFilterModal.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SearchFilterModal()` | Bottom sheet modal |
| `renderCategorySection()` | Multi-select pills |
| `renderConditionSection()` | Single-select pills |
| `renderAgeGroupSection()` | Single-select pills |
| `renderGenderSection()` | Single-select pills |
| `renderColorSection()` | Multi-select chips |
| `renderBrandSection()` | Text input + autocomplete |
| `renderPriceSection()` | Preset chips + custom min/max |
| `handleApply()` | Validates, closes, calls onApply |
| `handleClearAll()` | Resets all filters |
| `calculateActiveFilterCount()` | Returns number for badge |

#### **ActiveFilterChips.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `ActiveFilterChips()` | Horizontal scrollable chip row |
| `renderChip()` | Individual removable chip |
| `handleRemoveFilter()` | Removes one filter, searches |

#### **RecentSearchesPanel.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `RecentSearchesPanel()` | Renders below search bar when focused + empty |
| `renderSearchItem()` | Icon + text + X button |
| `handleSearchTap()` | Fills search bar, triggers search |
| `handleRemoveSearch()` | Removes from history |
| `handleClearAll()` | Clears entire history |

#### **SearchAutocomplete.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SearchAutocomplete()` | Dropdown overlay |
| `renderSuggestion()` | Icon + text row |
| `handleSuggestionTap()` | Fills search, fires immediately |

#### **SortDropdown.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SortDropdown()` | Dropdown with 4 options |
| `renderOption()` | Radio + label |
| `handleSelect()` | Updates sort, closes |

#### **SearchResultCard.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SearchResultCard()` | Individual result card |
| `renderImage()` | Square image + skeleton |
| `renderPriceOverlay()` | Bottom-left price badge |
| `renderTitleSection()` | Title (2 lines, truncated) |
| `renderSellerInfo()` | Avatar + name |
| `renderSPBadge()` | "SP" badge if eligible |
| `handlePress()` | Navigate to detail |

#### **SearchEmptyState.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SearchEmptyState()` | Conditional rendering |
| `renderFiltersActiveState()` | "Clear filters" CTA + hints |
| `renderNoFiltersState()` | "Did you mean...?" + browse CTA |
| `renderPopularItems()` | Fallback: 3-6 popular items |

#### **SearchResultSkeleton.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `SearchResultSkeleton()` | Animated skeleton card |
| `renderSkeletonGrid()` | Renders N skeletons in 2-col grid |

#### **NetworkErrorBanner.tsx (NEW)**

| Function | Purpose |
|----------|---------|
| `NetworkErrorBanner()` | Top banner |
| `handleRetry()` | Calls onRetry callback |

**Total Component Functions:** 42

---

### **Layer 4: Utilities**

#### **fuzzyMatch.ts (NEW)**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `levenshteinDistance()` | `(a: string, b: string) => number` | Edit distance calculation |
| `findClosestMatch()` | `(query: string, candidates: string[], threshold?: number) => string \| null` | Best match or null |

#### **filterHelpers.ts (NEW)**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `countActiveFilters()` | `(filters: DiscoveryFilters) => number` | Returns count for badge |
| `formatFilterChipLabel()` | `(key: string, value: any) => string` | Display string for chips |
| `validatePriceRange()` | `(min?: number, max?: number) => boolean` | Ensures min <= max |
| `getDefaultFilters()` | `() => DiscoveryFilters` | Clean filter object |

**Total Utility Functions:** 6

---

### **Grand Total: 61 Functions**

- Database: 2
- Services: 11
- Components: 42
- Utilities: 6

---

## Component Specifications

### **DiscoverScreen Component**

**File:** `p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx`

**State:**
```typescript
interface DiscoverScreenState {
  // Search state
  query: string;              // Immediate input (controlled)
  debouncedQuery: string;     // Triggers actual search
  
  // Filter state
  filters: DiscoveryFilters;  // Active filters
  sortBy: SortOption;         // Active sort
  
  // Results state
  results: SearchResult[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  
  // UI state
  filterModalVisible: boolean;
  recentSearches: string[];
  autocompleteVisible: boolean;
  autocompleteSuggestions: string[];
  
  // Error state
  error: string | null;
}
```

**Props:** None (navigation props from stack)

**Layout:**
```
┌─────────────────────────────────────┐
│ [← Back]  Discover     [Filter (3)] │ ← Header
├─────────────────────────────────────┤
│ 🔍 [Search for items...]       [X]  │ ← Search Bar
├─────────────────────────────────────┤
│ [Blue ✕] [Age: 3-5 ✕] [< $25 ✕]    │ ← Active Filter Chips (if any)
├─────────────────────────────────────┤
│  [Sort: Relevance ▾]                │ ← Sort Dropdown
├─────────────────────────────────────┤
│ ┌───────┐  ┌───────┐                │
│ │ Item  │  │ Item  │  ← 2-col grid  │
│ │ $20   │  │ $15   │                │
│ └───────┘  └───────┘                │
│ ┌───────┐  ┌───────┐                │
│ │ Item  │  │ Item  │                │
│ └───────┘  └───────┘                │
│         [Loading...]                 │ ← Infinite scroll loader
└─────────────────────────────────────┘
```

**Behavior:**
- Default view (no query): shows all items or personalized recommendations
- Typing: triggers 200ms debounced search
- Scrolling to bottom: auto-loads next 20 items
- Tapping Filter button: opens SearchFilterModal
- Tapping item card: navigates to ItemDetailScreen

---

### **SearchFilterModal Component**

**File:** `p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx`

**Props:**
```typescript
interface SearchFilterModalProps {
  visible: boolean;
  filters: DiscoveryFilters;
  categories: Category[];
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
}
```

**Layout (Bottom Sheet):**
```
┌─────────────────────────────────────┐
│ Filters            [Clear All] [X]  │
├─────────────────────────────────────┤
│ CATEGORY                            │
│ [Toys ✓] [Books] [Clothing ✓] ...  │ ← Horizontal scroll
├─────────────────────────────────────┤
│ CONDITION                           │
│ [New] [Like New ✓] [Good] ...      │
├─────────────────────────────────────┤
│ AGE GROUP                           │
│ [0-2] [3-5 ✓] [6-8] ...            │
├─────────────────────────────────────┤
│ GENDER                              │
│ [Boy] [Girl ✓] [Unisex] [Any]      │
├─────────────────────────────────────┤
│ COLOR                               │
│ [🔴 Red] [🔵 Blue ✓] ...           │ ← Multi-select
├─────────────────────────────────────┤
│ BRAND                               │
│ 🔍 [Type brand name...]            │
│    LEGO                             │ ← Autocomplete dropdown
│    LEGO Duplo                       │
├─────────────────────────────────────┤
│ PRICE RANGE                         │
│ [Under $10] [$10-25 ✓] [$25-50]... │
│ Custom: $[min] to $[max]           │
├─────────────────────────────────────┤
│ SWAP POINTS ONLY                    │
│ ○───────────────────●               │ ← Toggle
├─────────────────────────────────────┤
│         [Apply Filters]             │
└─────────────────────────────────────┘
```

**Sections (in order):**
1. Category (multi-select pills)
2. Condition (single-select pills)
3. Age Group (single-select pills)
4. Gender (single-select pills, default: Any)
5. Color (multi-select chips with color indicators)
6. Brand (text input + autocomplete)
7. Price Range (preset chips + custom min/max)
8. SP Only (toggle switch)

**Validation:**
- Price min <= max (shows error if invalid)
- At least one category if multi-selecting (no empty array)

---

### **ActiveFilterChips Component**

**File:** `p2p-kids-marketplace/src/components/molecules/ActiveFilterChips.tsx`

**Props:**
```typescript
interface ActiveFilterChipsProps {
  filters: DiscoveryFilters;
  onRemoveFilter: (key: keyof DiscoveryFilters) => void;
}
```

**Example Output:**
```
[Blue ✕] [Age: 3-5 ✕] [$10-$25 ✕] [Girl ✕] [SP Only ✕]
```

**Logic:**
- Only renders if `countActiveFilters() > 0`
- Horizontal scrollable (FlatList horizontal)
- Each chip: label + X button
- Tapping X: removes that filter, triggers new search

---

## Performance Requirements

### **Target Metrics**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Search latency** | < 400ms | Time from last keystroke to first result visible |
| **Debounce delay** | 200ms | Configured constant |
| **Backend RPC time** | < 200ms | Supabase dashboard logs |
| **Filter modal open** | < 100ms | Time from tap to modal visible |
| **Infinite scroll load** | < 300ms | Next batch appears in < 300ms |
| **First render (cold start)** | < 2s | App launch to DiscoverScreen interactive |

### **Optimization Strategies**

1. **Partial Indexes:** Only index `status = 'available'` items (reduces index size by 80%)
2. **Debouncing:** 200ms prevents excessive API calls
3. **Optimistic UI:** Keep old results visible while loading new (no blank screen)
4. **Skeleton Placeholders:** Perceived performance (immediate visual feedback)
5. **FlatList Optimization:** 
   - `initialNumToRender={10}`
   - `maxToRenderPerBatch={10}`
   - `windowSize={5}`
   - `removeClippedSubviews={true}`
6. **Image Caching:** Use `expo-image` with aggressive caching
7. **Pagination:** 20 items per batch (balance between load time and scroll depth)

---

## Accessibility Requirements

All interactive elements must have proper accessibility labels:

```typescript
// Search bar
accessibilityLabel="Search for items"
accessibilityHint="Type to search for kids items"

// Filter button
accessibilityLabel={`Open filters. Currently ${activeFilterCount} filters active`}

// Sort dropdown
accessibilityLabel={`Sort by ${currentSort}. Tap to change sort option`}

// Filter chips
accessibilityLabel={`Remove ${filterLabel} filter`}
accessibilityRole="button"

// Result cards
accessibilityLabel={`${item.title}, $${item.price}, ${item.condition} condition`}
accessibilityHint="Tap to view details"
```

**Screen reader flow:**
1. Search bar → Filter button → Sort dropdown → Result cards → Load more

---

## Testing Requirements

### **Unit Tests (Jest)**

**File:** `src/__tests__/services/discovery.test.ts`
```typescript
describe('searchListings', () => {
  it('should pass all filter params to RPC', async () => {
    const filters = {
      categoryIds: ['uuid1', 'uuid2'],
      condition: 'like_new',
      minPrice: 10,
      maxPrice: 50,
      ageGroup: '3-5',
      gender: 'girl',
      brand: 'LEGO',
      colors: ['blue', 'red'],
      sortBy: 'price_asc',
    };
    
    await searchListings('toys', filters);
    
    expect(supabase.rpc).toHaveBeenCalledWith('search_listings', {
      p_query: 'toys',
      p_category_ids: ['uuid1', 'uuid2'],
      p_condition: 'like_new',
      p_min_price: 10,
      p_max_price: 50,
      p_age_group: '3-5',
      p_gender: 'girl',
      p_brand: 'LEGO',
      p_colors: ['blue', 'red'],
      p_sort_by: 'price_asc',
      p_sp_eligible_only: false,
      p_limit: 20,
      p_offset: 0,
    });
  });
});
```

**File:** `src/__tests__/utils/fuzzyMatch.test.ts`
```typescript
describe('findClosestMatch', () => {
  it('should find closest match within threshold', () => {
    const result = findClosestMatch('bycicle', ['bicycle', 'tricycle', 'scooter'], 3);
    expect(result).toBe('bicycle'); // distance = 1
  });
  
  it('should return null if no match within threshold', () => {
    const result = findClosestMatch('xyz', ['bicycle', 'tricycle'], 2);
    expect(result).toBeNull();
  });
});
```

**File:** `src/__tests__/utils/filterHelpers.test.ts`
```typescript
describe('countActiveFilters', () => {
  it('should count only non-default filters', () => {
    const filters = {
      categoryIds: ['uuid1'],
      condition: 'new',
      minPrice: 10,
      spEligibleOnly: false, // default
    };
    expect(countActiveFilters(filters)).toBe(3);
  });
});
```

---

### **Maestro E2E Tests**

**File:** `p2p-kids-marketplace/e2e/search-filters.yaml`
```yaml
appId: com.p2pkids.marketplace
---
- launchApp
- tapOn: 
    text: "Discover"
    
# Test 1: Basic search
- tapOn: 
    id: "search-input"
- inputText: "lego"
- assertVisible: 
    text: "LEGO"
- assertVisible:
    id: "search-result-card"
    
# Test 2: Multi-filter
- tapOn:
    id: "filter-button"
- assertVisible:
    text: "Filters"
- tapOn:
    text: "3-5"  # Age group
- tapOn:
    text: "Like New"  # Condition
- tapOn:
    id: "price-chip-10-25"  # $10-$25
- tapOn:
    text: "Apply Filters"
- assertVisible:
    text: "Age: 3-5"  # Active chip
- assertVisible:
    text: "$10-$25"
    
# Test 3: Remove filter chip
- tapOn:
    id: "remove-filter-age_group"
- assertNotVisible:
    text: "Age: 3-5"
    
# Test 4: Sort
- tapOn:
    id: "sort-dropdown"
- tapOn:
    text: "Price: Low to High"
# Verify first result has lower price than last result

# Test 5: Clear all filters
- tapOn:
    id: "filter-button"
- tapOn:
    text: "Clear All"
- assertNotVisible:
    id: "active-filter-chips"
```

**File:** `p2p-kids-marketplace/e2e/search-autocomplete.yaml`
```yaml
appId: com.p2pkids.marketplace
---
- launchApp
- tapOn:
    text: "Discover"
    
# Test recent searches
- tapOn:
    id: "search-input"
- inputText: "bicycle"
- assertVisible:
    id: "search-result-card"
- tapOn:
    id: "clear-search"
    
# Search again
- tapOn:
    id: "search-input"
# Should see "bicycle" in recent searches
- assertVisible:
    text: "bicycle"
- tapOn:
    text: "bicycle"
# Should trigger search immediately
- assertVisible:
    id: "search-result-card"
```

**File:** `p2p-kids-marketplace/e2e/search-empty-state.yaml`
```yaml
appId: com.p2pkids.marketplace
---
- launchApp
- tapOn:
    text: "Discover"
    
# Test no results with filters
- tapOn:
    id: "filter-button"
- tapOn:
    text: "New"
- inputText: "zzzzznonexistent"
- assertVisible:
    text: "No items match all your filters"
- assertVisible:
    text: "Clear filters"
    
# Test typo suggestion
- tapOn:
    id: "clear-search"
- inputText: "bycicle"
- assertVisible:
    text: "Did you mean 'bicycle'?"
```

---

### **Manual Testing Checklist**

**Performance:**
- [ ] Search results appear < 400ms after typing stops
- [ ] Scrolling 2-column grid is smooth (60fps)
- [ ] Infinite scroll loads next batch seamlessly
- [ ] Filter modal opens instantly (< 100ms)

**Search Behavior:**
- [ ] Partial words match ("wint" finds "winter jacket")
- [ ] Case-insensitive ("LEGO" = "lego")
- [ ] Empty query shows all/recommended items
- [ ] Debounce works (rapid typing doesn't spam API)

**Filters:**
- [ ] Multi-category: selecting 2 categories shows items from both
- [ ] Price range: $10-$25 only shows items in that range
- [ ] Age group: selecting "3-5" filters correctly
- [ ] Gender: default is "Any" (no filter)
- [ ] Color: multi-select works (Blue + Red shows items with either)
- [ ] Brand: autocomplete shows after 2 characters
- [ ] Condition: single-select only
- [ ] SP toggle: filters SP-eligible items

**Active Filters:**
- [ ] Chip row appears when filters active
- [ ] Badge count on Filter button is correct
- [ ] Removing chip updates results immediately
- [ ] "Clear All" in modal resets everything

**Sort:**
- [ ] Relevance: best matches first
- [ ] Newest: most recent items first
- [ ] Price Low: cheapest first
- [ ] Price High: most expensive first

**Recent Searches:**
- [ ] Appears when search bar focused + empty
- [ ] Max 8 searches shown
- [ ] Tapping recent search triggers search immediately
- [ ] X button removes individual search
- [ ] "Clear All History" clears everything

**Autocomplete:**
- [ ] Shows after 2 characters typed
- [ ] Max 5 suggestions
- [ ] Tapping suggestion fills search bar and fires search
- [ ] Only shows if matching recent searches exist

**Empty States:**
- [ ] With filters: shows "Clear filters" + impact hints
- [ ] Without filters: shows "Did you mean...?" if typo detected
- [ ] Fallback: shows 3-6 popular items

**Infinite Scroll:**
- [ ] First 20 load immediately
- [ ] Scrolling near bottom triggers next batch
- [ ] Loading indicator appears at bottom
- [ ] No duplicate items
- [ ] "No more items" message when exhausted

**Error Handling:**
- [ ] Network error: shows banner "Can't connect. Tap to retry"
- [ ] Old results stay visible during network error
- [ ] Retry button works

**Accessibility:**
- [ ] VoiceOver reads all labels correctly
- [ ] Filter button announces active count
- [ ] Each chip announces its filter type
- [ ] Result cards read title + price + condition

---

## Acceptance Criteria

### **Database:**
- [ ] `age_group` column exists with CHECK constraint
- [ ] `gender` column exists with CHECK constraint
- [ ] `brand` column exists (max 100 chars)
- [ ] `color` column exists (TEXT[] array)
- [ ] All 6 indexes created (age_group, gender, brand, color, price, category_price)
- [ ] `search_listings` RPC accepts 13 params (12 filters + sort)
- [ ] `get_popular_brands` RPC returns top 50 brands

### **Frontend:**
- [ ] DiscoverScreen replaces SearchScreen + BrowseItemsScreen
- [ ] Search debounce is 200ms
- [ ] All 10 new components exist and render correctly
- [ ] Filter modal has 8 filter sections in correct order
- [ ] Active filter chips appear/disappear correctly
- [ ] Sort dropdown has 4 options
- [ ] Recent searches stored in AsyncStorage
- [ ] Autocomplete dropdown shows after 2 chars

### **Performance:**
- [ ] Search latency < 400ms (measured with stopwatch)
- [ ] Backend RPC < 200ms (Supabase logs)
- [ ] Infinite scroll loads < 300ms per batch
- [ ] FlatList scrolling is smooth (no jank)

### **UX:**
- [ ] 2-column grid with square images
- [ ] Price overlaid on image bottom-left
- [ ] Title truncated at 2 lines
- [ ] SP badge visible if accepts_swap_points
- [ ] Skeleton placeholders during first load
- [ ] Optimistic UI (old results visible while loading)
- [ ] Network error banner at top (doesn't block content)

### **Filters Work Correctly:**
- [ ] Multi-category returns items from ANY selected category
- [ ] Price range filters min/max correctly
- [ ] Age group filters exact match
- [ ] Gender filters exact match (default: any)
- [ ] Color multi-select filters ANY selected color
- [ ] Brand autocomplete shows predefined + DB brands
- [ ] Condition filters exact match
- [ ] SP toggle filters correctly

### **Edge Cases Handled:**
- [ ] Empty query → shows all items
- [ ] Query with 0 results + filters → shows "Clear filters"
- [ ] Query with 0 results no filters → shows "Did you mean...?"
- [ ] Typo < 3 edits away → suggests correction
- [ ] Network error → shows banner + keeps old results
- [ ] Invalid price range (min > max) → shows error in modal

### **Accessibility:**
- [ ] All buttons have `accessibilityLabel`
- [ ] Filter button announces count
- [ ] Screen reader can navigate entire flow
- [ ] VoiceOver announces filter changes

---

## Out of Scope (Post-MVP)

The following features are **NOT** included in this MVP and will be considered for Phase 2:

### **Advanced Search Features:**
- [ ] Server-side autocomplete (trigram index on titles)
- [ ] PostgreSQL fuzzy search (`pg_trgm` extension)
- [ ] NLP natural language search ("blue coat for 4yr old boy")
- [ ] Search by image (upload photo, find similar items)
- [ ] Voice search

### **Filter Enhancements:**
- [ ] Live filter count preview in modal ("Showing 47 items")
- [ ] Saved searches (save filter combinations)
- [ ] Search alerts (notify when new items match saved search)
- [ ] Distance/location filter (if node system changes)
- [ ] Size filter (clothing sizes)
- [ ] Hierarchical categories (parent → sub-categories)

### **Performance Optimizations:**
- [ ] ElasticSearch integration (if search traffic exceeds 10k queries/day)
- [ ] Redis caching layer
- [ ] CDN for search result thumbnails

### **Analytics:**
- [ ] Track search queries (what users are looking for)
- [ ] Track zero-results queries (where search fails)
- [ ] A/B test sort order defaults
- [ ] Heatmaps for filter usage

### **UX Polish:**
- [ ] Swipe-to-dismiss filter chips
- [ ] Haptic feedback on filter selection
- [ ] Animated transitions between sort/filter changes
- [ ] Search history sync across devices (requires DB storage)

---

## Implementation Checklist

### **Week 1: Database + Backend**

**Day 1-2: Database Migrations**
- [ ] Create `20260420000001_add_item_filter_columns.sql`
- [ ] Add columns: age_group, gender, brand, color
- [ ] Create 6 indexes
- [ ] Test migration on local Supabase
- [ ] Apply to staging
- [ ] Verify with SQL queries

**Day 3-5: RPC Functions**
- [ ] Create `20260420000002_update_search_listings_rpc.sql`
- [ ] Replace old search_listings with 13-param version
- [ ] Add get_popular_brands RPC
- [ ] Test all filter combinations with SQL
- [ ] Verify full-text search works
- [ ] Test sort options
- [ ] Apply to staging
- [ ] Performance test: measure RPC latency

**Deliverable:** Database ready with all filters + RPCs tested

---

### **Week 2: Core Components**

**Day 1: Services Layer**
- [ ] Update `discovery.ts`: modify searchListings()
- [ ] Create `searchHistory.ts`: 5 functions
- [ ] Create `brandAutocomplete.ts`: 3 functions
- [ ] Write unit tests for all services
- [ ] Test AsyncStorage reads/writes

**Day 2: Types + Utilities**
- [ ] Update `discovery.ts` types: DiscoveryFilters, SearchResult
- [ ] Create `fuzzyMatch.ts`: 2 functions
- [ ] Create `filterHelpers.ts`: 4 functions
- [ ] Write unit tests for utilities

**Day 3-4: DiscoverScreen**
- [ ] Create `DiscoverScreen.tsx`
- [ ] Implement search bar with 200ms debounce
- [ ] Implement 2-column FlatList
- [ ] Implement infinite scroll
- [ ] Implement optimistic UI
- [ ] Add sort dropdown
- [ ] Test on device

**Day 5: Filter Modal**
- [ ] Create `SearchFilterModal.tsx`
- [ ] Implement 8 filter sections
- [ ] Add validation (price min <= max)
- [ ] Add "Apply" and "Clear All" buttons
- [ ] Calculate active filter count
- [ ] Test all filter types

**Deliverable:** Core search + filters working on device

---

### **Week 3: Polish + Testing**

**Day 1: Supporting Components**
- [ ] Create `ActiveFilterChips.tsx`
- [ ] Create `RecentSearchesPanel.tsx`
- [ ] Create `SearchAutocomplete.tsx`
- [ ] Create `SearchResultCard.tsx`
- [ ] Create `SearchEmptyState.tsx`
- [ ] Create `SearchResultSkeleton.tsx`
- [ ] Create `NetworkErrorBanner.tsx`

**Day 2: Integration**
- [ ] Wire all components into DiscoverScreen
- [ ] Test full user flows
- [ ] Fix UI bugs
- [ ] Polish animations

**Day 3: Testing**
- [ ] Write Maestro E2E tests (3 files)
- [ ] Run full test suite
- [ ] Fix failing tests
- [ ] Performance profiling

**Day 4: Accessibility + Final Polish**
- [ ] Add all accessibility labels
- [ ] Test with VoiceOver
- [ ] Final UI polish (spacing, colors, fonts)
- [ ] Code review

**Day 5: Deployment**
- [ ] Merge to staging
- [ ] Deploy database migrations
- [ ] Deploy app update
- [ ] Smoke test on staging
- [ ] Monitor Sentry for errors

**Deliverable:** Fully tested, deployed to staging

---

## Appendix

### **Color Values (12 Options)**
```typescript
const COLORS = [
  { id: 'red', label: 'Red', hex: '#EF4444' },
  { id: 'blue', label: 'Blue', hex: '#3B82F6' },
  { id: 'green', label: 'Green', hex: '#10B981' },
  { id: 'yellow', label: 'Yellow', hex: '#FBBF24' },
  { id: 'pink', label: 'Pink', hex: '#EC4899' },
  { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
  { id: 'black', label: 'Black', hex: '#1F2937' },
  { id: 'white', label: 'White', hex: '#F9FAFB' },
  { id: 'gray', label: 'Gray', hex: '#6B7280' },
  { id: 'brown', label: 'Brown', hex: '#92400E' },
  { id: 'orange', label: 'Orange', hex: '#F97316' },
  { id: 'multicolor', label: 'Multicolor', hex: 'linear-gradient(...)' },
];
```

### **Price Preset Ranges**
```typescript
const PRICE_PRESETS = [
  { id: 'under-10', label: 'Under $10', min: 0, max: 10 },
  { id: '10-25', label: '$10-$25', min: 10, max: 25 },
  { id: '25-50', label: '$25-$50', min: 25, max: 50 },
  { id: '50-100', label: '$50-$100', min: 50, max: 100 },
  { id: 'over-100', label: 'Over $100', min: 100, max: 10000 },
];
```

### **AsyncStorage Keys**
```typescript
const STORAGE_KEYS = {
  RECENT_SEARCHES: '@kids_marketplace:recent_searches',
  ACTIVE_FILTERS: '@kids_marketplace:active_filters', // session only
  BRAND_CACHE: '@kids_marketplace:brand_cache', // 5min TTL
};
```

---

**End of Requirements Document**

---

**Approval Signatures:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | @sameralzubaidy-afk | 2026-04-19 | _______ |
| Tech Lead | @sameralzubaidi-afk | 2026-04-19 | _______ |

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-19 | AI + @sameralzubaidy-afk | Initial requirements |
