/**
 * File: p2p-kids-marketplace/src/__tests__/services/categoryService-admin-v3-007.test.ts
 * TASK ADMIN-V3-007: Unit tests for category service V3 enhancements
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 *
 * Tests:
 * - getBonusCategories filtering (sp_earning_multiplier > 1.10)
 * - calculateCategorySP rounding rules
 * - getCategoriesWithCounts filters inactive only (zero-count still visible)
 */

import { supabase } from '../../config/supabase';
import * as categoryService from '../../services/categoryService';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Category Service (MODULE-12 V3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBonusCategories', () => {
    it('returns only categories with sp_earning_multiplier > 1.10', async () => {
      const mockData = [
        {
          id: 'cat1',
          name: 'Electronics',
          sp_earning_multiplier: 1.25,
          is_active: true,
        },
        {
          id: 'cat2',
          name: 'Toys',
          sp_earning_multiplier: 1.4,
          is_active: true,
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await categoryService.getBonusCategories();

      expect(supabase.from).toHaveBeenCalledWith('categories');
      expect(result).toHaveLength(2);
      expect(result[0].sp_earning_multiplier).toBeGreaterThan(1.1);
    });

    it('returns empty array when no bonus categories exist', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await categoryService.getBonusCategories();

      expect(result).toEqual([]);
    });

    it('handles database error gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      });

      const result = await categoryService.getBonusCategories();

      expect(result).toEqual([]);
    });
  });

  describe('calculateCategorySP', () => {
    it('calculates SP earning with Math.round', async () => {
      const mockCategory = {
        sp_earning_multiplier: 1.15,
        sp_spending_cap_percent: 70,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCategory, error: null }),
      });

      const result = await categoryService.calculateCategorySP('cat1', 49.99);

      // earn_sp = Math.round(49.99 * 1.15) = Math.round(57.4885) = 57
      expect(result?.earn_sp).toBe(57);
    });

    it('calculates max_spend_sp with Math.floor', async () => {
      const mockCategory = {
        sp_earning_multiplier: 1.1,
        sp_spending_cap_percent: 70,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCategory, error: null }),
      });

      const result = await categoryService.calculateCategorySP('cat1', 50);

      // max_spend_sp = Math.floor((50 * 70) / 100) = Math.floor(35) = 35
      expect(result?.max_spend_sp).toBe(35);
    });

    it('uses default multiplier 1.10 when null', async () => {
      const mockCategory = {
        sp_earning_multiplier: null,
        sp_spending_cap_percent: 70,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCategory, error: null }),
      });

      const result = await categoryService.calculateCategorySP('cat1', 100);

      // earn_sp = Math.round(100 * 1.10) = 110
      expect(result?.earn_sp).toBe(110);
    });

    it('returns null when category not found', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await categoryService.calculateCategorySP('invalid-cat', 100);

      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('DB error'),
        }),
      });

      const result = await categoryService.calculateCategorySP('cat1', 100);

      expect(result).toBeNull();
    });
  });

  describe('getCategoriesWithCounts', () => {
    it('filters out inactive categories by default', async () => {
      const mockData = [
        { id: 'cat1', name: 'Active', is_active: true, item_count: 5 },
        { id: 'cat2', name: 'ZeroCountButActive', is_active: true, item_count: 0 },
      ];

      const mockQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: { data: typeof mockData; error: null }) => unknown) =>
          resolve({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await categoryService.getCategoriesWithCounts(false);

      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(mockData);
    });

    it('does not filter out zero-count categories by default', async () => {
      const mockData = [
        { id: 'cat1', name: 'HasItems', is_active: true, item_count: 3 },
        { id: 'cat2', name: 'ZeroItems', is_active: true, item_count: 0 },
      ];

      const mockQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: { data: typeof mockData; error: null }) => unknown) =>
          resolve({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await categoryService.getCategoriesWithCounts(false);

      // Verify active filter is still applied
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(mockData);
    });

    it('includes all categories when includeInactive=true', async () => {
      const mockData = [
        { id: 'cat1', name: 'Active', is_active: true, item_count: 5 },
        { id: 'cat2', name: 'Inactive', is_active: false, item_count: 0 },
      ];

      const mockQuery: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: { data: typeof mockData; error: null }) => unknown) =>
          resolve({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await categoryService.getCategoriesWithCounts(true);

      // Should not call eq when includeInactive=true
      expect(mockQuery).not.toHaveProperty('eq');
      expect(result).toEqual(mockData);
    });
  });
});
