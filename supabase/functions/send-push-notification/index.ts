// File: supabase/functions/send-push-notification/index.ts
// Edge Function to send push notifications via Expo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  sound?: string;
  badge?: number;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
}

interface SendPushNotificationRequest {
  userId?: string; // Send to specific user
  user_id?: string; // Backward-compatible snake_case alias
  notificationId?: string;
  notification_id?: string;
  skipNotificationRowCreate?: boolean;
  token?: string; // Send to specific token
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  priority?: 'default' | 'normal' | 'high';
}

interface PushTokenRow {
  id: string;
  token: string;
}

interface ExpoResponse {
  data?: Array<{
    id?: string;
    status?: 'ok' | 'error';
    message?: string;
    details?: { error?: string; [key: string]: unknown };
  }>;
  errors?: Array<{
    code: string;
    message: string;
    details?: unknown;
  }>;
}

interface PushDeliveryLogRow {
  user_id: string;
  notification_id: string | null;
  push_token_id: string | null;
  expo_receipt_id: string | null;
  receipt_status:
    | 'ok'
    | 'error'
    | 'DeviceNotRegistered'
    | 'MessageTooBig'
    | 'MessageRateExceeded'
    | 'MismatchSenderId'
    | 'InvalidCredentials';
  receipt_message: string | null;
  receipt_details: Record<string, unknown> | null;
  retry_count: number;
}

const KNOWN_RECEIPT_STATUSES = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'MessageRateExceeded',
  'MismatchSenderId',
  'InvalidCredentials',
]);

function mapReceiptStatus(errorCode?: string): PushDeliveryLogRow['receipt_status'] {
  if (errorCode && KNOWN_RECEIPT_STATUSES.has(errorCode)) {
    return errorCode as PushDeliveryLogRow['receipt_status'];
  }
  return 'error';
}

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const {
      userId,
      user_id,
      notificationId,
      notification_id,
      skipNotificationRowCreate = false,
      token,
      title,
      body,
      data,
      priority = 'high',
    }: SendPushNotificationRequest = await req.json();

    const targetUserId = userId || user_id;

    // Validate required fields
    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!targetUserId && !token) {
      return new Response(
        JSON.stringify({ error: 'Either userId or token must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let tokenRows: Array<{ id: string | null; token: string }> = [];
    let resolvedNotificationId: string | null =
      notificationId || notification_id || (typeof data?.notificationId === 'string' ? data.notificationId : null);

    // Ensure we always have a notification row to link logs to when user-based delivery is used.
    if (targetUserId && !resolvedNotificationId && !skipNotificationRowCreate) {
      const { data: existingNotification } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('title', title)
        .eq('body', body)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingNotification?.id) {
        resolvedNotificationId = existingNotification.id as string;
      } else {
        const notificationType =
          typeof data?.type === 'string' && data.type.trim().length > 0 ? data.type : 'system_push';
        const notificationCategory =
          typeof data?.category === 'string' && data.category.trim().length > 0 ? data.category : 'system';

        const { data: createdNotification, error: createNotificationError } = await supabase
          .from('user_notifications')
          .insert({
            user_id: targetUserId,
            category: notificationCategory,
            type: notificationType,
            title,
            body,
            channels: ['push'],
            data: data || {},
          })
          .select('id')
          .single();

        if (createNotificationError) {
          console.error('Failed to auto-create notification row for push logging:', createNotificationError);
        } else {
          resolvedNotificationId = (createdNotification as { id: string }).id;
        }
      }
    }

    // If userId provided, fetch all push tokens for that user
    if (targetUserId) {
      const { data: pushTokens, error } = await supabase
        .from('push_tokens')
        .select('id, token')
        .eq('user_id', targetUserId);

      if (error) {
        console.error('Error fetching push tokens:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch push tokens',
            details: error.message,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      tokenRows = (pushTokens || []).map((pt: PushTokenRow) => ({ id: pt.id, token: pt.token }));

      if (tokenRows.length === 0) {
        console.warn(`No push tokens found for user ${targetUserId}`);

        const noTokenLog: PushDeliveryLogRow = {
          user_id: targetUserId,
          notification_id: resolvedNotificationId,
          push_token_id: null,
          expo_receipt_id: null,
          receipt_status: 'error',
          receipt_message: 'No active push tokens for user',
          receipt_details: {
            reason: 'no_push_tokens',
            source: 'send-push-notification',
          },
          retry_count: 0,
        };

        const { error: noTokenLogError } = await supabase.from('push_delivery_log').insert(noTokenLog);
        if (noTokenLogError) {
          console.error('Failed to write no-token delivery log:', noTokenLogError);
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: 'No active push tokens for user',
            tokensCount: 0,
            notificationId: resolvedNotificationId,
            deliveryLogsWritten: noTokenLogError ? 0 : 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (token) {
      tokenRows = [{ id: null, token }];
    }

    const tokens = tokenRows.map((tr) => tr.token);

    // Build Expo push notification message
    const message: PushMessage = {
      to: tokens,
      title,
      body,
      data: data || {},
      sound: 'default',
      badge: 1,
      priority,
      ttl: 86400, // 24 hours
    };

    // Send to Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const result: ExpoResponse = await response.json();
    const tickets = Array.isArray(result.data) ? result.data : [];
    const ticketErrors = tickets
      .map((ticket, index) => ({ ticket, index }))
      .filter(({ ticket }) => ticket.status === 'error');
    const okTickets = tickets.filter((ticket) => ticket.status === 'ok').length;

    // Check for errors in response
    if (!response.ok || (result.errors && result.errors.length > 0) || (tickets.length > 0 && okTickets === 0)) {
      console.error('Expo push API errors:', {
        status: response.status,
        errors: result.errors,
        tickets,
      });
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error sending notification',
          status: response.status,
          errors: result.errors,
          tickets,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const invalidTokens = ticketErrors
      .filter(({ ticket }) => ticket.details?.error === 'DeviceNotRegistered')
      .map(({ index }) => tokens[index])
      .filter(Boolean);

    let deliveryLogsWritten = 0;
    if (targetUserId) {
      const deliveryRows: PushDeliveryLogRow[] = tokenRows.map((tokenRow, index) => {
        const ticket = tickets[index];

        if (!ticket) {
          return {
            user_id: targetUserId,
            notification_id: resolvedNotificationId,
            push_token_id: tokenRow.id,
            expo_receipt_id: null,
            receipt_status: 'error',
            receipt_message: 'Missing Expo ticket for push token',
            receipt_details: {
              token: tokenRow.token,
              token_index: index,
            },
            retry_count: 0,
          };
        }

        if (ticket.status === 'ok') {
          return {
            user_id: targetUserId,
            notification_id: resolvedNotificationId,
            push_token_id: tokenRow.id,
            expo_receipt_id: ticket.id || null,
            receipt_status: 'ok',
            receipt_message: ticket.message || 'Sent to Expo successfully',
            receipt_details: {
              ticket,
            },
            retry_count: 0,
          };
        }

        return {
          user_id: targetUserId,
          notification_id: resolvedNotificationId,
          push_token_id: tokenRow.id,
          expo_receipt_id: ticket.id || null,
          receipt_status: mapReceiptStatus(ticket.details?.error),
          receipt_message: ticket.message || 'Expo push ticket returned error status',
          receipt_details: {
            ticket,
          },
          retry_count: 0,
        };
      });

      if (deliveryRows.length > 0) {
        const { error: deliveryLogError } = await supabase.from('push_delivery_log').insert(deliveryRows);
        if (deliveryLogError) {
          console.error('Failed to write delivery logs:', deliveryLogError);
        } else {
          deliveryLogsWritten = deliveryRows.length;
        }
      }
    }

    if (invalidTokens.length > 0 && targetUserId) {
      const { error: cleanupError } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', targetUserId)
        .in('token', invalidTokens);

      if (cleanupError) {
        console.error('Failed to remove invalid push tokens:', cleanupError);
      } else {
        console.log(`Removed ${invalidTokens.length} invalid push token(s) for user ${targetUserId}`);
      }
    }

    console.log(`Push notification sent successfully to ${tokens.length} token(s)`, {
      title,
      userId: targetUserId,
      tokensCount: tokens.length,
      okTickets,
      errorTickets: ticketErrors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent',
        notificationId: resolvedNotificationId,
        tokensCount: tokens.length,
        okTickets,
        errorTickets: ticketErrors.length,
        deliveryLogsWritten,
        tickets,
        expoResponse: result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-push-notification function:', err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// TODO: Implement authenticated wrapper
// - Add JWT verification at the start
// - Verify user can only send notifications to themselves
// - Log all notification sends for audit trail
// - Rate limit per user per minute
