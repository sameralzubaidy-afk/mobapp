// File: p2p-kids-marketplace/src/services/__tests__/idBadge.test.ts
// TASK BADGE-008: ID Badge Service Unit Tests

import { idBadgeService } from '../idBadge';
import { supabase } from '../supabase/client';

// Mock Supabase
jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

describe('idBadgeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMessage', () => {
    it('should fetch message by key', async () => {
      const mockData = { message_text: 'Test disclaimer' };
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getMessage('upload_disclaimer');

      expect(result).toBe('Test disclaimer');
      expect(supabase.from).toHaveBeenCalledWith('id_badge_verification_messages');
      expect(mockFrom.select).toHaveBeenCalledWith('message_text');
      expect(mockFrom.eq).toHaveBeenCalledWith('message_key', 'upload_disclaimer');
    });

    it('should return empty string on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getMessage('nonexistent_key');

      expect(result).toBe('');
    });
  });

  describe('checkPendingRequest', () => {
    it('should return pending request if exists', async () => {
      const mockData = { id: '123', status: 'pending', submitted_at: '2026-02-08' };
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.checkPendingRequest('user-123');

      expect(result).toEqual(mockData);
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockFrom.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should return null if no pending request', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.checkPendingRequest('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getVerificationStatus', () => {
    it('should return pending status if pending request exists', async () => {
      const mockData = {
        status: 'pending',
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: null,
        rejection_reason: null,
        rejection_notes: null,
      };

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
          .mockResolvedValueOnce({ data: mockData, error: null }) // First call (pending)
          .mockResolvedValueOnce({ data: null, error: null }), // Second call (decided)
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getVerificationStatus('user-123');

      expect(result.status).toBe('pending');
      expect(result.submittedAt).toBe('2026-02-08T10:00:00Z');
    });

    it('should return approved status if approved', async () => {
      const mockData = {
        status: 'approved',
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: '2026-02-08T12:00:00Z',
        rejection_reason: null,
        rejection_notes: null,
      };

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
          .mockResolvedValueOnce({ data: null, error: null }) // No pending
          .mockResolvedValueOnce({ data: mockData, error: null }), // Approved
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getVerificationStatus('user-123');

      expect(result.status).toBe('approved');
      expect(result.reviewedAt).toBe('2026-02-08T12:00:00Z');
    });

    it('should return rejected status with reason', async () => {
      const mockData = {
        status: 'rejected',
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: '2026-02-08T12:00:00Z',
        rejection_reason: 'unclear_photo',
        rejection_notes: 'Please retake with better lighting',
      };

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
          .mockResolvedValueOnce({ data: null, error: null }) // No pending
          .mockResolvedValueOnce({ data: mockData, error: null }), // Rejected
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getVerificationStatus('user-123');

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('unclear_photo');
      expect(result.rejectionNotes).toBe('Please retake with better lighting');
    });

    it('should return none if no requests exist', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
          .mockResolvedValueOnce({ data: null, error: null }) // No pending
          .mockResolvedValueOnce({ data: null, error: null }), // No decided
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await idBadgeService.getVerificationStatus('user-123');

      expect(result.status).toBe('none');
    });
  });
});
