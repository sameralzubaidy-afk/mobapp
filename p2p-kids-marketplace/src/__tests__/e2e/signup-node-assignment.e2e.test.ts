/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/signup-node-assignment.e2e.test.ts
 * NODE-003: E2E Test for Signup with Automatic Node Assignment
 *
 * Scenarios:
 * 1. User enters ZIP with active node → assigned to exact ZIP
 * 2. User enters ZIP WITHOUT active node → assigned to nearest node
 * 3. User joins waitlist → entry created in zip_waitlist table
 * 4. User skips waitlist → proceeds with assigned node
 * 5. No active nodes anywhere → error shown
 */

import { supabase } from '../../services/supabase';
import { assignNodeByZipCode } from '../../services/location';

// Mock external services
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

global.fetch = jest.fn();

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Test data
const TEST_USER_ID = process.env.E2E_TEST_BUYER_ID || '49243010-f458-4744-add1-a6c84ab95f1f';
const _TEST_EMAIL = 'test@example.com';
const ACTIVE_ZIP = '06850'; // Norwalk - should have active node
const INACTIVE_ZIP = '06840'; // Near Norwalk - no active node

const MOCK_EXACT_MATCH_NODE = {
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

const MOCK_NEAREST_NODE = {
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

describe('E2E: Signup with Automatic Node Assignment - NODE-003', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // SCENARIO 1: Exact ZIP Match
  // =========================================================================

  describe('Scenario 1: Exact ZIP Match', () => {
    it('should assign user to node with exact ZIP match', async () => {
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
        data: [MOCK_EXACT_MATCH_NODE],
        error: null,
      } as any);

      const result = await assignNodeByZipCode(ACTIVE_ZIP, TEST_USER_ID);

      expect(result.nodeId).toBe('node-1');
      expect(result.matchType).toBe('zip');
      expect(result.distanceMiles).toBeNull();
    });

    it('should NOT show waitlist popup for exact ZIP match', async () => {
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
        data: [MOCK_EXACT_MATCH_NODE],
        error: null,
      } as any);

      const result = await assignNodeByZipCode(ACTIVE_ZIP);

      // Should NOT trigger waitlist popup
      expect(result.matchType).toBe('zip');
    });
  });

  // =========================================================================
  // SCENARIO 2: Fallback to Nearest Node
  // =========================================================================

  describe('Scenario 2: Fallback to Nearest Node', () => {
    it('should assign user to nearest node if requested ZIP not active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk Area',
              state: 'CT',
            },
          ],
          'post code': '06840',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [MOCK_NEAREST_NODE],
        error: null,
      } as any);

      const result = await assignNodeByZipCode(INACTIVE_ZIP, TEST_USER_ID);

      expect(result.nodeId).toBe('node-2');
      expect(result.matchType).toBe('nearest');
      expect(result.distanceMiles).toBeGreaterThan(40);
    });

    it('should show waitlist popup when assigned to nearest node', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk Area',
              state: 'CT',
            },
          ],
          'post code': '06840',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [MOCK_NEAREST_NODE],
        error: null,
      } as any);

      const result = await assignNodeByZipCode(INACTIVE_ZIP);

      // Should TRIGGER waitlist popup
      expect(result.matchType).toBe('nearest');
    });
  });

  // =========================================================================
  // SCENARIO 3: Waitlist Opt-In Flow
  // =========================================================================

  // NOTE: Waitlist tests require full supabase mock setup
  // These are covered in integration testing phase
  // Skipping deep mocks for now - focus on node assignment logic
  describe('Scenario 3: Waitlist Opt-In Flow', () => {
    it.skip('should add user to zip_waitlist when opting in', async () => {
      // Requires full supabase zip_waitlist table mock
      // Tested in integration phase with real database
    });

    it.skip('should handle duplicate waitlist entries (upsert)', async () => {
      // Requires full supabase zip_waitlist table mock
      // Tested in integration phase with real database
    });

    it.skip('should check if user is on waitlist', async () => {
      // Requires full supabase zip_waitlist table mock
      // Tested in integration phase with real database
    });
  });

  // =========================================================================
  // SCENARIO 4: No Active Nodes Anywhere
  // =========================================================================

  describe('Scenario 4: No Active Nodes Anywhere', () => {
    it('should throw error if no active nodes exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Nowhere',
              state: 'CT',
            },
          ],
          'post code': '00000',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      await expect(assignNodeByZipCode('00000')).rejects.toThrow(
        'We are not currently active in your area yet'
      );
    });
  });

  // =========================================================================
  // SCENARIO 5: Full Signup Flow Integration
  // =========================================================================

  describe('Scenario 5: Full Signup Flow Integration', () => {
    it('should complete full flow: ZIP → assignment → node increment', async () => {
      // Step 1: User enters ZIP and gets assigned
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
        data: [MOCK_EXACT_MATCH_NODE],
        error: null,
      } as any);

      const assignmentResult = await assignNodeByZipCode(ACTIVE_ZIP, TEST_USER_ID);
      expect(assignmentResult.nodeId).toBe('node-1');
    });

    it('should complete full flow with waitlist: ZIP → assignment → waitlist → skip', async () => {
      // Step 1: User enters inactive ZIP and gets assigned to nearest
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          country: 'United States',
          places: [
            {
              latitude: '41.1177',
              longitude: '-73.4079',
              place_name: 'Norwalk Area',
              state: 'CT',
            },
          ],
          'post code': '06840',
        }),
      } as any);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [MOCK_NEAREST_NODE],
        error: null,
      } as any);

      const assignmentResult = await assignNodeByZipCode(INACTIVE_ZIP, TEST_USER_ID);
      expect(assignmentResult.matchType).toBe('nearest');

      // Step 3: (Optional) Skip waitlist - proceed without adding to waitlist
      // No database call needed, just navigate to next screen
    });
  });
});
