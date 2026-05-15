/**
 * FILE: p2p-kids-marketplace/src/services/notificationAnalytics.ts
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
 * TASK: Notification Analytics & Metrics
 *
 * Service for tracking notification events (delivery, open, click, failure)
 * and integrating with Expo Notifications for analytics
 */

import { supabase } from '@/config/supabase';
import Constants from 'expo-constants';

export interface NotificationEvent {
  notification_id: string;
  event_type: 'delivered' | 'opened' | 'clicked' | 'failed';
  event_data?: Record<string, any>;
}

export class NotificationAnalyticsService {
  private static initialized = false;

  private static isTransientNetworkError(error: unknown): boolean {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String((error as { message?: unknown } | null)?.message || '');

    const normalized = message.toLowerCase();

    return (
      normalized.includes('network request failed') ||
      normalized.includes('fetch failed') ||
      normalized.includes('failed to fetch') ||
      normalized.includes('timeout') ||
      normalized.includes('timed out')
    );
  }

  private static logServiceError(context: string, error: unknown): void {
    if (this.isTransientNetworkError(error)) {
      console.warn(`[NotificationAnalytics] ${context} skipped due transient network issue`);
      return;
    }

    console.error(`[NotificationAnalytics] ${context}:`, error);
  }

  private static getNotificationsModule(): (typeof import('expo-notifications')) | null {
    if (Constants?.appOwnership === 'expo') {
      return null;
    }

    return require('expo-notifications') as typeof import('expo-notifications');
  }

  private static getNotificationId(
    notificationData: Record<string, unknown> | undefined
  ): string | null {
    const snakeCaseId = notificationData?.notification_id;
    if (typeof snakeCaseId === 'string' && snakeCaseId.length > 0) {
      return snakeCaseId;
    }

    const camelCaseId = notificationData?.notificationId;
    if (typeof camelCaseId === 'string' && camelCaseId.length > 0) {
      return camelCaseId;
    }

    return null;
  }

  private static getDeepLink(notificationData: Record<string, unknown> | undefined): string | null {
    const snakeCaseDeepLink = notificationData?.deep_link;
    if (typeof snakeCaseDeepLink === 'string' && snakeCaseDeepLink.length > 0) {
      return snakeCaseDeepLink;
    }

    const camelCaseDeepLink = notificationData?.deepLink;
    if (typeof camelCaseDeepLink === 'string' && camelCaseDeepLink.length > 0) {
      return camelCaseDeepLink;
    }

    return null;
  }

  /**
   * Track notification delivered event
   */
  static async trackDelivered(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_notification_event', {
        p_notification_id: notificationId,
        p_event_type: 'delivered',
        p_event_data: {
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        this.logServiceError('trackDelivered error', error);
      }
    } catch (err) {
      this.logServiceError('trackDelivered exception', err);
    }
  }

  /**
   * Track notification opened event
   */
  static async trackOpened(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_notification_event', {
        p_notification_id: notificationId,
        p_event_type: 'opened',
        p_event_data: {
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        this.logServiceError('trackOpened error', error);
      }
    } catch (err) {
      this.logServiceError('trackOpened exception', err);
    }
  }

  /**
   * Track notification clicked event (deep link followed)
   */
  static async trackClicked(notificationId: string, deepLink: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_notification_event', {
        p_notification_id: notificationId,
        p_event_type: 'clicked',
        p_event_data: {
          deep_link: deepLink,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        this.logServiceError('trackClicked error', error);
      }
    } catch (err) {
      this.logServiceError('trackClicked exception', err);
    }
  }

  /**
   * Track notification failure event
   */
  static async trackFailed(notificationId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_notification_event', {
        p_notification_id: notificationId,
        p_event_type: 'failed',
        p_event_data: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        this.logServiceError('trackFailed error', error);
      }
    } catch (err) {
      this.logServiceError('trackFailed exception', err);
    }
  }

  /**
   * Initialize analytics tracking listeners
   * Call this once in App.tsx or main entry point
   */
  static initialize(): void {
    if (this.initialized) {
      console.warn('[NotificationAnalytics] Already initialized, skipping');
      return;
    }

    const Notifications = this.getNotificationsModule();
    if (!Notifications) {
      this.initialized = true;
      console.log('[NotificationAnalytics] Skipped in Expo Go (dev build required for remote push)');
      return;
    }

    console.log('[NotificationAnalytics] Initializing analytics tracking...');

    // Track notification opens and clicks
    Notifications.addNotificationResponseReceivedListener((response) => {
      const notificationData = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const notificationId = this.getNotificationId(notificationData);

      if (!notificationId) {
        console.warn('[NotificationAnalytics] No notification id in response data');
        return;
      }

      console.log('[NotificationAnalytics] Notification interaction detected:', {
        notificationId,
        actionIdentifier: response.actionIdentifier,
      });

      // Track opened
      this.trackOpened(notificationId);

      // Track click if deep link present
      const deepLink = this.getDeepLink(notificationData);
      if (deepLink) {
        console.log('[NotificationAnalytics] Deep link detected:', deepLink);
        this.trackClicked(notificationId, deepLink);
      }
    });

    // Track notification received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      const notificationData = notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const notificationId = this.getNotificationId(notificationData);

      if (notificationId) {
        console.log('[NotificationAnalytics] Notification received (foreground):', notificationId);
        this.trackDelivered(notificationId);
      }
    });

    this.initialized = true;
    console.log('[NotificationAnalytics] Analytics tracking initialized');
  }

  /**
   * Get analytics for a specific date range (for admin dashboard)
   */
  static async getAnalytics(startDate: Date, endDate: Date, category?: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_notification_analytics', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_category: category || null,
      });

      if (error) {
        this.logServiceError('getAnalytics error', error);
        return null;
      }

      return data;
    } catch (err) {
      this.logServiceError('getAnalytics exception', err);
      return null;
    }
  }

  /**
   * Get A/B test performance for a specific notification type
   */
  static async getABTestPerformance(
    notificationType: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_ab_test_performance', {
        p_notification_type: notificationType,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });

      if (error) {
        this.logServiceError('getABTestPerformance error', error);
        return null;
      }

      return data;
    } catch (err) {
      this.logServiceError('getABTestPerformance exception', err);
      return null;
    }
  }
}
