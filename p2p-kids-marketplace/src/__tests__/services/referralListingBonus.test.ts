/**
 * Unit Tests for Referral Listing Bonus (REF-V2-008)
 * Tests the SP bonus rewards on first approved listing
 */

import { supabase } from '@/config/supabase';
import { ReferralRewardsService } from '@/services/referralRewards';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

describe('Referral Listing Bonus (REF-V2-008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfiguredRewardAmounts', () => {
    it('should return configured listing bonus amounts', async () => {
      const mockConfig = {
        referrer_sp: 50,
        referee_sp: 25,
        referrer_listing_sp: 25,
        referee_listing_sp: 10,
        program_enabled: true,
        first_trade_enabled: true,
        first_listing_enabled: true,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockConfig,
        error: null,
      });

      const result = await ReferralRewardsService.getConfiguredRewardAmounts();

      expect(result.referrer_listing_sp).toBe(25);
      expect(result.referee_listing_sp).toBe(10);
      expect(supabase.rpc).toHaveBeenCalledWith('get_referral_listing_config');
    });

    it('should fail loud when config is missing (no hardcoded defaults)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(ReferralRewardsService.getConfiguredRewardAmounts()).rejects.toThrow(
        /configuration unavailable/i
      );
    });

    it('should fail loud on RPC errors (no hardcoded defaults)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'SP_CONFIG_MISSING: referral_reward_referrer_sp' },
      });

      await expect(ReferralRewardsService.getConfiguredRewardAmounts()).rejects.toThrow(
        /configuration unavailable/i
      );
    });
  });

  describe('Feature Toggle Validation', () => {
    it('should check if listing bonus is enabled', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          referrer_listing_sp: 25,
          referee_listing_sp: 10,
          first_listing_enabled: true,
        },
        error: null,
      });

      const result = await ReferralRewardsService.isListingBonusEnabled();

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('get_referral_listing_config');
    });

    it('should return false when feature is disabled', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          referrer_listing_sp: 25,
          referee_listing_sp: 10,
          first_listing_enabled: false,
        },
        error: null,
      });

      const result = await ReferralRewardsService.isListingBonusEnabled();

      expect(result).toBe(false);
    });

    it('should fail loud when config is missing (no default enable)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue(null);

      await expect(ReferralRewardsService.isListingBonusEnabled()).rejects.toThrow(
        /configuration unavailable/i
      );
    });
  });

  describe('Idempotency Validation', () => {
    it('should not grant duplicate rewards for same listing', async () => {
      const mockResult = {
        success: false,
        error: 'Referral listing bonus already processed for this item',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const referrerId = '11111111-1111-1111-1111-111111111111';
      const refereeId = '22222222-2222-2222-2222-222222222222';
      const referralId = '33333333-3333-3333-3333-333333333333';
      const listingId = '44444444-4444-4444-4444-444444444444';

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: referrerId,
        p_referee_id: refereeId,
        p_referral_id: referralId,
        p_item_id: listingId,
      });

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('already processed');
    });
  });

  describe('Subscription Gating', () => {
    it('should grant rewards when both users are subscribers', async () => {
      const mockResult = {
        success: true,
        referrer_sp_awarded: 25,
        referee_sp_awarded: 10,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'referrer-id',
        p_referee_id: 'referee-id',
        p_referral_id: 'referral-id',
        p_item_id: 'listing-id',
      });

      expect(result.data.success).toBe(true);
      expect(result.data.referrer_sp_awarded).toBe(25);
      expect(result.data.referee_sp_awarded).toBe(10);
    });

    it('should NOT grant rewards when referrer subscription expired', async () => {
      const mockResult = {
        success: false,
        error: 'Referrer must have active subscription',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'expired-referrer',
        p_referee_id: 'active-referee',
        p_referral_id: 'referral-id',
        p_item_id: 'listing-id',
      });

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('active subscription');
    });

    it('should NOT grant rewards when referee subscription expired', async () => {
      const mockResult = {
        success: false,
        error: 'Referee must have active subscription',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'active-referrer',
        p_referee_id: 'expired-referee',
        p_referral_id: 'referral-id',
        p_item_id: 'listing-id',
      });

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('active subscription');
    });
  });

  describe('First Listing Validation', () => {
    it('should grant rewards only for first approved listing', async () => {
      const mockResult = {
        success: true,
        referrer_sp_awarded: 25,
        referee_sp_awarded: 10,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'referrer-id',
        p_referee_id: 'referee-id',
        p_referral_id: 'referral-id',
        p_item_id: 'first-listing-id',
      });

      expect(result.data.success).toBe(true);
    });

    it('should NOT grant rewards for second approved listing', async () => {
      const mockResult = {
        success: false,
        error: 'Not first approved listing',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'referrer-id',
        p_referee_id: 'referee-id',
        p_referral_id: 'referral-id',
        p_item_id: 'second-listing-id',
      });

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Not first');
    });
  });

  describe('Amount Configuration', () => {
    it('should use admin-configured amounts', async () => {
      const mockConfig = {
        referrer_sp: 25,
        referee_sp: 10,
        referrer_listing_sp: 100,
        referee_listing_sp: 50,
        program_enabled: true,
        first_trade_enabled: true,
        first_listing_enabled: true,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockConfig,
        error: null,
      });

      const config = await ReferralRewardsService.getConfiguredRewardAmounts();

      expect(config.referrer_listing_sp).toBe(100);
      expect(config.referee_listing_sp).toBe(50);
    });

    it('should apply configured amounts to rewards', async () => {
      const mockResult = {
        success: true,
        referrer_sp_awarded: 100,
        referee_sp_awarded: 50,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await supabase.rpc('award_listing_referral_sp', {
        p_referrer_id: 'referrer-id',
        p_referee_id: 'referee-id',
        p_referral_id: 'referral-id',
        p_item_id: 'listing-id',
      });

      expect(result.data.referrer_sp_awarded).toBe(100);
      expect(result.data.referee_sp_awarded).toBe(50);
    });
  });
});
