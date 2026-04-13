// filepath: p2p-kids-marketplace/src/__tests__/services/badgeNotifications.test.ts
// Unit Tests for Badge Notification Service
// TASK: NOTIF-V2-004

import { supabase } from '@/config/supabase';
import {
  checkBadgeMilestones,
  getBadgeNotifications,
  markBadgeNotificationRead,
  sendBadgeAwardPushNotification,
  parseBadgeNotificationData,
} from '@/services/badgeNotifications';
import { Badge } from '@/types/badge';

// Mock Supabase client
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('Badge Notification Service', () => {
  const mockUserId = 'user-123';
  const mockBadge: Badge = {
    id: 'badge-1',
    name: 'Trader 10',
    description: 'Complete 10 trades',
    category: 'trades',
    icon_url: 'https://example.com/icon.png',
    threshold: 10,
    created_at: '2024-01-01T00:00:00Z',
    is_active: true,
    sort_order: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkBadgeMilestones', () => {
    it('should successfully check milestones', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await checkBadgeMilestones(mockUserId);

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('check_badge_milestones', {
        p_user_id: mockUserId,
      });
    });

    it('should handle RPC error', async () => {
      const mockError = { message: 'RPC failed' };
      (supabase.rpc as jest.Mock).mockResolvedValue({
        error: mockError,
      });

      const result = await checkBadgeMilestones(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC failed');
    });

    it('should handle unexpected errors', async () => {
      (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await checkBadgeMilestones(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getBadgeNotifications', () => {
    it('should fetch unread badge notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: mockUserId,
          category: 'badges',
          type: 'badge_earned',
          title: 'New Badge Earned!',
          body: 'You earned Trader 10',
          data: { badge_id: 'badge-1' },
          read_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockNotifications,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await getBadgeNotifications(mockUserId);

      expect(result.data).toEqual(mockNotifications);
      expect(result.error).toBeUndefined();
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockFrom.eq).toHaveBeenCalledWith('category', 'badges');
      expect(mockFrom.is).toHaveBeenCalledWith('read_at', null);
    });

    it('should return empty array on error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await getBadgeNotifications(mockUserId);

      expect(result.data).toEqual([]);
      expect(result.error).toBe('Fetch failed');
    });
  });

  describe('markBadgeNotificationRead', () => {
    it('should mark notification as read', async () => {
      const mockNotificationId = 'notif-1';

      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await markBadgeNotificationRead(mockNotificationId);

      expect(result.success).toBe(true);
      expect(mockFrom.update).toHaveBeenCalled();
      expect(mockFrom.eq).toHaveBeenCalledWith('id', mockNotificationId);
    });

    it('should handle update error', async () => {
      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await markBadgeNotificationRead('notif-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('sendBadgeAwardPushNotification', () => {
    it('should send push notification successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await sendBadgeAwardPushNotification(mockUserId, mockBadge);

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: {
          userId: mockUserId,
          title: expect.stringContaining('New Badge Earned!'),
          body: expect.stringContaining('Trader 10'),
          data: {
            badge_id: mockBadge.id,
            badge_name: mockBadge.name,
            category: 'badges',
            deep_link: '/profile/badges',
          },
          priority: 'high',
        },
      });
    });

    it('should handle edge function error', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Function invocation failed' },
      });

      const result = await sendBadgeAwardPushNotification(mockUserId, mockBadge);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function invocation failed');
    });

    it('should use emoji fallback if no icon_url', async () => {
      const badgeWithoutIcon = { ...mockBadge, icon_url: undefined };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await sendBadgeAwardPushNotification(mockUserId, badgeWithoutIcon);

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-push-notification',
        expect.objectContaining({
          body: expect.objectContaining({
            title: expect.stringContaining('🏆'),
          }),
        })
      );
    });
  });

  describe('parseBadgeNotificationData', () => {
    it('should parse badge notification data', () => {
      const notification = {
        data: {
          badge_id: 'badge-1',
          badge_name: 'Trader 10',
          badge_icon: 'https://example.com/icon.png',
          badge_description: 'Complete 10 trades',
          category: 'trades',
          deep_link: '/profile/badges',
        },
      };

      const result = parseBadgeNotificationData(notification);

      expect(result).toEqual(notification.data);
    });

    it('should parse stringified JSON data', () => {
      const notification = {
        data: JSON.stringify({
          badge_id: 'badge-1',
          badge_name: 'Trader 10',
        }),
      };

      const result = parseBadgeNotificationData(notification);

      expect(result).toEqual({
        badge_id: 'badge-1',
        badge_name: 'Trader 10',
      });
    });

    it('should return null for invalid data', () => {
      const notification = { data: null };

      const result = parseBadgeNotificationData(notification);

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const notification = { data: 'invalid json' };

      const result = parseBadgeNotificationData(notification);

      expect(result).toBeNull();
    });
  });
});
