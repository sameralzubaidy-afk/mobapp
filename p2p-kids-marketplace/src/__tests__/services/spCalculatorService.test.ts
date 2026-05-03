// FILE: p2p-kids-marketplace/src/__tests__/services/spCalculatorService.test.ts
// MODULE-18 V1 EDU-003: Unit tests for SP calculator service

import { calculateSP, getBonusCategories } from '../../services/spCalculatorService';
import * as categoryService from '../../services/categoryService';

// Mock category service (MODULE-12 V3)
jest.mock('../../services/categoryService');

describe('spCalculatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSP', () => {
    const mockCategory = {
      id: 'cat-1',
      name: 'LEGO',
      icon: '🧱',
      is_active: true,
      sp_earning_multiplier: 1.3,
      sp_spending_cap_percent: 70,
      display_order: 1,
      item_count: 10,
    };

    it('should calculate sell mode SP correctly', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26, // Math.round(20 * 1.3)
        max_spend_sp: 14, // Math.floor(20 * 70 / 100)
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toEqual({
        mode: 'sell',
        price: 20,
        category_id: 'cat-1',
        category_name: 'LEGO',
        earn_sp: 26,
        multiplier: 1.3,
        is_bonus: true, // 1.3 > 1.10
      });

      expect(categoryService.calculateCategorySP).toHaveBeenCalledWith('cat-1', 20);
    });

    it('should calculate buy mode SP correctly', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(mockCategory);
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 26,
        max_spend_sp: 14,
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'buy', 10);

      expect(result).toEqual({
        mode: 'buy',
        price: 20,
        category_id: 'cat-1',
        category_name: 'LEGO',
        max_sp_usable: 14,
        sp_spending_cap_percent: 70,
        sp_to_use: 10,
        cash_paid: 10, // 20 - 10
        fee: 2, // Math.round(20 * 0.1 * 100) / 100
        total_cost: 12, // 10 + 2
        is_bonus: true,
      });
    });

    it('should return null for inactive category', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue({
        ...mockCategory,
        is_active: false,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toBeNull();
    });

    it('should return null for missing category', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue(null);

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result).toBeNull();
    });

    it('should handle baseline multiplier (1.10) as not bonus', async () => {
      (categoryService.getCategoryById as jest.Mock).mockResolvedValue({
        ...mockCategory,
        sp_earning_multiplier: 1.1,
      });
      (categoryService.calculateCategorySP as jest.Mock).mockResolvedValue({
        earn_sp: 22,
        max_spend_sp: 14,
        spend_percent: 70,
      });

      const result = await calculateSP(20, 'cat-1', 'sell');

      expect(result?.is_bonus).toBe(false); // 1.1 is NOT > 1.1
    });
  });

  describe('getBonusCategories', () => {
    it('should delegate to MODULE-12 V3 getBonusCategories', async () => {
      const mockBonusCategories = [
        {
          id: 'cat-1',
          name: 'LEGO',
          icon: '🧱',
          is_active: true,
          sp_earning_multiplier: 1.3,
          sp_spending_cap_percent: 70,
        },
        {
          id: 'cat-2',
          name: 'Books',
          icon: '📚',
          is_active: true,
          sp_earning_multiplier: 1.2,
          sp_spending_cap_percent: 70,
        },
      ];

      (categoryService.getBonusCategories as jest.Mock).mockResolvedValue(mockBonusCategories);

      const result = await getBonusCategories();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].sp_earning_multiplier).toBe(1.3);
      expect(categoryService.getBonusCategories).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      (categoryService.getBonusCategories as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await getBonusCategories();

      expect(result).toEqual([]);
    });
  });
});
