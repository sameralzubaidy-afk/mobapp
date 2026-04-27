/**
 * E2E Integration Tests for Discovery V3 Search & Filters
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-008
 * 
 * Tests search_listings RPC with real Supabase connection (staging)
 * 
 * Run with:
 *   RUN_SUPABASE_E2E=true npm run test:e2e
 * 
 * Prerequisites:
 *   - Staging Supabase must be accessible
 *   - Migration 20260420000002_update_search_listings_rpc.sql applied
 *   - At least 5 test items in staging database
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

describe('Discovery V3 E2E Integration Tests', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.log('⏭️  Skipping E2E tests (RUN_SUPABASE_E2E not set)');
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for E2E tests');
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  describe('search_listings RPC', () => {
    it('should return results with all 13 parameters', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: 'test',
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'relevance',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by category IDs (multi-select)', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // First, get a category ID
      const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .limit(2);

      if (!categories || categories.length === 0) {
        console.log('⏭️  No categories found, skipping category filter test');
        return;
      }

      const categoryIds = categories.map(c => c.id);

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: categoryIds,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'relevance',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // All results should belong to one of the specified categories
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          expect(categoryIds).toContain(item.category_id);
        });
      }
    });

    it('should filter by condition', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: 'like_new',
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'relevance',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // All results should have condition = 'like_new'
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          expect(item.condition).toBe('like_new');
        });
      }
    });

    it('should filter by price range', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const minPrice = 10;
      const maxPrice = 50;

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: minPrice,
        p_max_price: maxPrice,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'relevance',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // All results should have price within range
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          expect(item.price).toBeGreaterThanOrEqual(minPrice);
          expect(item.price).toBeLessThanOrEqual(maxPrice);
        });
      }
    });

    it('should filter by colors (multi-select with overlap)', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: ['blue', 'red'],
        p_sort_by: 'relevance',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Results should have at least one color overlapping with ['blue', 'red']
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (item.color && Array.isArray(item.color)) {
            const hasOverlap = item.color.some((c: string) =>
              ['blue', 'red'].includes(c.toLowerCase())
            );
            expect(hasOverlap).toBe(true);
          }
        });
      }
    });

    it('should sort by price ascending', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'price_asc',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify results are sorted by price ascending
      if (data && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          expect(data[i].price).toBeGreaterThanOrEqual(data[i - 1].price);
        }
      }
    });

    it('should sort by price descending', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'price_desc',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify results are sorted by price descending
      if (data && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          expect(data[i].price).toBeLessThanOrEqual(data[i - 1].price);
        }
      }
    });

    it('should sort by newest first', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'newest',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify results are sorted by created_at descending
      if (data && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          const prev = new Date(data[i - 1].created_at).getTime();
          const curr = new Date(data[i].created_at).getTime();
          expect(curr).toBeLessThanOrEqual(prev);
        }
      }
    });

    it('should handle pagination with offset', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      // First page
      const { data: page1 } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 5,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'newest',
      });

      // Second page
      const { data: page2 } = await supabase.rpc('search_listings', {
        p_query: null,
        p_sp_eligible_only: false,
        p_limit: 5,
        p_offset: 5,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'newest',
      });

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();

      // Pages should be different (if enough data exists)
      if (page1 && page2 && page1.length > 0 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });
  });

  describe('get_popular_brands RPC', () => {
    it('should return popular brands with default limit', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('get_popular_brands');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Should return at most 50 brands (default limit)
      if (data) {
        expect(data.length).toBeLessThanOrEqual(50);
      }
    });

    it('should respect custom limit parameter', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('get_popular_brands', {
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Should return at most 10 brands
      if (data) {
        expect(data.length).toBeLessThanOrEqual(10);
      }
    });

    it('should return brands ordered by frequency (most popular first)', async () => {
      if (!process.env.RUN_SUPABASE_E2E) {
        return;
      }

      const { data, error } = await supabase.rpc('get_popular_brands', {
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Each brand should have a count field
      if (data && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          const current =
            Number(data[i].count ?? data[i].item_count ?? data[i].frequency ?? 0);
          const previous =
            Number(data[i - 1].count ?? data[i - 1].item_count ?? data[i - 1].frequency ?? 0);
          expect(current).toBeLessThanOrEqual(previous);
        }
      }
    });
  });
});
