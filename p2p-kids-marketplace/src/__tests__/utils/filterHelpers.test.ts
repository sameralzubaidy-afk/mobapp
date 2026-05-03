/**
 * Unit tests for filterHelpers utility
 * MODULE-05-DISCOVERY-V3: Task DISCOVERY-V3-004
 *
 * Tests filter counting, chip label formatting, price validation, and defaults
 */

import {
  countActiveFilters,
  formatFilterChipLabel,
  validatePriceRange,
  getDefaultFilters,
} from '../../utils/filterHelpers';
import { DiscoveryFilters } from '../../types/discovery';

describe('filterHelpers utilities', () => {
  describe('countActiveFilters', () => {
    it('should return 0 for default filters', () => {
      const defaults = getDefaultFilters();
      expect(countActiveFilters(defaults)).toBe(0);
    });

    it('should count query as 1 filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        query: 'bicycle',
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should not count empty query', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        query: '',
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should not count whitespace-only query', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        query: '   ',
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should count category IDs as 1 filter regardless of count', () => {
      const singleCategory: DiscoveryFilters = {
        ...getDefaultFilters(),
        categoryIds: ['cat1'],
      };
      expect(countActiveFilters(singleCategory)).toBe(1);

      const multipleCategories: DiscoveryFilters = {
        ...getDefaultFilters(),
        categoryIds: ['cat1', 'cat2', 'cat3'],
      };
      expect(countActiveFilters(multipleCategories)).toBe(1);
    });

    it('should not count empty category array', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        categoryIds: [],
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should count condition as 1 filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        condition: 'like_new',
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count price range as 1 filter when min is set', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: 10,
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count price range as 1 filter when max is set', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        maxPrice: 50,
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count price range as 1 filter when both min and max are set', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        minPrice: 10,
        maxPrice: 50,
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count age group as 1 filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        ageGroup: '3-5',
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count gender as 1 filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        gender: 'girl',
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count brand as 1 filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        brand: 'Nike',
      };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should not count empty brand', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        brand: '',
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should count colors as 1 filter regardless of count', () => {
      const singleColor: DiscoveryFilters = {
        ...getDefaultFilters(),
        colors: ['red'],
      };
      expect(countActiveFilters(singleColor)).toBe(1);

      const multipleColors: DiscoveryFilters = {
        ...getDefaultFilters(),
        colors: ['red', 'blue', 'green'],
      };
      expect(countActiveFilters(multipleColors)).toBe(1);
    });

    it('should not count empty colors array', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        colors: [],
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should count SP eligible only when true', () => {
      const filtersTrue: DiscoveryFilters = {
        ...getDefaultFilters(),
        spEligibleOnly: true,
      };
      expect(countActiveFilters(filtersTrue)).toBe(1);

      const filtersFalse: DiscoveryFilters = {
        ...getDefaultFilters(),
        spEligibleOnly: false,
      };
      expect(countActiveFilters(filtersFalse)).toBe(0);
    });

    it('should not count sortBy as a filter', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        sortBy: 'price_asc',
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should not count limit or offset as filters', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        limit: 20,
        offset: 40,
      };
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should correctly count multiple active filters', () => {
      const filters: DiscoveryFilters = {
        ...getDefaultFilters(),
        query: 'bicycle',
        categoryIds: ['cat1', 'cat2'],
        condition: 'good',
        minPrice: 10,
        maxPrice: 50,
        ageGroup: '6-8',
        gender: 'boy',
        brand: 'Schwinn',
        colors: ['red', 'blue'],
        spEligibleOnly: true,
      };
      expect(countActiveFilters(filters)).toBe(9); // All 9 filter dimensions
    });
  });

  describe('formatFilterChipLabel', () => {
    it('should format query', () => {
      expect(formatFilterChipLabel('query', 'bicycle')).toBe('"bicycle"');
    });

    it('should format single category', () => {
      expect(formatFilterChipLabel('categoryIds', ['cat1'])).toBe('Category');
    });

    it('should format multiple categories', () => {
      expect(formatFilterChipLabel('categoryIds', ['cat1', 'cat2', 'cat3'])).toBe('3 Categories');
    });

    it('should format condition with title case', () => {
      expect(formatFilterChipLabel('condition', 'like_new')).toBe('Condition: Like New');
      expect(formatFilterChipLabel('condition', 'new')).toBe('Condition: New');
      expect(formatFilterChipLabel('condition', 'good')).toBe('Condition: Good');
    });

    it('should format minPrice', () => {
      expect(formatFilterChipLabel('minPrice', 10)).toBe('Min: $10');
      expect(formatFilterChipLabel('minPrice', 25.5)).toBe('Min: $25.5');
    });

    it('should format maxPrice', () => {
      expect(formatFilterChipLabel('maxPrice', 50)).toBe('Max: $50');
      expect(formatFilterChipLabel('maxPrice', 100)).toBe('Max: $100');
    });

    it('should format age group', () => {
      expect(formatFilterChipLabel('ageGroup', '3-5')).toBe('Age: 3-5');
      expect(formatFilterChipLabel('ageGroup', '9-12')).toBe('Age: 9-12');
    });

    it('should format gender with capitalization', () => {
      expect(formatFilterChipLabel('gender', 'boy')).toBe('Gender: Boy');
      expect(formatFilterChipLabel('gender', 'girl')).toBe('Gender: Girl');
      expect(formatFilterChipLabel('gender', 'unisex')).toBe('Gender: Unisex');
    });

    it('should format brand', () => {
      expect(formatFilterChipLabel('brand', 'Nike')).toBe('Brand: Nike');
      expect(formatFilterChipLabel('brand', 'LEGO')).toBe('Brand: LEGO');
    });

    it('should format single color', () => {
      expect(formatFilterChipLabel('colors', ['red'])).toBe('Red');
      expect(formatFilterChipLabel('colors', ['blue'])).toBe('Blue');
    });

    it('should format multiple colors', () => {
      expect(formatFilterChipLabel('colors', ['red', 'blue'])).toBe('2 Colors');
      expect(formatFilterChipLabel('colors', ['red', 'blue', 'green'])).toBe('3 Colors');
    });

    it('should format SP eligible only', () => {
      expect(formatFilterChipLabel('spEligibleOnly', true)).toBe('SP Only');
    });

    it('should handle unknown keys with fallback formatting', () => {
      expect(formatFilterChipLabel('customKey', 'value')).toBe('Custom Key: value');
      expect(formatFilterChipLabel('anotherCustomKey', 123)).toBe('Another Custom Key: 123');
    });
  });

  describe('validatePriceRange', () => {
    it('should return true when min <= max', () => {
      expect(validatePriceRange(10, 20)).toBe(true);
      expect(validatePriceRange(10, 10)).toBe(true);
      expect(validatePriceRange(0, 100)).toBe(true);
    });

    it('should return false when min > max', () => {
      expect(validatePriceRange(20, 10)).toBe(false);
      expect(validatePriceRange(50, 25)).toBe(false);
      expect(validatePriceRange(100, 99)).toBe(false);
    });

    it('should return true when min is undefined', () => {
      expect(validatePriceRange(undefined, 20)).toBe(true);
      expect(validatePriceRange(undefined, 100)).toBe(true);
    });

    it('should return true when max is undefined', () => {
      expect(validatePriceRange(10, undefined)).toBe(true);
      expect(validatePriceRange(50, undefined)).toBe(true);
    });

    it('should return true when both are undefined', () => {
      expect(validatePriceRange(undefined, undefined)).toBe(true);
    });

    it('should handle edge cases with 0', () => {
      expect(validatePriceRange(0, 0)).toBe(true);
      expect(validatePriceRange(0, 10)).toBe(true);
      expect(validatePriceRange(10, 0)).toBe(false);
    });

    it('should handle negative numbers', () => {
      expect(validatePriceRange(-10, 10)).toBe(true);
      expect(validatePriceRange(-20, -10)).toBe(true);
      expect(validatePriceRange(10, -10)).toBe(false);
    });
  });

  describe('getDefaultFilters', () => {
    it('should return object with sortBy as relevance', () => {
      const defaults = getDefaultFilters();
      expect(defaults.sortBy).toBe('relevance');
    });

    it('should return object with spEligibleOnly as false', () => {
      const defaults = getDefaultFilters();
      expect(defaults.spEligibleOnly).toBe(false);
    });

    it('should have all other fields undefined', () => {
      const defaults = getDefaultFilters();
      expect(defaults.query).toBeUndefined();
      expect(defaults.categoryIds).toBeUndefined();
      expect(defaults.condition).toBeUndefined();
      expect(defaults.minPrice).toBeUndefined();
      expect(defaults.maxPrice).toBeUndefined();
      expect(defaults.ageGroup).toBeUndefined();
      expect(defaults.gender).toBeUndefined();
      expect(defaults.brand).toBeUndefined();
      expect(defaults.colors).toBeUndefined();
      expect(defaults.limit).toBeUndefined();
      expect(defaults.offset).toBeUndefined();
    });

    it('should return 0 active filters when countActiveFilters is called', () => {
      const defaults = getDefaultFilters();
      expect(countActiveFilters(defaults)).toBe(0);
    });
  });
});
