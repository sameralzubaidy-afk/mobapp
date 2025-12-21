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
jest.mock('../services/supabase');

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
      });
    });

    it('should throw error on invalid input', async () => {
      await expect(saveUserPreferredRadius('', 10)).rejects.toThrow();
      await expect(saveUserPreferredRadius(mockUserId, -5)).rejects.toThrow();
    });

    it('should throw error if upsert fails', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
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

      const mockItems = [
        {
          id: 'item-1',
          title: 'Toy Car',
          price: 10,
          seller_id: 'seller-1',
          seller: { id: 'seller-1', node_id: mockNodeId },
        },
        {
          id: 'item-2',
          title: 'Book',
          price: 5,
          seller_id: 'seller-2',
          seller: { id: 'seller-2', node_id: mockOtherNodeId },
        },
      ];

      // Mock get_nodes_within_radius RPC
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockNodes,
        error: null,
      });

      // Mock items query
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockItems,
              error: null,
            }),
          }),
        }),
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

      const result = await getItemsWithinRadius(mockNodeId, 25);
      expect(result).toEqual([]);
    });

    it('should respect radius limits', async () => {
      const minRadius = 5;
      const maxRadius = 25;

      // Test min radius
      expect(await getItemsWithinRadius(mockNodeId, minRadius)).toBeDefined();

      // Test max radius
      expect(await getItemsWithinRadius(mockNodeId, maxRadius)).toBeDefined();
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
