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
  data?: { id: string }[];
  errors?: Array<{ code: string; message: string }>;
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
      .eq('status', 'trial')
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

    const updates: UpdatePayload[] = [];

    // Process each subscription
    for (const sub of subscriptions as TrialSubscription[]) {
      const trialEnds = new Date(sub.trial_end_date);
      const diffMs = trialEnds.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Day 23 reminder (7 days remaining)
      if (daysRemaining === 7 && !sub.trial_reminder_day_23_sent) {
        const sent = await sendTrialReminder(supabase, sub.user_id, '23', daysRemaining);
        if (sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_23_sent',
            day: '23',
            userId: sub.user_id,
          });
        }
      }
      // Day 28 reminder (2 days remaining)
      else if (daysRemaining === 2 && !sub.trial_reminder_day_28_sent) {
        const sent = await sendTrialReminder(supabase, sub.user_id, '28', daysRemaining);
        if (sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_28_sent',
            day: '28',
            userId: sub.user_id,
          });
        }
      }
      // Day 29 reminder (1 day remaining)
      else if (daysRemaining === 1 && !sub.trial_reminder_day_29_sent) {
        const sent = await sendTrialReminder(supabase, sub.user_id, '29', daysRemaining);
        if (sent) {
          updates.push({
            id: sub.id,
            field: 'trial_reminder_day_29_sent',
            day: '29',
            userId: sub.user_id,
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
        updates: updates.map((u) => ({ day: u.day, userId: u.userId })),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: updates.length,
        reminders: updates.map((u) => ({ day: u.day, userId: u.userId })),
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
): Promise<boolean> {
  try {
    const notificationContent = getNotificationContent(day, daysRemaining);

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

    if (!expoResponse.ok || (expoData.errors && expoData.errors.length > 0)) {
      console.error(`Failed to send trial reminder to user ${userId}:`, {
        status: expoResponse.status,
        errors: expoData.errors,
      });
      return false;
    }

    console.log(`Trial reminder sent to user ${userId} (Day ${day})`, {
      tokensCount: tokens.length,
      response: expoData,
    });
    return true;
  } catch (err) {
    console.error(`Error sending trial reminder to user ${userId}:`, err);
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
        title: '⏰ 2 Days Left in Your Free Trial',
        body: `Your trial ends soon! Add a payment method now to keep earning and spending Swap Points. Don't lose your rewards!`,
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
