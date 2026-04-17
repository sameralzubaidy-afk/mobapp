// File: p2p-kids-marketplace/src/services/referralNotifications.ts
// MODULE: MODULE-17-REFERRALS-V2 (REF-V2-005)
// Service for managing referral-specific notifications

import { supabase } from './supabase/client';

export interface UserNotification {
  id: string;
  user_id: string;
  category: string;
  type: string;
  title: string;
  body: string;
  channels: string[];
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationStats {
  unread_count: number;
  total_count: number;
}

/**
 * Get all notifications for a user
 * @param userId - User ID to fetch notifications for
 * @param limit - Maximum number of notifications to return (default: 50)
 * @param offset - Number of notifications to skip (for pagination)
 */
export const getUserNotifications = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: UserNotification[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[ReferralNotifications] Failed to fetch notifications:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as UserNotification[] };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error fetching notifications:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notification count for a user
 * @param userId - User ID to get count for
 */
export const getUnreadNotificationCount = async (
  userId: string
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[ReferralNotifications] Failed to get unread count:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, count: data as number };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error getting unread count:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a single notification as read
 * @param notificationId - Notification ID to mark as read
 * @param userId - User ID (for authorization)
 */
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
      p_user_id: userId,
    });

    if (error) {
      console.error('[ReferralNotifications] Failed to mark notification as read:', error.message);
      return { success: false, error: error.message };
    }

    return data as { success: boolean; error?: string };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error marking notification as read:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read for a user
 * @param userId - User ID to mark all notifications as read
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<{ success: boolean; updated_count?: number; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[ReferralNotifications] Failed to mark all as read:', error.message);
      return { success: false, error: error.message };
    }

    return data as { success: boolean; updated_count?: number; error?: string };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error marking all as read:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get notification statistics for a user
 * @param userId - User ID to get stats for
 */
export const getNotificationStats = async (
  userId: string
): Promise<{ success: boolean; stats?: NotificationStats; error?: string }> => {
  try {
    const [unreadResult, totalResult] = await Promise.all([
      getUnreadNotificationCount(userId),
      supabase.from('user_notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    if (!unreadResult.success) {
      return { success: false, error: unreadResult.error };
    }

    if (totalResult.error) {
      console.error('[ReferralNotifications] Failed to get total count:', totalResult.error.message);
      return { success: false, error: totalResult.error.message };
    }

    return {
      success: true,
      stats: {
        unread_count: unreadResult.count || 0,
        total_count: totalResult.count || 0,
      },
    };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error getting notification stats:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a custom referral notification (manual trigger)
 * @param userId - User ID to send notification to
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Additional data (deep link, etc.)
 */
export const sendCustomReferralNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('user_notifications').insert({
      user_id: userId,
      category: 'system',
      type: 'referral_custom',
      title,
      body,
      channels: ['push', 'in_app'],
      data: {
        deep_link: 'ReferralDashboard',
        ...data,
      },
    });

    if (error) {
      console.error('[ReferralNotifications] Failed to send custom notification:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error sending custom notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to realtime notifications for a user
 * @param userId - User ID to subscribe to
 * @param onNotification - Callback when new notification received
 * @returns Unsubscribe function
 */
export const subscribeToNotifications = (
  userId: string,
  onNotification: (notification: UserNotification) => void
): (() => void) => {
  try {
    // Use a unique topic per subscriber instance so remounts cannot reuse an already
    // subscribed channel and trigger "cannot add postgres_changes callbacks after subscribe".
    const channelTopic = `notifications:${userId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const channel = supabase.channel(channelTopic);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notification = payload.new as UserNotification;
        onNotification(notification);
      }
    );

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[ReferralNotifications] Realtime channel error:', channelTopic);
      }
    });

    // Return cleanup function
    return () => {
      // removeChannel ensures the channel is detached from the client registry,
      // preventing stale topic reuse across screen transitions.
      void supabase.removeChannel(channel);
    };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Failed to subscribe to realtime notifications:', error.message);
    return () => {};
  }
};

/**
 * Get referral-specific notifications only
 * @param userId - User ID to fetch notifications for
 * @param limit - Maximum number of notifications to return
 */
export const getReferralNotifications = async (
  userId: string,
  limit: number = 20
): Promise<{ success: boolean; data?: UserNotification[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['referral_invite_accepted', 'referral_rewards_granted', 'referral_welcome_bonus', 'referral_custom'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ReferralNotifications] Failed to fetch referral notifications:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as UserNotification[] };
  } catch (err) {
    const error = err as Error;
    console.error('[ReferralNotifications] Error fetching referral notifications:', error.message);
    return { success: false, error: error.message };
  }
};
