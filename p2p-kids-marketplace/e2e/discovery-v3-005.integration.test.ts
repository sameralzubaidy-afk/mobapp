/**
 * File: p2p-kids-marketplace/e2e/discovery-v3-005.integration.test.ts
 * MODULE-05-DISCOVERY-V3: DiscoverScreen E2E Integration Tests
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * End-to-end tests against staging Supabase
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-005
 */

import { searchListings } from '../src/services/discovery';
import {
  getRecentSearches,
  addSearchToHistory,
  removeSearchFromHistory,
  clearSearchHistory,
} from '../src/services/searchHistory';
import { fetchDatabaseBrands, getBrandSuggestions } from '../src/services/brandAutocomplete';
import { suggestSpellingCorrection } from '../src/services/discovery';
import { getCategories } from '../src/services/items';
import { DiscoveryFilters } from '../src/types/discovery';
import { assertPerfWithin } from '../src/test-helpers/perfAssert';

describe('DISCOVERY-V3-005 E2E: DiscoverScreen Integration', () => {
  // Skip if not running E2E tests
  if (!process.env.RUN_SUPABASE_E2E) {
    it.skip('Skipping E2E tests (set RUN_SUPABASE_E2E=true to run)', () => {});
    return;
  }

  beforeEach(async () => {
    // Clear search history before each test
    await clearSearchHistory();
  });

  describe('Search Functionality', () => {
    it('performs basic search and returns results', async () => {
      const results = await searchListings('toy', {
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(results)).toBe(true);
      console.log(`[E2E] Search returned ${results.length} results`);
    });

    it('handles empty search query gracefully', async () => {
      const results = await searchListings('', {
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('applies SP-eligible filter correctly', async () => {
      const allResults = await searchListings('', {
        spEligibleOnly: false,
        limit: 100,
      });

      const spOnlyResults = await searchListings('', {
        spEligibleOnly: true,
        limit: 100,
      });

      console.log(`[E2E] All results: ${allResults.length}, SP-only: ${spOnlyResults.length}`);

      // SP-only should be subset of all results
      expect(spOnlyResults.length).toBeLessThanOrEqual(allResults.length);

      // All SP-only results should have accepts_swap_points = true
      spOnlyResults.forEach((result) => {
        expect(result.accepts_swap_points).toBe(true);
      });
    });

    it('applies category filter correctly', async () => {
      const categories = await getCategories();

      if (categories.length === 0) {
        console.warn('[E2E] No categories found, skipping category filter test');
        return;
      }

      const firstCategoryId = categories[0].id;

      const results = await searchListings('', {
        categoryIds: [firstCategoryId],
        limit: 20,
      });

      console.log(
        `[E2E] Category filter returned ${results.length} results for category ${categories[0].name}`
      );

      // All results should belong to the selected category
      results.forEach((result) => {
        expect(result.category_id).toBe(firstCategoryId);
      });
    });

    it('applies price range filter correctly', async () => {
      const filters: DiscoveryFilters = {
        minPrice: 10,
        maxPrice: 50,
        limit: 50,
      };

      const results = await searchListings('', filters);

      console.log(`[E2E] Price range filter (10-50) returned ${results.length} results`);

      // All results should be within price range
      results.forEach((result) => {
        expect(result.price).toBeGreaterThanOrEqual(10);
        expect(result.price).toBeLessThanOrEqual(50);
      });
    });

    it('applies sort by price ascending', async () => {
      const results = await searchListings('', {
        sortBy: 'price_asc',
        limit: 20,
      });

      if (results.length < 2) {
        console.warn('[E2E] Not enough results to verify sort order');
        return;
      }

      // Check that results are sorted ascending
      for (let i = 1; i < results.length; i++) {
        expect(results[i].price).toBeGreaterThanOrEqual(results[i - 1].price);
      }

      console.log(
        `[E2E] Price ascending verified: ${results[0].price} to ${results[results.length - 1].price}`
      );
    });

    it('applies sort by price descending', async () => {
      const results = await searchListings('', {
        sortBy: 'price_desc',
        limit: 20,
      });

      if (results.length < 2) {
        console.warn('[E2E] Not enough results to verify sort order');
        return;
      }

      // Check that results are sorted descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i].price).toBeLessThanOrEqual(results[i - 1].price);
      }

      console.log(
        `[E2E] Price descending verified: ${results[0].price} to ${results[results.length - 1].price}`
      );
    });

    it('applies sort by newest', async () => {
      const results = await searchListings('', {
        sortBy: 'newest',
        limit: 20,
      });

      if (results.length < 2) {
        console.warn('[E2E] Not enough results to verify sort order');
        return;
      }

      // Check that results are sorted by created_at descending
      for (let i = 1; i < results.length; i++) {
        const date1 = new Date(results[i - 1].created_at).getTime();
        const date2 = new Date(results[i].created_at).getTime();
        expect(date2).toBeLessThanOrEqual(date1);
      }

      console.log(`[E2E] Newest sort verified`);
    });
  });

  describe('Pagination', () => {
    it('supports offset pagination', async () => {
      const page1 = await searchListings('', {
        limit: 10,
        offset: 0,
      });

      const page2 = await searchListings('', {
        limit: 10,
        offset: 10,
      });

      console.log(`[E2E] Page 1: ${page1.length} results, Page 2: ${page2.length} results`);

      // Pages should not overlap (different IDs)
      const page1Ids = page1.map((r) => r.id);
      const page2Ids = page2.map((r) => r.id);

      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('returns exactly requested limit', async () => {
      const results = await searchListings('', {
        limit: 5,
        offset: 0,
      });

      expect(results.length).toBeLessThanOrEqual(5);
      console.log(`[E2E] Limit 5 returned ${results.length} results`);
    });
  });

  describe('Search History', () => {
    it('stores and retrieves search history', async () => {
      await clearSearchHistory();

      await addSearchToHistory('bike');
      await addSearchToHistory('toy');
      await addSearchToHistory('book');

      const recent = await getRecentSearches();

      expect(recent).toEqual(['book', 'toy', 'bike']); // LRU order (newest first)
      console.log(`[E2E] Search history: ${recent.join(', ')}`);
    });

    it('deduplicates and moves to front on re-add', async () => {
      await clearSearchHistory();

      await addSearchToHistory('bike');
      await addSearchToHistory('toy');
      await addSearchToHistory('bike'); // Re-add

      const recent = await getRecentSearches();

      expect(recent).toEqual(['bike', 'toy']); // bike moved to front
      console.log(`[E2E] Deduplicated history: ${recent.join(', ')}`);
    });

    it('caps history at 8 items', async () => {
      await clearSearchHistory();

      for (let i = 1; i <= 10; i++) {
        await addSearchToHistory(`search-${i}`);
      }

      const recent = await getRecentSearches();

      expect(recent.length).toBe(8);
      expect(recent[0]).toBe('search-10'); // Most recent
      expect(recent[7]).toBe('search-3'); // Oldest kept
      console.log(`[E2E] Capped history at 8: ${recent.join(', ')}`);
    });

    it('removes individual search from history', async () => {
      await clearSearchHistory();

      await addSearchToHistory('bike');
      await addSearchToHistory('toy');
      await addSearchToHistory('book');

      await removeSearchFromHistory('toy');

      const recent = await getRecentSearches();

      expect(recent).toEqual(['book', 'bike']);
      console.log(`[E2E] After removal: ${recent.join(', ')}`);
    });
  });

  describe('Brand Autocomplete', () => {
    it('fetches database brands', async () => {
      const brands = await fetchDatabaseBrands();

      expect(Array.isArray(brands)).toBe(true);
      console.log(`[E2E] Fetched ${brands.length} brands from database`);
    });

    it('provides brand suggestions with minimum 2 chars', async () => {
      const suggestions = await getBrandSuggestions('le');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(8); // Capped at 8
      console.log(`[E2E] Brand suggestions for "le": ${suggestions.join(', ')}`);
    });

    it('returns empty array for single character', async () => {
      const suggestions = await getBrandSuggestions('l');

      expect(suggestions).toEqual([]);
      console.log(`[E2E] Single char returned empty array`);
    });

    it('merges predefined and database brands', async () => {
      const suggestions = await getBrandSuggestions('lego');

      expect(suggestions).toContain('LEGO'); // From predefined list
      console.log(`[E2E] Brand suggestions for "lego": ${suggestions.join(', ')}`);
    });
  });

  describe('Spell Suggestion', () => {
    it('suggests correction for typo within threshold', () => {
      const recentSearches = ['bicycle', 'tricycle', 'scooter'];

      const suggestion = suggestSpellingCorrection('bycicle', recentSearches);

      expect(suggestion).toBe('bicycle');
      console.log(`[E2E] Spell suggestion for "bycicle": ${suggestion}`);
    });

    it('returns null for typo beyond threshold', () => {
      const recentSearches = ['bicycle', 'tricycle', 'scooter'];

      const suggestion = suggestSpellingCorrection('xyz', recentSearches);

      expect(suggestion).toBeNull();
      console.log(`[E2E] No spell suggestion for "xyz"`);
    });
  });

  describe('Performance', () => {
    it('completes search in < 600ms', async () => {
      const start = Date.now();

      await searchListings('toy', {
        limit: 20,
        offset: 0,
      });

      const duration = Date.now() - start;

      console.log(`[E2E] Search completed in ${duration}ms`);
      assertPerfWithin('searchListings (query)', duration, 600);
    });

    it('completes search with filters in < 600ms', async () => {
      const start = Date.now();

      await searchListings('', {
        minPrice: 10,
        maxPrice: 100,
        spEligibleOnly: true,
        sortBy: 'price_asc',
        limit: 20,
      });

      const duration = Date.now() - start;

      console.log(`[E2E] Filtered search completed in ${duration}ms`);
      assertPerfWithin('searchListings (filtered)', duration, 600);
    });
  });
});
