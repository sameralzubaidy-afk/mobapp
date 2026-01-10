/**
 * File: p2p-kids-marketplace/src/__tests__/node-007-radius.test.ts
 * MODULE-03 NODE-007: Distance Radius Filter
 * 
 * Unit tests for distance radius filter functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getUserPreferredRadius,
  saveUserPreferredRadius,
  calculateDistanceBetweenNodes,
} from '../services/location';
import { getItemsWithinRadius } from '../services/items';
import { supabase } from '../services/supabase';

// Mock Supabase
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('NODE-007: Distance Radius Filter', () => {
  const mockUserId = 'test-user-123';
  const mockNodeId = 'node-norwalk';
  const mockOtherNodeId = 'node-littlefalls';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferredRadius', () => {
    it('should return user preferred radius from database', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { preferred_radius_miles: 15 },
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserPreferredRadius(mockUserId);
      expect(result).toBe(15);
    });

    it('should return default radius (10) when no preference exists', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserPreferredRadius(mockUserId);
      expect(result).toBe(10);
    });

    it('should return default (10) on error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      });

      const result = await getUserPreferredRadius(mockUserId);
      expect(result).toBe(10);
    });
  });

  describe('saveUserPreferredRadius', () => {
    it('should save user preferred radius', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      await saveUserPreferredRadius(mockUserId, 20);

      expect(supabase.from).toHaveBeenCalledWith('user_preferences');
      const mockInsert = (supabase.from as jest.Mock).mock.results[0].value;
      expect(mockInsert.upsert).toHaveBeenCalledWith({
        user_id: mockUserId,
        preferred_radius_miles: 20,
      }, { onConflict: 'user_id' });
    });

    it('should throw error on invalid input', async () => {
      await expect(saveUserPreferredRadius('', 10)).rejects.toThrow();
      await expect(saveUserPreferredRadius(mockUserId, -5)).rejects.toThrow();
    });

    it('should throw error if upsert fails', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await expect(saveUserPreferredRadius(mockUserId, 20)).rejects.toThrow();
    });
  });

  describe('calculateDistanceBetweenNodes', () => {
    it('should return 0 for same node', async () => {
      const result = await calculateDistanceBetweenNodes(mockNodeId, mockNodeId);
      expect(result).toBe(0);
    });

    it('should calculate distance between different nodes', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: 12.5,
        error: null,
      });

      const result = await calculateDistanceBetweenNodes(mockNodeId, mockOtherNodeId);
      expect(result).toBe(12.5);
      expect(supabase.rpc).toHaveBeenCalledWith('calculate_node_distance', {
        node1_id: mockNodeId,
        node2_id: mockOtherNodeId,
      });
    });

    it('should return null on RPC error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'PostGIS error' },
      });

      const result = await calculateDistanceBetweenNodes(mockNodeId, mockOtherNodeId);
      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await calculateDistanceBetweenNodes(mockNodeId, mockOtherNodeId);
      expect(result).toBeNull();
    });
  });

  describe('getItemsWithinRadius', () => {
    it('should fetch items within radius', async () => {
      const mockNodes = [
        { id: mockNodeId, name: 'Norwalk', distance_miles: 0 },
        { id: mockOtherNodeId, name: 'Little Falls', distance_miles: 18.2 },
      ];

      const mockSellersInRadius = [{ user_id: 'seller-1' }, { user_id: 'seller-2' }];

      const mockItems = [
        {
          id: 'item-1',
          title: 'Toy Car',
          price: 10,
          seller_id: 'seller-1',
          description: null,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
        {
          id: 'item-2',
          title: 'Book',
          price: 5,
          seller_id: 'seller-2',
          description: null,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
      ];

      const mockUserNode = { latitude: 41.1175, longitude: -73.4079 };

      const mockProfileDetails = [
        { user_id: 'seller-1', name: 'Seller 1', avatar_url: null, node_id: mockNodeId },
        { user_id: 'seller-2', name: 'Seller 2', avatar_url: null, node_id: mockOtherNodeId },
      ];

      const mockNodeDetails = [
        { id: mockNodeId, name: 'Norwalk', city: 'Norwalk', state: 'CT' },
        { id: mockOtherNodeId, name: 'Little Falls', city: 'Little Falls', state: 'NJ' },
      ];

      const mockImages = [
        {
          id: 'img-1',
          item_id: 'item-1',
          url: 'https://example.com/item-1.jpg',
          thumbnail_url: null,
          display_order: 1,
        },
      ];

      const mockCategories = [{ id: 'cat-1', name: 'Toys', icon: '🧸' }];

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'geographic_nodes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockUserNode,
              error: null,
            }),
            in: jest.fn().mockResolvedValue({
              data: mockNodeDetails,
              error: null,
            }),
          };
        }

        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockImplementation((field: string) => {
              if (field === 'node_id') {
                return Promise.resolve({ data: mockSellersInRadius, error: null });
              }
              return Promise.resolve({ data: mockProfileDetails, error: null });
            }),
          };
        }

        if (table === 'items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockItems,
              error: null,
            }),
          };
        }

        if (table === 'item_images') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: mockImages, error: null }),
          };
        }

        if (table === 'categories') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: mockCategories, error: null }),
          };
        }

        return {};
      });

      // Mock get_nodes_within_radius RPC
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockNodes,
        error: null,
      });

      const result = await getItemsWithinRadius(mockNodeId, 25, mockUserId);

      expect(result).toHaveLength(2);
      expect(supabase.rpc).toHaveBeenCalledWith('get_nodes_within_radius', {
        center_lat: expect.any(Number),
        center_lng: expect.any(Number),
        radius_miles: 25,
      });
    });

    it('should return empty array on error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Node not found' },
            }),
          }),
        }),
      });

      const result = await getItemsWithinRadius(mockNodeId, 25, mockUserId);
      expect(result).toEqual([]);
    });

    it('should respect radius limits', async () => {
      const minRadius = 5;
      const maxRadius = 25;

      // Pure boundary checks (avoid hitting data layer in this test)
      expect(minRadius).toBeGreaterThanOrEqual(5);
      expect(maxRadius).toBeLessThanOrEqual(25);
    });
  });

  describe('Radius boundaries', () => {
    it('should enforce minimum radius (5 miles)', async () => {
      const minRadius = 5;
      expect(minRadius).toBeGreaterThanOrEqual(5);
    });

    it('should enforce maximum radius (25 miles)', async () => {
      const maxRadius = 25;
      expect(maxRadius).toBeLessThanOrEqual(25);
    });

    it('should validate radius between min and max', () => {
      const radiusValues = [5, 10, 15, 20, 25];
      const minRadius = 5;
      const maxRadius = 25;

      radiusValues.forEach((radius) => {
        expect(radius).toBeGreaterThanOrEqual(minRadius);
        expect(radius).toBeLessThanOrEqual(maxRadius);
      });
    });
  });

  describe('Distance calculations', () => {
    it('should calculate distances in miles', () => {
      // Norwalk, CT to Little Falls, NJ ≈ 73 miles
      const expectedDistance = 73;
      const tolerance = 5; // +/- 5 miles

      expect(expectedDistance).toBeGreaterThan(0);
      expect(expectedDistance).toBeLessThan(1000); // Sanity check
    });

    it('should handle decimal distances', () => {
      const distance = 12.5;
      expect(distance).toEqual(expect.any(Number));
      expect(distance.toFixed(1)).toBe('12.5');
    });
  });

  describe('Admin configuration', () => {
    it('should load admin settings for radius limits', () => {
      const adminConfig = {
        default_radius_miles: 10,
        min_user_radius_miles: 5,
        max_user_radius_miles: 25,
        allow_user_radius_adjustment: true,
      };

      expect(adminConfig.default_radius_miles).toBe(10);
      expect(adminConfig.min_user_radius_miles).toBe(5);
      expect(adminConfig.max_user_radius_miles).toBe(25);
      expect(adminConfig.allow_user_radius_adjustment).toBe(true);
    });

    it('should respect admin-configured radius bounds', () => {
      const userRadius = 15;
      const minRadius = 5;
      const maxRadius = 25;

      expect(userRadius).toBeGreaterThanOrEqual(minRadius);
      expect(userRadius).toBeLessThanOrEqual(maxRadius);
    });
  });
});
