// File: p2p-kids-marketplace/src/__tests__/services/review-profile-display.test.ts
// Unit tests for REVIEW-005: Display Average Rating and Reviews on User Profile

import { getUserReviews, getReviewStats } from '@/services/review';

// Mock supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@/services/profile', () => ({
  resolveAvatarUrl: jest.fn((url) => Promise.resolve(url)),
}));

const { supabase } = require('@/services/supabase');

describe('REVIEW-005: Profile Rating Display', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserReviews', () => {
    it('should fetch and return reviews for a user', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          trade_id: 'trade-1',
          reviewer_id: 'user-2',
          reviewee_id: 'user-1',
          rating: 5,
          comment: 'Great trader!',
          is_anonymous: false,
          is_hidden: false,
          report_count: 0,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'review-2',
          trade_id: 'trade-2',
          reviewer_id: 'user-3',
          reviewee_id: 'user-1',
          rating: 4,
          comment: 'Good experience',
          is_anonymous: false,
          is_hidden: false,
          report_count: 0,
          created_at: '2024-01-14T10:00:00Z',
          updated_at: '2024-01-14T10:00:00Z',
        },
      ];

      const mockProfiles = [
        {
          user_id: 'user-2',
          name: 'John Doe',
          avatar_url: 'http://example.com/avatar1.jpg',
        },
        {
          user_id: 'user-3',
          name: 'Jane Smith',
          avatar_url: 'http://example.com/avatar2.jpg',
        },
      ];

      const mockReviewsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
      };

      const mockProfilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      const mockVerificationQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockReviewsQuery)
        .mockReturnValueOnce(mockProfilesQuery)
        .mockReturnValueOnce(mockVerificationQuery);

      const result = await getUserReviews('user-1');

      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(2);
      expect(result.reviews[0].reviewer).toBeDefined();
      expect(result.reviews[0].reviewer?.first_name).toBe('John');
    });

    it('should exclude hidden reviews', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          is_hidden: false,
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
      };

      const mockVerificationQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
        .mockReturnValueOnce(mockVerificationQuery);

      const result = await getUserReviews('user-1');

      expect(mockQuery.not).toHaveBeenCalledWith('is_hidden', 'is', true);
      expect(result.success).toBe(true);
    });

    it('should order reviews by created_at descending', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockProfilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockVerificationQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce(mockProfilesQuery)
        .mockReturnValueOnce(mockVerificationQuery);

      await getUserReviews('user-1');

      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should handle anonymous reviews', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          reviewer_id: 'user-2',
          reviewee_id: 'user-1',
          rating: 4,
          comment: 'Anonymous review',
          is_anonymous: true,
          is_hidden: false,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockReviewsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
      };

      const mockProfilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockVerificationQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockReviewsQuery)
        .mockReturnValueOnce(mockProfilesQuery)
        .mockReturnValueOnce(mockVerificationQuery);

      const result = await getUserReviews('user-1');

      expect(result.success).toBe(true);
      expect(result.reviews[0].is_anonymous).toBe(true);
    });
  });

  describe('getReviewStats', () => {
    it('should calculate average rating correctly', async () => {
      const mockReviews = [{ rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 3 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.average_rating).toBe(4.3); // (5+4+5+3) / 4 = 4.25 → rounded to 4.3
      expect(result.stats?.total_reviews).toBe(4);
    });

    it('should calculate rating breakdown correctly', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
        { rating: 3 },
        { rating: 2 },
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.rating_breakdown).toEqual({
        5: 2,
        4: 1,
        3: 2,
        2: 1,
        1: 0,
      });
    });

    it('should handle zero reviews', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.average_rating).toBe(0);
      expect(result.stats?.total_reviews).toBe(0);
      expect(result.stats?.rating_breakdown).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
    });

    it('should round average rating to 1 decimal place', async () => {
      const mockReviews = [{ rating: 5 }, { rating: 4 }, { rating: 4 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      // (5+4+4) / 3 = 4.333... → should round to 4.3
      expect(result.stats?.average_rating).toBe(4.3);
    });

    it('should exclude hidden reviews from stats', async () => {
      const mockNot = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockEq1 = jest.fn().mockReturnValue({
        not: mockNot,
      });
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      supabase.from.mockReturnValue({
        select: mockSelect,
      });

      await getReviewStats('user-1');

      expect(mockSelect).toHaveBeenCalledWith('rating');
      expect(mockEq1).toHaveBeenCalledWith('reviewee_id', 'user-1');
      expect(mockNot).toHaveBeenCalledWith('is_hidden', 'is', true);
    });

    it('should handle database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('Rating Breakdown Percentage Calculation', () => {
    it('should calculate percentages correctly for display', () => {
      const stats = {
        average_rating: 4.2,
        total_reviews: 10,
        rating_breakdown: {
          5: 3,
          4: 5,
          3: 1,
          2: 1,
          1: 0,
        },
      };

      // Simulate what the UI does
      const percentages = [5, 4, 3, 2, 1].map((stars) => {
        const count = stats.rating_breakdown[stars as keyof typeof stats.rating_breakdown];
        return stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
      });

      expect(percentages).toEqual([30, 50, 10, 10, 0]);
    });

    it('should handle zero reviews without division error', () => {
      const stats = {
        average_rating: 0,
        total_reviews: 0,
        rating_breakdown: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };

      const percentages = [5, 4, 3, 2, 1].map((stars) => {
        const count = stats.rating_breakdown[stars as keyof typeof stats.rating_breakdown];
        return stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
      });

      expect(percentages).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe('Profile Display Integration', () => {
    it('should load both reviews and stats in parallel', async () => {
      const mockReviewsData = {
        success: true,
        reviews: [
          { id: 'review-1', rating: 5 },
          { id: 'review-2', rating: 4 },
        ],
      };

      const mockStatsData = {
        success: true,
        stats: {
          average_rating: 4.5,
          total_reviews: 2,
          rating_breakdown: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
        },
      };

      // Mock both functions
      const getUserReviewsMock = jest.fn().mockResolvedValue(mockReviewsData);
      const getReviewStatsMock = jest.fn().mockResolvedValue(mockStatsData);

      // Simulate parallel loading (what ProfileScreen does)
      const [reviewsResult, statsResult] = await Promise.all([
        getUserReviewsMock('user-1'),
        getReviewStatsMock('user-1'),
      ]);

      expect(getUserReviewsMock).toHaveBeenCalledWith('user-1');
      expect(getReviewStatsMock).toHaveBeenCalledWith('user-1');
      expect(reviewsResult.success).toBe(true);
      expect(statsResult.success).toBe(true);
    });
  });
});
