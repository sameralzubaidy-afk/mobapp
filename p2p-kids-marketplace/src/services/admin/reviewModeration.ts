// File: p2p-kids-marketplace/src/services/admin/reviewModeration.ts
// Admin review moderation service for MODULE-08-REVIEWS-RATINGS (TASK REVIEW-006/007)

import { supabase } from '../supabase';
import { Review } from '../review';

export interface ReviewReport {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: 'spam' | 'offensive' | 'false_info' | 'other';
  description: string | null;
  created_at: string;
}

export interface ReportedReview {
  review: Review;
  reports: ReviewReport[];
  report_count: number;
}

/**
 * Get all reported reviews (hidden reviews with reports)
 * Admin only
 */
export async function getReportedReviews(): Promise<{
  success: boolean;
  reviews: ReportedReview[];
  error?: string;
}> {
  try {
    // Get all hidden reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_hidden', true)
      .order('report_count', { ascending: false });

    if (reviewsError) {
      console.error('Get reported reviews error:', reviewsError);
      return {
        success: false,
        reviews: [],
        error: reviewsError.message,
      };
    }

    if (!reviews || reviews.length === 0) {
      return {
        success: true,
        reviews: [],
      };
    }

    // Get reports for all these reviews
    const reviewIds = reviews.map((r: { id: string }) => r.id);
    const { data: reports, error: reportsError } = await supabase
      .from('review_reports')
      .select('*')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Get review reports error:', reportsError);
      // Continue without reports data
    }

    // Get reviewer profiles
    const reviewerIds = Array.from(new Set(reviews.map((r: { reviewer_id: string }) => r.reviewer_id)));
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, avatar_url')
      .in('user_id', reviewerIds);

    if (profilesError) {
      console.error('Get reviewer profiles error:', profilesError);
    }

    // Map reports to reviews
    const reportsMap: Record<string, ReviewReport[]> = {};
    (reports || []).forEach((report: ReviewReport) => {
      if (!reportsMap[report.review_id]) {
        reportsMap[report.review_id] = [];
      }
      reportsMap[report.review_id].push(report);
    });

    // Map profiles to reviews
    const profilesMap: Record<string, any> = {};
    (profiles || []).forEach((profile: { user_id: string; name: string | null; avatar_url: string | null }) => {
      profilesMap[profile.user_id] = profile;
    });

    // Combine data
    const reportedReviews: ReportedReview[] = reviews.map((review: Record<string, unknown> & { id: string; reviewer_id: string }) => {
      const profile = profilesMap[review.reviewer_id];
      const fullName = (profile?.name || 'User').trim();
      const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

      return {
        review: {
          ...review,
          reviewer: profile
            ? {
                first_name: firstName || 'User',
                last_name: rest.join(' '),
                profile_image_url: profile.avatar_url,
              }
            : undefined,
        },
        reports: reportsMap[review.id] || [],
        report_count: review.report_count || 0,
      };
    });

    return {
      success: true,
      reviews: reportedReviews,
    };
  } catch (error) {
    console.error('Get reported reviews unexpected error:', error);
    return {
      success: false,
      reviews: [],
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Approve a review (unhide and delete all reports)
 * Admin only
 */
export async function approveReview(reviewId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Update review to unhide and reset report count
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        is_hidden: false,
        report_count: 0,
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Approve review error:', updateError);
      return {
        success: false,
        error: updateError.message,
      };
    }

    // Delete all reports for this review
    const { error: deleteError } = await supabase
      .from('review_reports')
      .delete()
      .eq('review_id', reviewId);

    if (deleteError) {
      console.error('Delete reports error:', deleteError);
      // Continue - review is already unhidden
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Approve review unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Permanently delete a review
 * Admin only
 */
export async function deleteReview(reviewId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);

    if (error) {
      console.error('Delete review error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete review unexpected error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
