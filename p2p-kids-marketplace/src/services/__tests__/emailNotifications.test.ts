/**
 * Unit Tests: Email Notifications Service
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email Notifications - Unit Tests
 */

import {
  sendPaymentFailureEmail,
  sendTrialExpiringEmail,
  sendSubscriptionCancelledEmail,
  sendSecurityAlertEmail,
  sendPasswordChangedEmail,
  getUserEmailStats,
} from '../emailNotifications';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('EmailNotifications Service', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPaymentFailureEmail', () => {
    it('should send payment failure email successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, logId: 'log-123' },
        error: null,
      });

      const result = await sendPaymentFailureEmail(
        mockUserId,
        mockUserEmail,
        'sub_123',
        9.99,
        'Insufficient funds'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: {
          type: 'payment_failed',
          to: mockUserEmail,
          userId: mockUserId,
          category: 'subscription',
          isCritical: true,
          data: {
            subscriptionId: 'sub_123',
            amount: 9.99,
            reason: 'Insufficient funds',
          },
        },
      });

      expect(result).toEqual({
        success: true,
        logId: 'log-123',
      });
    });

    it('should handle errors gracefully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const result = await sendPaymentFailureEmail(
        mockUserId,
        mockUserEmail,
        'sub_123',
        9.99,
        'Insufficient funds'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('sendTrialExpiringEmail', () => {
    it('should send trial expiring email successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, logId: 'log-456' },
        error: null,
      });

      const result = await sendTrialExpiringEmail(
        mockUserId,
        mockUserEmail,
        7,
        '2026-05-01T00:00:00Z'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: {
          type: 'trial_expiring',
          to: mockUserEmail,
          userId: mockUserId,
          category: 'subscription',
          isCritical: false,
          data: {
            daysRemaining: 7,
            trialEndsAt: '2026-05-01T00:00:00Z',
          },
        },
      });

      expect(result).toEqual({
        success: true,
        logId: 'log-456',
        skipped: undefined,
      });
    });

    it('should mark email as skipped if user has email disabled', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, skipped: true },
        error: null,
      });

      const result = await sendTrialExpiringEmail(
        mockUserId,
        mockUserEmail,
        3,
        '2026-05-01T00:00:00Z'
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('sendSubscriptionCancelledEmail', () => {
    it('should send subscription cancelled email successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, logId: 'log-789' },
        error: null,
      });

      const result = await sendSubscriptionCancelledEmail(
        mockUserId,
        mockUserEmail,
        '2026-08-01T00:00:00Z'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: {
          type: 'subscription_cancelled',
          to: mockUserEmail,
          userId: mockUserId,
          category: 'subscription',
          isCritical: true,
          data: {
            gracePeriodEndsAt: '2026-08-01T00:00:00Z',
          },
        },
      });

      expect(result).toEqual({
        success: true,
        logId: 'log-789',
      });
    });
  });

  describe('sendSecurityAlertEmail', () => {
    it('should send security alert email successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, logId: 'log-101' },
        error: null,
      });

      const result = await sendSecurityAlertEmail(
        mockUserId,
        mockUserEmail,
        'password_change',
        'Your password was changed from a new device'
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: {
          type: 'security_alert',
          to: mockUserEmail,
          userId: mockUserId,
          category: 'system',
          isCritical: true,
          data: {
            alertType: 'password_change',
            alertMessage: 'Your password was changed from a new device',
          },
        },
      });

      expect(result).toEqual({
        success: true,
        logId: 'log-101',
      });
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email successfully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, logId: 'log-202' },
        error: null,
      });

      const result = await sendPasswordChangedEmail(mockUserId, mockUserEmail);

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: {
          type: 'password_changed',
          to: mockUserEmail,
          userId: mockUserId,
          category: 'system',
          isCritical: true,
          data: {},
        },
      });

      expect(result).toEqual({
        success: true,
        logId: 'log-202',
      });
    });
  });

  describe('getUserEmailStats', () => {
    it('should return email statistics for a user', async () => {
      const mockLogs = [
        { status: 'sent' },
        { status: 'delivered' },
        { status: 'delivered' },
        { status: 'opened' },
        { status: 'clicked' },
        { status: 'bounced' },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockLogs,
            error: null,
          }),
        }),
      });

      const stats = await getUserEmailStats(mockUserId);

      expect(stats).toEqual({
        total: 6,
        sent: 1,
        delivered: 2,
        opened: 1,
        clicked: 1,
        bounced: 1,
      });
    });

    it('should return zero stats on error', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      const stats = await getUserEmailStats(mockUserId);

      expect(stats).toEqual({
        total: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
      });
    });

    it('should handle exceptions and return zero stats', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const stats = await getUserEmailStats(mockUserId);

      expect(stats).toEqual({
        total: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
      });
    });
  });
});
