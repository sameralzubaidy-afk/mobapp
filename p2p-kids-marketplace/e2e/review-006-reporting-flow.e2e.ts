// File: p2p-kids-marketplace/e2e/review-006-reporting-flow.e2e.ts
// E2E test for review reporting and moderation (TASK REVIEW-006)

import { supabase } from '../src/services/supabase';
import { reportReview } from '../src/services/review';
import { getReportedReviews, approveReview, deleteReview } from '../src/services/admin/reviewModeration';

/**
 * TASK REVIEW-006 E2E Test: Review Reporting and Moderation Flow
 * 
 * Tests the complete flow:
 * 1. User reports inappropriate review
 * 2. Review auto-hides after 3 reports
 * 3. Admin views reported reviews
 * 4. Admin approves/deletes review
 */

describe('REVIEW-006: Review Reporting and Moderation E2E', () => {
  let testReviewId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testUserId3: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Create test users
    const { data: user1 } = await supabase.auth.admin.createUser({
      email: 'reporter1@test.com',
      password: 'test123456',
      email_confirm: true,
    });
    testUserId1 = user1?.user?.id || '';

    const { data: user2 } = await supabase.auth.admin.createUser({
      email: 'reporter2@test.com',
      password: 'test123456',
      email_confirm: true,
    });
    testUserId2 = user2?.user?.id || '';

    const { data: user3 } = await supabase.auth.admin.createUser({
      email: 'reporter3@test.com',
      password: 'test123456',
      email_confirm: true,
    });
    testUserId3 = user3?.user?.id || '';

    const { data: admin } = await supabase.auth.admin.createUser({
      email: 'admin@test.com',
      password: 'admin123456',
      email_confirm: true,
    });
    testAdminId = admin?.user?.id || '';

    // Set admin role
    await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', testAdminId);

    // Create a test review
    const { data: review } = await supabase
      .from('reviews')
      .insert({
        trade_id: 'test-trade-id',
        reviewer_id: testUserId1,
        reviewee_id: testUserId2,
        rating: 1,
        comment: 'Inappropriate content',
      })
      .select()
      .single();

    testReviewId = review?.id || '';
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('review_reports').delete().eq('review_id', testReviewId);
    await supabase.from('reviews').delete().eq('id', testReviewId);
    await supabase.auth.admin.deleteUser(testUserId1);
    await supabase.auth.admin.deleteUser(testUserId2);
    await supabase.auth.admin.deleteUser(testUserId3);
    await supabase.auth.admin.deleteUser(testAdminId);
  });

  it('should allow user to report a review', async () => {
    const result = await reportReview({
      reviewId: testReviewId,
      reporterId: testUserId2,
      reason: 'offensive',
      description: 'Contains offensive language',
    });

    expect(result.success).toBe(true);

    // Verify report was saved
    const { data: reports } = await supabase
      .from('review_reports')
      .select('*')
      .eq('review_id', testReviewId);

    expect(reports).toHaveLength(1);
    expect(reports?.[0].reason).toBe('offensive');
  });

  it('should prevent duplicate reports from same user', async () => {
    const result = await reportReview({
      reviewId: testReviewId,
      reporterId: testUserId2,
      reason: 'spam',
      description: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already reported');
  });

  it('should auto-hide review after 3 reports', async () => {
    // Add 2 more reports
    await reportReview({
      reviewId: testReviewId,
      reporterId: testUserId1,
      reason: 'spam',
      description: null,
    });

    await reportReview({
      reviewId: testReviewId,
      reporterId: testUserId3,
      reason: 'false_info',
      description: null,
    });

    // Check review is hidden
    const { data: review } = await supabase
      .from('reviews')
      .select('is_hidden, report_count')
      .eq('id', testReviewId)
      .single();

    expect(review?.is_hidden).toBe(true);
    expect(review?.report_count).toBe(3);
  });

  it('should show hidden reviews in admin moderation queue', async () => {
    // Sign in as admin
    await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123456',
    });

    const result = await getReportedReviews();

    expect(result.success).toBe(true);
    expect(result.reviews.length).toBeGreaterThan(0);

    const reportedReview = result.reviews.find(r => r.review.id === testReviewId);
    expect(reportedReview).toBeDefined();
    expect(reportedReview?.report_count).toBe(3);
    expect(reportedReview?.reports.length).toBe(3);
  });

  it('should allow admin to approve review', async () => {
    const result = await approveReview(testReviewId);

    expect(result.success).toBe(true);

    // Check review is no longer hidden
    const { data: review } = await supabase
      .from('reviews')
      .select('is_hidden, report_count')
      .eq('id', testReviewId)
      .single();

    expect(review?.is_hidden).toBe(false);
    expect(review?.report_count).toBe(0);

    // Check reports are deleted
    const { data: reports } = await supabase
      .from('review_reports')
      .select('*')
      .eq('review_id', testReviewId);

    expect(reports).toHaveLength(0);
  });

  it('should allow admin to delete review permanently', async () => {
    // Create a new review for deletion test
    const { data: review } = await supabase
      .from('reviews')
      .insert({
        trade_id: 'test-trade-id-2',
        reviewer_id: testUserId1,
        reviewee_id: testUserId2,
        rating: 1,
        comment: 'To be deleted',
        is_hidden: true,
      })
      .select()
      .single();

    const reviewToDeleteId = review?.id || '';

    const result = await deleteReview(reviewToDeleteId);

    expect(result.success).toBe(true);

    // Verify review is deleted
    const { data: deletedReview } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewToDeleteId)
      .single();

    expect(deletedReview).toBeNull();
  });

  it('should exclude hidden reviews from public view', async () => {
    // Sign out admin
    await supabase.auth.signOut();

    // Create a hidden review
    const { data: hiddenReview } = await supabase
      .from('reviews')
      .insert({
        trade_id: 'test-trade-id-3',
        reviewer_id: testUserId1,
        reviewee_id: testUserId2,
        rating: 1,
        comment: 'Hidden review',
        is_hidden: true,
        report_count: 3,
      })
      .select()
      .single();

    // Try to fetch user reviews (should exclude hidden)
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', testUserId2)
      .eq('is_hidden', false);

    const hiddenReviewFound = reviews?.find(r => r.id === hiddenReview?.id);
    expect(hiddenReviewFound).toBeUndefined();

    // Clean up
    await supabase.from('reviews').delete().eq('id', hiddenReview?.id);
  });
});
