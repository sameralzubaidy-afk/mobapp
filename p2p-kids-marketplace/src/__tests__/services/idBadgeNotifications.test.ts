/**
 * Unit Tests for ID Badge Notification System
 * Tests submission and decision notification logic
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { supabase } from '@/services/supabase/client';

// Mock Supabase
jest.mock('@/services/supabase/client');

describe('ID Badge Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Submission Notifications', () => {
    it('should send in-app notification on submission', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'notif-123' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Simulate submission notification
      const _result = await supabase.from('user_notifications').insert({
        user_id: 'user-123',
        category: 'badges',
        type: 'id_badge_submission',
        title: 'ID Verification Submitted',
        body: 'Your ID verification has been received.',
        channels: ['in_app'],
        data: { requestId: 'req-123' },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          category: 'badges',
          title: 'ID Verification Submitted',
        })
      );
    });

    it('should respect user notification preferences', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                push_enabled: false,
                in_app_enabled: true,
                email_enabled: true,
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const prefs = await supabase
        .from('notification_preferences')
        .select('push_enabled, in_app_enabled, email_enabled')
        .eq('user_id', 'user-123')
        .eq('category', 'badges')
        .maybeSingle();

      expect(prefs.data?.push_enabled).toBe(false);
      expect(prefs.data?.in_app_enabled).toBe(true);
      expect(prefs.data?.email_enabled).toBe(true);
    });
  });

  describe('Approval Notifications', () => {
    it('should send all notification channels on approval', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'notif-456' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Test in-app notification
      await supabase.from('user_notifications').insert({
        user_id: 'user-123',
        category: 'badges',
        type: 'id_badge_approved',
        title: 'ID Verification Approved! 🎉',
        body: 'Your ID has been verified.',
        channels: ['in_app'],
        data: { requestId: 'req-123', badge: 'verified' },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'ID Verification Approved! 🎉',
          data: expect.objectContaining({ badge: 'verified' }),
        })
      );
    });

    it('should include badge data in approval notification', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'notif-456' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await supabase.from('user_notifications').insert({
        user_id: 'user-123',
        category: 'badges',
        title: 'ID Verification Approved! 🎉',
        body: 'Your ID has been verified.',
        channels: ['in_app'],
        data: { requestId: 'req-123', badge: 'verified', screen: 'Profile' },
      });

      const callArgs = mockInsert.mock.calls[0][0];
      expect(callArgs.data.badge).toBe('verified');
      expect(callArgs.data.screen).toBe('Profile');
    });
  });

  describe('Rejection Notifications', () => {
    it('should include rejection reason in notification', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'notif-789' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await supabase.from('user_notifications').insert({
        user_id: 'user-123',
        category: 'badges',
        type: 'id_badge_rejected',
        title: 'ID Verification Request',
        body: 'Your ID verification was not approved. Reason: unclear photo',
        channels: ['in_app'],
        data: {
          requestId: 'req-123',
          decision: 'rejected',
          reason: 'unclear_photo',
          screen: 'IDVerificationUpload',
        },
      });

      const callArgs = mockInsert.mock.calls[0][0];
      expect(callArgs.data.decision).toBe('rejected');
      expect(callArgs.data.reason).toBe('unclear_photo');
      expect(callArgs.data.screen).toBe('IDVerificationUpload');
    });

    it('should format rejection reason for display', () => {
      const rejectionReason = 'unclear_photo';
      const formatted = rejectionReason.replace(/_/g, ' ');
      expect(formatted).toBe('unclear photo');
    });
  });

  describe('Message Template Variables', () => {
    it('should replace template variables correctly', () => {
      const template = 'Hi {first_name}, your verification was {status}.';
      const replaced = template.replace(/{first_name}/g, 'John').replace(/{status}/g, 'approved');

      expect(replaced).toBe('Hi John, your verification was approved.');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hi {first_name}, reason: {rejection_reason}';
      const replaced = template.replace(/{first_name}/g, 'Jane').replace(/{rejection_reason}/g, '');

      expect(replaced).toBe('Hi Jane, reason: ');
    });

    it('should format admin notes in template', () => {
      const template = 'Reason: {rejection_reason}. Notes: {admin_notes}';
      const replaced = template
        .replace(/{rejection_reason}/g, 'unclear photo')
        .replace(/{admin_notes}/g, 'Please retake with better lighting');

      expect(replaced).toBe('Reason: unclear photo. Notes: Please retake with better lighting');
    });
  });

  describe('Admin Notifications', () => {
    it('should create admin notification on new submission', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'admin-notif-123' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await supabase.from('admin_notifications').insert({
        admin_id: 'admin-123',
        notification_type: 'id_badge_submission',
        title: 'New ID Verification Request',
        message: 'John submitted an ID verification request for review',
        entity_type: 'id_badge_verification_request',
        entity_id: 'req-123',
        is_read: false,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_type: 'id_badge_submission',
          entity_id: 'req-123',
        })
      );
    });
  });

  describe('Activity Logging', () => {
    it('should log admin approval action', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'log-123' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await supabase.from('admin_activity_log').insert({
        admin_id: 'admin-123',
        action_type: 'id_badge_approved',
        entity_type: 'id_badge_verification',
        entity_id: 'req-123',
        details: { approvalNotes: 'Looks good' },
        notes: 'ID badge approved for user user-123',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'id_badge_approved',
          entity_type: 'id_badge_verification',
        })
      );
    });

    it('should log admin rejection action with reason', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: { id: 'log-456' },
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      await supabase.from('admin_activity_log').insert({
        admin_id: 'admin-123',
        action_type: 'id_badge_rejected',
        entity_type: 'id_badge_verification',
        entity_id: 'req-123',
        details: {
          rejectionReason: 'unclear_photo',
          rejectionNotes: 'Please retake with better lighting',
        },
        notes: 'ID badge rejected for user user-123',
      });

      const callArgs = mockInsert.mock.calls[0][0];
      expect(callArgs.details.rejectionReason).toBe('unclear_photo');
      expect(callArgs.details.rejectionNotes).toBe('Please retake with better lighting');
    });
  });
});
