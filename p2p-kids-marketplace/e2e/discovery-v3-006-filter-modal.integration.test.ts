/**
 * File: p2p-kids-marketplace/e2e/discovery-v3-006-filter-modal.integration.test.ts
 * MODULE-05-DISCOVERY-V3: SearchFilterModal Integration Test
 * Task: DISCOVERY-V3-006
 * 
 * Integration tests for SearchFilterModal against staging Supabase
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '@/config/supabase';
import { getBrandSuggestions } from '@/services/brandAutocomplete';
import { getCategories } from '@/services/items';
import { validatePriceRange, getDefaultFilters, countActiveFilters } from '@/utils/filterHelpers';

describe('SearchFilterModal Integration Tests', () => {
  // Only run if RUN_SUPABASE_E2E is set
  const shouldRun = process.env.RUN_SUPABASE_E2E === 'true';

  beforeAll(() => {
    if (!shouldRun) {
      console.log('⏭️  Skipping Supabase integration tests (set RUN_SUPABASE_E2E=true to enable)');
    }
  });

  describe('Category Data Loading', () => {
    it('should load active categories from Supabase', async () => {
      if (!shouldRun) return;

      const categories = await getCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      // Verify structure
      categories.forEach(cat => {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('is_active');
        expect(cat.is_active).toBe(true);
      });
    });
  });

  describe('Brand Autocomplete', () => {
    it('should return empty array for queries < 2 characters', async () => {
      if (!shouldRun) return;

      const result = await getBrandSuggestions('a');
      expect(result).toEqual([]);
    });

    it('should return brand suggestions for valid queries', async () => {
      if (!shouldRun) return;

      const result = await getBrandSuggestions('lego');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(8); // Max 8 suggestions

      // All suggestions should contain "lego" (case-insensitive)
      result.forEach(brand => {
        expect(brand.toLowerCase()).toContain('lego');
      });
    });

    it('should merge predefined + database brands', async () => {
      if (!shouldRun) return;

      // "Nike" is in the predefined list
      const result = await getBrandSuggestions('nike');

      expect(result).toContain('Nike');
    });

    it('should dedupe and sort alphabetically', async () => {
      if (!shouldRun) return;

      const result = await getBrandSuggestions('le');

      // Should be alphabetically sorted
      const sorted = [...result].sort((a, b) => a.localeCompare(b));
      expect(result).toEqual(sorted);

      // Should not have duplicates
      const unique = [...new Set(result)];
      expect(result).toEqual(unique);
    });
  });

  describe('Filter Helpers', () => {
    it('should validate price ranges correctly', () => {
      expect(validatePriceRange(10, 20)).toBe(true);
      expect(validatePriceRange(20, 10)).toBe(false);
      expect(validatePriceRange(undefined, 20)).toBe(true);
      expect(validatePriceRange(10, undefined)).toBe(true);
      expect(validatePriceRange(10, 10)).toBe(true); // Equal is valid
    });

    it('should count active filters correctly', () => {
      const defaults = getDefaultFilters();
      expect(countActiveFilters(defaults)).toBe(0);

      const withCondition = { ...defaults, condition: 'new' as const };
      expect(countActiveFilters(withCondition)).toBe(1);

      const withMultiple = {
        ...defaults,
        condition: 'new' as const,
        ageGroup: '3-5' as const,
        gender: 'boy' as const,
      };
      expect(countActiveFilters(withMultiple)).toBe(3);

      const withColors = {
        ...defaults,
        colors: ['red', 'blue', 'green'],
      };
      expect(countActiveFilters(withColors)).toBe(1); // Colors count as 1 filter

      const withCategories = {
        ...defaults,
        categoryIds: ['cat-1', 'cat-2', 'cat-3'],
      };
      expect(countActiveFilters(withCategories)).toBe(1); // Categories count as 1 filter

      const withPriceRange = {
        ...defaults,
        minPrice: 10,
        maxPrice: 50,
      };
      expect(countActiveFilters(withPriceRange)).toBe(1); // Price range counts as 1 filter

      const withSPOnly = {
        ...defaults,
        spEligibleOnly: true,
      };
      expect(countActiveFilters(withSPOnly)).toBe(1);
    });

    it('should return default filters with correct structure', () => {
      const defaults = getDefaultFilters();

      expect(defaults).toEqual({
        sortBy: 'relevance',
        spEligibleOnly: false,
      });
    });
  });

  describe('Multi-Filter Scenarios', () => {
    it('should support complex filter combinations', async () => {
      if (!shouldRun) return;

      // Simulate a complex filter selection
      const complexFilters = {
        ...getDefaultFilters(),
        categoryIds: ['cat-1', 'cat-2'],
        condition: 'like_new' as const,
        ageGroup: '3-5' as const,
        gender: 'boy' as const,
        colors: ['blue', 'red'],
        brand: 'LEGO',
        minPrice: 10,
        maxPrice: 50,
        spEligibleOnly: true,
      };

      // Count should be 8 (all filter dimensions active)
      expect(countActiveFilters(complexFilters)).toBe(8);

      // Validate price range
      expect(validatePriceRange(complexFilters.minPrice, complexFilters.maxPrice)).toBe(true);
    });
  });
});
