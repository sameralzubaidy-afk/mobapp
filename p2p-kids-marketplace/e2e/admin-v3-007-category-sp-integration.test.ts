/**
 * File: p2p-kids-marketplace/e2e/admin-v3-007-category-sp-integration.test.ts
 * TASK ADMIN-V3-007: Integration tests for category SP calculations
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 * 
 * Tests against staging Supabase:
 * - Category-specific SP earning and spending calculations
 * - Bonus category filtering
 * - Active category visibility regardless of item_count
 * 
 * Run: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '../src/config/supabase';
import {
  getBonusCategories,
  calculateCategorySP,
  getCategoriesWithCounts,
} from '../src/services/categoryService';

describe('Category SP Integration (MODULE-12 V3)', () => {
  // Skip if not running Supabase E2E tests
  const describeIf = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

  describeIf('with live Supabase', () => {
    beforeAll(async () => {
      // Verify connection to staging Supabase
      const { data, error } = await supabase.from('categories').select('count').limit(1);
      if (error) {
        throw new Error(`Cannot connect to Supabase: ${error.message}`);
      }
    });

    it('getBonusCategories returns only categories with multiplier > 1.10', async () => {
      const bonusCategories = await getBonusCategories();

      expect(bonusCategories).toBeTruthy();
      
      // Verify all returned categories have sp_earning_multiplier > 1.10
      bonusCategories.forEach((cat) => {
        expect(cat.sp_earning_multiplier).toBeGreaterThan(1.10);
        expect(cat.is_active).toBe(true);
      });
    });

    it('calculateCategorySP applies correct rounding rules', async () => {
      // Find a bonus category for testing
      const bonusCategories = await getBonusCategories();
      
      if (bonusCategories.length === 0) {
        console.warn('No bonus categories found - skipping test');
        return;
      }

      const testCategory = bonusCategories[0];
      const testPrice = 49.99;

      const result = await calculateCategorySP(testCategory.id, testPrice);

      expect(result).toBeTruthy();
      expect(result!.earn_sp).toBe(
        Math.round(testPrice * (testCategory.sp_earning_multiplier || 1.10))
      );
      expect(result!.max_spend_sp).toBe(
        Math.floor((testPrice * (testCategory.sp_spending_cap_percent || 70)) / 100)
      );
      expect(result!.spend_percent).toBe(testCategory.sp_spending_cap_percent || 70);
    });

    it('getCategoriesWithCounts returns active categories regardless of item_count', async () => {
      const activeCategories = await getCategoriesWithCounts(false);

      expect(activeCategories).toBeTruthy();

      // All categories should be active; zero-count categories are allowed.
      activeCategories.forEach((cat) => {
        expect(cat.is_active).toBe(true);
      });
    });

    it('getCategoriesWithCounts(true) includes all categories', async () => {
      const allCategories = await getCategoriesWithCounts(true);
      const activeCategories = await getCategoriesWithCounts(false);

      expect(allCategories.length).toBeGreaterThanOrEqual(activeCategories.length);
    });

    it('category bonus badge fields are present', async () => {
      const bonusCategories = await getBonusCategories();

      bonusCategories.forEach((cat) => {
        expect(cat).toHaveProperty('bonus_badge_icon_url');
        expect(cat).toHaveProperty('icon_url');
        expect(cat).toHaveProperty('item_count');
      });
    });
  });
});
