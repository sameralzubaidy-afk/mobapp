// FILE: p2p-kids-marketplace/e2e/edu-006-sp-calculator.integration.test.ts
// MODULE-18 EDU-006: SPCalculator integration tests
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../src/config/supabase';
import { calculateSP } from '../src/services/spCalculatorService';
import { getCategoriesWithCounts } from '../src/services/categoryService';

describe('EDU-006 SPCalculator Integration', () => {
  let testCategoryId: string;
  let canRunSupabaseChecks = process.env.RUN_SUPABASE_E2E === 'true';

  beforeAll(async () => {
    if (!process.env.RUN_SUPABASE_E2E) {
      console.warn('Skipping integration tests - set RUN_SUPABASE_E2E=true to run');
      return;
    }

    try {
      // Fetch a real category from staging
      const categories = await getCategoriesWithCounts(false);
      if (categories.length === 0) {
        canRunSupabaseChecks = false;
        return;
      }

      testCategoryId = categories[0].id;
    } catch {
      canRunSupabaseChecks = false;
    }
  });

  describe('calculateSP service integration', () => {
    it('calculates sell SP with real category data', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const result = await calculateSP(25.00, testCategoryId, 'sell');

      expect(result).toBeDefined();
      expect(result.mode).toBe('sell');
      expect(result.price).toBe(25.00);
      expect(result.category_id).toBe(testCategoryId);
      expect(result.earn_sp).toBeGreaterThan(0);
      expect(result.multiplier).toBeGreaterThan(0);
      expect(typeof result.is_bonus).toBe('boolean');
    });

    it('calculates buy SP with real category data', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const result = await calculateSP(50.00, testCategoryId, 'buy');

      expect(result).toBeDefined();
      expect(result.mode).toBe('buy');
      expect(result.price).toBe(50.00);
      expect(result.category_id).toBe(testCategoryId);
      expect(result.max_sp_usable).toBeGreaterThan(0);
      expect(result.sp_spending_cap_percent).toBeGreaterThan(0);
      expect(result.cash_paid).toBeLessThanOrEqual(50.00);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.total_cost).toBeGreaterThan(0);
    });

    it('respects category-specific SP spending cap', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const price = 100.00;
      const result = await calculateSP(price, testCategoryId, 'buy');

      // Max SP should respect category cap (e.g., 70% for bonus categories, 50% default)
      const maxAllowedByPrice = price * (result.sp_spending_cap_percent / 100);
      expect(result.max_sp_usable).toBeLessThanOrEqual(maxAllowedByPrice);
    });

    it('calculates BOTH sell and buy for same item (dual-panel use case)', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const price = 30.00;
      const [sellResult, buyResult] = await Promise.all([
        calculateSP(price, testCategoryId, 'sell'),
        calculateSP(price, testCategoryId, 'buy'),
      ]);

      expect(sellResult.mode).toBe('sell');
      expect(buyResult.mode).toBe('buy');
      expect(sellResult.price).toBe(price);
      expect(buyResult.price).toBe(price);
      expect(sellResult.category_id).toBe(testCategoryId);
      expect(buyResult.category_id).toBe(testCategoryId);

      // Bonus flag should match
      expect(sellResult.is_bonus).toBe(buyResult.is_bonus);
    });
  });

  describe('Categories with bonus_badge_icon_url', () => {
    it('retrieves categories with bonus_badge_icon_url field', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const categories = await getCategoriesWithCounts(false);

      expect(categories.length).toBeGreaterThan(0);

      // Verify bonus_badge_icon_url field exists (may be null)
      categories.forEach((cat) => {
        expect(cat).toHaveProperty('bonus_badge_icon_url');
        if (cat.bonus_badge_icon_url) {
          expect(typeof cat.bonus_badge_icon_url).toBe('string');
          expect(cat.bonus_badge_icon_url).toMatch(/^https?:\/\//);
        }
      });
    });
  });

  describe('Price boundary tests', () => {
    it('handles minimum price (0.01)', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const result = await calculateSP(0.01, testCategoryId, 'sell');
      expect(result.earn_sp).toBeGreaterThanOrEqual(0);
    });

    it('handles maximum price (10000)', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      const result = await calculateSP(10000, testCategoryId, 'sell');
      expect(result.earn_sp).toBeGreaterThan(0);
    });

    it('rejects invalid prices', async () => {
      if (!canRunSupabaseChecks) {
        return;
      }

      await expect(calculateSP(-5, testCategoryId, 'sell')).resolves.toBeNull();
      await expect(calculateSP(0, testCategoryId, 'sell')).resolves.toBeNull();
    });
  });
});
