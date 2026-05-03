// File: p2p-kids-marketplace/e2e/review-001-submission.e2e.ts
// E2E tests for REVIEW-001: Review Submission Flow

import { by, element, expect as detoxExpect, device } from 'detox';

describe('REVIEW-001: Review Submission Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  /**
   * Test Case 1: Submit review with rating and comment
   *
   * Prerequisites:
   * - User is logged in
   * - User has a completed trade
   * - User has not yet reviewed the trade
   */
  it('should submit review with rating and comment', async () => {
    // Navigate to completed trade
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-0')).tap();

    // Tap "Review" button
    await element(by.id('review-button')).tap();

    // Verify on SubmitReviewScreen
    await detoxExpect(element(by.text('Review'))).toBeVisible();

    // Select 5-star rating
    await element(by.id('star-5')).tap();

    // Enter comment
    await element(by.id('comment-input')).typeText('Great experience! Would trade again.');

    // Submit review
    await element(by.id('submit-review-button')).tap();

    // Verify success message
    await detoxExpect(element(by.text('Success'))).toBeVisible();
    await element(by.text('OK')).tap();

    // Verify navigated back to trade details
    await detoxExpect(element(by.id('trade-detail-screen'))).toBeVisible();
  });

  /**
   * Test Case 2: Submit review without comment (rating only)
   */
  it('should submit review with rating only', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-1')).tap();
    await element(by.id('review-button')).tap();

    // Select 4-star rating
    await element(by.id('star-4')).tap();

    // Do NOT enter comment

    // Submit review
    await element(by.id('submit-review-button')).tap();

    // Verify success
    await detoxExpect(element(by.text('Success'))).toBeVisible();
    await element(by.text('OK')).tap();
  });

  /**
   * Test Case 3: Attempt to submit without rating (should show error)
   */
  it('should show error when submitting without rating', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-2')).tap();
    await element(by.id('review-button')).tap();

    // Enter comment but no rating
    await element(by.id('comment-input')).typeText('Good experience');

    // Verify submit button is disabled
    await detoxExpect(element(by.id('submit-review-button'))).toHaveToggleValue(false);

    // Try to tap (should not work)
    await element(by.id('submit-review-button')).tap();

    // Verify error alert
    await detoxExpect(element(by.text('Rating Required'))).toBeVisible();
    await element(by.text('OK')).tap();
  });

  /**
   * Test Case 4: Character count validation (500 char limit)
   */
  it('should limit comment to 500 characters', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-3')).tap();
    await element(by.id('review-button')).tap();

    // Select rating
    await element(by.id('star-5')).tap();

    // Enter 501 characters (should be limited to 500)
    const longComment = 'a'.repeat(501);
    await element(by.id('comment-input')).typeText(longComment);

    // Verify character count shows 500/500
    await detoxExpect(element(by.id('char-count'))).toHaveText('500/500');
  });

  /**
   * Test Case 5: Submit anonymous review
   */
  it('should submit anonymous review', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-4')).tap();
    await element(by.id('review-button')).tap();

    // Select rating
    await element(by.id('star-4')).tap();

    // Enter comment
    await element(by.id('comment-input')).typeText('Prefer to stay anonymous');

    // Check anonymous checkbox
    await element(by.id('anonymous-checkbox')).tap();

    // Submit review
    await element(by.id('submit-review-button')).tap();

    // Verify success
    await detoxExpect(element(by.text('Success'))).toBeVisible();
    await element(by.text('OK')).tap();
  });

  /**
   * Test Case 6: Attempt to review same trade twice (should show error)
   */
  it('should prevent duplicate review', async () => {
    // First, submit a review
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-5')).tap();
    await element(by.id('review-button')).tap();
    await element(by.id('star-5')).tap();
    await element(by.id('submit-review-button')).tap();
    await element(by.text('OK')).tap();

    // Navigate back to trade
    await element(by.id('back-button')).tap();
    await element(by.id('trade-item-5')).tap();

    // Verify review button is no longer visible or shows "Already Reviewed"
    await detoxExpect(element(by.id('review-button'))).not.toBeVisible();
    // OR
    await detoxExpect(element(by.text('Already Reviewed'))).toBeVisible();
  });

  /**
   * Test Case 7: Review button only shown for completed trades
   */
  it('should not show review button for incomplete trades', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('active-trades')).tap();
    await element(by.id('trade-item-0')).tap();

    // Verify review button is not visible
    await detoxExpect(element(by.id('review-button'))).not.toBeVisible();
  });

  /**
   * Test Case 8: Cancel review submission
   */
  it('should allow user to cancel review submission', async () => {
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades')).tap();
    await element(by.id('trade-item-6')).tap();
    await element(by.id('review-button')).tap();

    // Start filling review
    await element(by.id('star-3')).tap();
    await element(by.id('comment-input')).typeText('Starting review...');

    // Tap back button
    await element(by.id('back-button')).tap();

    // Verify navigated back to trade details
    await detoxExpect(element(by.id('trade-detail-screen'))).toBeVisible();
  });
});

/**
 * Test Data Requirements:
 *
 * For these E2E tests to run, you need:
 *
 * 1. At least 7 completed trades for the test user
 * 2. Test user must be either buyer or seller in each trade
 * 3. Trades should be in various states:
 *    - Some already reviewed
 *    - Some not yet reviewed
 *    - Some still in progress (not completed)
 *
 * Setup Script (run before E2E tests):
 * ```sql
 * -- Create test trades
 * INSERT INTO trades (id, buyer_id, seller_id, item_id, status, completed_at)
 * VALUES
 *   ('test-trade-1', 'test-user-1', 'test-user-2', 'item-1', 'completed', NOW() - INTERVAL '1 day'),
 *   ('test-trade-2', 'test-user-1', 'test-user-3', 'item-2', 'completed', NOW() - INTERVAL '2 days'),
 *   ('test-trade-3', 'test-user-1', 'test-user-4', 'item-3', 'completed', NOW() - INTERVAL '3 days'),
 *   ('test-trade-4', 'test-user-1', 'test-user-5', 'item-4', 'completed', NOW() - INTERVAL '4 days'),
 *   ('test-trade-5', 'test-user-1', 'test-user-6', 'item-5', 'completed', NOW() - INTERVAL '5 days'),
 *   ('test-trade-6', 'test-user-1', 'test-user-7', 'item-6', 'completed', NOW() - INTERVAL '6 days'),
 *   ('test-trade-7', 'test-user-1', 'test-user-8', 'item-7', 'in_progress', NULL);
 * ```
 */
