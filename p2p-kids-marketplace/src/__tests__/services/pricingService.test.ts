/**
 * Unit tests for pricingService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests price suggestion tiers and validation
 */

import * as pricingService from '../../services/pricingService';
import { supabase } from '../../config/supabase';

// Mock supabase
jest.mock('../../config/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('pricingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockItemsQuery = (mockSales: { price: number }[]) => {
    const query: any = {
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      then: (resolve: (value: { data: { price: number }[]; error: null }) => unknown) =>
        resolve({ data: mockSales, error: null }),
    };

    mockSupabase.from = jest.fn(() => ({
      select: jest.fn(() => query),
    })) as any;

    return query;
  };

  describe('getSuggestedPrice', () => {
    it('should return empty array if no category provided', async () => {
      const result = await pricingService.getSuggestedPrice(undefined, 'good');

      expect(result).toEqual([]);
    });

    it('should return empty array if fewer than 5 comparable sales', async () => {
      const mockSales = [{ price: 10 }, { price: 12 }, { price: 15 }, { price: 8 }];

      mockItemsQuery(mockSales);

      const result = await pricingService.getSuggestedPrice('cat-123', 'good');

      expect(result).toEqual([]);
    });

    it('should return 4 tiers when enough data available', async () => {
      const mockSales = [
        { price: 10 },
        { price: 12 },
        { price: 15 },
        { price: 8 },
        { price: 20 },
        { price: 18 },
      ];

      mockItemsQuery(mockSales);

      const result = await pricingService.getSuggestedPrice('cat-123', 'good');

      expect(result).toHaveLength(4);
      expect(result[0].tier).toBe('great_deal');
      expect(result[1].tier).toBe('fair_price');
      expect(result[2].tier).toBe('asking_price');
      expect(result[3].tier).toBe('almost_new');
    });

    it('should calculate tiers using correct multipliers', async () => {
      const mockSales = [
        { price: 100 }, // avg will be 100
        { price: 100 },
        { price: 100 },
        { price: 100 },
        { price: 100 },
      ];

      mockItemsQuery(mockSales);

      const result = await pricingService.getSuggestedPrice('cat-123');

      // great_deal: 100 * 0.45 = 45
      // fair_price: 100 * 0.60 = 60
      // asking_price: 100 * 0.75 = 75
      // almost_new: 100 * 0.90 = 90
      expect(result[0].price).toBe(45);
      expect(result[1].price).toBe(60);
      expect(result[2].price).toBe(75);
      expect(result[3].price).toBe(90);
    });

    it('should filter by condition when provided', async () => {
      const mockSales = [{ price: 10 }, { price: 12 }, { price: 15 }, { price: 8 }, { price: 20 }];

      const query = mockItemsQuery(mockSales);

      await pricingService.getSuggestedPrice('cat-123', 'like_new');

      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(query.eq).toHaveBeenCalledWith('condition', 'like_new');
    });
  });

  describe('getPriceTierLabel', () => {
    it('should return correct labels for tier IDs', () => {
      expect(pricingService.getPriceTierLabel('great_deal')).toBe('Great Deal');
      expect(pricingService.getPriceTierLabel('fair_price')).toBe('Fair Price');
      expect(pricingService.getPriceTierLabel('asking_price')).toBe('Asking Price');
      expect(pricingService.getPriceTierLabel('almost_new')).toBe('Almost New');
    });

    it('should return "Custom Price" for unknown tier', () => {
      expect(pricingService.getPriceTierLabel('unknown')).toBe('Custom Price');
    });
  });

  describe('formatPrice', () => {
    it('should format price with dollar sign and 2 decimals', () => {
      expect(pricingService.formatPrice(10)).toBe('$10.00');
      expect(pricingService.formatPrice(12.5)).toBe('$12.50');
      expect(pricingService.formatPrice(99.99)).toBe('$99.99');
    });
  });

  describe('validatePrice', () => {
    it('should reject price <= 0', () => {
      expect(pricingService.validatePrice(0).valid).toBe(false);
      expect(pricingService.validatePrice(-5).valid).toBe(false);
    });

    it('should reject price > 10000', () => {
      expect(pricingService.validatePrice(10001).valid).toBe(false);
    });

    it('should reject price with more than 2 decimal places', () => {
      expect(pricingService.validatePrice(12.345).valid).toBe(false);
    });

    it('should accept valid prices', () => {
      expect(pricingService.validatePrice(10).valid).toBe(true);
      expect(pricingService.validatePrice(12.5).valid).toBe(true);
      expect(pricingService.validatePrice(99.99).valid).toBe(true);
      expect(pricingService.validatePrice(9999).valid).toBe(true);
    });
  });
});
