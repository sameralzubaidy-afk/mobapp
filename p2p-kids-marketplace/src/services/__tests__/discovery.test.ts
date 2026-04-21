/**
 * File: p2p-kids-marketplace/src/services/__tests__/discovery.test.ts
 * MODULE-05-DISCOVERY-V2: Discovery Service Tests
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * Task: DISCOVERY-V2-002 - Subscriber-Personalized Recommendations
 * 
 * Unit tests for search and discovery functions
 */

import { searchListings, searchListingsByCategory, getRecommendations } from '../discovery';
import { SearchResult, CategoryResult, Recommendation } from '../../types/discovery';
import * as supabaseModule from '../../config/supabase';
import * as analyticsModule from '../analytics';

// Mock Supabase and Analytics
jest.mock('../../config/supabase');
jest.mock('../analytics');

describe('Discovery Service - DISCOVERY-V2-001: Full-Text Search', () => {
  const mockSupabase = supabaseModule.supabase as jest.Mocked<typeof supabaseModule.supabase>;
  const mockTrackEvent = analyticsModule.trackEvent as jest.MockedFunction<typeof analyticsModule.trackEvent>;

  const mockSearchResult: SearchResult = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Toy Car',
    description: 'Red toy car in good condition',
    price: 15.99,
    accepts_swap_points: true,
    status: 'available',
    seller_id: '660e8400-e29b-41d4-a716-446655440000',
    category_id: '770e8400-e29b-41d4-a716-446655440000',
    condition: 'good',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    relevance: 0.8,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchListings', () => {
    test('should return search results for valid query', async () => {
      // Arrange
      const query = 'toy';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockSearchResult],
        error: null,
      } as any);

      // Act
      const results = await searchListings(query);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Toy Car');
      expect(results[0].relevance).toBeGreaterThan(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: query,
          p_sp_eligible_only: false,
          p_limit: 20,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          query,
          result_count: 1,
          sp_eligible_only: false,
          has_filters: false,
          sort_by: 'relevance',
        })
      );
    });

    test('should filter for SP-eligible items when requested', async () => {
      // Arrange
      const query = 'toy';
      const spEligibleResult = { ...mockSearchResult, accepts_swap_points: true };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [spEligibleResult],
        error: null,
      } as any);

      // Act
      const results = await searchListings(query, { spEligibleOnly: true });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].accepts_swap_points).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: query,
          p_sp_eligible_only: true,
          p_limit: 20,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
    });

    test('should respect custom limit parameter', async () => {
      // Arrange
      const query = 'toy';
      const customLimit = 5;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockSearchResult],
        error: null,
      } as any);

      // Act
      await searchListings(query, { limit: customLimit });

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: query,
          p_sp_eligible_only: false,
          p_limit: customLimit,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
    });

    test('should call RPC for empty query and return results', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      // Act
      const results = await searchListings('');

      // Assert
      expect(results).toEqual([]);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({ p_query: '' })
      );
    });

    test('should trim whitespace-only query and still call RPC', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      // Act
      const results = await searchListings('   ');

      // Assert
      expect(results).toEqual([]);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({ p_query: '' })
      );
    });

    test('should trim query before searching', async () => {
      // Arrange
      const query = '  toy  ';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockSearchResult],
        error: null,
      } as any);

      // Act
      await searchListings(query);

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          p_query: 'toy',
          p_sp_eligible_only: false,
          p_limit: 20,
          p_offset: 0,
          p_sort_by: 'relevance',
        })
      );
    });

    test('should handle RPC errors gracefully', async () => {
      // Arrange
      const query = 'toy';
      const error = new Error('Database connection failed');
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error,
      } as any);

      // Act & Assert
      await expect(searchListings(query)).rejects.toThrow(error);
    });

    test('should rank results by relevance (highest first)', async () => {
      // Arrange
      const query = 'toy';
      const result1 = { ...mockSearchResult, id: '1', relevance: 0.9 };
      const result2 = { ...mockSearchResult, id: '2', relevance: 0.5 };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [result1, result2],
        error: null,
      } as any);

      // Act
      const results = await searchListings(query);

      // Assert
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[1].relevance);
    });

    test('should truncate long queries for analytics (PII safe)', async () => {
      // Arrange
      const longQuery = 'a'.repeat(150);
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      // Act
      await searchListings(longQuery);

      // Assert
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'search_listings',
        expect.objectContaining({
          query: 'a'.repeat(100), // Truncated to 100 chars
          result_count: 0,
          sp_eligible_only: false,
          has_filters: false,
          sort_by: 'relevance',
        })
      );
    });

    test('should only return active listings', async () => {
      // Arrange
      const query = 'toy';
      const activeResult = { ...mockSearchResult, status: 'available' };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [activeResult],
        error: null,
      } as any);

      // Act
      const results = await searchListings(query);

      // Assert
      expect(results.every(r => r.status === 'available')).toBe(true);
    });
  });

  describe('searchListingsByCategory', () => {
    const mockCategoryResult: CategoryResult = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Toy Car',
      description: 'Red toy car',
      price: 15.99,
      accepts_swap_points: true,
      status: 'available',
      seller_id: '660e8400-e29b-41d4-a716-446655440000',
      category_id: '770e8400-e29b-41d4-a716-446655440000',
      condition: 'good',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    test('should return category results for valid category ID', async () => {
      // Arrange
      const categoryId = '770e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockCategoryResult],
        error: null,
      } as any);

      // Act
      const results = await searchListingsByCategory(categoryId);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Toy Car');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings_by_category', {
        p_category_id: categoryId,
        p_sp_eligible_only: false,
        p_limit: 20,
        p_offset: 0,
      });
    });

    test('should support pagination with offset and limit', async () => {
      // Arrange
      const categoryId = '770e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockCategoryResult],
        error: null,
      } as any);

      // Act
      await searchListingsByCategory(categoryId, {
        categoryId,
        limit: 10,
        offset: 20,
      });

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings_by_category', {
        p_category_id: categoryId,
        p_sp_eligible_only: false,
        p_limit: 10,
        p_offset: 20,
      });
    });

    test('should filter for SP-eligible items when requested', async () => {
      // Arrange
      const categoryId = '770e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockCategoryResult],
        error: null,
      } as any);

      // Act
      await searchListingsByCategory(categoryId, { 
        categoryId,
        spEligibleOnly: true 
      });

      // Assert
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings_by_category', {
        p_category_id: categoryId,
        p_sp_eligible_only: true,
        p_limit: 20,
        p_offset: 0,
      });
    });

    test('should reject empty category ID', async () => {
      // Act & Assert
      await expect(searchListingsByCategory('')).rejects.toThrow(
        'Category ID is required'
      );
    });

    test('should reject null/undefined category ID', async () => {
      // Act & Assert
      await expect(searchListingsByCategory(null as any)).rejects.toThrow(
        'Category ID is required'
      );
    });

    test('should handle RPC errors gracefully', async () => {
      // Arrange
      const categoryId = '770e8400-e29b-41d4-a716-446655440000';
      const error = new Error('Database connection failed');
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error,
      } as any);

      // Act & Assert
      await expect(searchListingsByCategory(categoryId)).rejects.toThrow(error);
    });

    test('should track browse event', async () => {
      // Arrange
      const categoryId = '770e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockCategoryResult],
        error: null,
      } as any);

      // Act
      await searchListingsByCategory(categoryId, { 
        categoryId,
        limit: 15, 
        offset: 5 
      });

      // Assert
      expect(mockTrackEvent).toHaveBeenCalledWith('browse_category', {
        category_id: categoryId,
        result_count: 1,
        sp_eligible_only: false,
        offset: 5,
      });
    });
  });

  describe('getRecommendations - DISCOVERY-V2-002', () => {
    const mockRecommendation: Recommendation = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Recommended Toy',
      price: 19.99,
      accepts_swap_points: true,
      status: 'available',
      seller_id: '660e8400-e29b-41d4-a716-446655440000',
      category_id: '770e8400-e29b-41d4-a716-446655440000',
      condition: 'excellent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      score: 150, // SP-eligible + affordable
    };

    test('should return personalized recommendations for user', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockRecommendation],
        error: null,
      } as any);

      // Act
      const results = await getRecommendations(userId);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Recommended Toy');
      expect(results[0].score).toBeGreaterThan(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_recommendations', {
        p_user_id: userId,
        p_limit: 10,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('view_recommendations', {
        user_id: userId,
        result_count: 1,
        limit: 10,
      });
    });

    test('should respect custom limit parameter', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      const customLimit = 5;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockRecommendation],
        error: null,
      } as any);

      // Act
      const results = await getRecommendations(userId, customLimit);

      // Assert
      expect(results).toHaveLength(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_recommendations', {
        p_user_id: userId,
        p_limit: customLimit,
      });
    });

    test('should return SP-eligible items with high scores', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      const spRecommendation = { 
        ...mockRecommendation, 
        accepts_swap_points: true,
        score: 150, // High score for SP-eligible
      };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [spRecommendation],
        error: null,
      } as any);

      // Act
      const results = await getRecommendations(userId);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].accepts_swap_points).toBe(true);
      expect(results[0].score).toBeGreaterThanOrEqual(100);
    });

    test('should return empty array for empty user ID', async () => {
      // Act - empty user ID should be caught and return empty array gracefully
      const results = await getRecommendations('');

      // Assert - should gracefully return empty array, not throw
      expect(results).toEqual([]);
    });

    test('should return empty array on RPC error (graceful fallback)', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      const error = new Error('Database connection failed');
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error,
      } as any);

      // Act
      const results = await getRecommendations(userId);

      // Assert - should not throw, return empty array
      expect(results).toEqual([]);
    });

    test('should handle null/undefined data gracefully', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      // Act
      const results = await getRecommendations(userId);

      // Assert
      expect(results).toEqual([]);
    });

    test('should track view_recommendations event', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockRecommendation],
        error: null,
      } as any);

      // Act
      await getRecommendations(userId, 15);

      // Assert
      expect(mockTrackEvent).toHaveBeenCalledWith('view_recommendations', {
        user_id: userId,
        result_count: 1,
        limit: 15,
      });
    });

    test('should verify recommendations are sorted by score descending', async () => {
      // Arrange
      const userId = '880e8400-e29b-41d4-a716-446655440000';
      const recommendations = [
        { ...mockRecommendation, id: '1', score: 150 },
        { ...mockRecommendation, id: '2', score: 100 },
        { ...mockRecommendation, id: '3', score: 50 },
      ];
      mockSupabase.rpc.mockResolvedValueOnce({
        data: recommendations,
        error: null,
      } as any);

      // Act
      const results = await getRecommendations(userId);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });
  });
});
