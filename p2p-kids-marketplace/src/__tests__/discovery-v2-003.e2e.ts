/**
 * File: p2p-kids-marketplace/src/__tests__/discovery-v2-003.e2e.ts
 * MODULE-05-DISCOVERY-V2: End-to-End Tests
 * Task: DISCOVERY-V2-003 - Category Browsing with SP Filter
 * 
 * E2E tests for category browsing functionality
 */

import { fetchListingsByCategory } from '../services/discovery';
import { supabase } from '../config/supabase';

/**
 * E2E Test: Category Browsing (DISCOVERY-V2-003)
 * 
 * Prerequisites:
 * - Supabase production instance must be running
 * - Database migrations applied
 * - Test data with categories and listings created
 * 
 * Run with: npm test src/__tests__/discovery-v2-003.e2e.ts
 */
describe('E2E: DISCOVERY-V2-003 - Category Browsing', () => {
  // Skip if no SUPABASE_URL environment variable
  const skipIfNoSupabase = process.env.SUPABASE_URL ? describe : describe.skip;

  skipIfNoSupabase('Category Browsing Service', () => {
    let realCategoryName = '';

    beforeAll(async () => {
      // Fetch a real category name from the database to use for testing
      const { data: categories, error } = await supabase
        .from('categories')
        .select('name')
        .limit(1);
      
      if (categories && categories.length > 0) {
        realCategoryName = categories[0].name;
        console.log(`Using real category for E2E test: ${realCategoryName}`);
      } else {
        console.warn('No categories found in database. E2E tests may fail or be less meaningful.');
        // Fallback to a common category name
        realCategoryName = 'Toys';
      }
    });

    test('should fetch listings for a valid category', async () => {
      // Act
      const results = await fetchListingsByCategory(realCategoryName);

      // Assert
      expect(Array.isArray(results)).toBe(true);
      // If there are results, verify their structure
      if (results.length > 0) {
        const item = results[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('price');
        expect(item).toHaveProperty('category_id');
        // Since we fetched by category name, the category_id should be consistent
        const categoryId = item.category_id;
        expect(results.every(r => r.category_id === categoryId)).toBe(true);
      }
    });

    test('should filter SP-eligible items within a category', async () => {
      // Act
      const results = await fetchListingsByCategory(realCategoryName, true);

      // Assert
      expect(Array.isArray(results)).toBe(true);
      // All results should have accepts_swap_points = true
      if (results.length > 0) {
        expect(results.every(r => r.accepts_swap_points)).toBe(true);
      }
    });

    test('should return empty array for non-existent category', async () => {
      // Arrange
      const fakeCategory = 'NonExistentCategory12345';

      // Act
      const results = await fetchListingsByCategory(fakeCategory);

      // Assert
      expect(results).toEqual([]);
    });

    test('should handle case-insensitive category names', async () => {
      // Arrange
      const upperCategory = realCategoryName.toUpperCase();
      const lowerCategory = realCategoryName.toLowerCase();

      // Act
      const resultsUpper = await fetchListingsByCategory(upperCategory);
      const resultsLower = await fetchListingsByCategory(lowerCategory);

      // Assert
      // They should return the same number of results (assuming category names are unique)
      expect(resultsUpper.length).toBe(resultsLower.length);
    });

    test('should perform category fetch in < 500ms', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const results = await fetchListingsByCategory(realCategoryName);

      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500);
      console.log(`Category fetch for "${realCategoryName}" completed in ${duration.toFixed(2)}ms with ${results.length} results`);
    });
  });
});
