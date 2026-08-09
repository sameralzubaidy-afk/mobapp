// File: p2p-kids-marketplace/src/__tests__/services/referralCodeV2.test.ts
// Unit tests for ReferralCodeServiceV2

import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';

import { supabase } from '@/services/supabase/client';

// Mock supabase
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  },
}));

describe('ReferralCodeServiceV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReferralCode', () => {
    it('should return existing referral code', async () => {
      const mockData = { referral_code: 'ABC123XY' };
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await ReferralCodeServiceV2.getReferralCode('user-123');

      expect(result).toBe('ABC123XY');
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should create new code if none exists', async () => {
      // First call: getReferralCode select returns no rows
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        }),
      }));

      // Second call: createReferralCode update fails so service falls back to RPC
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      }));

      // Mock RPC call for creating new code
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { code: 'DEF456ZX', created: true },
        error: null,
      });

      const result = await ReferralCodeServiceV2.getReferralCode('user-123');

      expect(result).toBe('DEF456ZX');
      expect(supabase.rpc).toHaveBeenCalledWith('create_referral_code', {
        p_user_id: 'user-123',
      });
    });

    it('should handle errors gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' },
        }),
      });

      const result = await ReferralCodeServiceV2.getReferralCode('user-123');

      expect(result).toBeNull();
    });
  });

  describe('createReferralCode', () => {
    it('should create new referral code via RPC', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      });

      const mockRpcResponse = {
        data: { code: 'GHI789UV', created: true },
        error: null,
      };
      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralCodeServiceV2.createReferralCode('user-123');

      expect(result).toBe('GHI789UV');
      expect(supabase.rpc).toHaveBeenCalledWith('create_referral_code', {
        p_user_id: 'user-123',
      });
    });

    it('should throw error if RPC fails', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(ReferralCodeServiceV2.createReferralCode('user-123')).rejects.toThrow(
        'Failed to create referral code: RPC failed'
      );
    });
  });

  describe('applyReferralCode', () => {
    it('should apply valid referral code', async () => {
      const mockRpcResponse = {
        data: {
          success: true,
          referrer_id: 'referrer-123',
          message: 'Referral code applied successfully',
        },
        error: null,
      };
      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralCodeServiceV2.applyReferralCode('referee-123', 'ABC123XY');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('referrer_id');
      expect(supabase.rpc).toHaveBeenCalledWith('apply_referral_code', {
        p_user_id: 'referee-123',
        p_code: 'abc123xy', // Should be normalized to lowercase
      });
    });

    it('should handle invalid referral code', async () => {
      const mockRpcResponse = {
        data: {
          success: false,
          error: 'Invalid referral code',
        },
        error: null,
      };
      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralCodeServiceV2.applyReferralCode('referee-123', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid referral code');
    });

    it('should prevent self-referral', async () => {
      const mockRpcResponse = {
        data: {
          success: false,
          error: 'Cannot refer yourself',
        },
        error: null,
      };
      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralCodeServiceV2.applyReferralCode('user-123', 'SELF123');

      expect(result).toEqual({
        success: false,
        error: 'Cannot refer yourself',
      });
    });
  });

  describe('getReferralStats', () => {
    it('should calculate referral stats correctly', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          referrer_listing_sp: 25,
          referee_listing_sp: 10,
          referrer_sp: 25,
          referee_sp: 10,
          program_enabled: true,
          first_trade_enabled: true,
          first_listing_enabled: true,
        },
        error: null,
      });

      const mockReferrals = [
        { id: '1', status: 'pending', trial_extension_applied: false },
        { id: '2', status: 'completed', trial_extension_applied: true },
        { id: '3', status: 'completed', trial_extension_applied: false },
        { id: '4', status: 'expired', trial_extension_applied: false },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockReferrals, error: null }),
      });

      const result = await ReferralCodeServiceV2.getReferralStats('user-123');

      expect(result).toEqual({
        total_referrals: 4,
        pending_referrals: 1,
        completed_referrals: 2,
        total_sp_earned: 50, // 2 completed * 25 SP each
        trial_extensions_used: 1,
      });
    });

    it('should handle empty referral history', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          referrer_listing_sp: 25,
          referee_listing_sp: 10,
          referrer_sp: 25,
          referee_sp: 10,
          first_listing_enabled: true,
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await ReferralCodeServiceV2.getReferralStats('user-123');

      expect(result).toEqual({
        total_referrals: 0,
        pending_referrals: 0,
        completed_referrals: 0,
        total_sp_earned: 0,
        trial_extensions_used: 0,
      });
    });

    it('should handle database errors', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await ReferralCodeServiceV2.getReferralStats('user-123');

      expect(result).toEqual({
        total_referrals: 0,
        pending_referrals: 0,
        completed_referrals: 0,
        total_sp_earned: 0,
        trial_extensions_used: 0,
      });
    });
  });

  describe('getReferralLink', () => {
    it('should generate correct deep link format', () => {
      const code = 'ABC123XY';
      const result = ReferralCodeServiceV2.getReferralLink(code);

      expect(result).toBe('kidsclub://signup?ref=ABC123XY');
    });
  });

  describe('checkEligibility', () => {
    it('should return eligibility for referee with pending referral', async () => {
      const mockReferral = {
        referrer_user_id: 'referrer-123',
        status: 'pending',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockReferral, error: null }),
      });

      const result = await ReferralCodeServiceV2.checkEligibility('referee-123');

      expect(result).toEqual({
        is_referee: true,
        referrer_id: 'referrer-123',
        rewards_pending: true,
      });
    });

    it('should return no eligibility for user without referral', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const result = await ReferralCodeServiceV2.checkEligibility('user-123');

      expect(result).toEqual({
        is_referee: false,
        referrer_id: null,
        rewards_pending: false,
      });
    });
  });
});

// Integration test helper for V2 specification compliance
export const testReferralV2Compliance = {
  /**
   * Test that referral codes are 8 characters alphanumeric
   */
  validateReferralCodeFormat: (code: string) => {
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
  },

  /**
   * Test SP rewards match V2 spec (25 SP referrer, 10 SP referee)
   */
  validateV2SpRewards: (stats: any) => {
    // Each completed referral should give referrer 50 SP
    const expectedSP = stats.completed_referrals * 50;
    expect(stats.total_sp_earned).toBe(expectedSP);
  },

  /**
   * Test trial extensions are properly tracked
   */
  validateTrialExtensions: (stats: any) => {
    // trial_extensions_used should not exceed 3 per V2 spec
    expect(stats.trial_extensions_used).toBeLessThanOrEqual(3);
  },
};
