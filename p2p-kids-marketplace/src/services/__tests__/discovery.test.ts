/**
 * File: p2p-kids-marketplace/src/services/__tests__/discovery.test.ts
 * MODULE-05-DISCOVERY-V2: Discovery Service Tests
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * 
 * Unit tests for search and discovery functions
 */

import { searchListings, searchListingsByCategory } from '../discovery';
import { SearchResult, CategoryResult } from '../../types/discovery';
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings', {
        p_query: query,
        p_sp_eligible_only: false,
        p_limit: 20,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('search_listings', {
        query,
        result_count: 1,
        sp_eligible_only: false,
      });
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings', {
        p_query: query,
        p_sp_eligible_only: true,
        p_limit: 20,
      });
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings', {
        p_query: query,
        p_sp_eligible_only: false,
        p_limit: customLimit,
      });
    });

    test('should return empty array for empty query', async () => {
      // Act
      const results = await searchListings('');

      // Assert
      expect(results).toEqual([]);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    test('should return empty array for whitespace-only query', async () => {
      // Act
      const results = await searchListings('   ');

      // Assert
      expect(results).toEqual([]);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
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
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_listings', {
        p_query: 'toy',
        p_sp_eligible_only: false,
        p_limit: 20,
      });
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
      expect(mockTrackEvent).toHaveBeenCalledWith('search_listings', {
        query: 'a'.repeat(100), // Truncated to 100 chars
        result_count: 0,
        sp_eligible_only: false,
      });
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
});
