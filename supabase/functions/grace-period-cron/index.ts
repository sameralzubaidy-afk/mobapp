// filepath: supabase/functions/grace-period-cron/index.ts
/**
 * MODULE-11 SUB-009: Grace Period Countdown, Reminders & Expiry
 * 
 * Daily cron job that:
 * 1. Selects all users in 'grace_period' status
 * 2. Calculates days remaining until grace_ends_at
 * 3. Sends reminder notifications at admin-configured thresholds
 * 4. Expires subscriptions when grace period ends (status → 'expired', SP deletion)
 * 
 * Scheduled: Daily at 3:00 AM UTC
 * Invoked by: pg_cron job 'grace-period-daily'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type GraceStatus = 'grace_active' | 'expiring_soon' | 'expired_today';

interface GraceSubscription {
  id: string;
  user_id: string;
  grace_ends_at: string;
  status: string;
  grace_reminder_sent_day_60?: boolean;
  grace_reminder_sent_day_30?: boolean;
  grace_reminder_sent_day_7?: boolean;
  grace_reminder_sent_day_1?: boolean;
}

serve(async (_req) => {
  console.log('[grace-period-cron] Starting grace period check');

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch admin-configured grace period settings
  const { data: adminConfig, error: configError } = await supabaseClient
    .from('admin_config')
    .select('key, value')
    .in('key', ['grace_period_days', 'grace_reminder_thresholds'])
    .eq('is_active', true);

  if (configError) {
    console.error('[grace-period-cron] Error fetching admin config:', configError);
    return new Response(JSON.stringify({ error: 'Failed to fetch admin config' }), { status: 500 });
  }

  const gracePeriodDaysConfig = adminConfig?.find(c => c.key === 'grace_period_days');
  const reminderThresholdsConfig = adminConfig?.find(c => c.key === 'grace_reminder_thresholds');

  const gracePeriodDays = gracePeriodDaysConfig ? parseInt(gracePeriodDaysConfig.value) : 90;
  let reminderThresholds: number[] = [60, 30, 7, 1]; // Default

  if (reminderThresholdsConfig?.value) {
    try {
      const parsed = JSON.parse(reminderThresholdsConfig.value);
      if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
        reminderThresholds = parsed;
      }
    } catch (err) {
      console.warn('[grace-period-cron] Failed to parse grace_reminder_thresholds, using default', err);
    }
  }

  console.log('[grace-period-cron] Config:', { gracePeriodDays, reminderThresholds });

  // Fetch all grace_period subscriptions
  let subs: GraceSubscription[] | null = null;
  let subsError: any = null;

  const queries = [
    {
      description: 'primary schema with reminder flags',
      select: 'id, user_id, grace_ends_at, status, grace_reminder_sent_day_60, grace_reminder_sent_day_30, grace_reminder_sent_day_7, grace_reminder_sent_day_1',
      notColumn: 'grace_ends_at',
    },
    {
      description: 'legacy grace column with reminder flags',
      select: 'id, user_id, grace_ends_at:grace_period_ends_at, status, grace_reminder_sent_day_60, grace_reminder_sent_day_30, grace_reminder_sent_day_7, grace_reminder_sent_day_1',
      notColumn: 'grace_period_ends_at',
    },
    {
      description: 'primary schema without reminder flags',
      select: 'id, user_id, grace_ends_at, status',
      notColumn: 'grace_ends_at',
    },
    {
      description: 'legacy grace column without reminder flags',
      select: 'id, user_id, grace_ends_at:grace_period_ends_at, status',
      notColumn: 'grace_period_ends_at',
    },
  ];

  for (const attempt of queries) {
    const result = await supabaseClient
      .from('subscriptions')
      .select(attempt.select)
      .eq('status', 'grace_period')
      .not(attempt.notColumn, 'is', null);

    subs = result.data as GraceSubscription[] | null;
    subsError = result.error;

    if (!subsError) {
      console.log(`[grace-period-cron] Using subscriptions query: ${attempt.description}`);
      break;
    }

    if (subsError.code === '42703') {
      console.warn(`[grace-period-cron] Query failed (${attempt.description}) due to missing column, trying next fallback`, subsError.message);
      continue;
    }

    break;
  }

  if (subsError || !subs) {
    console.error('[grace-period-cron] Error fetching subscriptions:', subsError);
    return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), { status: 500 });
  }

  console.log(`[grace-period-cron] Found ${subs.length} subscriptions in grace_period`);

  const now = new Date();
  let expiredCount = 0;
  let remindersSent = 0;

  for (const sub of subs as GraceSubscription[]) {
    const endsAt = new Date(sub.grace_ends_at);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    console.log(`[grace-period-cron] User ${sub.user_id}: ${daysRemaining} days remaining`);

    // Case 1: Grace period expired → transition to 'expired' and delete SP
    if (daysRemaining <= 0) {
      await expireSubscription(supabaseClient, sub.user_id, sub.id);
      expiredCount++;
      continue;
    }

    // Case 2: Send reminder if threshold matches and not already sent
    const status: GraceStatus =
      daysRemaining <= 1 ? 'expired_today' : daysRemaining <= 7 ? 'expiring_soon' : 'grace_active';

    const sent = await maybeSendGraceReminder(
      supabaseClient,
      sub,
      daysRemaining,
      status,
      reminderThresholds
    );

    if (sent) remindersSent++;
  }

  console.log(`[grace-period-cron] Complete: ${expiredCount} expired, ${remindersSent} reminders sent`);

  return new Response(
    JSON.stringify({
      success: true,
      processed: subs.length,
      expired: expiredCount,
      reminders_sent: remindersSent,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

/**
 * Expires a subscription and permanently deletes SP
 */
async function expireSubscription(
  supabaseClient: any,
  userId: string,
  subId: string
): Promise<void> {
  console.log(`[expireSubscription] Expiring subscription ${subId} for user ${userId}`);

  // Update subscription status to 'expired'
  const { error: updateError } = await supabaseClient
    .from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', subId);

  if (updateError) {
    console.error('[expireSubscription] Error updating status:', updateError);
  }

  // R6 (2026-08-09): post-grace expiry FREEZES the SP balance (can neither earn
  // nor spend) so a later resubscribe restores it — instead of permanently
  // deleting the SP as the legacy SP_SUBSCRIPTION_EXPIRE_URL handler did.
  try {
    const { error: freezeRpcError } = await supabaseClient.rpc('rpc_set_sp_wallet_state', {
      p_user_id: userId,
      p_state: 'frozen',
    });
    if (freezeRpcError) {
      console.error('[expireSubscription] Freeze SP wallet RPC failed:', freezeRpcError.message);
    } else {
      console.log('[expireSubscription] SP wallet frozen (not deleted) for user', userId);
    }
  } catch (err) {
    console.error('[expireSubscription] Error freezing SP wallet:', err);
  }
}

/**
 * Sends grace period reminder if threshold matches and not already sent
 */
async function maybeSendGraceReminder(
  supabaseClient: any,
  sub: GraceSubscription,
  daysRemaining: number,
  status: GraceStatus,
  reminderThresholds: number[]
): Promise<boolean> {
  // Check if this day is in the reminder thresholds
  if (!reminderThresholds.includes(daysRemaining)) {
    return false;
  }

  // Check if reminder already sent for this threshold
  const flagMap: Record<number, keyof GraceSubscription> = {
    60: 'grace_reminder_sent_day_60',
    30: 'grace_reminder_sent_day_30',
    7: 'grace_reminder_sent_day_7',
    1: 'grace_reminder_sent_day_1',
  };

  const flagField = flagMap[daysRemaining];
  if (flagField && sub[flagField]) {
    console.log(`[maybeSendGraceReminder] Reminder for ${daysRemaining} days already sent`);
    return false;
  }

  const title = getReminderTitle(daysRemaining);
  const body = getReminderBody(daysRemaining);

  // DEV-TASK-98 (DEFECT-1 FIX): the legacy code inserted into a bare
  // `notifications` table that has never existed in this project — the real
  // table is `user_notifications` — so the in-app leg errored on every run.
  // Create the in-app row here with the app's canonical subscription
  // notification shape (category/type = 'subscription', data.event =
  // 'grace_period_reminder', deep_link '/subscription' → ManageKidsClub), then
  // pass its id to send-push-notification so that function does NOT auto-create
  // a duplicate record (it only auto-creates a row when no notificationId is
  // supplied).
  const { data: inAppRow, error: inAppError } = await supabaseClient
    .from('user_notifications')
    .insert({
      user_id: sub.user_id,
      category: 'subscription',
      type: 'subscription',
      title,
      body,
      channels: ['push', 'in_app'],
      data: {
        event: 'grace_period_reminder',
        days_left: daysRemaining,
        days_remaining: daysRemaining,
        status,
        deep_link: '/subscription',
      },
      is_read: false,
    })
    .select('id')
    .maybeSingle();

  if (inAppError) {
    console.error('[maybeSendGraceReminder] Error inserting in-app notification:', inAppError.message);
  } else {
    console.log(`[maybeSendGraceReminder] In-app notification created for ${sub.user_id} (${daysRemaining} days), id=${inAppRow?.id ?? 'n/a'}`);
  }

  // Send push notification, linked to the in-app row when one was created
  try {
    const sendPushUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/send-push-notification';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const pushBody: Record<string, unknown> = {
      userId: sub.user_id,
      title,
      body,
      data: {
        type: 'grace_period_reminder',
        days_remaining: daysRemaining,
        status,
        deep_link: '/subscription',
      },
    };
    if (inAppRow?.id) {
      pushBody.notificationId = inAppRow.id;
    }

    const response = await fetch(sendPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(pushBody),
    });

    if (!response.ok) {
      console.error('[maybeSendGraceReminder] Push notification failed:', response.status);
    } else {
      console.log(`[maybeSendGraceReminder] Push requested for ${sub.user_id} (${daysRemaining} days)`);
    }
  } catch (err) {
    console.error('[maybeSendGraceReminder] Error sending push notification:', err);
  }

  // Update flag to prevent duplicate notifications
  if (flagField) {
    const { error: flagError } = await supabaseClient
      .from('subscriptions')
      .update({ [flagField]: true })
      .eq('id', sub.id);

    if (flagError) {
      console.error('[maybeSendGraceReminder] Error updating reminder flag:', flagError.message);
    }
  }

  return true;
}

/**
 * Get reminder notification title based on days remaining
 */
function getReminderTitle(daysRemaining: number): string {
  if (daysRemaining <= 1) {
    return '⚠️ Final Day: Grace Period Ending';
  } else if (daysRemaining <= 7) {
    return '⏰ Grace Period Ending Soon';
  } else if (daysRemaining <= 30) {
    return '📅 Grace Period Update';
  } else {
    return '💡 Grace Period Reminder';
  }
}

/**
 * Get reminder notification body based on days remaining
 */
function getReminderBody(daysRemaining: number): string {
  if (daysRemaining <= 1) {
    return 'Your grace period ends today. If you do not re-subscribe, your Swap Points will be frozen until you do.';
  } else if (daysRemaining <= 7) {
    return `You have ${daysRemaining} days to re-subscribe before your Swap Points are frozen.`;
  } else if (daysRemaining <= 30) {
    return `Your Kids Club+ grace period ends in ${daysRemaining} days. Re-subscribe to restore your Swap Points access.`;
  } else {
    return `You have ${daysRemaining} days remaining in your grace period. Re-subscribe anytime to restore full access.`;
  }
}
