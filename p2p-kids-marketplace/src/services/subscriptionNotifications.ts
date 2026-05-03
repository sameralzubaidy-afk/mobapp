/**
 * File: p2p-kids-marketplace/src/services/subscriptionNotifications.ts
 * MODULE-14 TASK NOTIF-V2-002: Subscription Event Notifications
 *
 * Service for sending subscription lifecycle notifications
 * Integrates with existing notification infrastructure
 */

import { supabase } from '../config/supabase';

export interface SubscriptionNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  critical?: boolean; // If true, ignores user preferences
}

/**
 * Send a subscription-related notification
 * Respects user notification preferences unless marked critical
 *
 * @param options - Notification options
 * @returns Success status
 */
export async function sendSubscriptionNotification(
  options: SubscriptionNotificationOptions
): Promise<{ success: boolean; error?: string }> {
  const { userId, title, body, data = {}, critical = false } = options;

  try {
    // Get user notification preferences
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('push_enabled, in_app_enabled, email_enabled')
      .eq('user_id', userId)
      .eq('category', 'subscription')
      .maybeSingle();

    if (prefError) {
      console.error('[subscriptionNotifications] Failed to fetch preferences:', prefError);
      // Continue anyway - use default preferences
    }

    // Determine channels based on preferences or critical flag
    const channels: string[] = [];

    if (critical) {
      // Critical notifications bypass preferences
      channels.push('push', 'in_app', 'email');
    } else {
      // Respect user preferences
      if (preferences?.push_enabled !== false) {
        channels.push('push');
      }
      if (preferences?.in_app_enabled !== false) {
        channels.push('in_app');
      }
      if (preferences?.email_enabled === true) {
        channels.push('email');
      }
    }

    const notificationData = {
      ...data,
      critical: critical || undefined,
    };

    // Use security-definer RPC so server-side notification creation works under RLS.
    const { error: insertError } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: 'subscription',
      p_title: title,
      p_body: body,
      p_data: notificationData,
    });

    if (insertError) {
      console.error('[subscriptionNotifications] Failed to create notification:', insertError);
      return { success: false, error: insertError.message };
    }

    // Send push notification if enabled
    if (channels.includes('push')) {
      const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: userId,
          title,
          body,
          data: {
            ...notificationData,
            type: 'subscription',
          },
        },
      });

      if (pushError) {
        console.warn('[subscriptionNotifications] Push notification failed:', pushError);
        // Don't fail the whole operation if push fails
      }
    }

    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error('[subscriptionNotifications] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send subscription renewal success notification
 *
 * @param userId - User ID
 * @param nextBillingDate - Next billing date
 */
export async function notifySubscriptionRenewed(
  userId: string,
  nextBillingDate: string
): Promise<{ success: boolean; error?: string }> {
  const formattedDate = new Date(nextBillingDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return sendSubscriptionNotification({
    userId,
    title: 'Subscription Renewed ✅',
    body: `Your Kids Club+ subscription has been renewed. Your next billing date is ${formattedDate}.`,
    data: {
      event: 'subscription_renewed',
      next_billing_date: nextBillingDate,
      deep_link: '/profile/subscription',
    },
    critical: false,
  });
}

/**
 * Send subscription cancellation confirmation notification
 *
 * @param userId - User ID
 * @param accessUntil - Date when access ends
 */
export async function notifyCancellationConfirmed(
  userId: string,
  accessUntil: string
): Promise<{ success: boolean; error?: string }> {
  const formattedDate = new Date(accessUntil).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return sendSubscriptionNotification({
    userId,
    title: 'Subscription Cancelled',
    body: `Your Kids Club+ subscription has been cancelled. You'll have access until ${formattedDate}, then enter a 90-day grace period where your Swap Points will be frozen.`,
    data: {
      event: 'subscription_cancelled',
      access_until: accessUntil,
      deep_link: '/profile/subscription',
    },
    critical: false,
  });
}

/**
 * Send payment failure notification (CRITICAL)
 * Always sent regardless of user preferences
 *
 * @param userId - User ID
 * @param retryCount - Current retry count (1-3)
 */
export async function notifyPaymentFailed(
  userId: string,
  retryCount: number
): Promise<{ success: boolean; error?: string }> {
  const messages = {
    1: 'Your payment was declined. Please update your payment method to keep your subscription active.',
    2: 'Your subscription payment was declined again. Please update your payment method to avoid service interruption.',
    3: 'Final attempt failed. Your subscription will be paused soon. Please update your payment method immediately.',
  };

  const body = messages[retryCount as keyof typeof messages] || messages[1];

  return sendSubscriptionNotification({
    userId,
    title: '⚠️ Payment Failed - Action Required',
    body,
    data: {
      event: 'payment_failed',
      retry_count: retryCount,
      action_required: true,
      deep_link: '/profile/subscription',
    },
    critical: true, // Critical notification - bypasses preferences
  });
}
