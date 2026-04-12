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
  token?: string; // Send to specific token
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  priority?: 'default' | 'normal' | 'high';
}

interface PushTokenRow {
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

    let tokens: string[] = [];

    // If userId provided, fetch all push tokens for that user
    if (targetUserId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: pushTokens, error } = await supabase
        .from('push_tokens')
        .select('token')
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

      tokens = (pushTokens || []).map((pt: PushTokenRow) => pt.token);

      if (tokens.length === 0) {
        console.warn(`No push tokens found for user ${targetUserId}`);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'No active push tokens for user',
            tokensCount: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (token) {
      tokens = [token];
    }

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

    if (invalidTokens.length > 0 && targetUserId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, serviceRoleKey);

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
        tokensCount: tokens.length,
        okTickets,
        errorTickets: ticketErrors.length,
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
