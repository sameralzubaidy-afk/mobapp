/**
 * File: p2p-kids-marketplace/src/__tests__/utils/spCalculations.test.ts
 * MODULE-04 LISTING-V3-011: Unit tests for SP calculation utilities
 * Task: LISTING-V3-011 - SP earnings preview
 */

import {
  calculateEarnedSP,
  calculateMaxSpendSP,
  calculateBulkTotalSP,
  formatSP,
  formatMultiplier,
} from '../../utils/spCalculations';

describe('spCalculations utilities', () => {
  describe('calculateEarnedSP', () => {
    it('should calculate SP correctly with valid inputs', () => {
      expect(calculateEarnedSP(30, 1.2)).toBe(36); // Math.round(30 * 1.20) = 36
      expect(calculateEarnedSP(25, 1.15)).toBe(29); // Math.round(25 * 1.15) = 29
      expect(calculateEarnedSP(100, 1.1)).toBe(110); // Math.round(100 * 1.10) = 110
    });

    it('should round correctly (Math.round)', () => {
      expect(calculateEarnedSP(10, 1.24)).toBe(12); // 12.4 rounds to 12
      expect(calculateEarnedSP(10, 1.25)).toBe(13); // 12.5 rounds to 13
      expect(calculateEarnedSP(10, 1.26)).toBe(13); // 12.6 rounds to 13
    });

    it('should return 0 for invalid prices', () => {
      expect(calculateEarnedSP(0, 1.2)).toBe(0);
      expect(calculateEarnedSP(-10, 1.2)).toBe(0);
      expect(calculateEarnedSP(NaN, 1.2)).toBe(0);
      expect(calculateEarnedSP(Infinity, 1.2)).toBe(0);
    });

    it('should use default multiplier 1.10 for invalid multipliers', () => {
      expect(calculateEarnedSP(100, 0.5)).toBe(110); // < 1.05, uses 1.10
      expect(calculateEarnedSP(100, 2.0)).toBe(110); // > 1.40, uses 1.10
      expect(calculateEarnedSP(100, NaN)).toBe(110);
      expect(calculateEarnedSP(100, Infinity)).toBe(110);
    });

    it('should handle edge case multipliers', () => {
      expect(calculateEarnedSP(100, 1.05)).toBe(105); // Min valid
      expect(calculateEarnedSP(100, 1.4)).toBe(140); // Max valid
    });
  });

  describe('calculateMaxSpendSP', () => {
    it('should calculate max spend SP correctly', () => {
      expect(calculateMaxSpendSP(100, 70)).toBe(70); // Floor(100 * 0.70) = 70
      expect(calculateMaxSpendSP(30, 50)).toBe(15); // Floor(30 * 0.50) = 15
      expect(calculateMaxSpendSP(100, 80)).toBe(80); // Floor(100 * 0.80) = 80
    });

    it('should floor correctly (Math.floor)', () => {
      expect(calculateMaxSpendSP(33, 70)).toBe(23); // Floor(23.1) = 23
      expect(calculateMaxSpendSP(34, 70)).toBe(23); // Floor(23.8) = 23
      expect(calculateMaxSpendSP(35, 70)).toBe(24); // Floor(24.5) = 24
    });

    it('should return 0 for invalid prices', () => {
      expect(calculateMaxSpendSP(0, 70)).toBe(0);
      expect(calculateMaxSpendSP(-10, 70)).toBe(0);
      expect(calculateMaxSpendSP(NaN, 70)).toBe(0);
    });

    it('should use default 70% for invalid caps', () => {
      expect(calculateMaxSpendSP(100, 30)).toBe(70); // < 50, uses 70
      expect(calculateMaxSpendSP(100, 90)).toBe(70); // > 80, uses 70
      expect(calculateMaxSpendSP(100, NaN)).toBe(70);
    });
  });

  describe('calculateBulkTotalSP', () => {
    const mockGetMultiplier = (categoryId: string | null): number => {
      const map: Record<string, number> = {
        'cat-toys': 1.2,
        'cat-clothes': 1.1,
        'cat-books': 1.3,
      };
      return map[categoryId || ''] || 1.1;
    };

    const mockCategoryNames = new Map([
      ['cat-toys', 'Toys'],
      ['cat-clothes', 'Clothes'],
      ['cat-books', 'Books'],
    ]);

    it('should calculate total SP and breakdown', () => {
      const items = [
        { category_id: 'cat-toys', price: 30, includeInPublish: true },
        { category_id: 'cat-toys', price: 20, includeInPublish: true },
        { category_id: 'cat-clothes', price: 25, includeInPublish: true },
      ];

      const result = calculateBulkTotalSP(items, mockGetMultiplier, mockCategoryNames);

      expect(result.totalSP).toBe(88); // (30+20)*1.20 + 25*1.10 = 60 + 28 = 88
      expect(result.breakdown).toHaveLength(2);

      const toysBreakdown = result.breakdown.find((b) => b.categoryId === 'cat-toys');
      expect(toysBreakdown).toEqual({
        categoryId: 'cat-toys',
        categoryName: 'Toys',
        count: 2,
        sp: 60,
        multiplier: 1.2,
      });

      const clothesBreakdown = result.breakdown.find((b) => b.categoryId === 'cat-clothes');
      expect(clothesBreakdown).toEqual({
        categoryId: 'cat-clothes',
        categoryName: 'Clothes',
        count: 1,
        sp: 28,
        multiplier: 1.1,
      });
    });

    it('should filter out excluded items', () => {
      const items = [
        { category_id: 'cat-toys', price: 30, includeInPublish: true },
        { category_id: 'cat-toys', price: 20, includeInPublish: false }, // Excluded
      ];

      const result = calculateBulkTotalSP(items, mockGetMultiplier, mockCategoryNames);
      expect(result.totalSP).toBe(36); // Only first item
    });

    it('should filter out items with no category or zero price', () => {
      const items = [
        { category_id: 'cat-toys', price: 30, includeInPublish: true },
        { category_id: null, price: 20, includeInPublish: true }, // No category
        { category_id: 'cat-toys', price: 0, includeInPublish: true }, // Zero price
      ];

      const result = calculateBulkTotalSP(items, mockGetMultiplier, mockCategoryNames);
      expect(result.totalSP).toBe(36); // Only first item
    });

    it('should handle empty items array', () => {
      const result = calculateBulkTotalSP([], mockGetMultiplier, mockCategoryNames);
      expect(result.totalSP).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should use default category name if not in map', () => {
      const items = [{ category_id: 'cat-unknown', price: 10, includeInPublish: true }];

      const result = calculateBulkTotalSP(items, mockGetMultiplier, mockCategoryNames);
      expect(result.breakdown[0].categoryName).toBe('cat-unknown'); // Falls back to ID
    });
  });

  describe('formatSP', () => {
    it('should format SP values correctly', () => {
      expect(formatSP(35)).toBe('~35 SP');
      expect(formatSP(100)).toBe('~100 SP');
      expect(formatSP(0)).toBe('0 SP');
    });

    it('should round fractional values', () => {
      expect(formatSP(35.7)).toBe('~36 SP');
      expect(formatSP(35.3)).toBe('~35 SP');
    });

    it('should handle invalid inputs', () => {
      expect(formatSP(NaN)).toBe('0 SP');
      expect(formatSP(Infinity)).toBe('0 SP');
      expect(formatSP(-10)).toBe('0 SP');
    });
  });

  describe('formatMultiplier', () => {
    it('should format multipliers correctly', () => {
      expect(formatMultiplier(1.2)).toBe('1.20x');
      expect(formatMultiplier(1.1)).toBe('1.10x');
      expect(formatMultiplier(1.35)).toBe('1.35x');
    });

    it('should handle invalid inputs', () => {
      expect(formatMultiplier(NaN)).toBe('1.00x');
      expect(formatMultiplier(Infinity)).toBe('1.00x');
      expect(formatMultiplier(0)).toBe('1.00x');
      expect(formatMultiplier(-1)).toBe('1.00x');
    });
  });
});
