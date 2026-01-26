/**
 * File: p2p-kids-marketplace/src/services/__tests__/trialExtension.test.ts
 * Unit tests for trial extension service (SUB-EXT-001)
 */

import { extendTrial, getTrialExtensionStats, getTrialExtensionHistory } from '../subscriptions/trialExtension';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('Trial Extension Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extendTrial', () => {
    it('should successfully extend trial', async () => {
      const mockResult = {
        success: true,
        new_trial_end: '2026-02-22T00:00:00Z',
        extensions_used: 1,
        extensions_remaining: 2,
        days_added: 7,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await extendTrial('user-123', 'referral-456');

      expect(result.success).toBe(true);
      expect(result.extensions_used).toBe(1);
      expect(result.extensions_remaining).toBe(2);
      expect(result.days_added).toBe(7);
      expect(supabase.rpc).toHaveBeenCalledWith('extend_trial_period', {
        p_user_id: 'user-123',
        p_referral_user_id: 'referral-456',
      });
    });

    it('should reject when no active trial found', async () => {
      const mockResult = {
        success: false,
        error: 'No active trial found',
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await extendTrial('user-123', 'referral-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active trial found');
    });

    it('should reject when max extensions reached', async () => {
      const mockResult = {
        success: false,
        error: 'Maximum trial extensions reached',
        extensions_used: 3,
        max_extensions: 3,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await extendTrial('user-123', 'referral-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum trial extensions reached');
    });

    it('should handle RPC error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await extendTrial('user-123', 'referral-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extend trial');
    });

    it('should handle unexpected errors', async () => {
      (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await extendTrial('user-123', 'referral-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });
  });

  describe('getTrialExtensionStats', () => {
    it('should return correct stats', async () => {
      const mockSubscription = {
        referral_extensions_used: 1,
      };

      const mockConfig = {
        value: '3',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: mockSubscription, error: null })
          .mockResolvedValueOnce({ data: mockConfig, error: null }),
      });

      const result = await getTrialExtensionStats('user-123');

      expect(result).toEqual({
        extensions_used: 1,
        extensions_remaining: 2,
        max_extensions: 3,
      });
    });

    it('should handle subscription fetch error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      });

      const result = await getTrialExtensionStats('user-123');

      expect(result).toBeNull();
    });

    it('should handle config fetch error', async () => {
      const mockSubscription = {
        referral_extensions_used: 1,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: mockSubscription, error: null })
          .mockResolvedValueOnce({ data: null, error: { message: 'Config not found' } }),
      });

      const result = await getTrialExtensionStats('user-123');

      expect(result).toBeNull();
    });

    it('should handle zero extensions used', async () => {
      const mockSubscription = {
        referral_extensions_used: 0,
      };

      const mockConfig = {
        value: '3',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: mockSubscription, error: null })
          .mockResolvedValueOnce({ data: mockConfig, error: null }),
      });

      const result = await getTrialExtensionStats('user-123');

      expect(result).toEqual({
        extensions_used: 0,
        extensions_remaining: 3,
        max_extensions: 3,
      });
    });
  });

  describe('getTrialExtensionHistory', () => {
    it('should return extension history', async () => {
      const mockHistory = [
        {
          id: 'event-1',
          event_type: 'trial_extended',
          metadata: {
            referral_user_id: 'ref-1',
            days_added: 7,
            new_trial_end: '2026-02-22T00:00:00Z',
            extensions_used: 1,
            extensions_remaining: 2,
          },
          created_at: '2026-01-15T00:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockHistory, error: null }),
      });

      const result = await getTrialExtensionHistory('user-123');

      expect(result).toEqual(mockHistory);
      expect(result.length).toBe(1);
      expect(result[0].event_type).toBe('trial_extended');
    });

    it('should return empty array on error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' },
        }),
      });

      const result = await getTrialExtensionHistory('user-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when no events found', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await getTrialExtensionHistory('user-123');

      expect(result).toEqual([]);
    });
  });
});
