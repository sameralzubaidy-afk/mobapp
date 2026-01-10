/**
 * File: p2p-kids-marketplace/src/services/__tests__/badges.test.ts
 * MODULE-08 BADGES-V2-001: Unit tests for badges service
 */

import { getUserBadges, getAllBadges } from '../badges';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('badges service', () => {
  const mockUserId = 'user-123';
  const mockBadges = [
    { id: 'badge-1', name: 'SP Earner - Bronze', category: 'sp_earning', threshold: 10 },
    { id: 'badge-2', name: 'SP Earner - Silver', category: 'sp_earning', threshold: 50 },
  ];
  const mockUserBadges = [
    { 
      id: 'ub-1', 
      user_id: mockUserId, 
      badge_id: 'badge-1', 
      awarded_at: new Date().toISOString(),
      badge: mockBadges[0]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserBadges', () => {
    it('should fetch user badges from database', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUserBadges,
          error: null,
        }),
      });

      const result = await getUserBadges(mockUserId);
      expect(result).toHaveLength(1);
      expect(result[0].badge?.name).toBe('SP Earner - Bronze');
      expect(supabase.from).toHaveBeenCalledWith('user_badges');
    });

    it('should throw error on database failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB Error' },
        }),
      });

      await expect(getUserBadges(mockUserId)).rejects.toThrow('DB Error');
    });
  });

  describe('getAllBadges', () => {
    it('should fetch all active badges', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockBadges,
          error: null,
        }),
      });

      const result = await getAllBadges();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('SP Earner - Bronze');
      expect(supabase.from).toHaveBeenCalledWith('badges');
    });

    it('should throw error on database failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB Error' },
        }),
      });

      await expect(getAllBadges()).rejects.toThrow('DB Error');
    });
  });
});
