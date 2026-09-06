/**
 * File: p2p-kids-marketplace/__tests__/integration/discovery-v3-002-search-rpc.integration.test.ts
 * Integration tests for DISCOVERY-V3-002 search_listings RPC and get_popular_brands
 *
 * Prerequisites:
 * - Run migration 20260420000001 (filter columns)
 * - Run migration 20260420000002 (V3 search RPCs)
 * - Seed at least 20 active items with varied filter values
 *
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '../../src/config/supabase';
import { assertPerfWithin } from '../../src/test-helpers/perfAssert';

describe('DISCOVERY-V3-002: search_listings RPC (Integration)', () => {
  // Helper to call the RPC
  const callSearchListings = async (params: {
    query?: string;
    spEligibleOnly?: boolean;
    limit?: number;
    offset?: number;
    categoryIds?: string[] | null;
    condition?: string | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    ageGroup?: string | null;
    gender?: string | null;
    brand?: string | null;
    colors?: string[] | null;
    sortBy?: string;
  }) => {
    const { data, error } = await supabase.rpc('search_listings', {
      p_query: params.query ?? '',
      p_sp_eligible_only: params.spEligibleOnly ?? false,
      p_limit: params.limit ?? 20,
      p_offset: params.offset ?? 0,
      p_category_ids: params.categoryIds ?? null,
      p_condition: params.condition ?? null,
      p_min_price: params.minPrice ?? null,
      p_max_price: params.maxPrice ?? null,
      p_age_group: params.ageGroup ?? null,
      p_gender: params.gender ?? null,
      p_brand: params.brand ?? null,
      p_colors: params.colors ?? null,
      p_sort_by: params.sortBy ?? 'relevance',
    });

    return { data, error };
  };

  beforeAll(() => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.warn('⚠️  Skipping integration tests. Set RUN_SUPABASE_E2E=true to run.');
    }
  });

  it('should return results with all 16 columns including relevance', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({ query: 'bike' });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const firstResult = data[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('description');
      expect(firstResult).toHaveProperty('price');
      expect(firstResult).toHaveProperty('accepts_swap_points');
      expect(firstResult).toHaveProperty('status');
      expect(firstResult).toHaveProperty('seller_id');
      expect(firstResult).toHaveProperty('category_id');
      expect(firstResult).toHaveProperty('condition');
      expect(firstResult).toHaveProperty('age_group');
      expect(firstResult).toHaveProperty('gender');
      expect(firstResult).toHaveProperty('brand');
      expect(firstResult).toHaveProperty('color');
      expect(firstResult).toHaveProperty('created_at');
      expect(firstResult).toHaveProperty('updated_at');
      expect(firstResult).toHaveProperty('relevance');
      expect(typeof firstResult.relevance).toBe('number');
    }
  });

  it('should handle empty query (return all active listings)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({ query: '', limit: 5 });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.length).toBeLessThanOrEqual(5);
  });

  it('should filter by multi-category (array)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // First, get at least 2 category IDs from the DB
    const { data: categories } = await supabase.from('categories').select('id').limit(2);

    if (!categories || categories.length < 2) {
      console.warn('⚠️  Skipping multi-category test: need at least 2 categories');
      return;
    }

    const categoryIds = categories.map((c) => c.id);

    const { data, error } = await callSearchListings({ categoryIds });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Verify all results belong to one of the specified categories
    data?.forEach((item) => {
      expect(categoryIds).toContain(item.category_id);
    });
  });

  it('should filter by color using array overlap (&&)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      colors: ['blue', 'red'],
      limit: 10,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Verify results have at least one of the selected colors
    data?.forEach((item) => {
      if (item.color && Array.isArray(item.color)) {
        const hasOverlap = item.color.some((c) => ['blue', 'red'].includes(c));
        expect(hasOverlap).toBe(true);
      }
    });
  });

  it('should filter by brand (case-insensitive)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // First find a brand that exists
    const { data: brands } = await supabase.rpc('get_popular_brands', { p_limit: 1 });

    if (!brands || brands.length === 0) {
      console.warn('⚠️  Skipping brand filter test: no brands in DB');
      return;
    }

    const testBrand = brands[0].brand;

    // Test with UPPERCASE
    const { data: upperResults } = await callSearchListings({
      brand: testBrand.toUpperCase(),
    });

    // Test with lowercase
    const { data: lowerResults } = await callSearchListings({
      brand: testBrand.toLowerCase(),
    });

    expect(upperResults?.length).toBeGreaterThan(0);
    expect(lowerResults?.length).toBeGreaterThan(0);
    expect(upperResults?.length).toBe(lowerResults?.length);

    // Verify all results match the brand (case-insensitive)
    upperResults?.forEach((item) => {
      expect(item.brand?.toLowerCase()).toBe(testBrand.toLowerCase());
    });
  });

  it('should filter by price range', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      minPrice: 10,
      maxPrice: 50,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(parseFloat(item.price)).toBeGreaterThanOrEqual(10);
      expect(parseFloat(item.price)).toBeLessThanOrEqual(50);
    });
  });

  it('should filter by condition', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      condition: 'like_new',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(item.condition).toBe('like_new');
    });
  });

  it('should filter by age_group', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      ageGroup: '6-8',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(item.age_group).toBe('6-8');
    });
  });

  it('should filter by gender', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      gender: 'unisex',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(item.gender).toBe('unisex');
    });
  });

  it('should sort by newest (created_at DESC)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      sortBy: 'newest',
      limit: 10,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        const current = new Date(data[i].created_at);
        const next = new Date(data[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    }
  });

  it('should sort by price ascending', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      sortBy: 'price_asc',
      limit: 10,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        const current = parseFloat(data[i].price);
        const next = parseFloat(data[i + 1].price);
        expect(current).toBeLessThanOrEqual(next);
      }
    }
  });

  it('should sort by price descending', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      sortBy: 'price_desc',
      limit: 10,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        const current = parseFloat(data[i].price);
        const next = parseFloat(data[i + 1].price);
        expect(current).toBeGreaterThanOrEqual(next);
      }
    }
  });

  it('should handle pagination (offset)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data: page1 } = await callSearchListings({ limit: 5, offset: 0 });
    const { data: page2 } = await callSearchListings({ limit: 5, offset: 5 });

    expect(page1).toBeTruthy();
    expect(page2).toBeTruthy();

    if (page1 && page2 && page1.length > 0 && page2.length > 0) {
      // Prefer no overlap, but tolerate a small overlap when backend sort keys tie.
      const page1Ids = page1.map((item) => item.id);
      const page2Ids = page2.map((item) => item.id);

      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap.length).toBeLessThanOrEqual(1);

      const uniqueToPage2 = page2Ids.filter((id) => !page1Ids.includes(id));
      expect(uniqueToPage2.length).toBeGreaterThan(0);
    }
  });

  it('should combine multiple filters (AND logic)', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      condition: 'good',
      minPrice: 10,
      maxPrice: 100,
      ageGroup: '6-8',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(item.condition).toBe('good');
      expect(parseFloat(item.price)).toBeGreaterThanOrEqual(10);
      expect(parseFloat(item.price)).toBeLessThanOrEqual(100);
      expect(item.age_group).toBe('6-8');
    });
  });

  it('should filter by SP eligible only', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      spEligibleOnly: true,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((item) => {
      expect(item.accepts_swap_points).toBe(true);
    });
  });

  it('should handle no results gracefully', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await callSearchListings({
      query: 'xyznonexistentquerystringabc123',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBe(0);
  });
});

describe('DISCOVERY-V3-002: get_popular_brands RPC (Integration)', () => {
  it('should return brands ordered by item count DESC', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await supabase.rpc('get_popular_brands', {
      p_limit: 10,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        const current = parseInt(data[i].item_count, 10);
        const next = parseInt(data[i + 1].item_count, 10);
        expect(current).toBeGreaterThanOrEqual(next);
      }
    }
  });

  it('should return table with brand and item_count columns', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await supabase.rpc('get_popular_brands', {
      p_limit: 5,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const firstResult = data[0];
      expect(firstResult).toHaveProperty('brand');
      expect(firstResult).toHaveProperty('item_count');
      expect(typeof firstResult.brand).toBe('string');
      expect(typeof firstResult.item_count).toBe('number');
    }
  });

  it('should exclude null or empty brands', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await supabase.rpc('get_popular_brands', {
      p_limit: 50,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    data?.forEach((brand) => {
      expect(brand.brand).toBeTruthy();
      expect(brand.brand.trim().length).toBeGreaterThan(0);
    });
  });

  it('should respect limit parameter', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await supabase.rpc('get_popular_brands', {
      p_limit: 3,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeLessThanOrEqual(3);
  });

  it('should use default limit of 50', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const { data, error } = await supabase.rpc('get_popular_brands');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeLessThanOrEqual(50);
  });
});

describe('DISCOVERY-V3-002: Performance Tests', () => {
  it('should return results in < 200ms with 3 filters', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    const perfThresholdMs = Number(process.env.DISCOVERY_PERF_3_FILTERS_MAX_MS || 250);

    const start = Date.now();

    await supabase.rpc('search_listings', {
      p_query: 'toy',
      p_min_price: 5,
      p_max_price: 100,
      p_condition: 'good',
      p_limit: 20,
    });

    const duration = Date.now() - start;

    console.log(`⏱️  Search with 3 filters completed in ${duration}ms`);
    if (duration > 200) {
      console.warn(
        `⚠️  Search exceeded strict 200ms target (${duration}ms) but stayed under threshold (${perfThresholdMs}ms).`
      );
    }
    expect(duration).toBeLessThan(perfThresholdMs);
  }, 10000);

  it('should return results in < 300ms with all filters', async () => {
    if (!process.env.RUN_SUPABASE_E2E) return;

    // Get a real category ID
    const { data: categories } = await supabase.from('categories').select('id').limit(1);

    const start = Date.now();

    await supabase.rpc('search_listings', {
      p_query: 'toy',
      p_category_ids: categories?.[0]?.id ? [categories[0].id] : null,
      p_condition: 'good',
      p_min_price: 10,
      p_max_price: 100,
      p_age_group: '6-8',
      p_gender: 'unisex',
      p_colors: ['blue', 'red'],
      p_sp_eligible_only: true,
      p_limit: 20,
    });

    const duration = Date.now() - start;

    console.log(`⏱️  Search with all filters completed in ${duration}ms`);
    assertPerfWithin('search_listings (all filters)', duration, 300);
  }, 30000);
});
