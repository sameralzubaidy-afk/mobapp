/**
 * Integration tests for DISCOVERY-V3-004 utilities with discovery types
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 * 
 * Tests that utilities work correctly with real-world discovery filter scenarios
 */

import {
  countActiveFilters,
  formatFilterChipLabel,
  validatePriceRange,
  getDefaultFilters,
} from '../../utils/filterHelpers';
import { levenshteinDistance, findClosestMatch } from '../../utils/fuzzyMatch';
import { 
  DiscoveryFilters, 
  COLOR_PALETTE, 
  PRICE_PRESETS,
  STORAGE_KEYS,
} from '../../types/discovery';

describe('DISCOVERY-V3-004 Integration Tests', () => {
  describe('Filter utilities with real-world scenarios', () => {
    it('should correctly handle a typical user filter flow', () => {
      // User starts with defaults
      let filters = getDefaultFilters();
      expect(countActiveFilters(filters)).toBe(0);

      // User adds age filter
      filters = { ...filters, ageGroup: '3-5' };
      expect(countActiveFilters(filters)).toBe(1);
      expect(formatFilterChipLabel('ageGroup', filters.ageGroup)).toBe('Age: 3-5');

      // User adds gender filter
      filters = { ...filters, gender: 'girl' };
      expect(countActiveFilters(filters)).toBe(2);

      // User adds price range
      filters = { ...filters, minPrice: 10, maxPrice: 50 };
      expect(countActiveFilters(filters)).toBe(3);
      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);

      // User adds colors
      filters = { ...filters, colors: ['pink', 'purple'] };
      expect(countActiveFilters(filters)).toBe(4);

      // User removes price range
      filters = { ...filters, minPrice: undefined, maxPrice: undefined };
      expect(countActiveFilters(filters)).toBe(3);
    });

    it('should handle edge case where user enters invalid price range', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: 50,
        maxPrice: 20,
      };

      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(false);
      // User should be prevented from applying this filter
    });

    it('should correctly format all filter types for chip display', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        query: 'bike',
        categoryIds: ['cat1', 'cat2'],
        condition: 'like_new',
        minPrice: 10,
        maxPrice: 25,
        ageGroup: '6-8',
        gender: 'boy',
        brand: 'Schwinn',
        colors: ['red', 'blue', 'green'],
        spEligibleOnly: true,
      };

      // Verify we can format each filter for display
      expect(formatFilterChipLabel('query', filters.query)).toBe('"bike"');
      expect(formatFilterChipLabel('categoryIds', filters.categoryIds)).toBe('2 Categories');
      expect(formatFilterChipLabel('condition', filters.condition)).toBe('Condition: Like New');
      expect(formatFilterChipLabel('minPrice', filters.minPrice)).toBe('Min: $10');
      expect(formatFilterChipLabel('maxPrice', filters.maxPrice)).toBe('Max: $25');
      expect(formatFilterChipLabel('ageGroup', filters.ageGroup)).toBe('Age: 6-8');
      expect(formatFilterChipLabel('gender', filters.gender)).toBe('Gender: Boy');
      expect(formatFilterChipLabel('brand', filters.brand)).toBe('Brand: Schwinn');
      expect(formatFilterChipLabel('colors', filters.colors)).toBe('3 Colors');
      expect(formatFilterChipLabel('spEligibleOnly', filters.spEligibleOnly)).toBe('SP Only');

      expect(countActiveFilters(filters)).toBe(9);
    });

    it('should work with PRICE_PRESETS for quick filter selection', () => {
      // User selects "Under $10" preset
      const preset = PRICE_PRESETS[0];
      expect(preset.id).toBe('under-10');
      expect(preset.label).toBe('Under $10');

      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: preset.min,
        maxPrice: preset.max,
      };

      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);
      expect(countActiveFilters(filters)).toBe(1); // Price range counts as 1 filter
    });

    it('should work with COLOR_PALETTE for color selection', () => {
      // Verify COLOR_PALETTE structure
      expect(COLOR_PALETTE).toHaveLength(12);
      expect(COLOR_PALETTE[0]).toHaveProperty('id');
      expect(COLOR_PALETTE[0]).toHaveProperty('label');
      expect(COLOR_PALETTE[0]).toHaveProperty('hex');

      // User selects pink and purple colors
      const pinkColor = COLOR_PALETTE.find(c => c.id === 'pink');
      const purpleColor = COLOR_PALETTE.find(c => c.id === 'purple');

      expect(pinkColor).toBeDefined();
      expect(purpleColor).toBeDefined();

      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        colors: [pinkColor!.id, purpleColor!.id],
      };

      expect(countActiveFilters(filters)).toBe(1); // Colors count as 1 filter
      expect(formatFilterChipLabel('colors', filters.colors)).toBe('2 Colors');
    });

    it('should validate STORAGE_KEYS are correctly defined', () => {
      expect(STORAGE_KEYS.RECENT_SEARCHES).toBe('@kids_marketplace:recent_searches');
      expect(STORAGE_KEYS.ACTIVE_FILTERS).toBe('@kids_marketplace:active_filters');
      expect(STORAGE_KEYS.BRAND_CACHE).toBe('@kids_marketplace:brand_cache');
    });
  });

  describe('Fuzzy match integration with COLOR_PALETTE', () => {
    it('should suggest correct color for typo', () => {
      const colorNames = COLOR_PALETTE.map(c => c.label);

      // User types "bule" instead of "blue"
      const suggestion = findClosestMatch('bule', colorNames, 3);
      expect(suggestion).toBe('Blue');

      // User types "pnk" instead of "pink"
      const suggestion2 = findClosestMatch('pnk', colorNames, 3);
      expect(suggestion2).toBe('Pink');
    });

    it('should handle case-insensitive color matching', () => {
      const colorNames = COLOR_PALETTE.map(c => c.label);

      const suggestion = findClosestMatch('RED', colorNames, 3);
      expect(suggestion).toBe('Red');

      const suggestion2 = findClosestMatch('YeLLoW', colorNames, 3);
      expect(suggestion2).toBe('Yellow');
    });

    it('should return null for colors too far from any match', () => {
      const colorNames = COLOR_PALETTE.map(c => c.label);

      const suggestion = findClosestMatch('xyz', colorNames, 2);
      expect(suggestion).toBeNull();
    });
  });

  describe('Complete filter workflow', () => {
    it('should handle full search and filter flow', () => {
      // Scenario: Parent searching for daughter's birthday gift
      let filters = getDefaultFilters();

      // 1. User types search query
      filters = { ...filters, query: 'doll' };
      expect(countActiveFilters(filters)).toBe(1);

      // 2. User selects age group
      filters = { ...filters, ageGroup: '3-5' };
      expect(countActiveFilters(filters)).toBe(2);

      // 3. User selects gender
      filters = { ...filters, gender: 'girl' };
      expect(countActiveFilters(filters)).toBe(3);

      // 4. User selects condition
      filters = { ...filters, condition: 'like_new' };
      expect(countActiveFilters(filters)).toBe(4);

      // 5. User sets price range using preset
      const preset = PRICE_PRESETS.find(p => p.id === '10-25')!;
      filters = { ...filters, minPrice: preset.min, maxPrice: preset.max };
      expect(countActiveFilters(filters)).toBe(5);
      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);

      // 6. User selects favorite colors
      const pink = COLOR_PALETTE.find(c => c.id === 'pink')!;
      const purple = COLOR_PALETTE.find(c => c.id === 'purple')!;
      filters = { ...filters, colors: [pink.id, purple.id] };
      expect(countActiveFilters(filters)).toBe(6);

      // 7. User wants SP-eligible items only
      filters = { ...filters, spEligibleOnly: true };
      expect(countActiveFilters(filters)).toBe(7);

      // 8. User changes sort
      filters = { ...filters, sortBy: 'price_asc' };
      expect(countActiveFilters(filters)).toBe(7); // sortBy doesn't count

      // 9. Generate chip labels for display
      const chipLabels = {
        query: formatFilterChipLabel('query', filters.query),
        ageGroup: formatFilterChipLabel('ageGroup', filters.ageGroup),
        gender: formatFilterChipLabel('gender', filters.gender),
        condition: formatFilterChipLabel('condition', filters.condition),
        price: `${formatFilterChipLabel('minPrice', filters.minPrice)} - ${formatFilterChipLabel('maxPrice', filters.maxPrice)}`,
        colors: formatFilterChipLabel('colors', filters.colors),
        sp: formatFilterChipLabel('spEligibleOnly', filters.spEligibleOnly),
      };

      expect(chipLabels.query).toBe('"doll"');
      expect(chipLabels.ageGroup).toBe('Age: 3-5');
      expect(chipLabels.gender).toBe('Gender: Girl');
      expect(chipLabels.condition).toBe('Condition: Like New');
      expect(chipLabels.colors).toBe('2 Colors');
      expect(chipLabels.sp).toBe('SP Only');

      // 10. User clears all filters
      filters = getDefaultFilters();
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should prevent invalid price range from being applied', () => {
      let filters = getDefaultFilters();

      // User accidentally sets min > max
      filters = { ...filters, minPrice: 50, maxPrice: 20 };

      // Validation should fail
      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(false);

      // UI should prevent user from applying this filter
      // (This would be enforced in the SearchFilterModal component)
    });

    it('should handle empty state correctly', () => {
      const filters = getDefaultFilters();

      // Count should be 0
      expect(countActiveFilters(filters)).toBe(0);

      // Validation should pass for empty price range
      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);

      // All fields should be undefined except defaults
      expect(filters.sortBy).toBe('relevance');
      expect(filters.spEligibleOnly).toBe(false);
      expect(filters.query).toBeUndefined();
      expect(filters.categoryIds).toBeUndefined();
      expect(filters.condition).toBeUndefined();
    });
  });

  describe('Boundary and edge cases', () => {
    it('should handle zero price values', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: 0,
        maxPrice: 10,
      };

      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should handle large price values', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: 100,
        maxPrice: 10000,
      };

      expect(validatePriceRange(filters.minPrice, filters.maxPrice)).toBe(true);
      expect(formatFilterChipLabel('minPrice', filters.minPrice)).toBe('Min: $100');
      expect(formatFilterChipLabel('maxPrice', filters.maxPrice)).toBe('Max: $10000');
    });

    it('should handle single vs multiple selection formatting correctly', () => {
      // Single category
      expect(formatFilterChipLabel('categoryIds', ['cat1'])).toBe('Category');

      // Multiple categories
      expect(formatFilterChipLabel('categoryIds', ['cat1', 'cat2'])).toBe('2 Categories');
      expect(formatFilterChipLabel('categoryIds', ['cat1', 'cat2', 'cat3'])).toBe('3 Categories');

      // Single color
      expect(formatFilterChipLabel('colors', ['red'])).toBe('Red');

      // Multiple colors
      expect(formatFilterChipLabel('colors', ['red', 'blue'])).toBe('2 Colors');
    });

    it('should handle all age group values', () => {
      const ageGroups = ['0-2', '3-5', '6-8', '9-12', '13+'];

      ageGroups.forEach(age => {
        expect(formatFilterChipLabel('ageGroup', age)).toBe(`Age: ${age}`);
      });
    });

    it('should handle all condition values', () => {
      const conditions = ['new', 'like_new', 'good', 'fair', 'worn'];
      const expected = ['Condition: New', 'Condition: Like New', 'Condition: Good', 'Condition: Fair', 'Condition: Worn'];

      conditions.forEach((condition, index) => {
        expect(formatFilterChipLabel('condition', condition)).toBe(expected[index]);
      });
    });

    it('should handle all gender values', () => {
      expect(formatFilterChipLabel('gender', 'boy')).toBe('Gender: Boy');
      expect(formatFilterChipLabel('gender', 'girl')).toBe('Gender: Girl');
      expect(formatFilterChipLabel('gender', 'unisex')).toBe('Gender: Unisex');
    });
  });
});
