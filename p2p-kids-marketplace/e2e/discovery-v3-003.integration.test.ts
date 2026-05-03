/**
 * E2E Integration Tests for Discovery V3 Services
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-003
 *
 * Tests services layer against production Supabase
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e -- discovery-v3-003
 */

import { searchListings, suggestSpellingCorrection } from '../src/services/discovery';
import { getBrandSuggestions, fetchDatabaseBrands } from '../src/services/brandAutocomplete';
import {
  getRecentSearches,
  addSearchToHistory,
  clearSearchHistory,
  getAutocompleteSuggestions,
} from '../src/services/searchHistory';
import { DiscoveryFilters } from '../src/types/discovery';

// Skip if not in E2E mode
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeE2E('Discovery V3 Services - E2E Integration Tests', () => {
  // Clean up search history before and after tests
  beforeAll(async () => {
    await clearSearchHistory();
  });

  afterAll(async () => {
    await clearSearchHistory();
  });

  describe('searchListings with V3 filters', () => {
    it('should search with query only', async () => {
      const results = await searchListings('LEGO');

      expect(Array.isArray(results)).toBe(true);
      // Results may be empty if no LEGO items in staging DB
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('relevance');
      }
    }, 10000);

    it('should apply category filter', async () => {
      const filters: DiscoveryFilters = {
        categoryIds: ['00000000-0000-0000-0000-000000000001'], // Use actual category ID from staging
        limit: 5,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should have matching category (if any)
      results.forEach((item) => {
        if (item.category_id) {
          expect(filters.categoryIds).toContain(item.category_id);
        }
      });
    }, 10000);

    it('should apply price range filter', async () => {
      const filters: DiscoveryFilters = {
        minPrice: 10,
        maxPrice: 50,
        limit: 10,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should be within price range (if any)
      results.forEach((item) => {
        expect(item.price).toBeGreaterThanOrEqual(10);
        expect(item.price).toBeLessThanOrEqual(50);
      });
    }, 10000);

    it('should apply age group filter', async () => {
      const filters: DiscoveryFilters = {
        ageGroup: '6-8',
        limit: 5,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should match age group (if any)
      results.forEach((item) => {
        if (item.age_group) {
          expect(item.age_group).toBe('6-8');
        }
      });
    }, 10000);

    it('should apply gender filter', async () => {
      const filters: DiscoveryFilters = {
        gender: 'unisex',
        limit: 5,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should match gender (if any)
      results.forEach((item) => {
        if (item.gender) {
          expect(item.gender).toBe('unisex');
        }
      });
    }, 10000);

    it('should apply brand filter', async () => {
      const filters: DiscoveryFilters = {
        brand: 'LEGO',
        limit: 5,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should match brand (if any)
      results.forEach((item) => {
        if (item.brand) {
          expect(item.brand.toLowerCase()).toBe('lego');
        }
      });
    }, 10000);

    it('should apply color filter', async () => {
      const filters: DiscoveryFilters = {
        colors: ['blue', 'red'],
        limit: 5,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // All results should have overlapping colors (if any)
      results.forEach((item) => {
        if (item.color && item.color.length > 0) {
          const hasMatchingColor = item.color.some((c) =>
            ['blue', 'red'].includes(c.toLowerCase())
          );
          expect(hasMatchingColor).toBe(true);
        }
      });
    }, 10000);

    it('should apply sort by newest', async () => {
      const filters: DiscoveryFilters = {
        sortBy: 'newest',
        limit: 10,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // Results should be sorted by created_at DESC
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          const current = new Date(results[i].created_at);
          const next = new Date(results[i + 1].created_at);
          expect(current >= next).toBe(true);
        }
      }
    }, 10000);

    it('should apply sort by price ascending', async () => {
      const filters: DiscoveryFilters = {
        sortBy: 'price_asc',
        limit: 10,
      };

      const results = await searchListings('', filters);

      expect(Array.isArray(results)).toBe(true);
      // Results should be sorted by price ASC
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].price).toBeLessThanOrEqual(results[i + 1].price);
        }
      }
    }, 10000);

    it('should apply multiple filters together', async () => {
      const filters: DiscoveryFilters = {
        minPrice: 5,
        maxPrice: 30,
        ageGroup: '3-5',
        condition: 'like_new',
        sortBy: 'price_asc',
        limit: 5,
      };

      const results = await searchListings('toy', filters);

      expect(Array.isArray(results)).toBe(true);
      // Verify all filters applied (if results exist)
      results.forEach((item) => {
        expect(item.price).toBeGreaterThanOrEqual(5);
        expect(item.price).toBeLessThanOrEqual(30);
        if (item.age_group) {
          expect(item.age_group).toBe('3-5');
        }
        if (item.condition) {
          expect(item.condition).toBe('like_new');
        }
      });
    }, 10000);
  });

  describe('searchHistory integration', () => {
    it('should persist searches across operations', async () => {
      await clearSearchHistory();

      await addSearchToHistory('LEGO');
      await addSearchToHistory('bicycle');

      const searches = await getRecentSearches();

      expect(searches).toContain('bicycle'); // most recent first
      expect(searches).toContain('LEGO');
    });

    it('should provide autocomplete suggestions', async () => {
      await clearSearchHistory();

      await addSearchToHistory('LEGO Star Wars');
      await addSearchToHistory('LEGO City');
      await addSearchToHistory('bicycle');

      const suggestions = await getAutocompleteSuggestions('lego');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('LEGO Star Wars');
      expect(suggestions).toContain('LEGO City');
      expect(suggestions).not.toContain('bicycle');
    });
  });

  describe('brandAutocomplete integration', () => {
    it('should fetch database brands', async () => {
      const brands = await fetchDatabaseBrands();

      expect(Array.isArray(brands)).toBe(true);
      // May be empty if no brands in staging DB
    }, 10000);

    it('should provide brand suggestions', async () => {
      const suggestions = await getBrandSuggestions('lego');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(8);

      // Should include LEGO from predefined brands
      const hasLego = suggestions.some((b) => b.toLowerCase() === 'lego');
      expect(hasLego).toBe(true);
    }, 10000);

    it('should return empty for short queries', async () => {
      const suggestions = await getBrandSuggestions('a');

      expect(suggestions).toEqual([]);
    });

    it('should sort suggestions alphabetically', async () => {
      const suggestions = await getBrandSuggestions('ar'); // Carter's, Marvel, Star Wars, etc.

      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          const current = suggestions[i].toLowerCase();
          const next = suggestions[i + 1].toLowerCase();
          expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
        }
      }
    }, 10000);
  });

  describe('suggestSpellingCorrection integration', () => {
    it('should suggest corrections from recent searches', async () => {
      await clearSearchHistory();

      await addSearchToHistory('bicycle');
      await addSearchToHistory('tricycle');

      const recent = await getRecentSearches();
      const suggestion = suggestSpellingCorrection('bycicle', recent);

      expect(suggestion).toBe('bicycle');
    });
  });
});
