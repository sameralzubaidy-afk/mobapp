/**
 * Additional Unit tests for discovery service V3 enhancements
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-003
 *
 * Tests for 13-param searchListings and suggestSpellingCorrection
 */

import { supabase } from '../../config/supabase';
import { searchListings, suggestSpellingCorrection } from '../../services/discovery';
import { SearchResult, DiscoveryFilters } from '../../types/discovery';

// Mock modules
jest.mock('../../config/supabase');
jest.mock('../../services/analytics');

const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

describe('discovery service V3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchListings with V3 filters', () => {
    const mockSearchResults: SearchResult[] = [
      {
        id: '123',
        title: 'LEGO Star Wars Set',
        description: 'Great condition',
        price: 45,
        accepts_swap_points: true,
        status: 'available',
        seller_id: 'seller-1',
        category_id: 'cat-1',
        condition: 'like_new',
        age_group: '6-8',
        gender: 'unisex',
        brand: 'LEGO',
        color: ['blue', 'gray'],
        created_at: '2026-04-20T10:00:00Z',
        updated_at: '2026-04-20T10:00:00Z',
        relevance: 0.95,
      },
    ];

    it('should pass all 13 parameters to RPC', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      const filters: DiscoveryFilters = {
        categoryIds: ['cat-1', 'cat-2'],
        condition: 'like_new',
        minPrice: 10,
        maxPrice: 50,
        ageGroup: '6-8',
        gender: 'unisex',
        brand: 'LEGO',
        colors: ['blue', 'red'],
        spEligibleOnly: true,
        sortBy: 'price_asc',
        limit: 30,
        offset: 20,
      };

      await searchListings('star wars', filters);

      expect(mockRpc).toHaveBeenCalledWith('search_listings', {
        p_query: 'star wars',
        p_sp_eligible_only: true,
        p_limit: 30,
        p_offset: 20,
        p_category_ids: ['cat-1', 'cat-2'],
        p_condition: 'like_new',
        p_min_price: 10,
        p_max_price: 50,
        p_age_group: '6-8',
        p_gender: 'unisex',
        p_brand: 'LEGO',
        p_colors: ['blue', 'red'],
        p_sort_by: 'price_asc',
      });
    });

    it('should convert undefined filters to null', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      await searchListings('test', {});

      expect(mockRpc).toHaveBeenCalledWith('search_listings', {
        p_query: 'test',
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null,
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null,
        p_sort_by: 'relevance',
      });
    });

    it('should convert empty arrays to null', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      await searchListings('test', {
        categoryIds: [],
        colors: [],
      });

      expect(mockRpc).toHaveBeenCalledWith('search_listings', {
        p_query: 'test',
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
        p_category_ids: null, // empty array → null
        p_condition: null,
        p_min_price: null,
        p_max_price: null,
        p_age_group: null,
        p_gender: null,
        p_brand: null,
        p_colors: null, // empty array → null
        p_sort_by: 'relevance',
      });
    });

    it('should default sortBy to relevance', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      await searchListings('test');

      const call = (mockRpc as jest.Mock).mock.calls[0][1];
      expect(call.p_sort_by).toBe('relevance');
    });

    it('should handle empty query string', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null } as any);

      await searchListings('');

      expect(mockRpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: '',
        })
      );
    });

    it('should trim query whitespace', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      await searchListings('  test query  ');

      expect(mockRpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: 'test query',
        })
      );
    });

    it('should handle all sort options', async () => {
      mockRpc.mockResolvedValue({ data: mockSearchResults, error: null } as any);

      const sortOptions: ('relevance' | 'newest' | 'price_asc' | 'price_desc')[] = [
        'relevance',
        'newest',
        'price_asc',
        'price_desc',
      ];

      for (const sortBy of sortOptions) {
        await searchListings('test', { sortBy });

        expect(mockRpc).toHaveBeenCalledWith(
          'search_listings',
          expect.objectContaining({
            p_sort_by: sortBy,
          })
        );
      }
    });

    it('should handle RPC errors', async () => {
      const error = { message: 'Database error', code: 'PGRST000' };
      mockRpc.mockResolvedValue({ data: null, error } as any);

      await expect(searchListings('test')).rejects.toThrow();
    });
  });

  describe('suggestSpellingCorrection', () => {
    const recentSearches = ['bicycle', 'tricycle', 'scooter', 'LEGO', 'books'];

    it('should return correction for close typos (distance <= 3)', () => {
      const result = suggestSpellingCorrection('bycicle', recentSearches);

      expect(result).toBe('bicycle');
    });

    it('should return null for queries too different from any recent search', () => {
      const result = suggestSpellingCorrection('xyz', recentSearches);

      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = suggestSpellingCorrection('BYCICLE', recentSearches);

      expect(result).toBe('bicycle');
    });

    it('should return null for empty query', () => {
      expect(suggestSpellingCorrection('', recentSearches)).toBeNull();
      expect(suggestSpellingCorrection('   ', recentSearches)).toBeNull();
    });

    it('should return null for empty recent searches', () => {
      const result = suggestSpellingCorrection('bicycle', []);

      expect(result).toBeNull();
    });

    it('should return null when distance exceeds threshold 3', () => {
      const result = suggestSpellingCorrection('zzz', recentSearches);

      expect(result).toBeNull();
    });

    it('should find closest match among multiple candidates', () => {
      const result = suggestSpellingCorrection('scoter', recentSearches);

      expect(result).toBe('scooter'); // distance 1, closer than others
    });

    it('should not return the same typo when typo exists in history', () => {
      const historyWithTypo = ['bycicle', 'bicycle', 'tricycle'];

      const result = suggestSpellingCorrection('bycicle', historyWithTypo);

      expect(result).toBe('bicycle');
    });

    it('should return null for exact matches (no correction needed)', () => {
      const result = suggestSpellingCorrection('LEGO', recentSearches);

      expect(result).toBeNull();
    });
  });
});
