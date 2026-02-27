/**
 * File: p2p-kids-marketplace/src/__tests__/services/subscription-sub-008.unit.test.ts
 * MODULE-11 TASK SUB-008: User-Initiated Cancellation Flow - Unit Tests
 *
 * Tests for:
 * - cancelSubscription function
 * - Edge cases: active/trial users, SP activity detection, error handling
 */

import { cancelSubscription, CancelSubscriptionResult } from '../../services/subscription';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { supabase } from '../../config/supabase';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('MODULE-11 SUB-008: cancelSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication checks', () => {
    it('should return error if no session exists', async () => {
      // Mock no session
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
      expect(result.message).toContain('logged in');
    });

    it('should return error if auth error occurs', async () => {
      // Mock auth error
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new Error('Auth error'),
      });

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
    });
  });

  describe('Successful cancellation - Active user', () => {
    beforeEach(() => {
      // Mock valid session
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'test-user-id' },
            access_token: 'test-token',
          } 
        },
        error: null,
      });
    });

    it('should successfully cancel active subscription', async () => {
      // Mock successful Edge Function response
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          new_status: 'cancelled',
          message: 'Your subscription has been cancelled.',
          current_period_end: '2026-03-22T00:00:00Z',
        },
        error: null,
      });

      const result = await cancelSubscription('Too expensive');

      expect(result.success).toBe(true);
      expect(result.new_status).toBe('cancelled');
      expect(result.current_period_end).toBeDefined();
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'cancel-subscription',
        expect.objectContaining({
          body: { cancel_reason: 'Too expensive' },
        })
      );
    });

    it('should use default reason if none provided', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, new_status: 'cancelled', message: 'OK' },
        error: null,
      });

      await cancelSubscription();

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'cancel-subscription',
        expect.objectContaining({
          body: { cancel_reason: 'User requested cancellation' },
        })
      );
    });
  });

  describe('Successful cancellation - Trial user with SP activity', () => {
    beforeEach(() => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'trial-user-id' },
            access_token: 'test-token',
          } 
        },
        error: null,
      });
    });

    it('should move trial user with SP to grace_period', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          new_status: 'grace_period',
          message: 'Your trial has been cancelled. Your Swap Points are frozen.',
          grace_period_ends_at: '2026-05-22T00:00:00Z',
        },
        error: null,
      });

      const result = await cancelSubscription('Testing cancellation');

      expect(result.success).toBe(true);
      expect(result.new_status).toBe('grace_period');
      expect(result.grace_period_ends_at).toBeDefined();
    });
  });

  describe('Successful cancellation - Trial user without SP activity', () => {
    beforeEach(() => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'trial-no-sp-user' },
            access_token: 'test-token',
          } 
        },
        error: null,
      });
    });

    it('should move trial user without SP to free', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          new_status: 'free',
          message: 'Your trial has been cancelled. You are now on the free plan.',
        },
        error: null,
      });

      const result = await cancelSubscription('Not needed');

      expect(result.success).toBe(true);
      expect(result.new_status).toBe('free');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'test-user-id' },
            access_token: 'test-token',
          } 
        },
        error: null,
      });
    });

    it('should handle Edge Function error', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Edge Function failed'),
      });

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Edge Function failed');
    });

    it('should handle no data returned', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unexpected error');
    });

    it('should handle unsuccessful cancellation response', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Cannot cancel subscription in current status',
        },
        error: null,
      });

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot cancel');
    });

    it('should handle unexpected exceptions', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await cancelSubscription('Testing');

      expect(result.success).toBe(false);
      expect(result.message).toContain('unexpected error');
    });
  });

  describe('CancelSubscriptionResult type validation', () => {
    beforeEach(() => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'test-user' },
            access_token: 'test-token',
          } 
        },
        error: null,
      });
    });

    it('should return properly typed result for cancelled status', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          new_status: 'cancelled',
          message: 'Cancelled',
          current_period_end: '2026-03-22T00:00:00Z',
        },
        error: null,
      });

      const result: CancelSubscriptionResult = await cancelSubscription();

      // Type checks
      expect(typeof result.success).toBe('boolean');
      expect(['cancelled', 'grace_period', 'free', undefined]).toContain(result.new_status);
      expect(typeof result.message).toBe('string');
    });

    it('should return properly typed result for grace_period status', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          new_status: 'grace_period',
          message: 'Grace period',
          grace_period_ends_at: '2026-05-22T00:00:00Z',
        },
        error: null,
      });

      const result: CancelSubscriptionResult = await cancelSubscription();

      expect(result.new_status).toBe('grace_period');
      expect(result.grace_period_ends_at).toBeDefined();
    });
  });
});

describe('Cancellation reason analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { 
        session: { 
          user: { id: 'analytics-test-user' },
          access_token: 'test-token',
        } 
      },
      error: null,
    });
    (mockSupabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { success: true, new_status: 'cancelled', message: 'OK' },
      error: null,
    });
  });

  it('should pass cancel reason to Edge Function', async () => {
    await cancelSubscription('Too expensive');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'cancel-subscription',
      expect.objectContaining({
        body: { cancel_reason: 'Too expensive' },
      })
    );
  });

  it('should handle custom/other reason', async () => {
    await cancelSubscription('Moving to a different city and no longer need the service');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'cancel-subscription',
      expect.objectContaining({
        body: { cancel_reason: 'Moving to a different city and no longer need the service' },
      })
    );
  });
});
