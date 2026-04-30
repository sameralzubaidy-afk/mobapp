/**
 * File: p2p-kids-marketplace/src/__tests__/hooks/useCategorySPCache.test.ts
 * MODULE-04 LISTING-V3-011: Unit tests for category SP cache hook
 * Task: LISTING-V3-011 - SP earnings preview
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategorySPCache } from '../../hooks/useCategorySPCache';
import * as categoryService from '../../services/categoryService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../services/categoryService');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockCategoryService = categoryService as jest.Mocked<typeof categoryService>;

describe('useCategorySPCache', () => {
  const mockCategories = [
    { id: 'cat-toys', name: 'Toys', sp_earning_multiplier: 1.20, item_count: 10 },
    { id: 'cat-clothes', name: 'Clothes', sp_earning_multiplier: 1.10, item_count: 5 },
    { id: 'cat-books', name: 'Books', sp_earning_multiplier: 1.30, item_count: 8 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should fetch categories from API when no cache exists', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have called API
      expect(mockCategoryService.getCategoriesWithCounts).toHaveBeenCalled();

      // Should have populated multipliers
      expect(result.current.getMultiplier('cat-toys')).toBe(1.20);
      expect(result.current.getMultiplier('cat-clothes')).toBe(1.10);
      expect(result.current.getMultiplier('cat-books')).toBe(1.30);

      // Should have category names
      expect(result.current.getCategoryName('cat-toys')).toBe('Toys');

      // Should have saved to cache
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@kids_marketplace:category_sp_multipliers',
        expect.stringContaining('cat-toys')
      );
    });

    it('should use fresh cache if < 24h old', async () => {
      const freshCache = {
        data: [
          {
            category_id: 'cat-toys',
            category_name: 'Toys',
            sp_earning_multiplier: 1.20,
            last_updated: new Date().toISOString(),
          },
        ],
        cachedAt: new Date().toISOString(), // Fresh
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(freshCache));
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should call API in background to keep cache synced with admin changes
      await waitFor(() => {
        expect(mockCategoryService.getCategoriesWithCounts).toHaveBeenCalled();
      });

      // Should use cached data
      expect(result.current.getMultiplier('cat-toys')).toBe(1.20);
    });

    it('should refresh stale cache (> 24h old)', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 2); // 2 days ago

      const staleCache = {
        data: [
          {
            category_id: 'cat-toys',
            category_name: 'Toys',
            sp_earning_multiplier: 1.15, // Old value
            last_updated: staleDate.toISOString(),
          },
        ],
        cachedAt: staleDate.toISOString(),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(staleCache));
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any); // New value: 1.20

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should call API to refresh
      expect(mockCategoryService.getCategoriesWithCounts).toHaveBeenCalled();

      // Should use new value
      expect(result.current.getMultiplier('cat-toys')).toBe(1.20);
    });
  });

  describe('getMultiplier', () => {
    it('should return 1.10 default for null category', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getMultiplier(null)).toBe(1.10);
    });

    it('should return 1.10 default for unknown category', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getMultiplier('cat-unknown')).toBe(1.10);
    });
  });

  describe('error handling', () => {
    it('should use stale cache on network error', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 2);

      const staleCache = {
        data: [
          {
            category_id: 'cat-toys',
            category_name: 'Toys',
            sp_earning_multiplier: 1.20,
            last_updated: staleDate.toISOString(),
          },
        ],
        cachedAt: staleDate.toISOString(),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(staleCache));
      mockCategoryService.getCategoriesWithCounts.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have error message
      expect(result.current.error).toContain('cached data');

      // Should still have multiplier from stale cache
      expect(result.current.getMultiplier('cat-toys')).toBe(1.20);
    });

    it('should set error and use defaults when no cache and API fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockCategoryService.getCategoriesWithCounts.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have error
      expect(result.current.error).toBeTruthy();

      // Should default to 1.10 for all categories
      expect(result.current.getMultiplier('cat-toys')).toBe(1.10);
      expect(result.current.getMultiplier('cat-anything')).toBe(1.10);
    });
  });

  describe('refresh', () => {
    it('should force refresh from API', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Call refresh
      await result.current.refresh();

      // Should call API again
      expect(mockCategoryService.getCategoriesWithCounts).toHaveBeenCalled();
    });
  });

  describe('getCategoryName', () => {
    it('should return category name for known ID', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getCategoryName('cat-toys')).toBe('Toys');
      expect(result.current.getCategoryName('cat-clothes')).toBe('Clothes');
    });

    it('should return ID for unknown category', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getCategoryName('cat-unknown')).toBe('cat-unknown');
    });

    it('should return "Unknown" for null', async () => {
      mockCategoryService.getCategoriesWithCounts.mockResolvedValue(mockCategories as any);

      const { result } = renderHook(() => useCategorySPCache());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getCategoryName(null)).toBe('Unknown');
    });
  });
});
