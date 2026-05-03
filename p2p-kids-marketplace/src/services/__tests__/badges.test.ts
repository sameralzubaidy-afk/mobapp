// filepath: p2p-kids-marketplace/src/services/__tests__/badges.test.ts
// BADGES-V2-004: Unit tests for badge display and leaderboard

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getBadgeLeaderboard, getUserBadges } from '../badges';
import { supabase } from '../../config/supabase';

// Mock Supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('Badge Service - BADGES-V2-004', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBadgeLeaderboard', () => {
    it('should fetch leaderboard with default limit of 10', async () => {
      const mockLeaderboardData = [
        { user_id: 'user-1', display_name: 'Alice', badge_count: 5 },
        { user_id: 'user-2', display_name: 'Bob', badge_count: 3 },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLeaderboardData,
        error: null,
      });

      const result = await getBadgeLeaderboard();

      expect(supabase.rpc).toHaveBeenCalledWith('get_badge_leaderboard', {
        p_limit: 10,
      });
      expect(result).toEqual(mockLeaderboardData);
    });

    it('should fetch leaderboard with custom limit', async () => {
      const mockLeaderboardData = Array.from({ length: 50 }, (_, i) => ({
        user_id: `user-${i}`,
        display_name: `User ${i}`,
        badge_count: 50 - i,
      }));

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLeaderboardData,
        error: null,
      });

      const result = await getBadgeLeaderboard(50);

      expect(supabase.rpc).toHaveBeenCalledWith('get_badge_leaderboard', {
        p_limit: 50,
      });
      expect(result).toHaveLength(50);
    });

    it('should throw error when RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' },
      });

      await expect(getBadgeLeaderboard()).rejects.toThrow('Failed to fetch leaderboard');
    });

    it('should return empty array when no users have badges', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getBadgeLeaderboard();

      expect(result).toEqual([]);
    });

    it('should order results by badge_count descending', async () => {
      const mockLeaderboardData = [
        { user_id: 'user-1', display_name: 'Alice', badge_count: 10 },
        { user_id: 'user-2', display_name: 'Bob', badge_count: 8 },
        { user_id: 'user-3', display_name: 'Charlie', badge_count: 5 },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLeaderboardData,
        error: null,
      });

      const result = await getBadgeLeaderboard();

      // Verify descending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].badge_count).toBeGreaterThanOrEqual(result[i].badge_count);
      }
    });
  });

  describe('getUserBadges', () => {
    it('should fetch badges for a user', async () => {
      const mockUserBadges = [
        {
          id: 'ub-1',
          user_id: 'user-1',
          badge_id: 'badge-1',
          awarded_at: '2026-01-10T00:00:00Z',
          badge: {
            id: 'badge-1',
            name: 'First Trade',
            description: 'Completed first trade',
            category: 'trades',
            threshold: 1,
          },
        },
      ];

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUserBadges,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await getUserBadges('user-1');

      expect(supabase.from).toHaveBeenCalledWith('user_badges');
      expect(mockFrom.select).toHaveBeenCalledWith('*, badge:badges(*)');
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockFrom.order).toHaveBeenCalledWith('awarded_at', { ascending: false });
      expect(result).toEqual(mockUserBadges);
    });
  });
});
