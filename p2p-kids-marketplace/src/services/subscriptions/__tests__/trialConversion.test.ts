/**
 * File: p2p-kids-marketplace/src/services/subscriptions/__tests__/trialConversion.test.ts
 * MODULE-11 TASK SUB-005: Unit tests for trial conversion logic
 */

import { supabase } from '../../../config/supabase';
import {
  getTrialStatus,
  hasTrialExpired,
  triggerTrialConversion,
} from '../trialConversion';

// Mock Supabase
jest.mock('../../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('Trial Conversion Service', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrialStatus', () => {
    it('should return trial status with days remaining', async () => {
      // Mock auth
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      // Mock subscription query
      const mockTrialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                status: 'trial',
                trial_end_date: mockTrialEndDate.toISOString(),
                stripe_payment_method_id: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await getTrialStatus();

      expect(result).toBeDefined();
      expect(result?.status).toBe('trial');
      expect(result?.days_remaining).toBeGreaterThan(6);
      expect(result?.days_remaining).toBeLessThanOrEqual(7);
      expect(result?.has_payment_method).toBe(false);
      expect(result?.can_convert).toBe(false);
    });

    it('should indicate can_convert when payment method exists', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const mockTrialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                status: 'trial',
                trial_end_date: mockTrialEndDate.toISOString(),
                stripe_payment_method_id: 'pm_test_123',
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await getTrialStatus();

      expect(result?.has_payment_method).toBe(true);
      expect(result?.can_convert).toBe(true);
    });

    it('should return null when user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await getTrialStatus();

      expect(result).toBeNull();
    });

    it('should return null when subscription not found', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found'),
            }),
          }),
        }),
      });

      const result = await getTrialStatus();

      expect(result).toBeNull();
    });
  });

  describe('hasTrialExpired', () => {
    it('should return true when trial is expired', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      // Trial ended 2 days ago
      const expiredDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                status: 'trial',
                trial_end_date: expiredDate.toISOString(),
                stripe_payment_method_id: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasTrialExpired();

      expect(result).toBe(true);
    });

    it('should return false when trial is still active', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                status: 'trial',
                trial_end_date: futureDate.toISOString(),
                stripe_payment_method_id: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasTrialExpired();

      expect(result).toBe(false);
    });

    it('should return false when status is not trial', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                status: 'active',
                trial_end_date: null,
                stripe_payment_method_id: 'pm_test',
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasTrialExpired();

      expect(result).toBe(false);
    });
  });

  describe('triggerTrialConversion', () => {
    it('should successfully call trial-conversion Edge Function', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const mockConversionResult = {
        success: true,
        processed: 1,
        converted: 1,
        downgraded: 0,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockConversionResult,
        error: null,
      });

      const result = await triggerTrialConversion();

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockConversionResult);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('trial-conversion', {
        body: { user_id: mockUserId },
      });
    });

    it('should return error when not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await triggerTrialConversion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should return error when Edge Function fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Function invocation failed'),
      });

      const result = await triggerTrialConversion();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
