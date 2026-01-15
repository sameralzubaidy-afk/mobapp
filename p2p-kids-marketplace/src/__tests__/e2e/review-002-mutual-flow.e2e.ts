// File: p2p-kids-marketplace/src/__tests__/e2e/review-002-mutual-flow.e2e.ts
// TASK REVIEW-002 E2E Tests: Mutual Review Flow

import { submitReview, getTradeReviewStatus, canReviewUser } from '@/services/review';
import { supabase } from '@/services/supabase/client';

/**
 * E2E TEST: REVIEW-002 - Mutual Review Flow
 * 
 * Tests the complete flow where both buyer and seller review each other
 * after trade completion.
 * 
 * Prerequisites:
 * - Completed trade exists (trade ID provided)
 * - Buyer and seller user accounts exist
 * - Review permissions configured
 * 
 * Test Flow:
 * 1. Buyer reviews seller
 * 2. Verify buyer review status
 * 3. Seller reviews buyer
 * 4. Verify mutual review status
 * 5. Verify both reviews visible on profiles
 */

describe('E2E: REVIEW-002 - Mutual Review Flow', () => {
  // Test data (replace with real test data in production DB)
  const testTradeId = 'TEST-TRADE-ID'; // Replace with actual completed trade ID
  const buyerId = 'TEST-BUYER-ID'; // Replace with actual buyer user ID
  const sellerId = 'TEST-SELLER-ID'; // Replace with actual seller user ID

  // Skip tests if running in CI without test data
  const skipIfNoTestData = process.env.CI && !process.env.E2E_TEST_DATA_AVAILABLE;

  beforeAll(async () => {
    if (skipIfNoTestData) {
      console.log('⚠️  Skipping E2E tests - no test data available');
      return;
    }

    // Cleanup any existing test reviews
    await supabase
      .from('reviews')
      .delete()
      .eq('trade_id', testTradeId);
  });

  afterAll(async () => {
    if (skipIfNoTestData) return;

    // Cleanup test reviews
    await supabase
      .from('reviews')
      .delete()
      .eq('trade_id', testTradeId);
  });

  it('should allow buyer to review seller', async () => {
    if (skipIfNoTestData) {
      console.log('Test skipped - no test data');
      return;
    }

    // Check if buyer can review
    const canReview = await canReviewUser(testTradeId, buyerId);
    expect(canReview.success).toBe(true);
    expect(canReview.canReview).toBe(true);

    // Buyer submits review for seller
    const result = await submitReview({
      tradeId: testTradeId,
      reviewerId: buyerId,
      revieweeId: sellerId,
      rating: 5,
      comment: 'Great seller! Item as described.',
      isAnonymous: false,
    });

    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();
    expect(result.review?.rating).toBe(5);

    // Verify review status
    const status = await getTradeReviewStatus(testTradeId, buyerId);
    expect(status.success).toBe(true);
    expect(status.userReviewed).toBe(true);
    expect(status.otherUserReviewed).toBe(false);
  });

  it('should prevent buyer from reviewing twice', async () => {
    if (skipIfNoTestData) {
      console.log('Test skipped - no test data');
      return;
    }

    // Attempt to submit duplicate review
    const result = await submitReview({
      tradeId: testTradeId,
      reviewerId: buyerId,
      revieweeId: sellerId,
      rating: 4,
      comment: 'Trying to review again',
      isAnonymous: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already reviewed');
  });

  it('should allow seller to review buyer independently', async () => {
    if (skipIfNoTestData) {
      console.log('Test skipped - no test data');
      return;
    }

    // Check if seller can review
    const canReview = await canReviewUser(testTradeId, sellerId);
    expect(canReview.success).toBe(true);
    expect(canReview.canReview).toBe(true);

    // Seller submits review for buyer
    const result = await submitReview({
      tradeId: testTradeId,
      reviewerId: sellerId,
      revieweeId: buyerId,
      rating: 4,
      comment: 'Good buyer, smooth transaction.',
      isAnonymous: false,
    });

    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();
    expect(result.review?.rating).toBe(4);

    // Verify mutual review status
    const buyerStatus = await getTradeReviewStatus(testTradeId, buyerId);
    expect(buyerStatus.success).toBe(true);
    expect(buyerStatus.userReviewed).toBe(true);
    expect(buyerStatus.otherUserReviewed).toBe(true);

    const sellerStatus = await getTradeReviewStatus(testTradeId, sellerId);
    expect(sellerStatus.success).toBe(true);
    expect(sellerStatus.userReviewed).toBe(true);
    expect(sellerStatus.otherUserReviewed).toBe(true);
  });

  it('should show both reviews are complete', async () => {
    if (skipIfNoTestData) {
      console.log('Test skipped - no test data');
      return;
    }

    // Check buyer can no longer review
    const buyerCanReview = await canReviewUser(testTradeId, buyerId);
    expect(buyerCanReview.success).toBe(true);
    expect(buyerCanReview.canReview).toBe(false);
    expect(buyerCanReview.reason).toContain('already reviewed');

    // Check seller can no longer review
    const sellerCanReview = await canReviewUser(testTradeId, sellerId);
    expect(sellerCanReview.success).toBe(true);
    expect(sellerCanReview.canReview).toBe(false);
    expect(sellerCanReview.reason).toContain('already reviewed');
  });
});

/**
 * To run this E2E test against production Supabase:
 * 
 * 1. Set up test data:
 *    - Create a completed trade in Supabase
 *    - Note the trade ID, buyer ID, and seller ID
 * 
 * 2. Update test constants:
 *    - Replace TEST-TRADE-ID with actual trade ID
 *    - Replace TEST-BUYER-ID with actual buyer user ID
 *    - Replace TEST-SELLER-ID with actual seller user ID
 * 
 * 3. Run the test:
 *    npm test -- review-002-mutual-flow.e2e.ts
 * 
 * 4. Verify results:
 *    - Check Supabase reviews table for both reviews
 *    - Verify mutual review status on TradeDetailScreen
 *    - Verify reviews display on both user profiles
 */
