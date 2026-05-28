/**
 * File: p2p-kids-marketplace/src/services/__tests__/subscription.test.ts
 * MODULE-11 TASK SUB-002: Unit Tests for Subscription Service
 *
 * Tests cover:
 * - Subscription status retrieval
 * - Feature gates (SP earn/spend)
 * - Transaction fee calculation
 * - Trial eligibility
 * - Grace period handling
 * - Cancellation and pause logic
 */

import { supabase } from '../../config/supabase';
import {
  getSubscriptionSummary,
  canAcceptSwapPoints,
  getSubscriptionStatusString,
  isTrialEligible,
  getTrialLimitStatus,
  checkTrialEligibility,
  getTransactionFee,
  getSubscriptionDetails,
} from '../subscription';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

describe('Subscription Service - TASK SUB-002', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSubscriptionSummary', () => {
    it('should return free tier for user with no subscription', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('free');
      expect(result.is_subscriber).toBe(false);
      expect(result.can_earn_sp).toBe(false);
      expect(result.can_spend_sp).toBe(false);
      expect(result.transaction_fee_cents).toBe(299);
      expect(result.tier_name).toBe('Free');
    });

    it('should return trial status for active trial user', async () => {
      const mockTrialData = {
        id: 'sub-123',
        user_id: 'user-123',
        tier_id: 'tier-123',
        status: 'trial',
        has_used_trial: true,
        trial_started_at: '2026-02-01T00:00:00Z',
        trial_ends_at: '2026-03-03T00:00:00Z',
        current_period_start: null,
        current_period_end: null,
        next_billing_date: '2026-03-03T00:00:00Z',
        grace_started_at: null,
        grace_ends_at: null,
        cancelled_at: null,
        cancel_reason: null,
        paused_until: null,
        auto_renew_enabled: true,
        payment_retry_count: 0,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: null,
        stripe_payment_method_id: null,
      };

      mockRpc
        .mockResolvedValueOnce({
          data: [mockTrialData],
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: 99,
          error: null,
        } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('trial');
      expect(result.is_subscriber).toBe(true);
      expect(result.can_earn_sp).toBe(true);
      expect(result.can_spend_sp).toBe(true);
      expect(result.transaction_fee_cents).toBe(99); // Subscriber fee
      expect(result.tier_name).toBe('Kids Club+');
      expect(result.has_used_trial).toBe(true);
      expect(result.trial_ends_at).toBe('2026-03-03T00:00:00Z');
    });

    it('should return active status for paying subscriber', async () => {
      const mockActiveData = {
        id: 'sub-123',
        user_id: 'user-123',
        tier_id: 'tier-123',
        status: 'active',
        has_used_trial: true,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: '2026-02-01T00:00:00Z',
        current_period_end: '2026-03-01T00:00:00Z',
        next_billing_date: '2026-03-01T00:00:00Z',
        grace_started_at: null,
        grace_ends_at: null,
        cancelled_at: null,
        cancel_reason: null,
        paused_until: null,
        auto_renew_enabled: true,
        payment_retry_count: 0,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        stripe_payment_method_id: 'pm_123',
      };

      mockRpc
        .mockResolvedValueOnce({
          data: [mockActiveData],
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: 99,
          error: null,
        } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('active');
      expect(result.is_subscriber).toBe(true);
      expect(result.transaction_fee_cents).toBe(99);
      expect(result.next_billing_date).toBe('2026-03-01T00:00:00Z');
      expect(result.stripe_subscription_id).toBe('sub_123');
    });

    it('should handle grace_period status correctly (SP frozen)', async () => {
      const mockGraceData = {
        id: 'sub-123',
        user_id: 'user-123',
        tier_id: 'tier-123',
        status: 'grace_period',
        has_used_trial: true,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
        next_billing_date: null,
        grace_started_at: '2026-02-01T00:00:00Z',
        grace_ends_at: '2026-05-02T00:00:00Z', // 90 days later
        cancelled_at: '2026-02-01T00:00:00Z',
        cancel_reason: 'Too expensive',
        paused_until: null,
        auto_renew_enabled: false,
        payment_retry_count: 3,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: null,
        stripe_payment_method_id: 'pm_123',
      };

      mockRpc
        .mockResolvedValueOnce({
          data: [mockGraceData],
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: 299,
          error: null,
        } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('grace_period');
      expect(result.is_subscriber).toBe(false); // No active benefits
      expect(result.can_earn_sp).toBe(false); // Wallet frozen
      expect(result.can_spend_sp).toBe(false); // Wallet frozen
      expect(result.transaction_fee_cents).toBe(299); // Non-subscriber fee
      expect(result.grace_ends_at).toBe('2026-05-02T00:00:00Z');
      expect(result.cancelled_at).toBe('2026-02-01T00:00:00Z');
      expect(result.payment_retry_count).toBe(3);
    });

    it('should handle paused status correctly (keeps access)', async () => {
      const mockPausedData = {
        id: 'sub-123',
        user_id: 'user-123',
        tier_id: 'tier-123',
        status: 'paused',
        has_used_trial: true,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: '2026-02-01T00:00:00Z',
        current_period_end: '2026-03-01T00:00:00Z',
        next_billing_date: null,
        grace_started_at: null,
        grace_ends_at: null,
        cancelled_at: null,
        cancel_reason: null,
        paused_until: '2026-03-01T00:00:00Z',
        auto_renew_enabled: false,
        payment_retry_count: 0,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        stripe_payment_method_id: 'pm_123',
      };

      mockRpc
        .mockResolvedValueOnce({
          data: [mockPausedData],
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: 99,
          error: null,
        } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('paused');
      expect(result.is_subscriber).toBe(true); // Still has access during pause
      expect(result.can_earn_sp).toBe(true); // Can still use SP during pause
      expect(result.can_spend_sp).toBe(true);
      expect(result.transaction_fee_cents).toBe(99); // Subscriber fee
      expect(result.paused_until).toBe('2026-03-01T00:00:00Z');
      expect(result.auto_renew_enabled).toBe(false);
    });

    it('should return free tier on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '' },
      } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('free');
      expect(result.transaction_fee_cents).toBe(299);
    });
  });

  describe('canAcceptSwapPoints', () => {
    it('should return true for subscribers', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            status: 'active',
            can_spend_sp: true,
          },
        ],
        error: null,
      } as any);

      const result = await canAcceptSwapPoints('user-123');
      expect(result).toBe(true);
    });

    it('should return false for free users', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      const result = await canAcceptSwapPoints('user-123');
      expect(result).toBe(false);
    });
  });

  describe('isTrialEligible', () => {
    it('should return true for users who have not used trial', async () => {
      mockRpc.mockResolvedValueOnce({
        data: true,
        error: null,
      } as any);

      const result = await isTrialEligible('user-123');
      expect(result).toBe(true);
    });

    it('should return false for users who have used trial', async () => {
      mockRpc.mockResolvedValueOnce({
        data: false,
        error: null,
      } as any);

      const result = await isTrialEligible('user-123');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '' },
      } as any);

      const result = await isTrialEligible('user-123');
      expect(result).toBe(false);
    });
  });

  describe('getTrialLimitStatus', () => {
    it('should return parsed trial-limit status from RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          trial_uses_count: 1,
          max_trial_uses: 1,
          unlimited: false,
          limit_reached: true,
          remaining_uses: 0,
          can_start_trial: false,
        },
        error: null,
      } as any);

      const result = await getTrialLimitStatus('user-123');

      expect(result.trial_uses_count).toBe(1);
      expect(result.max_trial_uses).toBe(1);
      expect(result.limit_reached).toBe(true);
      expect(result.can_start_trial).toBe(false);
    });

    it('should return safe defaults when RPC errors', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '' },
      } as any);

      const result = await getTrialLimitStatus('user-123');

      expect(result.trial_uses_count).toBe(0);
      expect(result.max_trial_uses).toBe(1);
      expect(result.can_start_trial).toBe(true);
    });

    it('should parse unlimited status when max_trial_uses is <= 0', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          trial_uses_count: 10,
          max_trial_uses: 0,
          unlimited: true,
          limit_reached: false,
          remaining_uses: null,
          can_start_trial: true,
        },
        error: null,
      } as any);

      const result = await getTrialLimitStatus('user-123');

      expect(result.unlimited).toBe(true);
      expect(result.limit_reached).toBe(false);
      expect(result.can_start_trial).toBe(true);
      expect(result.remaining_uses).toBeNull();
    });
  });

  describe('checkTrialEligibility', () => {
    it('should return explicit limit-reached reason when max trial uses is reached', async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null } as any).mockResolvedValueOnce({
        data: {
          trial_uses_count: 1,
          max_trial_uses: 1,
          unlimited: false,
          limit_reached: true,
          remaining_uses: 0,
          can_start_trial: false,
        },
        error: null,
      } as any);

      const result = await checkTrialEligibility('user-123');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Trial limit reached');
    });

    it('should return generic ineligible reason when limit is not reached', async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null } as any).mockResolvedValueOnce({
        data: {
          trial_uses_count: 0,
          max_trial_uses: 1,
          unlimited: false,
          limit_reached: false,
          remaining_uses: 1,
          can_start_trial: true,
        },
        error: null,
      } as any);

      const result = await checkTrialEligibility('user-123');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Trial already used or user not eligible');
    });
  });

  describe('getTransactionFee', () => {
    it('should return $0.99 for trial users', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 99,
        error: null,
      } as any);

      const result = await getTransactionFee('user-123');
      expect(result).toBe(99);
    });

    it('should return $0.99 for active subscribers', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 99,
        error: null,
      } as any);

      const result = await getTransactionFee('user-123');
      expect(result).toBe(99);
    });

    it('should return $2.99 for free users', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 299,
        error: null,
      } as any);

      const result = await getTransactionFee('user-123');
      expect(result).toBe(299);
    });

    it('should return $2.99 for grace_period users', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 299,
        error: null,
      } as any);

      const result = await getTransactionFee('user-123');
      expect(result).toBe(299);
    });

    it('should return $2.99 on error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '' },
      } as any);

      const result = await getTransactionFee('user-123');
      expect(result).toBe(299);
    });
  });

  describe('getSubscriptionStatusString', () => {
    it('should return status string for active subscriber', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ status: 'active' }],
        error: null,
      } as any);

      const result = await getSubscriptionStatusString('user-123');
      expect(result).toBe('active');
    });

    it('should return "free" for non-subscriber', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      const result = await getSubscriptionStatusString('user-123');
      expect(result).toBe('free');
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should return full subscription details', async () => {
      const mockDetails = {
        id: 'sub-123',
        user_id: 'user-123',
        tier_id: 'tier-123',
        status: 'active',
        has_used_trial: true,
        stripe_customer_id: 'cus_123',
      };

      mockRpc.mockResolvedValueOnce({
        data: [mockDetails],
        error: null,
      } as any);

      const result = await getSubscriptionDetails('user-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sub-123');
      expect(result?.status).toBe('active');
    });

    it('should return null when no subscription exists', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      } as any);

      const result = await getSubscriptionDetails('user-123');
      expect(result).toBeNull();
    });
  });
});
