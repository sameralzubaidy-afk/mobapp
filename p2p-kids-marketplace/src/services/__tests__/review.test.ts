// File: p2p-kids-marketplace/src/services/__tests__/review.test.ts
// Unit tests for review service (MODULE-08-REVIEWS-RATINGS TASK REVIEW-001)

import { submitReview, getUserReviews, getReviewStats, canReviewUser } from '../review';
import { supabase } from '../supabase';

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Review Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitReview', () => {
    it('should successfully submit a review', async () => {
      const mockReview = {
        id: '123',
        trade_id: 'trade-1',
        reviewer_id: 'user-1',
        reviewee_id: 'user-2',
        rating: 5,
        comment: 'Great experience!',
        is_anonymous: false,
        created_at: '2026-01-13T00:00:00Z',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockReview,
              error: null,
            }),
          }),
        }),
      });

      const result = await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 5,
        comment: 'Great experience!',
        isAnonymous: false,
      });

      expect(result.success).toBe(true);
      expect(result.review).toEqual(mockReview);
      expect(result.error).toBeUndefined();
    });

    it('should reject rating below 1', async () => {
      const result = await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 0,
        comment: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rating must be between 1 and 5');
    });

    it('should reject rating above 5', async () => {
      const result = await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 6,
        comment: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rating must be between 1 and 5');
    });

    it('should reject comment longer than 500 characters', async () => {
      const longComment = 'a'.repeat(501);

      const result = await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 5,
        comment: longComment,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment must be 500 characters or less');
    });

    it('should handle duplicate review error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'Duplicate key violation' },
            }),
          }),
        }),
      });

      const result = await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 5,
        comment: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already reviewed this trade');
    });

    it('should trim comment whitespace', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: '123' },
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await submitReview({
        tradeId: 'trade-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 5,
        comment: '  Great experience!  ',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: 'Great experience!',
        })
      );
    });
  });

  describe('getUserReviews', () => {
    const buildUserReviewMocks = (mockReviews: any[], mockProfiles: any[] = []) => {
      const reviewsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReviews, error: null }),
      };

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return reviewsChain;
        }

        if (table === 'profiles') {
          return profilesChain;
        }

        return null;
      });

      return { reviewsChain, profilesChain };
    };

    it('should fetch user reviews successfully', async () => {
      const mockReviews = [
        {
          id: '1',
          reviewer_id: 'rev-1',
          reviewee_id: 'user-1',
          rating: 5,
          comment: 'Great!',
          is_anonymous: false,
          created_at: '2026-01-01T00:00:00Z',
          is_hidden: false,
        },
        {
          id: '2',
          reviewer_id: 'rev-2',
          reviewee_id: 'user-1',
          rating: 4,
          comment: 'Good',
          is_anonymous: false,
          created_at: '2026-01-02T00:00:00Z',
          is_hidden: false,
        },
      ];

      const mockProfiles = [
        { user_id: 'rev-1', name: 'John Doe', avatar_url: null },
        { user_id: 'rev-2', name: 'Jane Smith', avatar_url: null },
      ];

      const { reviewsChain, profilesChain } = buildUserReviewMocks(mockReviews, mockProfiles);

      const result = await getUserReviews('user-1');

      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(2);
      expect(result.reviews[0].reviewer?.first_name).toBe('John');
      expect(result.reviews[0].reviewer?.last_name).toBe('Doe');
      expect(result.reviews[0].reviewer?.profile_image_url).toBeNull();
      expect(profilesChain.in).toHaveBeenCalledWith('user_id', ['rev-1', 'rev-2']);
      expect(reviewsChain.order).toHaveBeenCalled();
    });

    it('should exclude hidden reviews', async () => {
      const { reviewsChain } = buildUserReviewMocks([]);

      await getUserReviews('user-1');

      expect(reviewsChain.eq).toHaveBeenCalledWith('is_hidden', false);
    });
  });

  describe('getReviewStats', () => {
    it('should calculate review stats correctly', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 4 },
        { rating: 3 },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockReviews,
              error: null,
            }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.total_reviews).toBe(5);
      expect(result.stats?.average_rating).toBe(4.2); // (5+5+4+4+3)/5 = 4.2
      expect(result.stats?.rating_breakdown[5]).toBe(2);
      expect(result.stats?.rating_breakdown[4]).toBe(2);
      expect(result.stats?.rating_breakdown[3]).toBe(1);
      expect(result.stats?.rating_breakdown[2]).toBe(0);
      expect(result.stats?.rating_breakdown[1]).toBe(0);
    });

    it('should handle zero reviews', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.total_reviews).toBe(0);
      expect(result.stats?.average_rating).toBe(0);
    });

    it('should round average rating to 1 decimal place', async () => {
      const mockReviews = [{ rating: 5 }, { rating: 4 }, { rating: 3 }];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockReviews,
              error: null,
            }),
          }),
        }),
      });

      const result = await getReviewStats('user-1');

      expect(result.success).toBe(true);
      expect(result.stats?.average_rating).toBe(4.0); // (5+4+3)/3 = 4.0
    });
  });

  describe('canReviewUser', () => {
    it('should allow review for completed trade', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    status: 'completed',
                    completed_at: '2026-01-13T00:00:00Z',
                    buyer_id: 'user-1',
                    seller_id: 'user-2',
                  },
                  error: null,
                }),
              }),
            }),
          };
        } else if (table === 'reviews') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
      });

      const result = await canReviewUser('trade-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.canReview).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject if trade not completed', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    status: 'pending',
                    completed_at: null,
                    buyer_id: 'user-1',
                    seller_id: 'user-2',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      const result = await canReviewUser('trade-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.canReview).toBe(false);
      expect(result.reason).toBe('Trade is not completed yet');
    });

    it('should reject if user not part of trade', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    status: 'completed',
                    completed_at: '2026-01-13T00:00:00Z',
                    buyer_id: 'user-2',
                    seller_id: 'user-3',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      const result = await canReviewUser('trade-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.canReview).toBe(false);
      expect(result.reason).toBe('You are not part of this trade');
    });

    it('should reject if review already exists', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'trades') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    status: 'completed',
                    completed_at: '2026-01-13T00:00:00Z',
                    buyer_id: 'user-1',
                    seller_id: 'user-2',
                  },
                  error: null,
                }),
              }),
            }),
          };
        } else if (table === 'reviews') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'review-1' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
      });

      const result = await canReviewUser('trade-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.canReview).toBe(false);
      expect(result.reason).toBe('You have already reviewed this trade');
    });
  });
});
