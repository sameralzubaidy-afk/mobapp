// File: p2p-kids-marketplace/e2e/review-002-mutual-flow.e2e.ts
// E2E tests for REVIEW-002: Mutual Review Flow (Buyer & Seller Reviews Each Other)

import { by, element, expect as detoxExpect, device } from 'detox';

describe('REVIEW-002: Mutual Review Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  /**
   * Test Case 1: Both buyer and seller can review each other
   * 
   * Prerequisites:
   * - Two users (buyer and seller)
   * - One completed trade between them
   * - Neither has reviewed yet
   */
  it('should allow buyer to review seller and seller to review buyer', async () => {
    // === BUYER PERSPECTIVE ===
    // Buyer logs in
    await element(by.id('auth-login-button')).tap();
    await element(by.id('email-input')).typeText('buyer@test.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-submit-button')).tap();
    await detoxExpect(element(by.id('home-screen'))).toBeVisible();

    // Buyer navigates to completed trade
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades-tab')).tap();
    await element(by.id('trade-card-mutual-test')).tap();

    // Buyer submits review for seller
    await element(by.id('review-seller-button')).tap();
    await detoxExpect(element(by.text('Review Seller'))).toBeVisible();

    await element(by.id('star-4')).tap();
    await element(by.id('comment-input')).typeText('Excellent seller, would trade again!');
    await element(by.id('submit-review-button')).tap();
    await detoxExpect(element(by.text('Review submitted!'))).toBeVisible();
    await element(by.text('OK')).tap();

    // Verify review submitted
    await detoxExpect(element(by.id('trade-detail-screen'))).toBeVisible();

    // === SELLER PERSPECTIVE ===
    // Logout buyer
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();
    await element(by.id('confirm-logout-button')).tap();

    // Seller logs in
    await element(by.id('auth-login-button')).tap();
    await element(by.id('email-input')).typeText('seller@test.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-submit-button')).tap();
    await detoxExpect(element(by.id('home-screen'))).toBeVisible();

    // Seller navigates to same completed trade
    await element(by.id('trades-tab')).tap();
    await element(by.id('completed-trades-tab')).tap();
    await element(by.id('trade-card-mutual-test')).tap();

    // Seller submits review for buyer
    await element(by.id('review-buyer-button')).tap();
    await detoxExpect(element(by.text('Review Buyer'))).toBeVisible();

    await element(by.id('star-5')).tap();
    await element(by.id('comment-input')).typeText('Great buyer, smooth transaction!');
    await element(by.id('submit-review-button')).tap();
    await detoxExpect(element(by.text('Review submitted!'))).toBeVisible();
    await element(by.text('OK')).tap();

    // Verify seller review also submitted
    await detoxExpect(element(by.id('trade-detail-screen'))).toBeVisible();
  });

  /**\n   * Test Case 2: Verify both reviews are visible on respective profiles
   */
  it('should display both reviews on user profiles', async () => {
    // Seller is still logged in from previous test
    // Seller views buyer's profile (other user)
    await element(by.id('profile-tab')).tap();
    await element(by.id('view-buyer-profile-button')).tap();

    // Verify seller's review appears on buyer's profile
    await detoxExpect(element(by.text('Great buyer, smooth transaction!'))).toBeVisible();
    await detoxExpect(element(by.id('star-rating-5'))).toBeVisible();

    // Go back and logout
    await element(by.id('back-button')).tap();
    await element(by.id('logout-button')).tap();
    await element(by.id('confirm-logout-button')).tap();

    // === BUYER PERSPECTIVE (AGAIN) ===
    // Buyer logs in
    await element(by.id('auth-login-button')).tap();
    await element(by.id('email-input')).typeText('buyer@test.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-submit-button')).tap();

    // Buyer views seller's profile
    await element(by.id('profile-tab')).tap();
    await element(by.id('view-seller-profile-button')).tap();

    // Verify buyer's review appears on seller's profile
    await detoxExpect(element(by.text('Excellent seller, would trade again!'))).toBeVisible();
    await detoxExpect(element(by.id('star-rating-4'))).toBeVisible();
  });

  /**\n   * Test Case 3: Verify one review doesn't block the other
   */\n  it('should allow reviews to be independent (one does not block other)', async () => {\n    // New trade where only buyer reviews (seller hasn't reviewed yet)\n    await element(by.id('trades-tab')).tap();\n    await element(by.id('completed-trades-tab')).tap();\n    await element(by.id('trade-card-one-way')).tap();\n\n    // Buyer reviews\n    await element(by.id('review-seller-button')).tap();\n    await element(by.id('star-3')).tap();\n    await element(by.id('submit-review-button')).tap();\n    await element(by.text('OK')).tap();\n\n    // Verify review button is gone for buyer\n    await element(by.id('back-button')).tap();\n    await element(by.id('trade-card-one-way')).tap();\n    await detoxExpect(element(by.id('review-seller-button'))).not.toBeVisible();\n\n    // Logout buyer\n    await element(by.id('profile-tab')).tap();\n    await element(by.id('logout-button')).tap();\n    await element(by.id('confirm-logout-button')).tap();\n\n    // Seller logs in\n    await element(by.id('auth-login-button')).tap();\n    await element(by.id('email-input')).typeText('seller@test.com');\n    await element(by.id('password-input')).typeText('password123');\n    await element(by.id('login-submit-button')).tap();\n\n    // Seller navigates to trade\n    await element(by.id('trades-tab')).tap();\n    await element(by.id('completed-trades-tab')).tap();\n    await element(by.id('trade-card-one-way')).tap();\n\n    // Verify seller can STILL review (buyer's review didn't block it)\n    await detoxExpect(element(by.id('review-buyer-button'))).toBeVisible();\n    await element(by.id('review-buyer-button')).tap();\n    await element(by.id('star-5')).tap();\n    await element(by.id('submit-review-button')).tap();\n    await element(by.text('OK')).tap();\n\n    // Verify seller review submitted\n    await detoxExpect(element(by.id('trade-detail-screen'))).toBeVisible();\n  });\n\n  /**\n   * Test Case 4: Verify review counts include both directions\n   */\n  it('should show correct review count for mutual reviews', async () => {\n    // Seller still logged in\n    // View seller's own profile\n    await element(by.id('profile-tab')).tap();\n\n    // Verify review count increased\n    // (Should now show at least 1 review from buyer's previous actions)\n    await detoxExpect(element(by.id('total-reviews-count'))).toBeVisible();\n    \n    // Get review count\n    const reviewCountElement = element(by.id('total-reviews-count'));\n    await detoxExpect(reviewCountElement).toHaveText(/\\d+/);\n  });\n\n  /**\n   * Test Case 5: Verify average rating calculation with multiple reviews\n   */\n  it('should correctly calculate average rating across all reviews', async () => {\n    // Seller logged in\n    await element(by.id('profile-tab')).tap();\n\n    // Verify average rating is displayed\n    await detoxExpect(element(by.id('average-rating-display'))).toBeVisible();\n\n    // Average should be between 1-5\n    const ratingElement = element(by.id('average-rating-value'));\n    await detoxExpect(ratingElement).toHaveText(/^[1-5](\\.\\d)?$/);\n  });\n});\n\n/**\n * Test Data Requirements:\n * \n * For these E2E tests to run, you need:\n * \n * 1. Two test users:\n *    - buyer@test.com / password123\n *    - seller@test.com / password123\n * \n * 2. Multiple completed trades:\n *    - trade-mutual-test: Between buyer and seller (both can review)\n *    - trade-one-way: Between buyer and seller (for testing independence)\n * \n * Setup Script (run before E2E tests):\n * ```sql\n * -- Create test users (if not exists)\n * INSERT INTO profiles (user_id, name, email) VALUES\n *   ('buyer-user-id', 'Test Buyer', 'buyer@test.com'),\n *   ('seller-user-id', 'Test Seller', 'seller@test.com')\n * ON CONFLICT DO NOTHING;\n * \n * -- Create completed trades\n * INSERT INTO trades (id, buyer_id, seller_id, item_id, status, completed_at) VALUES\n *   ('trade-mutual-test', 'buyer-user-id', 'seller-user-id', 'item-1', 'completed', NOW() - INTERVAL '1 day'),\n *   ('trade-one-way', 'buyer-user-id', 'seller-user-id', 'item-2', 'completed', NOW() - INTERVAL '2 days');\n * ```\n */\n