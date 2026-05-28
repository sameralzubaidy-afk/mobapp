/**
 * Unit tests for brandAutocomplete service
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-003
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import {
  PREDEFINED_BRANDS,
  getBrandSuggestions,
  fetchDatabaseBrands,
} from '../../services/brandAutocomplete';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock Supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const BRAND_CACHE_KEY = '@kids_marketplace:brand_cache';
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

describe('brandAutocomplete service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PREDEFINED_BRANDS', () => {
    it('should contain exactly 50 brands', () => {
      expect(PREDEFINED_BRANDS).toHaveLength(50);
    });

    it('should include all required brands from spec', () => {
      const requiredBrands = [
        'LEGO',
        'Nike',
        "Carter's",
        'Disney',
        'Pokemon',
        'The North Face',
        'Patagonia',
      ];

      requiredBrands.forEach((brand) => {
        expect(PREDEFINED_BRANDS).toContain(brand);
      });
    });

    it('should use exact casing from spec', () => {
      expect(PREDEFINED_BRANDS).toContain("OshKosh B'Gosh");
      expect(PREDEFINED_BRANDS).toContain('BabyBjörn');
      expect(PREDEFINED_BRANDS).toContain("Lands' End");
    });
  });

  describe('fetchDatabaseBrands', () => {
    const mockDbBrands = [
      { brand: 'Custom Brand 1', item_count: 25 },
      { brand: 'Custom Brand 2', item_count: 10 },
      { brand: null, item_count: 5 }, // should be filtered
    ];

    it('should fetch brands from database', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockDbBrands,
        error: null,
      });

      const result = await fetchDatabaseBrands();

      expect(supabase.rpc).toHaveBeenCalledWith('get_popular_brands', {
        p_limit: 50,
      });
      expect(result).toEqual(['Custom Brand 1', 'Custom Brand 2']);
    });

    it('should filter out null and empty brands', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [
          { brand: 'Valid Brand', item_count: 10 },
          { brand: null, item_count: 5 },
          { brand: '', item_count: 3 },
          { brand: '  ', item_count: 2 },
        ],
        error: null,
      });

      const result = await fetchDatabaseBrands();

      expect(result).toEqual(['Valid Brand']);
    });

    it('should use cached brands if within TTL', async () => {
      const cachedBrands = ['Cached Brand 1', 'Cached Brand 2'];
      const cache = {
        timestamp: Date.now() - 60000, // 1 minute ago
        brands: cachedBrands,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cache));

      const result = await fetchDatabaseBrands();

      expect(result).toEqual(cachedBrands);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should refetch if cache expired', async () => {
      const expiredCache = {
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        brands: ['Old Brand'],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(expiredCache));
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockDbBrands,
        error: null,
      });

      const result = await fetchDatabaseBrands();

      expect(supabase.rpc).toHaveBeenCalled();
      expect(result).toEqual(['Custom Brand 1', 'Custom Brand 2']);
    });

    it('should cache fetched brands', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockDbBrands,
        error: null,
      });

      const beforeTimestamp = Date.now();
      await fetchDatabaseBrands();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(BRAND_CACHE_KEY, expect.any(String));

      const savedCache = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);

      expect(savedCache.brands).toEqual(['Custom Brand 1', 'Custom Brand 2']);
      expect(savedCache.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });

    it('should handle RPC errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await fetchDatabaseBrands();

      expect(result).toEqual([]);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockDbBrands,
        error: null,
      });

      const result = await fetchDatabaseBrands();

      expect(result).toEqual(['Custom Brand 1', 'Custom Brand 2']);
    });
  });

  describe('getBrandSuggestions', () => {
    const mockDbBrands = ['Database Brand', 'Another DB Brand'];

    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockDbBrands.map((brand, i) => ({ brand, item_count: 10 - i })),
        error: null,
      });
    });

    it('should return empty array for queries < 2 characters', async () => {
      expect(await getBrandSuggestions('')).toEqual([]);
      expect(await getBrandSuggestions('a')).toEqual([]);
      expect(await getBrandSuggestions('  ')).toEqual([]);
    });

    it('should merge predefined and DB brands', async () => {
      const result = await getBrandSuggestions('brand');

      // Should include both predefined and DB brands that contain 'brand'
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Database Brand');
      expect(result).toContain('Another DB Brand');
    });

    it('should deduplicate case-insensitive', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [
          { brand: 'LEGO', item_count: 100 },
          { brand: 'lego', item_count: 50 },
        ],
        error: null,
      });

      const result = await getBrandSuggestions('lego');

      // Only one 'LEGO' should appear
      const legoCount = result.filter((brand) => brand.toLowerCase() === 'lego').length;
      expect(legoCount).toBe(1);
    });

    it('should filter by query (case-insensitive contains)', async () => {
      const result = await getBrandSuggestions('nike');

      expect(result).toContain('Nike');
      expect(result.every((brand) => brand.toLowerCase().includes('nike'))).toBe(true);
    });

    it('should sort alphabetically (case-insensitive)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [
          { brand: 'Zebra Brand', item_count: 100 },
          { brand: 'Apple Brand', item_count: 50 },
        ],
        error: null,
      });

      const result = await getBrandSuggestions('brand');

      // Check if sorted (case-insensitive)
      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i].toLowerCase();
        const next = result[i + 1].toLowerCase();
        expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
      }
    });

    it('should cap at 8 suggestions', async () => {
      // Use a query that matches many predefined brands
      const result = await getBrandSuggestions('a'); // many brands contain 'a'

      expect(result.length).toBeLessThanOrEqual(8);
    });

    it('should trim whitespace from query', async () => {
      const result = await getBrandSuggestions('  lego  ');

      expect(result).toContain('LEGO');
    });

    it('should handle fetch errors gracefully', async () => {
      (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await getBrandSuggestions('lego');

      // Should still return predefined brands
      expect(result).toContain('LEGO');
    });
  });
});
