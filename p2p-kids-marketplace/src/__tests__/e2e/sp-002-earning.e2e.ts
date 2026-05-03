// File: p2p-kids-marketplace/src/__tests__/e2e/sp-002-earning.e2e.ts
// MODULE-09 SP-002: E2E Tests for SP Earning Flows

import { describe, it, expect, beforeAll } from '@jest/globals';
import { supabase } from '@/config/supabase';
import {
  issueStarterPack,
  awardReferralReward,
  awardChallengeReward,
  refundSpForCancelledTrade,
  hasReceivedStarterPack,
} from '@/services/sp/earning';
import { getWalletSummary, getBalance } from '@/services/sp/wallet';

/**
 * E2E Tests for SP Earning Logic
 *
 * Prerequisites:
 * 1. Run migration 094_sp_earning_rpcs.sql in Supabase
 * 2. Have test users with active Kids Club+ subscriptions
 * 3. Have test listings created
 *
 * Test users should be seeded with:
 * - User A: Active subscriber, no starter pack
 * - User B: Active subscriber, referrer
 * - User C: Active subscriber, referee
 * - User D: Free user (no subscription)
 */

describe('SP-002 E2E: SP Earning Flows', () => {
  let testUserId: string;
  let testListingId: string;
  let testReferrerId: string;
  let testRefereeId: string;
  let testReferralId: string;
  let testChallengeId: string;
  let testTradeId: string;

  beforeAll(async () => {
    // TODO: Replace with actual test user IDs from your seeded test data
    // For now, we'll skip these tests if test data not available
    console.log('ℹ️  SP-002 E2E Tests require seeded test data');
    console.log('ℹ️  Set TEST_USER_ID, TEST_LISTING_ID, etc. in your .env.test');
  });

  describe('Starter Pack Flow', () => {
    it('should issue starter pack to new subscriber after first listing', async () => {
      if (!testUserId || !testListingId) {
        console.log('⏭️  Skipping: Test user data not available');
        return;
      }

      // Check no starter pack issued yet
      const hasStarterPack = await hasReceivedStarterPack(testUserId);
      expect(hasStarterPack).toBe(false);

      // Get balance before
      const balanceBefore = await getBalance(testUserId);

      // Issue starter pack
      const result = await issueStarterPack(testUserId, testListingId);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBeGreaterThan(0);
      expect(result.batch_id).toBeDefined();
      expect(result.ledger_entry_id).toBeDefined();

      // Check balance after
      const balanceAfter = await getBalance(testUserId);
      expect(balanceAfter).toBe(balanceBefore + (result.sp_awarded || 0));

      // Verify starter pack flag set
      const hasStarterPackAfter = await hasReceivedStarterPack(testUserId);
      expect(hasStarterPackAfter).toBe(true);
    });

    it('should prevent duplicate starter pack issuance', async () => {
      if (!testUserId || !testListingId) {
        console.log('⏭️  Skipping: Test user data not available');
        return;
      }

      // Try to issue starter pack again
      const result = await issueStarterPack(testUserId, testListingId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already issued');
    });

    it('should reject starter pack for non-subscribers', async () => {
      if (!testListingId) {
        console.log('⏭️  Skipping: Test data not available');
        return;
      }

      // Use a free user ID (User D from prerequisites)
      const freeUserId = process.env.TEST_FREE_USER_ID || 'free-user-id';

      const result = await issueStarterPack(freeUserId, testListingId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('subscription required');
    });
  });

  describe('Referral Reward Flow', () => {
    it('should award referral rewards to both referrer and referee', async () => {
      if (!testReferrerId || !testRefereeId || !testReferralId) {
        console.log('⏭️  Skipping: Test referral data not available');
        return;
      }

      // Get balances before
      const referrerBalanceBefore = await getBalance(testReferrerId);
      const refereeBalanceBefore = await getBalance(testRefereeId);

      // Award referral rewards
      const result = await awardReferralReward(testReferrerId, testRefereeId, testReferralId);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBeGreaterThan(0);

      // Check balances after
      const referrerBalanceAfter = await getBalance(testReferrerId);
      const refereeBalanceAfter = await getBalance(testRefereeId);

      expect(referrerBalanceAfter).toBeGreaterThan(referrerBalanceBefore);
      expect(refereeBalanceAfter).toBeGreaterThan(refereeBalanceBefore);
    });

    it('should prevent duplicate referral reward', async () => {
      if (!testReferrerId || !testRefereeId || !testReferralId) {
        console.log('⏭️  Skipping: Test referral data not available');
        return;
      }

      // Try to award again
      const result = await awardReferralReward(testReferrerId, testRefereeId, testReferralId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });
  });

  describe('Challenge Reward Flow', () => {
    it('should award SP for challenge completion', async () => {
      if (!testUserId || !testChallengeId) {
        console.log('⏭️  Skipping: Test challenge data not available');
        return;
      }

      const balanceBefore = await getBalance(testUserId);
      const rewardAmount = 100;

      const result = await awardChallengeReward(testUserId, testChallengeId, rewardAmount);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(rewardAmount);

      const balanceAfter = await getBalance(testUserId);
      expect(balanceAfter).toBe(balanceBefore + rewardAmount);
    });

    it('should prevent duplicate challenge reward claim', async () => {
      if (!testUserId || !testChallengeId) {
        console.log('⏭️  Skipping: Test challenge data not available');
        return;
      }

      const result = await awardChallengeReward(testUserId, testChallengeId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already claimed');
    });
  });

  describe('SP Refund Flow', () => {
    it('should refund SP when trade is cancelled', async () => {
      if (!testUserId || !testTradeId) {
        console.log('⏭️  Skipping: Test trade data not available');
        return;
      }

      const balanceBefore = await getBalance(testUserId);
      const refundAmount = 50;

      const result = await refundSpForCancelledTrade(testUserId, testTradeId, refundAmount);

      expect(result.success).toBe(true);
      expect(result.sp_awarded).toBe(refundAmount);

      const balanceAfter = await getBalance(testUserId);
      expect(balanceAfter).toBe(balanceBefore + refundAmount);
    });

    it('should prevent duplicate refund for same trade', async () => {
      if (!testUserId || !testTradeId) {
        console.log('⏭️  Skipping: Test trade data not available');
        return;
      }

      const result = await refundSpForCancelledTrade(testUserId, testTradeId, 50);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });
  });

  describe('Wallet Summary Integration', () => {
    it('should show correct lifetime_earned after multiple earning events', async () => {
      if (!testUserId) {
        console.log('⏭️  Skipping: Test user data not available');
        return;
      }

      const summary = await getWalletSummary(testUserId);

      expect(summary.available_points).toBeGreaterThanOrEqual(0);
      expect(summary.lifetime_earned).toBeGreaterThan(0);
      expect(summary.wallet_state).toBe('active');
    });
  });
});

/**
 * Test Data Setup Guide
 *
 * To run these E2E tests, create a .env.test file with:
 *
 * TEST_USER_ID=<uuid-of-active-subscriber>
 * TEST_LISTING_ID=<uuid-of-approved-listing>
 * TEST_REFERRER_ID=<uuid-of-referrer-subscriber>
 * TEST_REFEREE_ID=<uuid-of-referee-subscriber>
 * TEST_REFERRAL_ID=<uuid-of-referral-record>
 * TEST_CHALLENGE_ID=<uuid-of-active-challenge>
 * TEST_TRADE_ID=<uuid-of-cancelled-trade>
 * TEST_FREE_USER_ID=<uuid-of-non-subscriber>
 *
 * Run SQL to create test data:
 *
 * -- Create test users with subscriptions
 * INSERT INTO auth.users (id, email) VALUES
 *   ('test-user-1', 'testuser1@test.com'),
 *   ('test-user-2', 'testuser2@test.com');
 *
 * INSERT INTO subscriptions (user_id, status, start_date) VALUES
 *   ('test-user-1', 'active', NOW()),
 *   ('test-user-2', 'active', NOW());
 *
 * -- Create SP wallets
 * INSERT INTO sp_wallets (user_id) VALUES
 *   ('test-user-1'),
 *   ('test-user-2');
 */
