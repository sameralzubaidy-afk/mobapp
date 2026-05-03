// File: p2p-kids-marketplace/src/__tests__/services/sp-earning.test.ts
// MODULE-09 SP-002: Unit Tests for SP Earning Service

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  issueStarterPack,
  awardReferralReward,
  awardChallengeReward,
  refundSpForCancelledTrade,
  hasReceivedStarterPack,
} from '@/services/sp/earning';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

describe('SP Earning Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('issueStarterPack', () => {
    it('should successfully issue starter pack', async () => {
      const mockResponse = {
        success: true,
        sp_awarded: 10,
        batch_id: 'batch-123',
        ledger_entry_id: 'ledger-456',
        expires_at: '2027-01-19T00:00:00Z',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await issueStarterPack('user-123', 'listing-456');

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(10);
      expect(result.batch_id).toBe('batch-123');
      expect(supabase.rpc).toHaveBeenCalledWith('issue_starter_pack', {
        p_user_id: 'user-123',
        p_listing_id: 'listing-456',
      });
    });

    it('should return error if user not subscribed', async () => {
      const mockResponse = {
        success: false,
        error: 'Kids Club+ subscription required to earn Swap Points',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await issueStarterPack('user-123', 'listing-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('subscription required');
    });

    it('should return error if starter pack already issued', async () => {
      const mockResponse = {
        success: false,
        error: 'Starter pack already issued for this user',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await issueStarterPack('user-123', 'listing-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already issued');
    });
  });

  describe('awardReferralReward', () => {
    it('should successfully award referral rewards', async () => {
      const mockResponse = {
        success: true,
        referrer_sp_awarded: 50,
        referee_sp_awarded: 25,
        referrer_batch_id: 'batch-referrer-123',
        referee_batch_id: 'batch-referee-456',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await awardReferralReward('referrer-123', 'referee-456', 'referral-789');

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(75); // 50 + 25
      expect(supabase.rpc).toHaveBeenCalledWith('award_referral_sp', {
        p_referrer_id: 'referrer-123',
        p_referee_id: 'referee-456',
        p_referral_id: 'referral-789',
      });
    });

    it('should return error if referral already processed', async () => {
      const mockResponse = {
        success: false,
        error: 'Referral reward already processed',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await awardReferralReward('referrer-123', 'referee-456', 'referral-789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });
  });

  describe('awardChallengeReward', () => {
    it('should successfully award challenge reward', async () => {
      const mockResponse = {
        success: true,
        sp_awarded: 100,
        batch_id: 'batch-123',
        ledger_entry_id: 'ledger-456',
        expires_at: '2027-01-19T00:00:00Z',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await awardChallengeReward('user-123', 'challenge-456', 100);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(100);
      expect(supabase.rpc).toHaveBeenCalledWith('award_challenge_sp', {
        p_user_id: 'user-123',
        p_challenge_id: 'challenge-456',
        p_sp_amount: 100,
      });
    });

    it('should return error for invalid SP amount', async () => {
      const result = await awardChallengeReward('user-123', 'challenge-456', 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SP amount');
    });

    it('should return error if challenge already claimed', async () => {
      const mockResponse = {
        success: false,
        error: 'Challenge reward already claimed',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await awardChallengeReward('user-123', 'challenge-456', 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already claimed');
    });
  });

  describe('refundSpForCancelledTrade', () => {
    it('should successfully refund SP', async () => {
      const mockResponse = {
        success: true,
        sp_refunded: 50,
        batch_id: 'batch-123',
        ledger_entry_id: 'ledger-456',
        expires_at: '2027-01-19T00:00:00Z',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await refundSpForCancelledTrade('user-123', 'trade-456', 50);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(50); // refunded amount
      expect(supabase.rpc).toHaveBeenCalledWith('refund_sp_for_cancelled_trade', {
        p_user_id: 'user-123',
        p_trade_id: 'trade-456',
        p_sp_amount: 50,
      });
    });

    it('should return error for invalid SP amount', async () => {
      const result = await refundSpForCancelledTrade('user-123', 'trade-456', -10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SP amount');
    });

    it('should return error if refund already processed', async () => {
      const mockResponse = {
        success: false,
        error: 'Refund already processed for this trade',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await refundSpForCancelledTrade('user-123', 'trade-456', 50);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });
  });

  describe('hasReceivedStarterPack', () => {
    it('should return true if starter pack issued', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { starter_pack_issued: true },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await hasReceivedStarterPack('user-123');

      expect(result).toBe(true);
    });

    it('should return false if starter pack not issued', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { starter_pack_issued: false },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await hasReceivedStarterPack('user-123');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await hasReceivedStarterPack('user-123');

      expect(result).toBe(false);
    });
  });
});
