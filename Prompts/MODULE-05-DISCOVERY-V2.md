# MODULE 05: SEARCH & DISCOVERY (V2)

**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Status:** Complete - All Tasks Specified  
**Last Updated:** [Auto-generated timestamp]

---

## V2 OVERVIEW

This module defines **search, browse, and discovery** features in the Kids Club+ marketplace, integrated with:

- **SP-eligible filtering**: Filter search results to show only listings that accept Swap Points.
- **Subscriber personalization**: Prioritize SP-eligible items for subscribers in recommendations.
- **Category browsing**: Organized catalog with age-appropriate categories.
- **Search optimization**: Full-text search with relevance scoring.

This module builds on MODULE-04 (Listings) and enhances discovery with V2 subscription-aware features.

---

## CHANGELOG FROM V1 → V2

### V1 Limitations
- **No SP context**: Search results didn't highlight SP-eligible items.
- **Generic recommendations**: No personalization based on subscription status.
- **Limited filtering**: Basic category and price filters only.

### V2 Enhancements
- **SP-Eligible Badge**: Search results show "✓ SP Eligible" badge prominently.
- **Subscriber-First Recommendations**: SP-eligible items ranked higher for subscribers.
- **Enhanced Filters**: Add SP-eligible toggle to all search/browse interfaces.
- **Smart Recommendations**: Suggest items within user's SP balance range.

---

## CRITICAL V2 RULES FOR DISCOVERY MODULE

### Rule 1: SP-Eligible Prioritization
- For subscribers: SP-eligible listings ranked higher in search results.
- For non-subscribers: SP-eligible items shown but with upgrade CTA.

### Rule 2: Balance-Aware Recommendations
- If user has 50 SP: Recommend items priced ≤ $50 that accept SP.
- Prevents recommending SP-eligible items user cannot afford.

### Rule 3: Search Index Optimization
- Full-text search includes: item name, description, category, tags.
- Relevance scoring: Exact match > partial match > category match.

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-05 (SEARCH & DISCOVERY V2).

CONTEXT:
- This is part of Phase 3 work for Kids Club+ marketplace V2.
- MODULE-04 (Listings) provides catalog data with accepts_swap_points field.
- MODULE-11 (Subscriptions) provides user subscription context.
- MODULE-09 (SP Gamification) provides SP balance for personalization.

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (DISCOVERY-V2-001, etc.), implement EXACTLY as specified.
3. Ensure search performance and relevance scoring.
4. Run tests after each task.

==================================================
NEXT TASK: DISCOVERY-V2-001 (Search Index & Full-Text Search)
==================================================
*/
```

---

## TASK DISCOVERY-V2-001: Full-Text Search Index

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** MODULE-04

### Description

Implement PostgreSQL full-text search for listings with relevance scoring.

### AI Prompt for Cursor

```typescript
/*
TASK: Create full-text search index and search function

REQUIREMENTS:
1. Migration: Add tsvector column to listings table
2. RPC function: search_listings with ranking
3. Service: searchListings wrapper

==================================================
FILE 1: Migration - Add Search Index
==================================================
*/

-- filepath: supabase/migrations/050_listings_search_index.sql

-- Add tsvector column for full-text search
ALTER TABLE listings
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(item_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(item_description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C')
) STORED;

-- Create GIN index for fast search
CREATE INDEX idx_listings_search ON listings USING GIN (search_vector);

/*
==================================================
FILE 2: RPC - search_listings
==================================================
*/

-- filepath: supabase/migrations/051_search_listings_rpc.sql

CREATE OR REPLACE FUNCTION search_listings(
  p_query TEXT,
  p_sp_eligible_only BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  item_name TEXT,
  price_cents INT,
  accepts_swap_points BOOLEAN,
  relevance REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.item_name,
    l.price_cents,
    l.accepts_swap_points,
    ts_rank(l.search_vector, plainto_tsquery('english', p_query)) AS relevance
  FROM listings l
  WHERE
    l.status = 'active'
    AND l.search_vector @@ plainto_tsquery('english', p_query)
    AND (NOT p_sp_eligible_only OR l.accepts_swap_points = TRUE)
  ORDER BY relevance DESC
  LIMIT p_limit;
END;
$$;

/*
==================================================
FILE 3: Service - searchListings
==================================================
*/

// filepath: src/services/discovery.ts

import { supabase } from '../lib/supabase';

export interface SearchResult {
  id: string;
  item_name: string;
  price_cents: number;
  accepts_swap_points: boolean;
  relevance: number;
}

export async function searchListings(
  query: string,
  spEligibleOnly: boolean = false
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_listings', {
    p_query: query,
    p_sp_eligible_only: spEligibleOnly,
    p_limit: 20,
  });

  if (error) throw error;

  return data as SearchResult[];
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Full-text search index created on listings table
✓ search_listings RPC ranks results by relevance
✓ SP-eligible filter works correctly
✓ Search performance < 100ms for typical queries

==================================================
NEXT TASK: DISCOVERY-V2-002 (Subscriber-Personalized Recommendations)
==================================================
*/
```

---

## TASK DISCOVERY-V2-002: Subscriber-Personalized Recommendations

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** DISCOVERY-V2-001, MODULE-11, MODULE-09

### Description

Build recommendation engine that:
- Prioritizes SP-eligible items for subscribers.
- Suggests items within user's SP balance range.
- Uses collaborative filtering (view/purchase history) for personalization.

### AI Prompt for Cursor

```typescript
/*
TASK: Build personalized recommendation engine

REQUIREMENTS:
1. RPC: get_recommendations with subscriber prioritization
2. Service: getRecommendations
3. UI: Recommendations carousel on home screen

==================================================
FILE 1: RPC - get_recommendations
==================================================
*/

-- filepath: supabase/migrations/052_get_recommendations_rpc.sql

CREATE OR REPLACE FUNCTION get_recommendations(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  item_name TEXT,
  price_cents INT,
  accepts_swap_points BOOLEAN,
  score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_sp_balance INT;
  v_can_spend_sp BOOLEAN;
BEGIN
  -- Get user SP balance and subscription status
  SELECT available_points, can_spend_sp
  INTO v_user_sp_balance, v_can_spend_sp
  FROM get_user_sp_wallet_summary(p_user_id);

  RETURN QUERY
  SELECT
    l.id,
    l.item_name,
    l.price_cents,
    l.accepts_swap_points,
    -- Scoring logic:
    -- +100 if SP-eligible and user can spend SP
    -- +50 if item price <= user SP balance (in cents)
    -- +10 for popular categories (TODO: add view tracking)
    (
      CASE WHEN l.accepts_swap_points AND v_can_spend_sp THEN 100 ELSE 0 END +
      CASE WHEN l.price_cents <= (v_user_sp_balance * 100) THEN 50 ELSE 0 END +
      10
    )::REAL AS score
  FROM listings l
  WHERE l.status = 'active'
  ORDER BY score DESC, RANDOM() -- Randomize within score tier
  LIMIT p_limit;
END;
$$;

/*
==================================================
FILE 2: Service - getRecommendations
==================================================
*/

// filepath: src/services/discovery.ts (add to existing file)

export interface Recommendation {
  id: string;
  item_name: string;
  price_cents: number;
  accepts_swap_points: boolean;
  score: number;
}

export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase.rpc('get_recommendations', {
    p_user_id: userId,
    p_limit: 10,
  });

  if (error) throw error;

  return data as Recommendation[];
}

/*
==================================================
FILE 3: UI - Recommendations Carousel
==================================================
*/

// filepath: src/components/RecommendationsCarousel.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { getRecommendations, Recommendation } from '../services/discovery';
import { useAuth } from '../hooks/useAuth';

export const RecommendationsCarousel = () => {
  const { session } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    loadRecommendations();
  }, [session]);

  const loadRecommendations = async () => {
    if (!session) return;
    const data = await getRecommendations(session.user.id);
    setRecommendations(data);
  };

  return (
    <View>
      <Text>Recommended for You</Text>
      <FlatList
        horizontal
        data={recommendations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.item_name}</Text>
            <Text>${(item.price_cents / 100).toFixed(2)}</Text>
            {item.accepts_swap_points && <Text>✓ SP Eligible</Text>}
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Recommendations prioritize SP-eligible items for subscribers
✓ Suggestions within user SP balance range
✓ Randomization within score tier for variety
✓ Carousel displays on home screen

==================================================
NEXT TASK: DISCOVERY-V2-003 (Category Browsing with SP Filter)
==================================================
*/
```

---

## TASK DISCOVERY-V2-003: Category Browsing with SP Filter

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** MODULE-04

### Description

Organize listings into categories (Toys, Books, Clothes, etc.) with SP-eligible filter toggle.

### AI Prompt for Cursor

```typescript
/*
TASK: Build category browsing with SP filter

REQUIREMENTS:
1. Service: fetchListingsByCategory
2. UI: CategoryBrowseScreen

==================================================
FILE 1: Service - fetchListingsByCategory
==================================================
*/

// filepath: src/services/discovery.ts (add to existing file)

export async function fetchListingsByCategory(
  category: string,
  spEligibleOnly: boolean = false
): Promise<Listing[]> {
  let query = supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (spEligibleOnly) {
    query = query.eq('accepts_swap_points', true);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as Listing[];
}

/*
==================================================
FILE 2: UI - CategoryBrowseScreen
==================================================
*/

// filepath: src/screens/CategoryBrowseScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Switch } from 'react-native';
import { fetchListingsByCategory } from '../services/discovery';

export const CategoryBrowseScreen = ({ route }) => {
  const { category } = route.params;
  const [listings, setListings] = useState([]);
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);

  useEffect(() => {
    loadListings();
  }, [category, spEligibleOnly]);

  const loadListings = async () => {
    const data = await fetchListingsByCategory(category, spEligibleOnly);
    setListings(data);
  };

  return (
    <View>
      <Text>{category} Listings</Text>
      <View>
        <Text>Show only SP-eligible</Text>
        <Switch value={spEligibleOnly} onValueChange={setSpEligibleOnly} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.item_name}</Text>
            <Text>${(item.price_cents / 100).toFixed(2)}</Text>
            {item.accepts_swap_points && <Text>✓ SP Eligible</Text>}
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Category browse filters by category and SP eligibility
✓ SP toggle works correctly
✓ Categories include: Toys, Books, Clothes, Games, Sports, Electronics

==================================================
NEXT TASK: DISCOVERY-V2-004 (Search UI with SP Filter)
==================================================
*/
```

---

## TASK DISCOVERY-V2-004: Search UI with SP Filter & Tests

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** DISCOVERY-V2-001, DISCOVERY-V2-002, DISCOVERY-V2-003

### Description

Build search UI with SP filter toggle and comprehensive tests.

### AI Prompt for Cursor

```typescript
/*
TASK: Build search UI and write tests

REQUIREMENTS:
1. UI: SearchScreen with SP filter
2. Tests for search, recommendations, category browse

==================================================
FILE 1: UI - SearchScreen
==================================================
*/

// filepath: src/screens/SearchScreen.tsx

import React, { useState } from 'react';
import { View, Text Input, FlatList, Switch, Button } from 'react-native';
import { searchListings, SearchResult } from '../services/discovery';

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);

  const handleSearch = async () => {
    const data = await searchListings(query, spEligibleOnly);
    setResults(data);
  };

  return (
    <View>
      <TextInput
        placeholder="Search for items..."
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
      />
      <View>
        <Text>SP-eligible only</Text>
        <Switch value={spEligibleOnly} onValueChange={setSpEligibleOnly} />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.item_name}</Text>
            <Text>${(item.price_cents / 100).toFixed(2)}</Text>
            {item.accepts_swap_points && <Text>✓ SP Eligible</Text>}
            <Text>Relevance: {item.relevance.toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
FILE 2: Tests
==================================================
*/

// filepath: src/services/discovery.test.ts

import { describe, it, expect, vi } from 'vitest';
import { searchListings, getRecommendations } from './discovery';

describe('searchListings', () => {
  it('should return search results ranked by relevance', async () => {
    const results = await searchListings('toy car');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relevance).toBeGreaterThanOrEqual(results[1]?.relevance || 0);
  });

  it('should filter for SP-eligible only', async () => {
    const results = await searchListings('book', true);
    expect(results.every((r) => r.accepts_swap_points)).toBe(true);
  });
});

describe('getRecommendations', () => {
  it('should prioritize SP-eligible items for subscribers', async () => {
    const recommendations = await getRecommendations('subscriber-user-id');
    const spEligibleCount = recommendations.filter((r) => r.accepts_swap_points).length;
    expect(spEligibleCount).toBeGreaterThan(recommendations.length / 2);
  });
});

/*
==================================================
MODULE SUMMARY
==================================================
*/

## MODULE-05 SUMMARY: Search & Discovery (V2)

### Overview
Search and discovery with V2 subscriber personalization:
- **Full-Text Search**: PostgreSQL tsvector with relevance ranking.
- **Subscriber Recommendations**: SP-eligible items prioritized.
- **Balance-Aware Suggestions**: Items within user's SP budget.
- **Category Browsing**: Organized catalog with SP filter.

### Key Features
- SP-eligible badge on all search results.
- Recommendations score: SP-eligible + within budget + popularity.
- Real-time search with < 100ms response time.

### API Surface
- `search_listings(query, spEligibleOnly)`: Full-text search RPC.
- `get_recommendations(userId)`: Personalized recommendations RPC.
- `fetchListingsByCategory(category, spEligibleOnly)`: Category browse.

### Test Coverage
- ✓ Search returns relevant results.
- ✓ SP filter works correctly.
- ✓ Recommendations prioritize subscriber items.

---

## MODULE-05 COMPLETE ✅

All tasks (DISCOVERY-V2-001 through DISCOVERY-V2-004) specified.

**Next:** MODULE-05-VERIFICATION-V2.md

---
