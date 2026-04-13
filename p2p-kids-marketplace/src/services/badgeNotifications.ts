// filepath: p2p-kids-marketplace/src/services/badgeNotifications.ts
// TASK: NOTIF-V2-004 - Badge Award Notifications
// Purpose: Service layer for badge notification logic

import { supabase } from '@/config/supabase';
import { Badge } from '@/types/badge';

export interface BadgeNotificationData {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_description: string;
  category: string;
  deep_link: string;
}

export interface MilestoneNotificationData extends BadgeNotificationData {
  current_progress: number;
  threshold: number;
  remaining: number;
}

/**
 * Check badge milestones for a user and send "almost there" notifications
 * Milestone notifications are sent when user is close to earning next badge:
 * - Within 5 SP of next SP badge
 * - Within 2 trades of next trade badge
 * 
 * Deduplication: Only sends once per badge per 7 days
 * 
 * @param userId - User ID to check milestones for
 * @returns Success/failure result
 */
export const checkBadgeMilestones = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('check_badge_milestones', {
      p_user_id: userId,
    });

    if (error) {
      const isDeprecatedMvpMilestoneError =
        error.code === '42703' &&
        /sp_available|transactions|milestone/i.test(error.message || '');

      if (isDeprecatedMvpMilestoneError) {
        // Milestones are decommissioned in MVP; treat legacy RPC schema errors as no-op.
        return { success: true };
      }

      console.error('[badgeNotifications] Error checking milestones:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error('[badgeNotifications] Unexpected error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch unread badge notifications for user
 * Used to display badge notifications in notification center
 * 
 * @param userId - User ID to fetch notifications for
 * @returns Array of badge notifications
 */
export const getBadgeNotifications = async (
  userId: string
): Promise<{ data: any[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('category', 'badges')
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[badgeNotifications] Error fetching notifications:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (err) {
    const error = err as Error;
    console.error('[badgeNotifications] Unexpected error:', error);
    return { data: [], error: error.message };
  }
};

/**
 * Mark badge notification as read
 * 
 * @param notificationId - Notification ID to mark as read
 * @returns Success/failure result
 */
export const markBadgeNotificationRead = async (
  notificationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error('[badgeNotifications] Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error('[badgeNotifications] Unexpected error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification for badge award via Edge Function
 * This is called from the app when a new badge is awarded
 * 
 * @param userId - User ID who earned the badge
 * @param badge - Badge details
 * @returns Success/failure result
 */
export const sendBadgeAwardPushNotification = async (
  userId: string,
  badge: Badge
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: `New Badge Earned! ${badge.icon_url || '🏆'}`,
        body: `Congratulations! You earned the "${badge.name}" badge: ${badge.description}`,
        data: {
          badge_id: badge.id,
          badge_name: badge.name,
          category: 'badges',
          deep_link: '/profile/badges',
        },
        priority: 'high',
      },
    });

    if (error) {
      console.warn('[badgeNotifications] Error sending push notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn('[badgeNotifications] Unexpected error sending push:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Parse badge notification data from notification row
 * 
 * @param notification - Notification row from database
 * @returns Parsed badge notification data
 */
export const parseBadgeNotificationData = (
  notification: any
): BadgeNotificationData | MilestoneNotificationData | null => {
  try {
    if (!notification.data) {
      return null;
    }

    const data = typeof notification.data === 'string' 
      ? JSON.parse(notification.data) 
      : notification.data;

    return data as BadgeNotificationData | MilestoneNotificationData;
  } catch (err) {
    console.error('[badgeNotifications] Error parsing notification data:', err);
    return null;
  }
};
