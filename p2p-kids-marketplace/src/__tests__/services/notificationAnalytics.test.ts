/**
 * FILE: p2p-kids-marketplace/src/__tests__/services/notificationAnalytics.test.ts
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
 * TASK: Unit Tests for Notification Analytics Service
 */

import { NotificationAnalyticsService } from '@/services/notificationAnalytics';
import { supabase } from '@/config/supabase';
import * as Notifications from 'expo-notifications';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
}));

describe('NotificationAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset initialized state
    (NotificationAnalyticsService as any).initialized = false;
  });

  describe('trackDelivered', () => {
    it('should track delivered event successfully', async () => {
      const mockNotificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await NotificationAnalyticsService.trackDelivered(mockNotificationId);

      expect(supabase.rpc).toHaveBeenCalledWith('track_notification_event', {
        p_notification_id: mockNotificationId,
        p_event_type: 'delivered',
        p_event_data: expect.objectContaining({
          timestamp: expect.any(String),
        }),
      });
    });

    it('should handle RPC errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (supabase.rpc as jest.Mock).mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await NotificationAnalyticsService.trackDelivered('test-id');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('trackDelivered error'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('trackOpened', () => {
    it('should track opened event successfully', async () => {
      const mockNotificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await NotificationAnalyticsService.trackOpened(mockNotificationId);

      expect(supabase.rpc).toHaveBeenCalledWith('track_notification_event', {
        p_notification_id: mockNotificationId,
        p_event_type: 'opened',
        p_event_data: expect.objectContaining({
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('trackClicked', () => {
    it('should track clicked event with deep link', async () => {
      const mockNotificationId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDeepLink = 'app://trade/123';
      
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await NotificationAnalyticsService.trackClicked(mockNotificationId, mockDeepLink);

      expect(supabase.rpc).toHaveBeenCalledWith('track_notification_event', {
        p_notification_id: mockNotificationId,
        p_event_type: 'clicked',
        p_event_data: expect.objectContaining({
          deep_link: mockDeepLink,
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('trackFailed', () => {
    it('should track failed event with error message', async () => {
      const mockNotificationId = '123e4567-e89b-12d3-a456-426614174000';
      const mockError = 'Invalid push token';
      
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await NotificationAnalyticsService.trackFailed(mockNotificationId, mockError);

      expect(supabase.rpc).toHaveBeenCalledWith('track_notification_event', {
        p_notification_id: mockNotificationId,
        p_event_type: 'failed',
        p_event_data: expect.objectContaining({
          error: mockError,
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('initialize', () => {
    it('should set up notification listeners', () => {
      NotificationAnalyticsService.initialize();

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect((NotificationAnalyticsService as any).initialized).toBe(true);
    });

    it('should not initialize twice', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      NotificationAnalyticsService.initialize();
      NotificationAnalyticsService.initialize();

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );

      consoleSpy.mockRestore();
    });

    it('should track opened and clicked when notification is tapped', async () => {
      const trackOpenedSpy = jest.spyOn(NotificationAnalyticsService, 'trackOpened').mockResolvedValue();
      const trackClickedSpy = jest.spyOn(NotificationAnalyticsService, 'trackClicked').mockResolvedValue();

      let responseListener: any;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((listener) => {
        responseListener = listener;
      });

      NotificationAnalyticsService.initialize();

      // Simulate notification response
      const mockResponse = {
        notification: {
          request: {
            content: {
              data: {
                notification_id: 'test-notif-id',
                deep_link: 'app://trade/123',
              },
            },
          },
        },
        actionIdentifier: 'default',
      };

      responseListener(mockResponse);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(trackOpenedSpy).toHaveBeenCalledWith('test-notif-id');
      expect(trackClickedSpy).toHaveBeenCalledWith('test-notif-id', 'app://trade/123');

      trackOpenedSpy.mockRestore();
      trackClickedSpy.mockRestore();
    });
  });

  describe('getAnalytics', () => {
    it('should fetch analytics data successfully', async () => {
      const mockAnalytics = {
        total_sent: 100,
        by_category: [],
        by_type: [],
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockAnalytics, error: null });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const result = await NotificationAnalyticsService.getAnalytics(startDate, endDate, 'sp_events');

      expect(supabase.rpc).toHaveBeenCalledWith('get_notification_analytics', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_category: 'sp_events',
      });
      expect(result).toEqual(mockAnalytics);
    });

    it('should handle null category parameter', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: {}, error: null });

      const startDate = new Date();
      const endDate = new Date();

      await NotificationAnalyticsService.getAnalytics(startDate, endDate);

      expect(supabase.rpc).toHaveBeenCalledWith('get_notification_analytics', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_category: null,
      });
    });

    it('should return null on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (supabase.rpc as jest.Mock).mockResolvedValue({ 
        data: null, 
        error: { message: 'RPC error' } 
      });

      const result = await NotificationAnalyticsService.getAnalytics(new Date(), new Date());

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getABTestPerformance', () => {
    it('should fetch A/B test performance data', async () => {
      const mockPerformance = {
        notification_type: 'sp_earned',
        variants: [
          { variant: 'control', total_sent: 50, open_rate: 45.0 },
          { variant: 'variant_a', total_sent: 50, open_rate: 52.0 },
        ],
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockPerformance, error: null });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const result = await NotificationAnalyticsService.getABTestPerformance(
        'sp_earned',
        startDate,
        endDate
      );

      expect(supabase.rpc).toHaveBeenCalledWith('get_ab_test_performance', {
        p_notification_type: 'sp_earned',
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      expect(result).toEqual(mockPerformance);
    });
  });
});
