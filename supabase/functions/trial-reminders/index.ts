// File: supabase/functions/trial-reminders/index.ts
// Daily cron job to send trial reminder notifications at Day 23, 28, and 29

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.1';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface TrialSubscription {
  id: string;
  user_id: string;
  trial_end_date: string;
  trial_reminder_day_23_sent: boolean;
  trial_reminder_day_28_sent: boolean;
  trial_reminder_day_29_sent: boolean;
}

interface UpdatePayload {
  id: string;
  field: 'trial_reminder_day_23_sent' | 'trial_reminder_day_28_sent' | 'trial_reminder_day_29_sent';
  day: '23' | '28' | '29';
  userId: string;
}

interface PushTokenRow {
  token: string;
}

interface NotificationPreferences {
  push_enabled: boolean | null;
  in_app_enabled: boolean | null;
}

interface PushMessage {
  to: string[];
  title: string;
  body: string;
  data: Record<string, string | number | boolean>;
  sound: string;
  badge: number;
  priority: 'default' | 'normal' | 'high';
  ttl: number;
}

interface ExpoResponse {
  data?: Array<{
    id?: string;
    status?: 'ok' | 'error';
    message?: string;
    details?: { error?: string; [key: string]: unknown };
  }>;
  errors?: Array<{ code: string; message: string; details?: unknown }>;
}

interface ReminderSendResult {
  sent: boolean;
  inAppCreated: boolean;
  pushSent: boolean;
}

Deno.serve(async (req: Request) => {
  console.log(`[trial-reminders] Inbound request: ${req.method} ${req.url}`);

  // Only accept POST requests (triggered by cron)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();

    // Fetch all trial subscriptions that haven't ended yet
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, trial_end_date, trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent')
      .in('status', ['trial', 'trialing'])
      .not('trial_end_date', 'is', null);

    if (error) {
      console.error('Error fetching trial subscriptions:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch subscriptions',
          details: error.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trial-reminders] Found ${subscriptions?.length || 0} trial subscriptions to check`);

    const updates: Array<UpdatePayload & { inAppCreated: boolean; pushSent: boolean }> = [];

    // Process each subscription
    for (const sub of subscriptions as TrialSubscription[]) {
      const trialEnds = new Date(sub.trial_end_date);
      const diffMs = trialEnds.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Day 23 reminder (7 days remaining)
      if (daysRemaining === 7 && !sub.trial_reminder_day_23_sent) {
        const result = await sendTrialReminder(supabase, sub.user_id, '23', daysRemaining);
        if (result.sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_23_sent',
            day: '23',
            userId: sub.user_id,
            inAppCreated: result.inAppCreated,
            pushSent: result.pushSent,
          });
        }
      }
      // Day 28 reminder (3 days remaining)
      else if (daysRemaining === 3 && !sub.trial_reminder_day_28_sent) {
        const result = await sendTrialReminder(supabase, sub.user_id, '28', daysRemaining);
        if (result.sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_28_sent',
            day: '28',
            userId: sub.user_id,
            inAppCreated: result.inAppCreated,
            pushSent: result.pushSent,
          });
        }
      }
      // Day 29 reminder (1 day remaining)
      else if (daysRemaining === 1 && !sub.trial_reminder_day_29_sent) {
        const result = await sendTrialReminder(supabase, sub.user_id, '29', daysRemaining);
        if (result.sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_29_sent',
            day: '29',
            userId: sub.user_id,
            inAppCreated: result.inAppCreated,
            pushSent: result.pushSent,
          });
        }
      }
    }

    // Batch update reminder flags
    if (updates.length > 0) {
      const updateResults = await Promise.allSettled(
        updates.map((update) =>
          supabase
            .from('user_subscriptions')
            .update({ [update.field]: true })
            .eq('id', update.id)
        )
      );

      const failedUpdates = updateResults.filter((r) => r.status === 'rejected');
      if (failedUpdates.length > 0) {
        console.error('Some reminder flag updates failed:', failedUpdates);
      }

      console.log(`Processed ${updates.length} trial reminders`, {
        updates: updates.map((u) => ({
          day: u.day,
          userId: u.userId,
          channels: {
            in_app: u.inAppCreated,
            push: u.pushSent,
          },
        })),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: updates.length,
        reminders: updates.map((u) => ({
          day: u.day,
          userId: u.userId,
          channels: {
            in_app: u.inAppCreated,
            push: u.pushSent,
          },
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in trial-reminders function:', err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Send trial reminder notification to user
 */
async function sendTrialReminder(
  supabase: any,
  userId: string,
  day: '23' | '28' | '29',
  daysRemaining: number
): Promise<ReminderSendResult> {
  try {
    const notificationContent = getNotificationContent(day, daysRemaining);

    const { pushEnabled, inAppEnabled } = await getSubscriptionNotificationPreferences(supabase, userId);

    let inAppCreated = false;
    let pushSent = false;

    if (inAppEnabled) {
      inAppCreated = await createInAppNotification(supabase, userId, notificationContent, day, daysRemaining);
    }

    if (pushEnabled) {
      pushSent = await sendPushNotification(supabase, userId, notificationContent, day, daysRemaining);
    }

    if (!inAppCreated && !pushSent) {
      console.warn(
        `[trial-reminders] Reminder skipped for user=${userId} day=${day}. in_app_enabled=${inAppEnabled} push_enabled=${pushEnabled}`
      );
    }

    // Mark reminder as sent if at least one channel succeeded.
    return {
      sent: inAppCreated || pushSent,
      inAppCreated,
      pushSent,
    };
  } catch (err) {
    console.error(`Error sending trial reminder to user ${userId}:`, err);
    return {
      sent: false,
      inAppCreated: false,
      pushSent: false,
    };
  }
}

async function getSubscriptionNotificationPreferences(
  supabase: any,
  userId: string
): Promise<{ pushEnabled: boolean; inAppEnabled: boolean }> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('push_enabled, in_app_enabled')
      .eq('user_id', userId)
      .eq('category', 'subscription')
      .maybeSingle();

    if (error) {
      console.warn(`[trial-reminders] Failed to read preferences for user=${userId}, defaulting enabled`, error);
      return { pushEnabled: true, inAppEnabled: true };
    }

    if (!data) {
      return { pushEnabled: true, inAppEnabled: true };
    }

    const prefs = data as NotificationPreferences;
    return {
      pushEnabled: prefs.push_enabled !== false,
      inAppEnabled: prefs.in_app_enabled !== false,
    };
  } catch (err) {
    console.warn(`[trial-reminders] Preference lookup error for user=${userId}, defaulting enabled`, err);
    return { pushEnabled: true, inAppEnabled: true };
  }
}

async function createInAppNotification(
  supabase: any,
  userId: string,
  notificationContent: { title: string; body: string },
  day: '23' | '28' | '29',
  daysRemaining: number
): Promise<boolean> {
  const payload = {
    event: 'trial_reminder',
    reminder_day: day,
    days_remaining: daysRemaining,
    deep_link: '/profile/subscription',
  };

  // Primary insert shape used by current subscription notification code.
  const { error: insertError } = await supabase.from('user_notifications').insert({
    user_id: userId,
    category: 'subscription',
    type: 'subscription',
    title: notificationContent.title,
    message: notificationContent.body,
    data: payload,
    read: false,
  });

  if (!insertError) {
    return true;
  }

  console.warn('[trial-reminders] Primary user_notifications insert failed, retrying legacy shape', {
    userId,
    error: insertError.message,
  });

  // Fallback insert shape for legacy table variants.
  const { error: fallbackError } = await supabase.from('user_notifications').insert({
    user_id: userId,
    category: 'subscription',
    type: 'subscription',
    title: notificationContent.title,
    body: notificationContent.body,
    channels: ['push', 'in_app'],
    data: payload,
    is_read: false,
  });

  if (fallbackError) {
    console.error('[trial-reminders] Failed to create user_notifications row', {
      userId,
      error: fallbackError.message,
    });
    return false;
  }

  return true;
}

async function sendPushNotification(
  supabase: any,
  userId: string,
  notificationContent: { title: string; body: string },
  day: '23' | '28' | '29',
  daysRemaining: number
): Promise<boolean> {
  try {
    const { data: pushTokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokenError) {
      console.error(`Failed to fetch push tokens for user ${userId}:`, tokenError);
      return false;
    }

    const tokens = (pushTokens || []).map((row: PushTokenRow) => row.token).filter(Boolean);

    if (tokens.length === 0) {
      console.warn(`No push tokens found for user ${userId}`);
      return false;
    }

    const message: PushMessage = {
      to: tokens,
      title: notificationContent.title,
      body: notificationContent.body,
      data: {
        type: 'trial_reminder',
        day,
        daysRemaining: String(daysRemaining),
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      ttl: 86400,
    };

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const expoData: ExpoResponse = await expoResponse.json().catch(() => ({}));

    const tickets = Array.isArray(expoData.data) ? expoData.data : [];
    const ticketErrors = tickets
      .map((ticket, index) => ({ ticket, index }))
      .filter(({ ticket }) => ticket.status === 'error');
    const okTickets = tickets.filter((ticket) => ticket.status === 'ok').length;

    if (!expoResponse.ok || (expoData.errors && expoData.errors.length > 0) || (tickets.length > 0 && okTickets === 0)) {
      console.error(`Failed to send trial reminder to user ${userId}:`, {
        status: expoResponse.status,
        errors: expoData.errors,
        tickets,
      });
      return false;
    }

    if (ticketErrors.length > 0) {
      console.warn(`[trial-reminders] Partial push delivery for user ${userId}`, {
        tickets,
      });
    }

    const invalidTokens = ticketErrors
      .filter(({ ticket }) => ticket.details?.error === 'DeviceNotRegistered')
      .map(({ index }) => tokens[index])
      .filter(Boolean);

    if (invalidTokens.length > 0) {
      const { error: cleanupError } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .in('token', invalidTokens);

      if (cleanupError) {
        console.error(`[trial-reminders] Failed to remove invalid push tokens for user ${userId}`, {
          error: cleanupError.message,
        });
      } else {
        console.log(`[trial-reminders] Removed ${invalidTokens.length} invalid push token(s) for user ${userId}`);
      }
    }

    console.log(`Trial reminder push sent to user ${userId} (Day ${day})`, {
      tokensCount: tokens.length,
      okTickets,
      errorTickets: ticketErrors.length,
      response: expoData,
    });
    return okTickets > 0;
  } catch (err) {
    console.error(`Error sending push trial reminder to user ${userId}:`, err);
    return false;
  }
}

/**
 * Get notification content based on day
 */
function getNotificationContent(
  day: '23' | '28' | '29',
  daysRemaining: number
): { title: string; body: string } {
  switch (day) {
    case '23':
      return {
        title: '🎉 7 Days Left in Your Free Trial!',
        body: `Continue enjoying Kids Club+ benefits! Your trial ends in ${daysRemaining} days. Add a payment method to keep your Swap Points active.`,
      };
    case '28':
      return {
        title: '⏰ 3 Days Left in Your Free Trial',
        body: `Your trial ends in ${daysRemaining} days! Add a payment method now to keep earning and spending Swap Points. Don't lose your rewards!`,
      };
    case '29':
      return {
        title: '🚨 Last Day of Your Free Trial!',
        body: `Your trial ends tomorrow! Subscribe now to keep your Swap Points active and continue enjoying Kids Club+ benefits.`,
      };
    default:
      return {
        title: 'Trial Reminder',
        body: `Your trial ends in ${daysRemaining} days.`,
      };
  }
}
