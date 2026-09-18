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
  getSubscriptionPeriodEnd,
  canAcceptSwapPoints,
  getSubscriptionStatusString,
  isTrialEligible,
  getTrialLimitStatus,
  checkTrialEligibility,
  getTransactionFee,
  getSubscriptionDetails,
  getPaymentMethod,
  invalidatePaymentMethodCache,
  // FIX-Task-53 item 3 (2026-09-17): the canonical status predicates.
  isGraceStatus,
  isSubscriberStatus,
  isFeeActiveMemberStatus,
  canSpendSpStatus,
  buyerSubscriptionSnapshotStatus,
} from '../subscription';
import {
  getSimulatedPaymentCardPreference,
  getSimulatedSubscriptionReadFailure,
} from '../devTestingService';

// QA forced-card toggle (Dev Task 44) — control it directly so the
// subscription service test doesn't need AsyncStorage fixture plumbing.
// FIX-Task-28 item 1: the subscription-read failure toggle is stubbed to 'none'
// by default so every test below exercises the real RPC path.
jest.mock('../devTestingService', () => ({
  getSimulatedPaymentCardPreference: jest.fn(),
  getSimulatedSubscriptionReadFailure: jest.fn().mockResolvedValue('none'),
}));

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getSession: jest.fn(), refreshSession: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;
const mockInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;
const mockGetSession = supabase.auth.getSession as jest.MockedFunction<
  typeof supabase.auth.getSession
>;
const mockGetPaymentCardPreference = getSimulatedPaymentCardPreference as jest.Mock;
const mockGetSimulatedSubscriptionReadFailure = getSimulatedSubscriptionReadFailure as jest.Mock;

describe('Subscription Service - TASK SUB-002', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // FIX-Task-28 item 1: clearAllMocks does not drop implementations, but set the
    // default explicitly so a toggle-armed test can never leak into the next one.
    mockGetSimulatedSubscriptionReadFailure.mockResolvedValue('none');
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

    it('should handle grace_period status correctly (can spend, cannot earn)', async () => {
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
      expect(result.is_subscriber).toBe(true); // Grace keeps membership benefits (DEV-TASK-66)
      expect(result.can_earn_sp).toBe(false); // Grace cannot earn (R6)
      expect(result.can_spend_sp).toBe(true); // Grace CAN spend existing SP (R6)
      expect(result.transaction_fee_cents).toBe(299); // Mocked fee RPC returns 299
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

    it('should NOT report a confirmed free tier when the RPC fails (FIX-Task-28 item 1)', async () => {
      // FIX-Task-28 item 1 (2026-09-13): this used to return the free tier, which
      // told a paying subscriber they were on the Free plan. A failed read is
      // "couldn't verify" — every gate stays fail-closed, but the status is honest.
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '' },
      } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('unknown');
      expect(result.unverified).toBe(true);
      expect(result.tier_name).toBeNull();
      // Fail-closed: an unread plan must not unlock anything.
      expect(result.can_spend_sp).toBe(false);
      expect(result.can_earn_sp).toBe(false);
      expect(result.is_subscriber).toBe(false);
    });

    it('should report unverified (NOT free) on a transient network failure (FIX-Task-28 item 1)', async () => {
      // The exact QA finding: a transient failure of get_subscription_status made an
      // ACTIVE subscriber's Home screen render the "Unlock Swap Points / Upgrade →"
      // free-tier upsell with no retry and no error state.
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Network request failed', details: '', hint: '', code: '' },
      } as any);

      const result = await getSubscriptionSummary('user-123');

      expect(result.status).toBe('unknown');
      expect(result.unverified).toBe(true);
      expect(result.transaction_fee_cents).toBe(299); // still fail-closed on pricing
    });

    it('should report unverified and skip the RPC when the QA toggle is armed (FIX-Task-28 item 1)', async () => {
      // Proves the dev-only failure injection short-circuits BEFORE the request, so
      // the on-device verification never needs a real gateway failure.
      mockGetSimulatedSubscriptionReadFailure.mockResolvedValueOnce('read_failure');

      const result = await getSubscriptionSummary('user-123');

      expect(result.unverified).toBe(true);
      expect(result.status).toBe('unknown');
      expect(mockRpc).not.toHaveBeenCalled();
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

  describe('getPaymentMethod — cache bypass after adding a new card (DEV-TASK-81 regression)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // QA forced-card toggle disarmed — production path.
      mockGetPaymentCardPreference.mockResolvedValue(null);
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            // FIX-Task-37 item 1: the PM cache is user-scoped, so the mocked
            // session must carry a user id (the real getSession always does).
            user: { id: 'user-cache-owner' },
            access_token: 'test-token',
            // Far-future expiry so the refresh branch is never hit in these tests.
            expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
          },
        },
        error: null,
      });
    });

    it('returns the NEW server card via forceRefresh=true even when the cache holds the old card', async () => {
      // Seed the shared in-memory cache with the OLD card via a forced read.
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_old',
            brand: 'visa',
            last4: '1111',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });
      const seeded = await getPaymentMethod(true);
      expect(seeded?.id).toBe('pm_old');

      // A non-forced read returns the cached OLD card (no network call) — this is
      // exactly the stale state the user hit after adding a new card.
      const stale = await getPaymentMethod();
      expect(stale?.id).toBe('pm_old');

      // The new card is now persisted server-side (attach-payment-method wrote it).
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_new',
            brand: 'mastercard',
            last4: '2222',
            exp_month: 1,
            exp_year: 2036,
          },
        },
        error: null,
      });

      // forceRefresh=true MUST bypass the cache and return the newly-added card.
      const fresh = await getPaymentMethod(true);
      expect(fresh?.id).toBe('pm_new');
    });
  });

  describe('invalidatePaymentMethodCache — destructive-path cache clear (DEV-TASK-127 / QA Task 39 F-1)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // QA forced-card toggle disarmed — production path.
      mockGetPaymentCardPreference.mockResolvedValue(null);
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            // FIX-Task-37 item 1: user-scoped cache — the session must carry a user id.
            user: { id: 'user-cache-owner' },
            access_token: 'test-token',
            // Far-future expiry so the refresh branch is never hit in these tests.
            expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
          },
        },
        error: null,
      });
    });

    it('forces the next read to re-fetch after a remove (no stale removed card in cache)', async () => {
      // Seed the shared in-memory cache with the SAVED card via a forced read.
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_old',
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2030,
          },
        },
        error: null,
      });
      const seeded = await getPaymentMethod(true);
      expect(seeded?.id).toBe('pm_old');

      // A non-forced read returns the cached card (no network call) — this is the
      // stale state QA hit on a same-session remount after remove.
      const stale = await getPaymentMethod();
      expect(stale?.id).toBe('pm_old');
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Successful detach → the screen calls invalidatePaymentMethodCache().
      invalidatePaymentMethodCache();

      // The server now reports NO saved card (detach-payment-method cleared it).
      mockInvoke.mockResolvedValueOnce({
        data: { payment_method: null },
        error: null,
      });

      // The next non-forced read MUST re-fetch (cache was cleared) and see the
      // true empty state instead of the removed card.
      const after = await getPaymentMethod();
      expect(after).toBeNull();
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPaymentMethod — cross-account isolation (FIX-Task-37 item 1 / BP-95)', () => {
    const farFuture = Math.floor(Date.now() / 1000) + 60 * 60;

    const mockSessionFor = (userId: string) => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: userId }, access_token: `token-${userId}`, expires_at: farFuture } },
        error: null,
      } as any);
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockGetPaymentCardPreference.mockResolvedValue(null);
      // Module-level cache persists across cases in this file — reset explicitly so
      // each test is order-independent (BP-60 test isolation).
      invalidatePaymentMethodCache();
    });

    it("never serves the previous user's cached card after a warm account switch", async () => {
      // User A is signed in and their saved card is fetched + cached.
      mockSessionFor('user-A');
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_A',
            brand: 'mastercard',
            last4: '4444',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });
      const asUserA = await getPaymentMethod();
      expect(asUserA?.id).toBe('pm_A');

      // Warm in-app account switch (no relaunch): user B has NO saved card, but the
      // module-level cache still holds user A's card.
      mockSessionFor('user-B');
      mockInvoke.mockResolvedValueOnce({ data: { payment_method: null }, error: null });

      const asUserB = await getPaymentMethod();

      // REGRESSION GUARD: before the fix this returned user A's MASTERCARD, i.e. one
      // account was shown another account's payment card (privacy exposure).
      expect(asUserB).toBeNull();
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('still serves the cache for the SAME user (no redundant fetch)', async () => {
      mockSessionFor('user-A');
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_A',
            brand: 'visa',
            last4: '1111',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });

      const first = await getPaymentMethod();
      const second = await getPaymentMethod();

      expect(first?.id).toBe('pm_A');
      expect(second?.id).toBe('pm_A');
      // The prefetch win is preserved: the second read is served from the cache.
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('treats a session-less read as a cache miss (fail closed, never a stale card)', async () => {
      mockSessionFor('user-A');
      mockInvoke.mockResolvedValueOnce({
        data: {
          payment_method: {
            id: 'pm_A',
            brand: 'visa',
            last4: '1111',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });
      expect((await getPaymentMethod())?.id).toBe('pm_A');

      // Signed out: no session → no owner → the cached card must NOT be served.
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null } as any);
      const signedOut = await getPaymentMethod();

      expect(signedOut).toBeNull();
    });
  });

  describe('getPaymentMethod — request bounds + late-response guards (FIX-Task-41 item 7)', () => {
    const farFuture = Math.floor(Date.now() / 1000) + 60 * 60;

    const mockSessionFor = (userId: string) => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: userId },
            access_token: `token-${userId}`,
            expires_at: farFuture,
          },
        },
        error: null,
      } as any);
    };

    const pmFor = (id: string) => ({
      id,
      brand: 'visa',
      last4: '1111',
      exp_month: 12,
      exp_year: 2035,
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockGetPaymentCardPreference.mockResolvedValue(null);
      invalidatePaymentMethodCache();
    });

    it('bounds the Edge Function call so a stalled request cannot wedge the screen', async () => {
      mockSessionFor('user-A');
      mockInvoke.mockResolvedValueOnce({ data: { payment_method: null }, error: null });

      await getPaymentMethod();

      // REGRESSION GUARD: without an explicit timeout the invoke could hang at the
      // socket layer and the calling screen stayed on "Fetching payment method…"
      // forever (the F5 wedge).
      expect(mockInvoke).toHaveBeenCalledWith(
        'get-payment-method',
        expect.objectContaining({ timeout: 15000 })
      );
    });

    it('a response landing after an identity change never overwrites the new user cache', async () => {
      // User A's request is in flight (never settles yet).
      let resolveStaleRequest: (value: any) => void = () => {};
      const staleRequest = new Promise((resolve) => {
        resolveStaleRequest = resolve;
      });
      mockSessionFor('user-A');
      mockInvoke.mockReturnValueOnce(staleRequest as any);
      const asUserA = getPaymentMethod();
      // Let A's read get past its own session read and actually reach the (pending)
      // EF call before the switch — otherwise B's read consumes A's queued mock.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Warm in-app account switch to B while A's request is still in flight.
      mockSessionFor('user-B');
      invalidatePaymentMethodCache();
      mockInvoke.mockResolvedValueOnce({
        data: { payment_method: pmFor('pm_B') },
        error: null,
      });
      const asUserB = await getPaymentMethod();
      expect(asUserB?.id).toBe('pm_B');

      // A's stale reply finally lands, carrying A's card.
      resolveStaleRequest({ data: { payment_method: pmFor('pm_A') }, error: null });
      expect((await asUserA)?.id).toBe('pm_A'); // the original caller still gets its value

      // REGRESSION GUARD: B's cached entry must survive. Before the fix the late
      // reply re-wrote the slot with A's card under owner A, so B refetched.
      expect((await getPaymentMethod())?.id).toBe('pm_B');
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPaymentMethod — QA forced-card pass-through (Dev Task 44)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            // FIX-Task-37 item 1: user-scoped cache — the session must carry a user id.
            user: { id: 'user-cache-owner' },
            access_token: 'test-token',
            // Far-future expiry so the refresh branch is never hit in these tests.
            expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
          },
        },
        error: null,
      });
    });

    it('passes force_card to the Edge Function when the QA toggle is armed', async () => {
      mockGetPaymentCardPreference.mockResolvedValue('mastercard_4444');
      mockInvoke.mockResolvedValue({
        data: {
          payment_method: {
            id: 'pm_mc_4444',
            brand: 'mastercard',
            last4: '4444',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });

      const pm = await getPaymentMethod();

      expect(mockInvoke).toHaveBeenCalledWith(
        'get-payment-method',
        expect.objectContaining({ body: { force_card: 'mastercard_4444' } })
      );
      expect(pm?.id).toBe('pm_mc_4444');
    });

    it('sends no force_card (and caches) when the toggle is disarmed', async () => {
      mockGetPaymentCardPreference.mockResolvedValue(null);
      mockInvoke.mockResolvedValue({
        data: {
          payment_method: {
            id: 'pm_default_4242',
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2035,
          },
        },
        error: null,
      });

      const pm = await getPaymentMethod(true);

      const call = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
      expect(mockInvoke).toHaveBeenCalledWith('get-payment-method', expect.any(Object));
      expect(call.body).toBeUndefined();
      expect(pm?.id).toBe('pm_default_4242');
    });
  });
});

/**
 * FIX-Task-47 item 1 (2026-09-16).
 *
 * Regression guard for the wrong billing date on Manage Kids Club+. The screen
 * rendered `subscription_expires_at || trial_ends_at`, omitting `next_billing_date`
 * entirely — and because staging leaves `subscription_expires_at` unpopulated for
 * active members, it showed a stale trial-end date as "Next Billing Date" while
 * the same user's My Subscription screen showed the correct one.
 *
 * `getSubscriptionPeriodEnd` is now the single source of truth for BOTH screens, so
 * these cases pin the precedence order itself.
 */
describe('getSubscriptionPeriodEnd — FIX-Task-47 item 1', () => {
  it('prefers next_billing_date (the case that was broken)', () => {
    expect(
      getSubscriptionPeriodEnd({
        next_billing_date: '2026-09-27T00:00:00Z',
        subscription_expires_at: '2026-07-27T00:00:00Z',
        trial_ends_at: '2026-07-27T00:00:00Z',
      })
    ).toBe('2026-09-27T00:00:00Z');
  });

  it('falls back to subscription_expires_at when next_billing_date is absent', () => {
    expect(
      getSubscriptionPeriodEnd({
        next_billing_date: null,
        subscription_expires_at: '2026-09-27T00:00:00Z',
        trial_ends_at: '2026-07-27T00:00:00Z',
      })
    ).toBe('2026-09-27T00:00:00Z');
  });

  it('falls back to trial_ends_at when both billing fields are absent', () => {
    expect(
      getSubscriptionPeriodEnd({
        next_billing_date: null,
        subscription_expires_at: null,
        trial_ends_at: '2026-07-27T00:00:00Z',
      })
    ).toBe('2026-07-27T00:00:00Z');
  });

  it('returns null when every date is absent or the subscription is null', () => {
    expect(
      getSubscriptionPeriodEnd({
        next_billing_date: null,
        subscription_expires_at: null,
        trial_ends_at: null,
      })
    ).toBeNull();
    expect(getSubscriptionPeriodEnd(null)).toBeNull();
    expect(getSubscriptionPeriodEnd(undefined)).toBeNull();
  });

  it('treats an empty-string field as absent rather than returning it', () => {
    expect(
      getSubscriptionPeriodEnd({
        next_billing_date: '',
        subscription_expires_at: '2026-09-27T00:00:00Z',
        trial_ends_at: null,
      })
    ).toBe('2026-09-27T00:00:00Z');
  });
});

/**
 * FIX-Task-47 item 2 (2026-09-16) — the subscription read is now deduped in-flight.
 *
 * MySubscriptionScreen and UpgradePlanScreen each run `useSubscription()` (one read
 * apiece) and ManageKidsClubScreen reads directly, so moving between subscription
 * screens re-issued the identical `get_subscription_status` + `get_user_transaction_fee`
 * pair and doubled the load chain on a surface already measured at 20–50s to paint.
 */
describe('getSubscriptionSummary — FIX-Task-47 item 2 (in-flight dedup)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSimulatedSubscriptionReadFailure.mockResolvedValue('none');
  });

  it('shares ONE read between concurrent calls for the same user', async () => {
    mockRpc.mockResolvedValue({ data: [{ status: 'active' }], error: null } as never);

    const [a, b] = await Promise.all([
      getSubscriptionSummary('user-1'),
      getSubscriptionSummary('user-1'),
    ]);

    expect(a).toEqual(b);
    // Before the fix this was 2 (one status RPC per caller).
    const statusCalls = mockRpc.mock.calls.filter((call) => call[0] === 'get_subscription_status');
    expect(statusCalls).toHaveLength(1);
  });

  it('never lets one user adopt another user\'s in-flight result', async () => {
    mockRpc.mockResolvedValue({ data: [{ status: 'active' }], error: null } as never);

    await Promise.all([
      getSubscriptionSummary('user-1'),
      getSubscriptionSummary('user-2'),
    ]);

    const statusCalls = mockRpc.mock.calls.filter((call) => call[0] === 'get_subscription_status');
    expect(statusCalls).toHaveLength(2);
    expect(statusCalls.map((call) => (call[1] as { p_user_id: string }).p_user_id).sort()).toEqual([
      'user-1',
      'user-2',
    ]);
  });
});

/**
 * FIX-Task-53 item 3 (2026-09-17) — the canonical status predicates.
 *
 * One predicate per SEMANTIC. `subscriptions.status` legally admits two spellings of
 * the grace state, and ad-hoc literal lists drifted until a grace user was offered SP
 * by the UI and refused by the server. These tests pin the two-spelling tolerance AND
 * the deliberate SEPARATION between membership benefits and the fee tier — collapsing
 * those two would silently change what a grace buyer is charged.
 */
describe('Subscription status predicates — FIX-Task-53 item 3', () => {
  describe('isGraceStatus', () => {
    it('accepts BOTH spellings', () => {
      expect(isGraceStatus('grace_period')).toBe(true);
      expect(isGraceStatus('grace')).toBe(true);
    });

    it('rejects every non-grace status and nullish input', () => {
      for (const status of ['free', 'trial', 'active', 'paused', 'cancelled', 'expired']) {
        expect(isGraceStatus(status)).toBe(false);
      }
      expect(isGraceStatus(null)).toBe(false);
      expect(isGraceStatus(undefined)).toBe(false);
    });
  });

  describe('isSubscriberStatus (membership BENEFITS)', () => {
    it('is TRUE for grace in both spellings — grace keeps Kids Club+ benefits (R6)', () => {
      expect(isSubscriberStatus('grace_period')).toBe(true);
      expect(isSubscriberStatus('grace')).toBe(true);
    });

    it('is TRUE for every paying/retained status', () => {
      for (const status of ['trial', 'active', 'paused', 'cancelled', 'canceled']) {
        expect(isSubscriberStatus(status)).toBe(true);
      }
    });

    it('is FALSE for free/expired/unknown — fail closed', () => {
      expect(isSubscriberStatus('free')).toBe(false);
      expect(isSubscriberStatus('expired')).toBe(false);
      expect(isSubscriberStatus('unknown')).toBe(false);
      expect(isSubscriberStatus(null)).toBe(false);
      expect(isSubscriberStatus(undefined)).toBe(false);
    });
  });

  describe('isFeeActiveMemberStatus (the SERVER fee tier)', () => {
    it('matches fn_get_buyer_fee_for_checkout exactly: trial | active ONLY', () => {
      expect(isFeeActiveMemberStatus('trial')).toBe(true);
      expect(isFeeActiveMemberStatus('active')).toBe(true);

      // The load-bearing negative: a grace buyer is billed the NON-member tier
      // (explicit owner decision), so the fee helper must NOT follow the
      // membership flag. If this ever returns true, the client would display a fee
      // the server will not charge.
      expect(isFeeActiveMemberStatus('grace_period')).toBe(false);
      expect(isFeeActiveMemberStatus('grace')).toBe(false);
      expect(isFeeActiveMemberStatus('paused')).toBe(false);
      expect(isFeeActiveMemberStatus('cancelled')).toBe(false);
      expect(isFeeActiveMemberStatus('free')).toBe(false);
    });

    it('is deliberately NARROWER than isSubscriberStatus', () => {
      expect(isSubscriberStatus('grace_period')).toBe(true);
      expect(isFeeActiveMemberStatus('grace_period')).toBe(false);
    });
  });

  describe('canSpendSpStatus (R6 SP entitlement)', () => {
    it('allows grace to keep SPENDING existing points', () => {
      expect(canSpendSpStatus('grace_period')).toBe(true);
      expect(canSpendSpStatus('grace')).toBe(true);
    });

    it('allows the paying statuses and refuses free/expired', () => {
      for (const status of ['trial', 'active', 'paused', 'cancelled', 'canceled']) {
        expect(canSpendSpStatus(status)).toBe(true);
      }
      expect(canSpendSpStatus('free')).toBe(false);
      expect(canSpendSpStatus('expired')).toBe(false);
    });
  });

  describe('buyerSubscriptionSnapshotStatus', () => {
    it('records the CANONICAL grace spelling — the FIX-Task-53 item 1 defect', () => {
      expect(buyerSubscriptionSnapshotStatus('grace_period')).toBe('grace_period');
      // Defensive: the legacy alias must never be written into a trade row.
      expect(buyerSubscriptionSnapshotStatus('grace')).toBe('grace_period');
    });

    it('preserves the historical narrowing for every other status', () => {
      expect(buyerSubscriptionSnapshotStatus('active')).toBe('active');
      expect(buyerSubscriptionSnapshotStatus('trial')).toBe('trial');
      // Unchanged from before this fix — only grace gained a value.
      expect(buyerSubscriptionSnapshotStatus('paused')).toBe('free');
      expect(buyerSubscriptionSnapshotStatus('cancelled')).toBe('free');
      expect(buyerSubscriptionSnapshotStatus('free')).toBe('free');
      expect(buyerSubscriptionSnapshotStatus(undefined)).toBe('free');
    });
  });
});
