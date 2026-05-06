// File: p2p-kids-marketplace/src/services/__tests__/review-reporting.test.ts
// Unit tests for review reporting functionality (TASK REVIEW-006)

import { reportReview } from '../review';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('reportReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully report a review with valid data', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'spam',
      description: 'This is spam content',
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      review_id: 'review-123',
      reporter_id: 'user-456',
      reason: 'spam',
      description: 'This is spam content',
    });
  });

  it('should successfully report a review without description', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'offensive',
      description: null,
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      review_id: 'review-123',
      reporter_id: 'user-456',
      reason: 'offensive',
      description: null,
    });
  });

  it('should trim whitespace from description', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'false_info',
      description: '  Contains false information  ',
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      review_id: 'review-123',
      reporter_id: 'user-456',
      reason: 'false_info',
      description: 'Contains false information',
    });
  });

  it('should validate report reason', async () => {
    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'invalid_reason' as any,
      description: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid report reason');
  });

  it('should handle duplicate report error (23505)', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: { code: '23505', message: 'duplicate key' },
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'spam',
      description: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already reported');
  });

  it('should handle database error', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: { message: 'Database error' },
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'spam',
      description: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });

  it('should handle unexpected errors', async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await reportReview({
      reviewId: 'review-123',
      reporterId: 'user-456',
      reason: 'spam',
      description: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('An unexpected error occurred');
  });

  it('should accept all valid report reasons', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'review_reports') {
        return { insert: mockInsert };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reviewee_id: 'user-456' },
          error: null,
        }),
      };
    });

    const validReasons: ('spam' | 'offensive' | 'false_info' | 'other')[] = [
      'spam',
      'offensive',
      'false_info',
      'other',
    ];

    for (const reason of validReasons) {
      const result = await reportReview({
        reviewId: 'review-123',
        reporterId: 'user-456',
        reason,
        description: null,
      });

      expect(result.success).toBe(true);
    }
  });
});
