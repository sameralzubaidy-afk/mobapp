// File: p2p-kids-marketplace/src/services/review.ts
// Review service for MODULE-08-REVIEWS-RATINGS (TASK REVIEW-001)

import { supabase } from './supabase';
import { resolveAvatarUrl } from '@/services/profile';

export interface Review {
  id: string;
  trade_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  is_anonymous: boolean;
  is_hidden: boolean;
  report_count: number;
  created_at: string;
  updated_at: string;
  reviewer?: {
    first_name: string;
    last_name: string;
    profile_image_url: string | null;
    verification_status?: 'none' | 'pending' | 'approved';
  };
}

async function buildReviewerFromProfile(profile: any): Promise<Review['reviewer']> {
  const fullName = (profile?.name || 'User').trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  let avatarUrl: string | null = null;
  if (profile?.avatar_url) {
    try {
      avatarUrl = await resolveAvatarUrl(profile.avatar_url);
    } catch (error) {
      console.error('Failed to resolve reviewer avatar URL:', error);
    }
  }
  return {
    first_name: firstName || 'User',
    last_name: rest.join(' '),
    profile_image_url: avatarUrl,
    verification_status: profile?.verification_status || 'none',
  };
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_breakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface SubmitReviewParams {
  tradeId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  isAnonymous?: boolean;
}

/**
 * Submit a review for a completed trade
 */
export async function submitReview(params: SubmitReviewParams): Promise<{
  success: boolean;
  review?: Review;
  error?: string;
}> {
  const { tradeId, reviewerId, revieweeId, rating, comment, isAnonymous = false } = params;

  // Validate rating
  if (rating < 1 || rating > 5) {
    return {
      success: false,
      error: 'Rating must be between 1 and 5',
    };
  }

  // Validate comment length
  if (comment && comment.length > 500) {
    return {
      success: false,
      error: 'Comment must be 500 characters or less',
    };
  }

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        trade_id: tradeId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating,
        comment: comment?.trim() || null,
        is_anonymous: isAnonymous,
      })
      .select()
      .single();

    if (error) {
      console.error('Submit review error:', error);

      // Handle specific errors
      if (error.code === '23505') {
        return {
          success: false,
          error: 'You have already reviewed this trade',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to submit review',
      };
    }

    return {
      success: true,
      review: data,
    };
  } catch (error) {
    console.error('Submit review unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Get all reviews for a specific user (reviewee)
 */
export async function getUserReviews(userId: string): Promise<{
  success: boolean;
  reviews: Review[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .not('is_hidden', 'is', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get user reviews error:', error);
      return {
        success: false,
        reviews: [],
        error: error.message,
      };
    }

    const reviews = data || [];
    const reviewerIds = Array.from(new Set(reviews.map((review: any) => review.reviewer_id)));
    let reviewerProfiles: any[] = [];

    if (reviewerIds.length) {
      // Get profiles and verification status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', reviewerIds);

      if (profileError) {
        console.error('Get reviewer profiles error:', profileError);
      } else if (profileData) {
        // Fetch verification status for these users
        const { data: verificationData } = await supabase
          .from('id_badge_verification_requests')
          .select('user_id, status')
          .in('user_id', reviewerIds)
          .order('created_at', { ascending: false });

        reviewerProfiles = profileData.map((p: { user_id: string; name: string | null; avatar_url: string | null }) => {
          // Find latest verification request for this user
          const userRequests = verificationData?.filter((v: { user_id: string; status: string }) => v.user_id === p.user_id) || [];
          const vStatus = userRequests.length > 0 ? userRequests[0].status : 'none';
          return { ...p, verification_status: vStatus };
        });
      }
    }

    const profileEntries = await Promise.all(
      reviewerProfiles.map(async (profile) => ({
        userId: profile?.user_id,
        reviewer: profile?.user_id ? await buildReviewerFromProfile(profile) : null,
      }))
    );

    const profileMap: Record<string, Review['reviewer']> = profileEntries.reduce(
      (acc, entry) => {
        if (entry.userId && entry.reviewer) {
          acc[entry.userId] = entry.reviewer;
        }
        return acc;
      },
      {} as Record<string, Review['reviewer']>
    );

    return {
      success: true,
      reviews: await Promise.all(
        reviews.map(async (review: any) => ({
          ...review,
          reviewer: profileMap[review.reviewer_id] || null,
        }))
      ),
    };
  } catch (error) {
    console.error('Get user reviews unexpected error:', error);
    return {
      success: false,
      reviews: [],
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Calculate review statistics for a user
 */
export async function getReviewStats(userId: string): Promise<{
  success: boolean;
  stats?: ReviewStats;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId)
      .not('is_hidden', 'is', true);

    if (error) {
      console.error('Get review stats error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const reviews = data || [];
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        success: true,
        stats: {
          average_rating: 0,
          total_reviews: 0,
          rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      };
    }

    type RatingRow = { rating: number };
    type Breakdown = { 1: number; 2: number; 3: number; 4: number; 5: number };
    const sum = reviews.reduce((acc: number, r: RatingRow) => acc + r.rating, 0);
    const averageRating = sum / totalReviews;

    const breakdown = reviews.reduce(
      (acc: Breakdown, r: RatingRow) => {
        acc[r.rating as keyof Breakdown]++;
        return acc;
      },
      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Breakdown
    );

    return {
      success: true,
      stats: {
        average_rating: Math.round(averageRating * 10) / 10,
        total_reviews: totalReviews,
        rating_breakdown: breakdown,
      },
    };
  } catch (error) {
    console.error('Get review stats unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Check if a user can review another user for a specific trade
 */
export async function canReviewUser(
  tradeId: string,
  reviewerId: string
): Promise<{
  success: boolean;
  canReview: boolean;
  reason?: string;
}> {
  try {
    // Check if trade is completed
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('status, completed_at, buyer_id, seller_id')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return {
        success: false,
        canReview: false,
        reason: 'Trade not found',
      };
    }

    // Verify user is part of the trade
    if (trade.buyer_id !== reviewerId && trade.seller_id !== reviewerId) {
      return {
        success: true,
        canReview: false,
        reason: 'You are not part of this trade',
      };
    }

    // Check if trade is completed
    if (trade.status !== 'completed' || !trade.completed_at) {
      return {
        success: true,
        canReview: false,
        reason: 'Trade is not completed yet',
      };
    }

    // Check if review already exists
    const { data: existingReview, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('trade_id', tradeId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle();

    if (reviewError) {
      console.error('Check existing review error:', reviewError);
      return {
        success: false,
        canReview: false,
        reason: 'Error checking existing review',
      };
    }

    if (existingReview) {
      return {
        success: true,
        canReview: false,
        reason: 'You have already reviewed this trade',
      };
    }

    return {
      success: true,
      canReview: true,
    };
  } catch (error) {
    console.error('Can review user unexpected error:', error);
    return {
      success: false,
      canReview: false,
      reason: 'An unexpected error occurred',
    };
  }
}

/**
 * Get review details for a specific trade
 */
export async function getTradeReviewStatus(
  tradeId: string,
  userId: string
): Promise<{
  success: boolean;
  userReviewed: boolean;
  otherUserReviewed: boolean;
  userReview?: Review;
  otherUserReview?: Review;
  error?: string;
}> {
  try {
    // Get all reviews for this trade
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('trade_id', tradeId);

    if (error) {
      console.error('Get trade review status error:', error);
      return {
        success: false,
        userReviewed: false,
        otherUserReviewed: false,
        error: error.message,
      };
    }

    type ReviewLite = { reviewer_id: string; reviewee_id: string };
    const userReview = reviews?.find((r: ReviewLite) => r.reviewer_id === userId);
    const otherUserReview = reviews?.find((r: ReviewLite) => r.reviewee_id === userId);

    return {
      success: true,
      userReviewed: !!userReview,
      otherUserReviewed: !!otherUserReview,
      userReview,
      otherUserReview,
    };
  } catch (error) {
    console.error('Get trade review status unexpected error:', error);
    return {
      success: false,
      userReviewed: false,
      otherUserReviewed: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Track that a user skipped leaving a review
 * This is used for analytics and doesn't block the user from continuing
 *
 * TASK REVIEW-004: Allow Users to Skip Leaving Reviews
 */
export async function skipReview(params: { tradeId: string; userId: string }): Promise<{
  success: boolean;
  error?: string;
}> {
  const { tradeId, userId } = params;

  try {
    // Log skip event for analytics
    console.log('[skipReview] User skipped review', { tradeId, userId });

    // Note: We don't save skip events to database
    // They're tracked via analytics only to calculate review completion rate
    // This ensures reviews remain fully optional without any database state

    return {
      success: true,
    };
  } catch (error) {
    console.error('Skip review unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Report an inappropriate review
 * TASK REVIEW-006: Implement Review Reporting and Flagging
 */
export async function reportReview(params: {
  reviewId: string;
  reporterId: string;
  reason: 'spam' | 'offensive' | 'false_info' | 'other';
  description?: string | null;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { reviewId, reporterId, reason, description } = params;

  // Validate reason
  const validReasons = ['spam', 'offensive', 'false_info', 'other'];
  if (!validReasons.includes(reason)) {
    return {
      success: false,
      error: 'Invalid report reason',
    };
  }

  try {
    // SECURITY: Ensure the reporter is the reviewee (ONLY report reviews about yourself)
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('reviewee_id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !reviewData) {
      return {
        success: false,
        error: 'Review not found',
      };
    }

    if (reviewData.reviewee_id !== reporterId) {
      return {
        success: false,
        error: 'You can only report reviews that were written about you',
      };
    }

    const { error } = await supabase.from('review_reports').insert({
      review_id: reviewId,
      reporter_id: reporterId,
      reason,
      description: description?.trim() || null,
    });

    if (error) {
      // Handle specific errors
      if (error.code === '23505') {
        // Expected error: user already reported this review
        return {
          success: false,
          error:
            'You have already reported this review. Thanks. The admin is reviewing your report.',
        };
      }

      console.error('Report review error:', error);
      return {
        success: false,
        error: error.message || 'Failed to report review',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Report review unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
