/**
 * File: p2p-kids-marketplace/src/utils/filterHelpers.ts
 * MODULE-05-DISCOVERY-V3: Filter Helper Utilities
 * Task: DISCOVERY-V3-004
 *
 * Provides utility functions for filter management, validation, and display
 */

import { DiscoveryFilters, SortOption } from '../types/discovery';

/**
 * Count the number of active filters (excluding defaults)
 *
 * @param filters - The current filter state
 * @returns Number of active filters
 *
 * @example
 * countActiveFilters(getDefaultFilters()) // 0
 * countActiveFilters({ ...getDefaultFilters(), brand: 'Nike' }) // 1
 * countActiveFilters({ ...getDefaultFilters(), colors: ['red', 'blue'] }) // 1
 */
export function countActiveFilters(filters: DiscoveryFilters): number {
  let count = 0;

  // Query is an active filter if non-empty
  if (filters.query && filters.query.trim().length > 0) {
    count++;
  }

  // Category IDs count as 1 filter regardless of how many selected
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    count++;
  }

  // Condition
  if (filters.condition) {
    count++;
  }

  // Price range (counts as 1 filter if either min or max is set)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    count++;
  }

  // Age group
  if (filters.ageGroup) {
    count++;
  }

  // Gender
  if (filters.gender) {
    count++;
  }

  // Brand
  if (filters.brand && filters.brand.trim().length > 0) {
    count++;
  }

  // Colors count as 1 filter regardless of how many selected
  if (filters.colors && filters.colors.length > 0) {
    count++;
  }

  // SP eligible only (counts only if true, since false is the default)
  if (filters.spEligibleOnly === true) {
    count++;
  }

  // Note: sortBy is NOT counted as an active filter (it's a sort option, not a filter)
  // Note: limit and offset are NOT counted (they're pagination params, not filters)

  return count;
}

/**
 * Format a filter key-value pair into a human-readable chip label
 *
 * @param key - The filter key (camelCase)
 * @param value - The filter value
 * @returns Formatted label string
 *
 * @example
 * formatFilterChipLabel('ageGroup', '3-5') // 'Age: 3-5'
 * formatFilterChipLabel('condition', 'like_new') // 'Condition: Like New'
 * formatFilterChipLabel('minPrice', 10) // 'Min: $10'
 * formatFilterChipLabel('brand', 'Nike') // 'Brand: Nike'
 * formatFilterChipLabel('spEligibleOnly', true) // 'SP Only'
 */
export function formatFilterChipLabel(key: string, value: any): string {
  switch (key) {
    case 'query':
      return `"${value}"`;

    case 'categoryIds':
      // For multiple categories, just show count
      if (Array.isArray(value)) {
        return value.length === 1 ? 'Category' : `${value.length} Categories`;
      }
      return 'Category';

    case 'condition':
      // Convert snake_case to Title Case
      const conditionFormatted = String(value)
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `Condition: ${conditionFormatted}`;

    case 'minPrice':
      return `Min: $${value}`;

    case 'maxPrice':
      return `Max: $${value}`;

    case 'priceRange':
      // Special case when both min and max are provided as a range
      if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
        return `$${value.min}-$${value.max}`;
      }
      return `Price: ${value}`;

    case 'ageGroup':
      return `Age: ${value}`;

    case 'gender':
      // Capitalize first letter
      return `Gender: ${String(value).charAt(0).toUpperCase() + String(value).slice(1)}`;

    case 'brand':
      return `Brand: ${value}`;

    case 'colors':
      // For multiple colors, just show count
      if (Array.isArray(value)) {
        return value.length === 1
          ? String(value[0]).charAt(0).toUpperCase() + String(value[0]).slice(1)
          : `${value.length} Colors`;
      }
      return 'Color';

    case 'spEligibleOnly':
      return 'SP Only';

    default:
      // Fallback: convert camelCase to Title Case
      const formatted = key
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${formatted}: ${value}`;
  }
}

/**
 * Validate price range (min must not exceed max)
 *
 * @param min - Minimum price (optional)
 * @param max - Maximum price (optional)
 * @returns true if valid, false if min > max
 *
 * @example
 * validatePriceRange(10, 20) // true
 * validatePriceRange(20, 10) // false
 * validatePriceRange(undefined, 20) // true
 * validatePriceRange(10, undefined) // true
 * validatePriceRange(undefined, undefined) // true
 */
export function validatePriceRange(min?: number, max?: number): boolean {
  // If either is undefined, consider it valid
  if (min === undefined || max === undefined) {
    return true;
  }

  // Both defined: min must not exceed max
  return min <= max;
}

/**
 * Get the default filter state
 *
 * @returns Default DiscoveryFilters object
 *
 * @example
 * const defaults = getDefaultFilters();
 * // { sortBy: 'relevance', spEligibleOnly: false }
 */
export function getDefaultFilters(): DiscoveryFilters {
  return {
    sortBy: 'relevance' as SortOption,
    spEligibleOnly: false,
    // All other fields are undefined by default
  };
}
