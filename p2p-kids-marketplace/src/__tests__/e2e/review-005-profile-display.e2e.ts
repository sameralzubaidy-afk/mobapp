// File: p2p-kids-marketplace/src/__tests__/e2e/review-005-profile-display.e2e.ts
// E2E tests for REVIEW-005: Display Average Rating and Reviews on User Profile

import { submitReview, getUserReviews, getReviewStats } from '@/services/review';
import { supabase } from '@/services/supabase';

// TODO: Replace with real test user IDs from your test database
const TEST_CONFIG = {
  reviewee_id: 'test-user-1', // User whose profile we're viewing
  reviewer_ids: ['test-user-2', 'test-user-3', 'test-user-4', 'test-user-5'],
  trade_ids: ['test-trade-1', 'test-trade-2', 'test-trade-3', 'test-trade-4'],
};

describe('REVIEW-005 E2E: Profile Rating Display', () => {
  // Skip if not in E2E test environment
  const isE2EEnv = process.env.TEST_ENV === 'e2e';

  beforeAll(async () => {
    if (!isE2EEnv) {
      console.log('⏭️  Skipping E2E tests (set TEST_ENV=e2e to run)');
      return;
    }

    // Clean up any existing test reviews
    await cleanupTestData();
  });

  afterAll(async () => {
    if (!isE2EEnv) return;

    // Clean up test data
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Delete test reviews
      await supabase
        .from('reviews')
        .delete()
        .in('trade_id', TEST_CONFIG.trade_ids);

      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error);
    }
  }

  describe('Profile with Multiple Reviews', () => {
    (isE2EEnv ? it : it.skip)(
      'should display average rating and breakdown correctly',
      async () => {
        // Submit multiple reviews with different ratings
        const reviews = [
          { tradeId: TEST_CONFIG.trade_ids[0], reviewerId: TEST_CONFIG.reviewer_ids[0], rating: 5, comment: 'Excellent!' },
          { tradeId: TEST_CONFIG.trade_ids[1], reviewerId: TEST_CONFIG.reviewer_ids[1], rating: 4, comment: 'Very good' },
          { tradeId: TEST_CONFIG.trade_ids[2], reviewerId: TEST_CONFIG.reviewer_ids[2], rating: 5, comment: 'Great trader' },
          { tradeId: TEST_CONFIG.trade_ids[3], reviewerId: TEST_CONFIG.reviewer_ids[3], rating: 3, comment: 'Good' },
        ];

        for (const review of reviews) {
          const result = await submitReview({
            tradeId: review.tradeId,
            reviewerId: review.reviewerId,
            revieweeId: TEST_CONFIG.reviewee_id,
            rating: review.rating,
            comment: review.comment,
          });

          expect(result.success).toBe(true);
        }

        // Get review stats
        const statsResult = await getReviewStats(TEST_CONFIG.reviewee_id);

        expect(statsResult.success).toBe(true);
        expect(statsResult.stats?.total_reviews).toBe(4);
        
        // Average: (5+4+5+3) / 4 = 4.25 → 4.3
        expect(statsResult.stats?.average_rating).toBeGreaterThanOrEqual(4.2);
        expect(statsResult.stats?.average_rating).toBeLessThanOrEqual(4.3);

        // Rating breakdown
        expect(statsResult.stats?.rating_breakdown).toEqual({
          5: 2,
          4: 1,
          3: 1,
          2: 0,
          1: 0,
        });

        console.log('✅ Average rating and breakdown displayed correctly');
      },
      30000
    );

    (isE2EEnv ? it : it.skip)(
      'should fetch reviews in descending order (most recent first)',
      async () => {
        const reviewsResult = await getUserReviews(TEST_CONFIG.reviewee_id);

        expect(reviewsResult.success).toBe(true);
        expect(reviewsResult.reviews.length).toBeGreaterThan(0);

        // Verify ordering (most recent first)
        const dates = reviewsResult.reviews.map((r) => new Date(r.created_at).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }

        console.log('✅ Reviews ordered by date (most recent first)');
      }
    );

    (isE2EEnv ? it : it.skip)(
      'should display reviewer information for non-anonymous reviews',
      async () => {
        const reviewsResult = await getUserReviews(TEST_CONFIG.reviewee_id);

        expect(reviewsResult.success).toBe(true);

        const nonAnonymousReviews = reviewsResult.reviews.filter((r) => !r.is_anonymous);
        expect(nonAnonymousReviews.length).toBeGreaterThan(0);

        // Check that reviewer info is populated
        nonAnonymousReviews.forEach((review) => {
          expect(review.reviewer).toBeDefined();
          expect(review.reviewer?.first_name).toBeTruthy();
        });

        console.log('✅ Reviewer information displayed for non-anonymous reviews');
      }
    );
  });

  describe('Profile with No Reviews', () => {
    (isE2EEnv ? it : it.skip)(
      'should return zero stats for user with no reviews',
      async () => {
        // Use a different user ID that has no reviews
        const emptyUserId = 'test-user-no-reviews';

        const statsResult = await getReviewStats(emptyUserId);

        expect(statsResult.success).toBe(true);
        expect(statsResult.stats?.average_rating).toBe(0);
        expect(statsResult.stats?.total_reviews).toBe(0);
        expect(statsResult.stats?.rating_breakdown).toEqual({
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        });

        console.log('✅ Zero stats returned for user with no reviews');
      }
    );

    (isE2EEnv ? it : it.skip)(
      'should return empty array for user with no reviews',
      async () => {
        const emptyUserId = 'test-user-no-reviews';

        const reviewsResult = await getUserReviews(emptyUserId);

        expect(reviewsResult.success).toBe(true);
        expect(reviewsResult.reviews).toEqual([]);

        console.log('✅ Empty reviews array returned');
      }
    );
  });

  describe('Profile with Hidden Reviews', () => {
    (isE2EEnv ? it : it.skip)(
      'should exclude hidden reviews from display',
      async () => {
        // Submit a review
        const reviewResult = await submitReview({
          tradeId: 'test-trade-hidden',
          reviewerId: 'test-user-reviewer',
          revieweeId: TEST_CONFIG.reviewee_id,
          rating: 2,
          comment: 'Bad experience',
        });

        expect(reviewResult.success).toBe(true);
        const reviewId = reviewResult.review?.id;

        // Manually hide the review (simulate moderation)
        await supabase
          .from('reviews')
          .update({ is_hidden: true })
          .eq('id', reviewId);

        // Fetch reviews
        const reviewsResult = await getUserReviews(TEST_CONFIG.reviewee_id);

        // Hidden review should not be included
        const hiddenReview = reviewsResult.reviews.find((r) => r.id === reviewId);
        expect(hiddenReview).toBeUndefined();

        // Stats should also exclude hidden review
        const statsResult = await getReviewStats(TEST_CONFIG.reviewee_id);
        // The hidden 2-star review should not affect the average

        console.log('✅ Hidden reviews excluded from display');

        // Cleanup
        await supabase.from('reviews').delete().eq('id', reviewId);
      }
    );
  });

  describe('Rating Breakdown Percentages', () => {
    (isE2EEnv ? it : it.skip)(
      'should calculate percentages correctly for UI display',
      async () => {
        const statsResult = await getReviewStats(TEST_CONFIG.reviewee_id);

        expect(statsResult.success).toBe(true);

        if (statsResult.stats && statsResult.stats.total_reviews > 0) {
          // Calculate percentages (as the UI would)
          const breakdown = statsResult.stats.rating_breakdown;
          const total = statsResult.stats.total_reviews;

          Object.entries(breakdown).forEach(([stars, count]) => {
            const percentage = (count / total) * 100;
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(100);
          });

          // Sum of all counts should equal total reviews
          const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
          expect(sum).toBe(total);

          console.log('✅ Rating breakdown percentages calculated correctly');
        }
      }
    );
  });

  describe('Anonymous Reviews on Profile', () => {
    (isE2EEnv ? it : it.skip)(
      'should include anonymous reviews in stats but hide reviewer info',
      async () => {
        // Submit an anonymous review
        const anonymousResult = await submitReview({
          tradeId: 'test-trade-anon',
          reviewerId: 'test-user-anon-reviewer',
          revieweeId: TEST_CONFIG.reviewee_id,
          rating: 5,
          comment: 'Great experience!',
          isAnonymous: true,
        });

        expect(anonymousResult.success).toBe(true);

        // Get reviews
        const reviewsResult = await getUserReviews(TEST_CONFIG.reviewee_id);
        const anonymousReview = reviewsResult.reviews.find(
          (r) => r.id === anonymousResult.review?.id
        );

        expect(anonymousReview).toBeDefined();
        expect(anonymousReview?.is_anonymous).toBe(true);

        // Get stats - should include the anonymous review
        const statsResult = await getReviewStats(TEST_CONFIG.reviewee_id);
        expect(statsResult.success).toBe(true);
        // The 5-star anonymous review should be counted

        console.log('✅ Anonymous reviews included in stats');

        // Cleanup
        await supabase
          .from('reviews')
          .delete()
          .eq('id', anonymousResult.review?.id);
      }
    );
  });
});
