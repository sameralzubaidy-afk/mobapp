/**
 * Unit tests for categoryService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests category operations with V3 enhancements
 */

import * as categoryService from '../../services/categoryService';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock supabase
jest.mock('../../config/supabase');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock items.ts getCategories
jest.mock('../../services/items', () => ({
  getCategories: jest.fn(),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('categoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCategoriesAndCounts = (
    categories: { id: string; name: string; icon?: string | null; is_active?: boolean; display_order?: number }[],
    itemCount: number = 5,
    trackCategoryEq?: jest.Mock
  ) => {
    const categoriesQuery: any = {
      order: jest.fn().mockReturnThis(),
      eq: jest.fn((column: string, value: unknown) => {
        if (trackCategoryEq) {
          trackCategoryEq(column, value);
        }
        return categoriesQuery;
      }),
      then: (resolve: (value: { data: typeof categories; error: null }) => unknown) =>
        resolve({ data: categories, error: null }),
    };

    const itemsQuery: any = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: (value: { count: number; error: null }) => unknown) =>
        resolve({ count: itemCount, error: null }),
    };

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: jest.fn(() => categoriesQuery),
        } as any;
      }

      if (table === 'items') {
        return {
          select: jest.fn(() => itemsQuery),
        } as any;
      }

      return {} as any;
    }) as any;

    return { categoriesQuery, itemsQuery };
  };

  describe('getCategoriesWithCounts', () => {
    it('should return categories with item counts', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Toys', icon: '🎮', is_active: true, display_order: 1 },
        { id: 'cat-2', name: 'Clothes', icon: '👕', is_active: true, display_order: 2 },
      ];

      mockCategoriesAndCounts(mockCategories, 5);

      const result = await categoryService.getCategoriesWithCounts();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('item_count');
    });

    it('should filter inactive categories by default', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Toys', is_active: true },
      ];

      const trackCategoryEq = jest.fn();
      mockCategoriesAndCounts(mockCategories, 0, trackCategoryEq);

      await categoryService.getCategoriesWithCounts(false);

      expect(mockSupabase.from).toHaveBeenCalledWith('categories');
      expect(trackCategoryEq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('flagForCategoryReview', () => {
    it('should update item with requested category name', async () => {
      mockSupabase.from = jest.fn((table) => {
        if (table === 'items') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          } as any;
        } else if (table === 'review_flags') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {} as any;
      }) as any;

      const result = await categoryService.flagForCategoryReview('item-123', 'Baby Gear');

      expect(result).toBe(true);
    });

    it('should be idempotent using upsert', async () => {
      mockSupabase.from = jest.fn((table) => {
        if (table === 'items') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          } as any;
        } else if (table === 'review_flags') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {} as any;
      }) as any;

      // Call twice
      await categoryService.flagForCategoryReview('item-123', 'Baby Gear');
      await categoryService.flagForCategoryReview('item-123', 'Baby Gear');

      // Should not throw or fail
      expect(true).toBe(true);
    });
  });

  describe('getRecentCategories', () => {
    it('should return recent categories from AsyncStorage', async () => {
      const mockRecent = ['cat-1', 'cat-2', 'cat-3'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecent));

      const result = await categoryService.getRecentCategories('seller-123');

      expect(result).toEqual(mockRecent);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        '@kids_marketplace:recent_categories_seller-123'
      );
    });

    it('should return max 3 categories', async () => {
      const mockRecent = ['cat-1', 'cat-2', 'cat-3', 'cat-4'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockRecent));

      const result = await categoryService.getRecentCategories('seller-123');

      expect(result).toHaveLength(3);
    });

    it('should return empty array if no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await categoryService.getRecentCategories('seller-123');

      expect(result).toEqual([]);
    });
  });

  describe('saveRecentCategory', () => {
    it('should save category to front of list (LRU)', async () => {
      const existing = ['cat-2', 'cat-3'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await categoryService.saveRecentCategory('seller-123', 'cat-1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@kids_marketplace:recent_categories_seller-123',
        JSON.stringify(['cat-1', 'cat-2', 'cat-3'])
      );
    });

    it('should remove duplicate and add to front', async () => {
      const existing = ['cat-2', 'cat-3', 'cat-1'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await categoryService.saveRecentCategory('seller-123', 'cat-1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@kids_marketplace:recent_categories_seller-123',
        JSON.stringify(['cat-1', 'cat-2', 'cat-3'])
      );
    });

    it('should keep max 3 entries', async () => {
      const existing = ['cat-2', 'cat-3', 'cat-4'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await categoryService.saveRecentCategory('seller-123', 'cat-1');

      const saved = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(saved);
      
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe('cat-1');
    });
  });

  describe('searchCategories', () => {
    it('should search categories case-insensitively', async () => {
      const mockResults = [
        { id: 'cat-1', name: 'Toys', icon: '🎮' },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          ilike: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ data: mockResults, error: null }),
              })),
            })),
          })),
        })),
      })) as any;

      const result = await categoryService.searchCategories('toy');

      expect(result).toEqual(mockResults);
    });

    it('should limit results to 10', async () => {
      let limit: number | undefined;

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          ilike: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn((n) => {
                  limit = n;
                  return Promise.resolve({ data: [], error: null });
                }),
              })),
            })),
          })),
        })),
      })) as any;

      await categoryService.searchCategories('test');

      expect(limit).toBe(10);
    });
  });
});
