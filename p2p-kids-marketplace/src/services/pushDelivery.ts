// File: p2p-kids-marketplace/src/services/pushDelivery.ts
// Centralized Push Notification Delivery Engine
// React Native-safe implementation: calls Supabase Edge Function for sends.

import { supabase } from '../config/supabase';

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
    [key: string]: unknown;
  };
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
    [key: string]: unknown;
  };
}

export interface PushDeliveryOptions {
  userId: string;
  notificationId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: string; // e.g., 'sp_earned', 'badge_earned'
  fingerprint?: string; // For deduplication (can be hash of type + key data)
  critical?: boolean; // If true, bypass quiet hours and rate limits
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushDeliveryResult {
  success: boolean;
  sent: boolean; // false if rate-limited or in quiet hours
  rateLimited?: boolean;
  inQuietHours?: boolean;
  duplicate?: boolean;
  error?: string;
  ticketId?: string;
  receipts?: ExpoPushReceipt[];
}

const isExpoPushToken = (token: string): boolean => /^ExponentPushToken\[.+\]$/.test(token);

/**
 * Check if user can receive push notification (not rate-limited)
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_push_rate_limit', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[pushDelivery] Rate limit check error:', error);
      return false; // Fail closed - don't send if check fails
    }

    return data === true;
  } catch (err) {
    console.error('[pushDelivery] Rate limit check exception:', err);
    return false;
  }
}

/**
 * Check if user is currently in quiet hours
 */
async function checkQuietHours(userId: string): Promise<boolean> {
  try {
    const localTime = new Date().toTimeString().slice(0, 8);

    const { data, error } = await supabase.rpc('is_in_quiet_hours', {
      p_user_id: userId,
      p_current_time: localTime,
    });

    if (error) {
      const message = (error as { message?: string }).message || '';

      // Backward compatibility: support older DB function signature is_in_quiet_hours(uuid)
      if (message.includes('function is_in_quiet_hours') && message.includes('does not exist')) {
        const fallback = await supabase.rpc('is_in_quiet_hours', {
          p_user_id: userId,
        });

        if (!fallback.error) {
          return fallback.data === true;
        }
      }

      console.error('[pushDelivery] Quiet hours check error:', error);
      // Fail-safe: if quiet-hours check fails, suppress push to avoid violating user quiet preferences.
      return true;
    }

    return data === true;
  } catch (err) {
    console.error('[pushDelivery] Quiet hours check exception:', err);
    // Fail-safe: if quiet-hours check fails, suppress push to avoid violating user quiet preferences.
    return true;
  }
}

/**
 * Check if notification is a duplicate (within 5-minute window)
 */
async function checkDuplicate(userId: string, type: string, fingerprint: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_duplicate_notification', {
      p_user_id: userId,
      p_notification_type: type,
      p_fingerprint: fingerprint,
    });

    if (error) {
      console.error('[pushDelivery] Duplicate check error:', error);
      return false; // Assume not duplicate if check fails
    }

    return data === true;
  } catch (err) {
    console.error('[pushDelivery] Duplicate check exception:', err);
    return false;
  }
}

/**
 * Record notification for deduplication tracking
 */
async function recordDeduplication(
  userId: string,
  type: string,
  fingerprint: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_notification_dedup', {
      p_user_id: userId,
      p_notification_type: type,
      p_fingerprint: fingerprint,
    });

    if (error) {
      console.error('[pushDelivery] Failed to record deduplication:', error);
    }
  } catch (err) {
    console.error('[pushDelivery] Record deduplication exception:', err);
  }
}

/**
 * Log push delivery attempt
 */
async function logDelivery(
  userId: string,
  notificationId: string | undefined,
  pushTokenId: string,
  ticketId: string | null,
  receiptStatus: string = 'ok',
  receiptMessage: string | null = null,
  receiptDetails: any = null,
  retryCount: number = 0
): Promise<void> {
  try {
    await supabase.rpc('log_push_delivery', {
      p_user_id: userId,
      p_notification_id: notificationId || null,
      p_push_token_id: pushTokenId,
      p_expo_receipt_id: ticketId,
      p_receipt_status: receiptStatus,
      p_receipt_message: receiptMessage,
      p_receipt_details: receiptDetails ? JSON.parse(JSON.stringify(receiptDetails)) : null,
      p_retry_count: retryCount,
    });
  } catch (err) {
    console.error('[pushDelivery] Failed to log delivery:', err);
  }
}

/**
 * Add failed notification to retry queue
 */
async function addToRetryQueue(
  notificationId: string,
  userId: string,
  error: string,
  errorDetails: any = null
): Promise<void> {
  try {
    await supabase.rpc('add_to_retry_queue', {
      p_notification_id: notificationId,
      p_user_id: userId,
      p_error: error,
      p_error_details: errorDetails ? JSON.parse(JSON.stringify(errorDetails)) : null,
    });
  } catch (err) {
    console.error('[pushDelivery] Failed to add to retry queue:', err);
  }
}

/**
 * Remove notification from retry queue (after successful delivery)
 */
async function removeFromRetryQueue(notificationId: string): Promise<void> {
  try {
    await supabase.rpc('remove_from_retry_queue', {
      p_notification_id: notificationId,
    });
  } catch (err) {
    console.error('[pushDelivery] Failed to remove from retry queue:', err);
  }
}

/**
 * Get active push tokens for user
 */
async function getUserPushTokens(userId: string): Promise<Array<{ id: string; token: string }>> {
  try {
    const { data, error } = await supabase
      .from('push_tokens' as never)
      .select('id, token')
      .eq('user_id', userId);

    if (error) {
      console.error('[pushDelivery] Failed to get push tokens:', error);
      return [];
    }

    return (data || []) as Array<{ id: string; token: string }>;
  } catch (err) {
    console.error('[pushDelivery] Get push tokens exception:', err);
    return [];
  }
}

async function sendViaEdgeFunction(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  priority: 'default' | 'normal' | 'high'
): Promise<{
  success: boolean;
  tickets: ExpoPushTicket[];
  error?: string;
  loggedByEdge?: boolean;
}> {
  try {
    const { data: response, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title,
        body,
        data,
        priority,
      },
    });

    if (error) {
      return {
        success: false,
        tickets: [],
        error: error.message,
      };
    }

    const payload = response as {
      success?: boolean;
      message?: string;
      deliveryLogsWritten?: number;
      tickets?: ExpoPushTicket[];
      expoResponse?: { data?: ExpoPushTicket[] };
    };

    const tickets = Array.isArray(payload.tickets)
      ? payload.tickets
      : Array.isArray(payload.expoResponse?.data)
        ? payload.expoResponse?.data || []
        : [];

    return {
      success: payload.success !== false,
      tickets,
      loggedByEdge: typeof payload.deliveryLogsWritten === 'number',
      error: payload.success === false ? payload.message || 'Push send failed' : undefined,
    };
  } catch (err) {
    return {
      success: false,
      tickets: [],
      loggedByEdge: false,
      error: err instanceof Error ? err.message : 'Unknown push send error',
    };
  }
}

/**
 * Send push notification to user with rate limiting, quiet hours, and deduplication
 *
 * @param options - Push delivery options
 * @returns Delivery result with success status and metadata
 */
export async function sendPushNotification(
  options: PushDeliveryOptions
): Promise<PushDeliveryResult> {
  const {
    userId,
    notificationId,
    title,
    body,
    data = {},
    type,
    fingerprint,
    critical = false,
    sound = 'default',
    badge,
    priority = 'default',
  } = options;

  // Generate fingerprint if not provided (hash of type + userId + current minute)
  const actualFingerprint = fingerprint || `${type}-${userId}-${Math.floor(Date.now() / 60000)}`; // 1-minute window for auto-generated fingerprints

  try {
    // 1. Check deduplication (unless critical)
    if (!critical) {
      const isDuplicate = await checkDuplicate(userId, type, actualFingerprint);
      if (isDuplicate) {
        console.log(`[pushDelivery] Duplicate notification blocked: ${type} for user ${userId}`);
        return {
          success: true,
          sent: false,
          duplicate: true,
        };
      }
    }

    // 2. Check rate limit (unless critical)
    if (!critical) {
      const withinRateLimit = await checkRateLimit(userId);
      if (!withinRateLimit) {
        console.log(`[pushDelivery] Rate limit exceeded for user ${userId}`);
        return {
          success: true,
          sent: false,
          rateLimited: true,
        };
      }
    }

    // 3. Check quiet hours (unless critical)
    if (!critical) {
      const inQuietHours = await checkQuietHours(userId);
      if (inQuietHours) {
        console.log(`[pushDelivery] User ${userId} in quiet hours, notification deferred`);
        return {
          success: true,
          sent: false,
          inQuietHours: true,
        };
      }
    }

    // 4. Get user's push tokens
    const pushTokens = await getUserPushTokens(userId);
    if (pushTokens.length === 0) {
      console.warn(`[pushDelivery] No push tokens found for user ${userId}`);
      return {
        success: false,
        sent: false,
        error: 'No push tokens registered',
      };
    }

    const validPushTokens = pushTokens.filter((pt) => isExpoPushToken(pt.token));

    if (validPushTokens.length === 0) {
      console.warn(`[pushDelivery] No valid Expo push tokens for user ${userId}`);
      return {
        success: false,
        sent: false,
        error: 'No valid Expo push tokens',
      };
    }

    // 6. Send push notifications via existing Supabase Edge Function.
    const sendResult = await sendViaEdgeFunction(
      userId,
      title,
      body,
      {
        ...data,
        notificationId,
        type,
        sound,
        badge,
      },
      priority
    );

    if (!sendResult.success) {
      // If edge function did not write logs, record failures locally for observability.
      if (!sendResult.loggedByEdge) {
        const failureTickets = sendResult.tickets || [];

        if (failureTickets.length > 0) {
          for (let i = 0; i < failureTickets.length; i++) {
            const ticket = failureTickets[i];
            const pushToken = validPushTokens[i] || validPushTokens[0];

            if (!pushToken) {
              continue;
            }

            await logDelivery(
              userId,
              notificationId,
              pushToken.id,
              ticket.id ?? null,
              ticket.status === 'ok' ? 'ok' : 'error',
              ticket.message ||
                (ticket.status === 'ok'
                  ? 'Sent to Expo successfully'
                  : 'Expo push ticket returned error status'),
              { ticket },
              0
            );
          }
        } else {
          const fallbackTokenId = validPushTokens[0]?.id;
          if (fallbackTokenId) {
            await logDelivery(
              userId,
              notificationId,
              fallbackTokenId,
              null,
              'error',
              sendResult.error || 'Failed to send push notification',
              {
                source: 'pushDelivery.local-fallback',
              },
              0
            );
          }
        }
      }

      if (notificationId) {
        await addToRetryQueue(
          notificationId,
          userId,
          sendResult.error || 'Failed to send push notification',
          null
        );
      }

      return {
        success: false,
        sent: false,
        error: sendResult.error || 'Failed to send push notification',
      };
    }

    const tickets: ExpoPushTicket[] = sendResult.tickets;

    // 7. Log delivery attempts only when edge function did not persist logs.
    if (!sendResult.loggedByEdge) {
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const pushToken = validPushTokens[i] || validPushTokens[0];

        if (!pushToken) {
          continue;
        }

        if (ticket.status === 'ok') {
          await logDelivery(
            userId,
            notificationId,
            pushToken.id,
            ticket.id ?? null,
            'ok',
            ticket.message || 'Sent to Expo successfully',
            { ticket },
            0
          );
        } else if (ticket.status === 'error') {
          await logDelivery(
            userId,
            notificationId,
            pushToken.id,
            ticket.id ?? null,
            'error',
            ticket.message || 'Expo push ticket returned error status',
            { ticket },
            0
          );

          // Add to retry queue if notification ID provided
          if (notificationId) {
            await addToRetryQueue(
              notificationId,
              userId,
              ticket.message || 'Expo push ticket returned error status',
              { details: ticket.details }
            );
          }
        }
      }
    }

    // 8. Record deduplication (unless critical)
    if (!critical) {
      await recordDeduplication(userId, type, actualFingerprint);
    }

    // 9. Remove from retry queue if successful
    if (notificationId && tickets.every((t) => t.status === 'ok')) {
      await removeFromRetryQueue(notificationId);
    }

    return {
      success: true,
      sent: true,
      ticketId: tickets[0]?.status === 'ok' ? tickets[0].id : undefined,
    };
  } catch (err) {
    console.error('[pushDelivery] Send push notification exception:', err);

    // Add to retry queue if notification ID provided
    if (notificationId) {
      await addToRetryQueue(
        notificationId,
        userId,
        err instanceof Error ? err.message : 'Unknown error',
        null
      );
    }

    return {
      success: false,
      sent: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Fetch and process push notification receipts
 * Call this periodically (e.g., every 15 minutes) to update delivery status
 *
 * @param ticketIds - Array of Expo push ticket IDs to check
 */
export async function processPushReceipts(ticketIds: string[]): Promise<void> {
  if (ticketIds.length === 0) {
    return;
  }

  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    const payload = (await response.json()) as {
      data?: Record<string, ExpoPushReceipt>;
      errors?: Array<{ code?: string; message?: string }>;
    };

    if (!response.ok) {
      console.error('[pushDelivery] Failed to fetch receipts:', payload.errors || payload);
      return;
    }

    const receipts = payload.data || {};

    for (const receiptId of Object.keys(receipts)) {
      const receipt = receipts[receiptId];

      if (receipt.status === 'ok') {
        await supabase
          .from('push_delivery_log' as never)
          .update({
            receipt_status: 'ok',
          } as never)
          .eq('expo_receipt_id', receiptId);
      } else {
        await supabase
          .from('push_delivery_log' as never)
          .update({
            receipt_status: receipt.details?.error || 'error',
            receipt_message: receipt.message || null,
            receipt_details: receipt.details || null,
          } as never)
          .eq('expo_receipt_id', receiptId);
      }
    }
  } catch (err) {
    console.error('[pushDelivery] Process push receipts exception:', err);
  }
}

/**
 * Retry failed push notifications
 * Call this periodically (e.g., every 5 minutes) to retry failed deliveries
 */
export async function retryFailedDeliveries(): Promise<void> {
  try {
    // Get pending retries from view
    const { data: retries, error } = await supabase
      .from('v_pending_retries' as never)
      .select('*')
      .limit(50); // Process up to 50 retries per run

    if (error) {
      console.error('[pushDelivery] Failed to fetch pending retries:', error);
      return;
    }

    if (!retries || retries.length === 0) {
      return;
    }

    console.log(`[pushDelivery] Processing ${retries.length} failed deliveries...`);

    for (const retry of retries as any[]) {
      try {
        // Re-send notification (with critical=true to bypass checks)
        const result = await sendPushNotification({
          userId: retry.user_id,
          notificationId: retry.notification_id,
          title: retry.title,
          body: retry.body,
          type: retry.type,
          critical: true, // Bypass rate limits and quiet hours for retries
        });

        if (result.success && result.sent) {
          console.log(`[pushDelivery] Successfully retried notification ${retry.notification_id}`);
        } else {
          console.warn(
            `[pushDelivery] Retry failed for notification ${retry.notification_id}:`,
            result.error
          );
        }
      } catch (err) {
        console.error(
          `[pushDelivery] Exception retrying notification ${retry.notification_id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error('[pushDelivery] Retry failed deliveries exception:', err);
  }
}

/**
 * Test push notification delivery (for manual testing)
 */
export async function sendTestPushNotification(userId: string): Promise<PushDeliveryResult> {
  return sendPushNotification({
    userId,
    title: 'Test Notification',
    body: 'This is a test push notification from the Kids P2P Marketplace app.',
    type: 'test',
    data: {
      screen: 'Home',
    },
    critical: false, // Test with real rate limiting and quiet hours
  });
}
