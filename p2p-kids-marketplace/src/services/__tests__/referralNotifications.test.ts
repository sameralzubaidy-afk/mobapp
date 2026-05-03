// File: p2p-kids-marketplace/src/services/__tests__/referralNotifications.test.ts
// Unit tests for referral notification service

import { supabase } from '../supabase/client';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats,
  sendCustomReferralNotification,
  getReferralNotifications,
} from '../referralNotifications';

// Mock Supabase client
jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

describe('ReferralNotifications Service', () => {
  const mockUserId = 'user-123';
  const mockNotificationId = 'notif-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should fetch user notifications successfully', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: mockUserId,
          type: 'referral_invite_accepted',
          title: 'Invite Accepted',
          body: 'Your invite was accepted',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ];

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockNotifications,
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getUserNotifications(mockUserId, 50, 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNotifications);
      expect(mockFrom).toHaveBeenCalledWith('user_notifications');
    });

    it('should handle errors when fetching notifications', async () => {
      const mockError = { message: 'Database error' };

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getUserNotifications(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.message);
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should get unread count successfully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: 5,
        error: null,
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await getUnreadNotificationCount(mockUserId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
      expect(mockRpc).toHaveBeenCalledWith('get_unread_notification_count', {
        p_user_id: mockUserId,
      });
    });

    it('should handle errors when getting unread count', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await getUnreadNotificationCount(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC error');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read successfully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await markNotificationAsRead(mockNotificationId, mockUserId);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('mark_notification_read', {
        p_notification_id: mockNotificationId,
        p_user_id: mockUserId,
      });
    });

    it('should handle errors when marking as read', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await markNotificationAsRead(mockNotificationId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: { success: true, updated_count: 3 },
        error: null,
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const result = await markAllNotificationsAsRead(mockUserId);

      expect(result.success).toBe(true);
      expect(result.updated_count).toBe(3);
      expect(mockRpc).toHaveBeenCalledWith('mark_all_notifications_read', {
        p_user_id: mockUserId,
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should get notification stats successfully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: 2,
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 10,
            error: null,
          }),
        }),
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);
      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getNotificationStats(mockUserId);

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        unread_count: 2,
        total_count: 10,
      });
    });
  });

  describe('sendCustomReferralNotification', () => {
    it('should send custom notification successfully', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await sendCustomReferralNotification(mockUserId, 'Test Title', 'Test Body', {
        custom_field: 'value',
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_notifications');
    });

    it('should handle errors when sending custom notification', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Insert error' },
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await sendCustomReferralNotification(mockUserId, 'Test', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert error');
    });
  });

  describe('getReferralNotifications', () => {
    it('should fetch referral-specific notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: mockUserId,
          type: 'referral_invite_accepted',
          title: 'Invite Accepted',
          body: 'Your invite was accepted',
        },
        {
          id: 'notif-2',
          user_id: mockUserId,
          type: 'referral_rewards_granted',
          title: 'Rewards Granted',
          body: 'You earned 25 SP',
        },
      ];

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockNotifications,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getReferralNotifications(mockUserId, 20);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNotifications);
      expect(result.data?.length).toBe(2);
    });
  });
});
