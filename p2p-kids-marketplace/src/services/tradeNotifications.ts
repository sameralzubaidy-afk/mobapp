// filepath: p2p-kids-marketplace/src/services/tradeNotifications.ts
// MODULE-14 TASK NOTIF-V2-007: Trade Event Notifications
// Service layer for trade lifecycle notifications.
//
// Architecture:
// - DB triggers (145_trade_notifications.sql) create user_notifications rows
//   for in-app notification center.
// - This service provides:
//   1. sendTradeNotificationPush() — fire push via send-push-notification Edge Function
//   2. getTradeNotifications()     — fetch trade notifications for current user
//   3. markTradeNotificationRead() — mark a single notification as read

import { supabase } from '@/config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeNotificationType =
  | 'trade_request'
  | 'trade_completion_requested'
  | 'trade_accepted'
  | 'trade_rejected'
  | 'trade_completed'
  | 'trade_cancelled';

export interface TradeNotificationData {
  trade_id: string;
  item_id: string;
  item_title: string;
  buyer_id?: string;
  buyer_name?: string;
  deep_link: string;
  type: TradeNotificationType;
}

export interface TradeNotification {
  id: string;
  user_id: string;
  category: 'trades';
  type: TradeNotificationType;
  title: string;
  body: string;
  data: TradeNotificationData;
  is_read: boolean;
  channels: string[];
  created_at: string;
  read_at: string | null;
}

export interface SendTradeNotificationResult {
  success: boolean;
  error?: string;
}

export interface GetTradeNotificationsResult {
  data: TradeNotification[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPushTitle(type: TradeNotificationType): string {
  switch (type) {
    case 'trade_request':
      return 'New Trade Request! 💬';
    case 'trade_completion_requested':
      return 'Trade Ready for Your Confirmation';
    case 'trade_accepted':
      return 'Trade Accepted! ✅';
    case 'trade_rejected':
      return 'Trade Declined';
    case 'trade_completed':
      return 'Trade Complete! 🎉';
    case 'trade_cancelled':
      return 'Trade Cancelled';
    default:
      return 'Trade Update';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a push notification for a trade lifecycle event.
 *
 * Called from the mobile app after a trade action (create, seller-mark-complete,
 * complete, cancel) to ensure the counterparty receives a push notification.
 * The in-app notification row is created by the DB trigger; this function
 * handles the push delivery.
 *
 * @param recipientUserId  - User ID of the notification recipient
 * @param notificationType - Trade lifecycle event type
 * @param body             - Human-readable notification body text
 * @param data             - Trade metadata payload (included in push data)
 */
export async function sendTradeNotificationPush(
  recipientUserId: string,
  notificationType: TradeNotificationType,
  body: string,
  data: TradeNotificationData
): Promise<SendTradeNotificationResult> {
  if (!recipientUserId || !notificationType) {
    return { success: false, error: 'recipientUserId and notificationType are required' };
  }

  try {
    // Check recipient's trade notification preferences before sending push
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', recipientUserId)
      .eq('category', 'trades')
      .maybeSingle();

    // If preference row exists and push is disabled, skip push
    if (prefs !== null && prefs.push_enabled === false) {
      console.log(
        `[tradeNotifications] push disabled for user ${recipientUserId} (trades category)`
      );
      return { success: true };
    }

    const title = buildPushTitle(notificationType);

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: recipientUserId,
        title,
        body,
        data: {
          ...data,
          type: notificationType,
          category: 'trades',
        },
        priority: 'high',
      },
    });

    if (error) {
      console.warn('[tradeNotifications] Push notification failed:', error.message);
      // Non-fatal: the in-app notification was still created by the DB trigger
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error(
      '[tradeNotifications] Unexpected error in sendTradeNotificationPush:',
      error.message
    );
    return { success: false, error: error.message };
  }
}

/**
 * Fetch trade notifications for the currently authenticated user.
 * Returns newest-first, only unread by default.
 *
 * @param userId    - Authenticated user ID
 * @param unreadOnly - When true, only includes unread notifications (default: false)
 * @param limit      - Maximum number of rows to return (default: 20)
 */
export async function getTradeNotifications(
  userId: string,
  unreadOnly = false,
  limit = 20
): Promise<GetTradeNotificationsResult> {
  try {
    let query = supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('category', 'trades')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[tradeNotifications] Error fetching notifications:', error.message);
      return { data: [], error: error.message };
    }

    return { data: (data ?? []) as TradeNotification[] };
  } catch (err) {
    const error = err as Error;
    console.error('[tradeNotifications] Unexpected error in getTradeNotifications:', error.message);
    return { data: [], error: error.message };
  }
}

/**
 * Mark a single trade notification as read.
 *
 * @param notificationId - UUID of the user_notifications row
 */
export async function markTradeNotificationRead(
  notificationId: string
): Promise<SendTradeNotificationResult> {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString(), is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[tradeNotifications] Error marking notification read:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error(
      '[tradeNotifications] Unexpected error in markTradeNotificationRead:',
      error.message
    );
    return { success: false, error: error.message };
  }
}

/**
 * Mark all trade notifications for a user as read in one call.
 *
 * @param userId - Authenticated user ID
 */
export async function markAllTradeNotificationsRead(
  userId: string
): Promise<SendTradeNotificationResult> {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString(), is_read: true })
      .eq('user_id', userId)
      .eq('category', 'trades')
      .is('read_at', null);

    if (error) {
      console.error(
        '[tradeNotifications] Error marking all trade notifications read:',
        error.message
      );
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error(
      '[tradeNotifications] Unexpected error in markAllTradeNotificationsRead:',
      error.message
    );
    return { success: false, error: error.message };
  }
}

/**
 * Get count of unread trade notifications for badge/indicator display.
 *
 * @param userId - Authenticated user ID
 */
export async function getUnreadTradeNotificationCount(
  userId: string
): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category', 'trades')
      .is('read_at', null);

    if (error) {
      console.error('[tradeNotifications] Error fetching unread count:', error.message);
      return { count: 0, error: error.message };
    }

    return { count: count ?? 0 };
  } catch (err) {
    const error = err as Error;
    console.error(
      '[tradeNotifications] Unexpected error in getUnreadTradeNotificationCount:',
      error.message
    );
    return { count: 0, error: error.message };
  }
}
