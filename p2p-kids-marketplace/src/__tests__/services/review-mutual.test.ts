// File: p2p-kids-marketplace/src/__tests__/services/review-mutual.test.ts
// TASK REVIEW-002 Unit Tests: Mutual Review Flow

import { getTradeReviewStatus } from '@/services/review';
import { supabase } from '@/services/supabase/client';

// Mock Supabase
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Mutual Review Flow - getTradeReviewStatus', () => {
  const mockTradeId = 'trade-123';
  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct status when both users have reviewed', async () => {
    const mockReviews = [
      {
        id: 'review-1',
        trade_id: mockTradeId,
        reviewer_id: mockUserId,
        reviewee_id: mockOtherUserId,
        rating: 5,
      },
      {
        id: 'review-2',
        trade_id: mockTradeId,
        reviewer_id: mockOtherUserId,
        reviewee_id: mockUserId,
        rating: 4,
      },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: mockReviews,
          error: null,
        }),
      }),
    });

    const result = await getTradeReviewStatus(mockTradeId, mockUserId);

    expect(result.success).toBe(true);
    expect(result.userReviewed).toBe(true);
    expect(result.otherUserReviewed).toBe(true);
    expect(result.userReview).toEqual(mockReviews[0]);
    expect(result.otherUserReview).toEqual(mockReviews[1]);
  });

  it('should return correct status when only user has reviewed', async () => {
    const mockReviews = [
      {
        id: 'review-1',
        trade_id: mockTradeId,
        reviewer_id: mockUserId,
        reviewee_id: mockOtherUserId,
        rating: 5,
      },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: mockReviews,
          error: null,
        }),
      }),
    });

    const result = await getTradeReviewStatus(mockTradeId, mockUserId);

    expect(result.success).toBe(true);
    expect(result.userReviewed).toBe(true);
    expect(result.otherUserReviewed).toBe(false);
    expect(result.userReview).toEqual(mockReviews[0]);
    expect(result.otherUserReview).toBeUndefined();
  });

  it('should return correct status when only other user has reviewed', async () => {
    const mockReviews = [
      {
        id: 'review-2',
        trade_id: mockTradeId,
        reviewer_id: mockOtherUserId,
        reviewee_id: mockUserId,
        rating: 4,
      },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: mockReviews,
          error: null,
        }),
      }),
    });

    const result = await getTradeReviewStatus(mockTradeId, mockUserId);

    expect(result.success).toBe(true);
    expect(result.userReviewed).toBe(false);
    expect(result.otherUserReviewed).toBe(true);
    expect(result.userReview).toBeUndefined();
    expect(result.otherUserReview).toEqual(mockReviews[0]);
  });

  it('should return correct status when neither user has reviewed', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    const result = await getTradeReviewStatus(mockTradeId, mockUserId);

    expect(result.success).toBe(true);
    expect(result.userReviewed).toBe(false);
    expect(result.otherUserReviewed).toBe(false);
    expect(result.userReview).toBeUndefined();
    expect(result.otherUserReview).toBeUndefined();
  });

  it('should handle database errors gracefully', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    });

    const result = await getTradeReviewStatus(mockTradeId, mockUserId);

    expect(result.success).toBe(false);
    expect(result.userReviewed).toBe(false);
    expect(result.otherUserReviewed).toBe(false);
    expect(result.error).toBe('Database error');
  });
});
