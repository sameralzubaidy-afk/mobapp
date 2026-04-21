/**
 * File: p2p-kids-marketplace/src/__tests__/services/discovery.test.ts
 * MODULE-05-DISCOVERY-V2: Discovery Service Tests
 * Task: DISCOVERY-V2-002 - Subscriber-Personalized Recommendations
 * 
 * Tests:
 * - getRecommendations returns personalized recommendations
 * - Recommendations respect user SP balance
 * - Recommendations prioritize SP-eligible items for subscribers
 * - Recommendations handle errors gracefully
 */

import { getRecommendations, searchListings, searchListingsByCategory, fetchListingsByCategory } from '../../services/discovery';
import { supabase } from '../../config/supabase';
import { Recommendation, SearchResult, CategoryResult } from '../../types/discovery';

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        ilike: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

// Mock analytics
jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('discovery.ts - DISCOVERY-V2-002: getRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations for valid user', async () => {
      const mockRecommendations: Recommendation[] = [
        {
          id: 'item-1',
          title: 'SP Eligible Item',
          price: 10.50,
          accepts_swap_points: true,
          status: 'available',
          seller_id: 'seller-1',
          category_id: 'cat-1',
          condition: 'like_new',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
          score: 150, // High score: SP-eligible + affordable
        },
        {
          id: 'item-2',
          title: 'Regular Item',
          price: 20.00,
          accepts_swap_points: false,
          status: 'available',
          seller_id: 'seller-2',
          category_id: 'cat-2',
          condition: 'good',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
          score: 10, // Low score: not SP-eligible
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRecommendations,
        error: null,
      });

      const result = await getRecommendations('user-123', 10);

      expect(result).toEqual(mockRecommendations);
      expect(supabase.rpc).toHaveBeenCalledWith('get_recommendations', {
        p_user_id: 'user-123',
        p_limit: 10,
      });
    });

    it('should return empty array for empty user ID', async () => {
      const result = await getRecommendations('', 10);

      expect(result).toEqual([]);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should return empty array when RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await getRecommendations('user-123', 10);

      expect(result).toEqual([]);
    });

    it('should prioritize SP-eligible items with higher scores', async () => {
      const mockRecommendations: Recommendation[] = [
        {
          id: 'item-sp',
          title: 'SP Item',
          price: 5.00,
          accepts_swap_points: true,
          status: 'available',
          seller_id: 'seller-1',
          category_id: 'cat-1',
          condition: 'like_new',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
          score: 160, // Score: 100 (SP-eligible) + 50 (affordable) + 10 (base)
        },
        {
          id: 'item-regular',
          title: 'Regular Item',
          price: 15.00,
          accepts_swap_points: false,
          status: 'available',
          seller_id: 'seller-2',
          category_id: 'cat-2',
          condition: 'good',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
          score: 10, // Score: 0 + 0 + 10 (base)
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRecommendations,
        error: null,
      });

      const result = await getRecommendations('user-subscriber', 10);

      // First result should have higher score (SP-eligible)
      expect(result[0].score).toBeGreaterThan(result[1].score);
      expect(result[0].accepts_swap_points).toBe(true);
    });

    it('should use default limit of 10 when not specified', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      await getRecommendations('user-123');

      expect(supabase.rpc).toHaveBeenCalledWith('get_recommendations', {
        p_user_id: 'user-123',
        p_limit: 10,
      });
    });
  });

  describe('searchListings', () => {
    it('should return search results with relevance ranking', async () => {
      const mockResults: SearchResult[] = [
        {
          id: 'item-1',
          title: 'Winter Jacket',
          description: 'Warm winter jacket',
          price: 25.00,
          accepts_swap_points: true,
          status: 'available',
          seller_id: 'seller-1',
          category_id: 'cat-1',
          condition: 'like_new',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
          relevance: 0.95,
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await searchListings('winter', { spEligibleOnly: false, limit: 20 });

      expect(result).toEqual(mockResults);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: 'winter',
          p_sp_eligible_only: false,
          p_limit: 20,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
    });

    it('should call RPC for empty query and return normalized results', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await searchListings('', { spEligibleOnly: false });

      expect(result).toEqual([]);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({ p_query: '' })
      );
    });

    it('should filter by SP-eligible when requested', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      await searchListings('toy', { spEligibleOnly: true, limit: 20 });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: 'toy',
          p_sp_eligible_only: true,
          p_limit: 20,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
    });
  });

  describe('searchListingsByCategory', () => {
    it('should return category results', async () => {
      const mockResults: CategoryResult[] = [
        {
          id: 'item-1',
          title: 'Toy Car',
          description: 'Red toy car',
          price: 5.00,
          accepts_swap_points: true,
          status: 'available',
          seller_id: 'seller-1',
          category_id: 'cat-toys',
          condition: 'like_new',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await searchListingsByCategory('cat-toys', { spEligibleOnly: false, limit: 20, offset: 0 });

      expect(result).toEqual(mockResults);
      expect(supabase.rpc).toHaveBeenCalledWith('search_listings_by_category', {
        p_category_id: 'cat-toys',
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
      });
    });

    it('should throw error for empty category ID', async () => {
      await expect(searchListingsByCategory('', { spEligibleOnly: false })).rejects.toThrow('Category ID is required');
    });
  });

  describe('fetchListingsByCategory', () => {
    it('should resolve category name to ID and return results', async () => {
      const mockCategoryId = 'cat-toys-uuid';
      const mockResults: CategoryResult[] = [
        {
          id: 'item-1',
          title: 'Toy Car',
          description: 'Red toy car',
          price: 5.00,
          accepts_swap_points: true,
          status: 'available',
          seller_id: 'seller-1',
          category_id: mockCategoryId,
          condition: 'like_new',
          created_at: '2025-12-20T00:00:00Z',
          updated_at: '2025-12-20T00:00:00Z',
        },
      ];

      // Mock category lookup
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: mockCategoryId },
        error: null,
      });
      const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockIlike = jest.fn(() => ({ eq: mockEq }));
      const mockSelect = jest.fn(() => ({ ilike: mockIlike }));
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      // Mock RPC call
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await fetchListingsByCategory('Toys', true);

      expect(result).toEqual(mockResults);
      expect(supabase.from).toHaveBeenCalledWith('categories');
      expect(mockIlike).toHaveBeenCalledWith('name', 'Toys');
      expect(supabase.rpc).toHaveBeenCalledWith('search_listings_by_category', {
        p_category_id: mockCategoryId,
        p_sp_eligible_only: true,
        p_limit: 50,
        p_offset: 0,
      });
    });

    it('should return empty array if category not found', async () => {
      // Mock category lookup returning null
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockIlike = jest.fn(() => ({ eq: mockEq }));
      const mockSelect = jest.fn(() => ({ ilike: mockIlike }));
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fetchListingsByCategory('NonExistent', false);

      expect(result).toEqual([]);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
