// File: p2p-kids-marketplace/src/services/admin/__tests__/reviewModeration.test.ts
// Unit tests for admin review moderation (TASK REVIEW-006/007)

import {
  getReportedReviews,
  approveReview,
  deleteReview,
} from '../reviewModeration';
import { supabase } from '../../supabase';

jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Review Moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReportedReviews', () => {
    it('should fetch reported reviews with reports', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 1,
          comment: 'Bad review',
          is_hidden: true,
          report_count: 3,
          reviewer_id: 'user-1',
        },
      ];

      const mockReports = [
        {
          id: 'report-1',
          review_id: 'review-1',
          reporter_id: 'user-2',
          reason: 'spam',
          description: 'This is spam',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockProfiles = [
        {
          user_id: 'user-1',
          name: 'John Doe',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      ];

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockReviews,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'review_reports') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockReports,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
            }),
          };
        }
      });

      const result = await getReportedReviews();

      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].review.id).toBe('review-1');
      expect(result.reviews[0].reports).toHaveLength(1);
      expect(result.reviews[0].report_count).toBe(3);
    });

    it('should return empty array when no reported reviews', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getReportedReviews();

      expect(result.success).toBe(true);
      expect(result.reviews).toEqual([]);
    });

    it('should handle database error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      const result = await getReportedReviews();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('approveReview', () => {
    it('should approve review and delete reports', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            update: mockUpdate,
          };
        }
        if (table === 'review_reports') {
          return {
            delete: mockDelete,
          };
        }
      });

      const result = await approveReview('review-123');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        is_hidden: false,
        report_count: 0,
      });
    });

    it('should handle update error', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await approveReview('review-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should continue even if delete reports fails', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Delete failed' },
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            update: mockUpdate,
          };
        }
        if (table === 'review_reports') {
          return {
            delete: mockDelete,
          };
        }
      });

      const result = await approveReview('review-123');

      // Should still succeed even if deleting reports fails
      expect(result.success).toBe(true);
    });
  });

  describe('deleteReview', () => {
    it('should delete review permanently', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const result = await deleteReview('review-123');

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle delete error', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Delete failed' },
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const result = await deleteReview('review-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
});
