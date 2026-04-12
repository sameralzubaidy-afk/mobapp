/**
 * FILE: p2p-kids-marketplace/src/__tests__/services/subscriptionNotifications.test.ts
 * MODULE-14 TASK NOTIF-V2-002: Unit tests for subscription notifications
 */

import { jest } from '@jest/globals';
import {
  sendSubscriptionNotification,
  notifySubscriptionRenewed,
  notifyCancellationConfirmed,
  notifyPaymentFailed,
} from '../../services/subscriptionNotifications';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('MODULE-14 NOTIF-V2-002: Subscription Notifications', () => {
  const mockUserId = 'user-123';
  const mockNextBillingDate = '2026-05-01T00:00:00Z';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendSubscriptionNotification', () => {
    it('should send notification respecting user preferences', async () => {
      const mockPreferences = {
        push_enabled: true,
        in_app_enabled: true,
        email_enabled: false,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: mockPreferences,
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await sendSubscriptionNotification({
        userId: mockUserId,
        title: 'Test Notification',
        body: 'Test body',
        critical: false,
      });

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('notification_preferences');
      expect(supabase.from).toHaveBeenCalledWith('user_notifications');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', expect.any(Object));
    });

    it('should bypass preferences for critical notifications', async () => {
      const mockPreferences = {
        push_enabled: false,
        in_app_enabled: false,
        email_enabled: false,
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: mockPreferences,
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await sendSubscriptionNotification({
        userId: mockUserId,
        title: 'Critical Notification',
        body: 'Critical body',
        critical: true,
      });

      expect(result.success).toBe(true);
      // Should send push even though preferences are disabled
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: expect.objectContaining({
          title: 'Critical Notification',
          data: expect.objectContaining({
            critical: true,
          }),
        }),
      });
    });

    it('should handle notification creation failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
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
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      });

      const result = await sendSubscriptionNotification({
        userId: mockUserId,
        title: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('notifySubscriptionRenewed', () => {
    it('should send renewal notification with formatted date', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { push_enabled: true, in_app_enabled: true },
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await notifySubscriptionRenewed(mockUserId, mockNextBillingDate);

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('user_notifications');
      
      const insertCall = (supabase.from as jest.Mock).mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.title).toContain('Renewed');
      expect(insertCall.data.event).toBe('subscription_renewed');
      expect(insertCall.data.next_billing_date).toBe(mockNextBillingDate);
    });
  });

  describe('notifyCancellationConfirmed', () => {
    it('should send cancellation notification with grace period info', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { push_enabled: true, in_app_enabled: true },
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const accessUntil = '2026-04-30T00:00:00Z';
      const result = await notifyCancellationConfirmed(mockUserId, accessUntil);

      expect(result.success).toBe(true);
      
      const insertCall = (supabase.from as jest.Mock).mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.title).toContain('Cancelled');
      expect(insertCall.message).toContain('90-day grace period');
      expect(insertCall.data.event).toBe('subscription_cancelled');
    });
  });

  describe('notifyPaymentFailed', () => {
    it('should send critical payment failure notification for retry 1', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { push_enabled: false }, // preferences disabled
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await notifyPaymentFailed(mockUserId, 1);

      expect(result.success).toBe(true);
      
      const insertCall = (supabase.from as jest.Mock).mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.title).toContain('Payment Failed');
      expect(insertCall.data.critical).toBe(true);
      expect(insertCall.data.retry_count).toBe(1);
      
      // Should send push despite preferences being disabled (critical notification)
      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', expect.any(Object));
    });

    it('should send escalated message for retry 2', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
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
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await notifyPaymentFailed(mockUserId, 2);

      expect(result.success).toBe(true);
      
      const insertCall = (supabase.from as jest.Mock).mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.message).toContain('declined again');
    });

    it('should send final warning for retry 3', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
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
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await notifyPaymentFailed(mockUserId, 3);

      expect(result.success).toBe(true);
      
      const insertCall = (supabase.from as jest.Mock).mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.message).toContain('Final attempt');
      expect(insertCall.message).toContain('immediately');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing preferences gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
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
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

      const result = await sendSubscriptionNotification({
        userId: mockUserId,
        title: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(true);
      // Should default to enabled channels
      expect(supabase.functions.invoke).toHaveBeenCalled();
    });

    it('should continue if push notification fails', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { push_enabled: true },
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        error: { message: 'Push notification service unavailable' },
      });

      const result = await sendSubscriptionNotification({
        userId: mockUserId,
        title: 'Test',
        body: 'Test',
      });

      // Should still succeed even if push fails
      expect(result.success).toBe(true);
    });
  });
});
