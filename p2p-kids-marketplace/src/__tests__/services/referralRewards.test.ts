// File: p2p-kids-marketplace/src/__tests__/services/referralRewards.test.ts
// MODULE-11 REF-V2-002: Unit tests for Referral Rewards Service

import { ReferralRewardsService } from '../../services/referralRewards';
import { supabase } from '../../config/supabase';

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('ReferralRewardsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('grantRewards', () => {
    it('should grant rewards successfully when both users are subscribers', async () => {
      const mockRpcResponse = {
        data: {
          success: true,
          referrer_sp_awarded: 25,
          referee_sp_awarded: 10,
          referrer_batch_id: 'batch-ref-123',
          referee_batch_id: 'batch-ree-456',
        },
        error: null,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralRewardsService.grantRewards(
        'referrer-user-id',
        'referee-user-id',
        'referral-id-123'
      );

      expect(result.success).toBe(true);
      expect(result.referrer_sp_awarded).toBe(25);
      expect(result.referee_sp_awarded).toBe(10);
      expect(result.referrer_batch_id).toBe('batch-ref-123');
      expect(result.referee_batch_id).toBe('batch-ree-456');
      expect(supabase.rpc).toHaveBeenCalledWith('award_referral_sp', {
        p_referrer_id: 'referrer-user-id',
        p_referee_id: 'referee-user-id',
        p_referral_id: 'referral-id-123',
      });
    });

    it('should return error when RPC fails', async () => {
      const mockRpcResponse = {
        data: null,
        error: { message: 'Database error' },
      };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralRewardsService.grantRewards(
        'referrer-user-id',
        'referee-user-id',
        'referral-id-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should return error when referral already processed', async () => {
      const mockRpcResponse = {
        data: {
          success: false,
          error: 'Referral reward already processed',
        },
        error: null,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralRewardsService.grantRewards(
        'referrer-user-id',
        'referee-user-id',
        'referral-id-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Referral reward already processed');
    });

    it('should return error when users are not subscribers', async () => {
      const mockRpcResponse = {
        data: {
          success: false,
          error: 'Both users must be active subscribers',
        },
        error: null,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await ReferralRewardsService.grantRewards(
        'referrer-user-id',
        'referee-user-id',
        'referral-id-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('subscriber');
    });
  });

  describe('checkEligibility', () => {
    it('should return eligibility when user has pending referral', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            referrer_user_id: 'referrer-123',
            status: 'pending',
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.checkEligibility('referee-user-id');

      expect(result.is_referee).toBe(true);
      expect(result.referrer_id).toBe('referrer-123');
      expect(result.rewards_pending).toBe(true);
      expect(result.referral_status).toBe('pending');
    });

    it('should return not eligible when user has no referral', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.checkEligibility('user-no-referral');

      expect(result.is_referee).toBe(false);
      expect(result.referrer_id).toBeNull();
      expect(result.rewards_pending).toBe(false);
      expect(result.referral_status).toBeNull();
    });

    it('should return not pending when referral is completed', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            referrer_user_id: 'referrer-123',
            status: 'completed',
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.checkEligibility('referee-user-id');

      expect(result.is_referee).toBe(true);
      expect(result.rewards_pending).toBe(false);
      expect(result.referral_status).toBe('completed');
    });
  });

  describe('isFirstCompletedTrade', () => {
    it('should return true when user has exactly 1 completed trade', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 1,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.isFirstCompletedTrade('user-id');

      expect(result).toBe(true);
    });

    it('should return false when user has multiple completed trades', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 3,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.isFirstCompletedTrade('user-id');

      expect(result).toBe(false);
    });

    it('should return false when user has no completed trades', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 0,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.isFirstCompletedTrade('user-id');

      expect(result).toBe(false);
    });
  });

  describe('getConfiguredRewardAmounts', () => {
    it('should return configured amounts from sp_config', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            { config_key: 'referral_reward_referrer_sp', config_value: '25' },
            { config_key: 'referral_reward_referee_sp', config_value: '10' },
          ],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.getConfiguredRewardAmounts();

      expect(result.referrer_sp).toBe(25);
      expect(result.referee_sp).toBe(10);
    });

    it('should return defaults when config not found', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.getConfiguredRewardAmounts();

      expect(result.referrer_sp).toBe(25);
      expect(result.referee_sp).toBe(10);
    });
  });

  describe('verifyBothUsersSubscribed', () => {
    it('should return true when both users have active subscriptions', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { user_id: 'referrer-id', status: 'active' },
            { user_id: 'referee-id', status: 'trial' },
          ],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.verifyBothUsersSubscribed(
        'referrer-id',
        'referee-id'
      );

      expect(result.both_subscribed).toBe(true);
      expect(result.referrer_status).toBe('active');
      expect(result.referee_status).toBe('trial');
    });

    it('should return false when referrer subscription is expired', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { user_id: 'referrer-id', status: 'expired' },
            { user_id: 'referee-id', status: 'active' },
          ],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.verifyBothUsersSubscribed(
        'referrer-id',
        'referee-id'
      );

      expect(result.both_subscribed).toBe(false);
    });

    it('should return false when referee subscription is cancelled', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            { user_id: 'referrer-id', status: 'active' },
            { user_id: 'referee-id', status: 'cancelled' },
          ],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ReferralRewardsService.verifyBothUsersSubscribed(
        'referrer-id',
        'referee-id'
      );

      expect(result.both_subscribed).toBe(false);
    });
  });
});
