/**
 * File: p2p-kids-marketplace/src/__tests__/services/location.test.ts
 * NODE-003: Location Service Unit Tests
 *
 * Tests:
 * - ZIP code coordinate lookup (valid/invalid)
 * - Node assignment (exact match, nearest fallback, no nodes)
 * - Distance calculations
 * - Error handling
 */

import {
  assignNodeByZipCode,
  getZipCodeCoordinates,
  checkZipCodeHasActiveNode,
} from '../../services/location';

// Mock Supabase and analytics
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

// Mock fetch for ZIP code lookup
global.fetch = jest.fn();

import { supabase } from '../../services/supabase';
import { trackEvent } from '../../services/analytics';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Location Service - NODE-003', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // TEST: getZipCodeCoordinates
  // =========================================================================

  describe('getZipCodeCoordinates', () => {
    it('should return coordinates for valid ZIP code', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await getZipCodeCoordinates('06850');

      expect(result).toEqual({
        latitude: 41.1177,
        longitude: -73.4079,
      });
      expect(mockFetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/06850');
    });

    it('should return null for invalid ZIP code (404)', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await getZipCodeCoordinates('99999');

      expect(result).toBeNull();
    });

    it('should return null if API returns no places', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [],
          'post code': '00000',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await getZipCodeCoordinates('00000');

      expect(result).toBeNull();
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getZipCodeCoordinates('06850');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // TEST: assignNodeByZipCode
  // =========================================================================

  describe('assignNodeByZipCode', () => {
    const mockExactMatchNode = {
      id: 'node-1',
      name: 'Norwalk Central',
      zip_code: '06850',
      city: 'Norwalk',
      state: 'CT',
      latitude: 41.1177,
      longitude: -73.4079,
      distance_km: null,
      match_type: 'zip',
    };

    const mockNearestNode = {
      id: 'node-2',
      name: 'Little Falls',
      zip_code: '07424',
      city: 'Little Falls',
      state: 'NJ',
      latitude: 40.8751,
      longitude: -74.2163,
      distance_km: 80.5,
      match_type: 'nearest',
    };

    it('should assign to exact ZIP match node', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockExactMatchNode],
        error: null,
      } as any);

      const result = await assignNodeByZipCode('06850', 'user-123');

      expect(result.nodeId).toBe('node-1');
      expect(result.nodeName).toBe('Norwalk Central');
      expect(result.matchType).toBe('zip');
      expect(result.distanceMiles).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'node_assigned',
        expect.objectContaining({
          user_id: 'user-123',
          node_id: 'node-1',
          match_type: 'zip',
        })
      );
    });

    it('should assign to nearest node when ZIP not active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockNearestNode],
        error: null,
      } as any);

      const result = await assignNodeByZipCode('06850', 'user-456');

      expect(result.nodeId).toBe('node-2');
      expect(result.nodeName).toBe('Little Falls');
      expect(result.matchType).toBe('nearest');
      expect(result.distanceMiles).toBeCloseTo(50, 0);
    });

    it('should throw error if no active nodes exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      await expect(assignNodeByZipCode('06850')).rejects.toThrow(
        'We are not currently active in your area yet'
      );
    });

    it('should throw error if ZIP lookup fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      await expect(assignNodeByZipCode('99999')).rejects.toThrow('Invalid ZIP code');
    });

    it('should throw error if ZIP format invalid', async () => {
      await expect(assignNodeByZipCode('ABC12')).rejects.toThrow('Invalid ZIP code format');
    });

    it('should log warning if distance >50 miles', async () => {
      const farNode = {
        ...mockNearestNode,
        distance_km: 100,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [farNode],
        error: null,
      } as any);

      const consoleSpy = jest.spyOn(console, 'warn');
      await assignNodeByZipCode('06850');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Distance warning/),
        expect.any(Object)
      );
    });

    it('should handle RPC error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk',
              state: 'CT',
            },
          ],
          'post code': '06850',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('RPC error'),
      } as any);

      await expect(assignNodeByZipCode('06850')).rejects.toThrow('RPC error');
    });
  });

  // =========================================================================
  // TEST: checkZipCodeHasActiveNode
  // =========================================================================

  describe('checkZipCodeHasActiveNode', () => {
    it('should return true if active node exists for ZIP', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: { id: 'node-1' },
          error: null,
        }),
      } as any);

      const result = await checkZipCodeHasActiveNode('06850');

      expect(result).toBe(true);
    });

    it('should return false if no active node for ZIP', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      } as any);

      const result = await checkZipCodeHasActiveNode('99999');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: null,
          error: new Error('Query error'),
        }),
      } as any);

      const result = await checkZipCodeHasActiveNode('06850');

      expect(result).toBe(false);
    });
  });
});
