// File: p2p-kids-marketplace/src/services/subscriptions/trialReminders.ts
// Service to handle trial reminder notifications on the client side

import { supabase } from '../../config/supabase';

export interface TrialReminderStatus {
  day23Sent: boolean;
  day28Sent: boolean;
  day29Sent: boolean;
  trialEndDate: string | null;
  daysRemaining: number | null;
}

/**
 * Get trial reminder status for current user
 */
export async function getTrialReminderStatus(): Promise<TrialReminderStatus | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(
        'trial_end_date, trial_reminder_day_23_sent, trial_reminder_day_28_sent, trial_reminder_day_29_sent'
      )
      .eq('user_id', user.id)
      .eq('status', 'trial')
      .single();

    if (error || !data) {
      console.error('Error fetching trial reminder status:', error);
      return null;
    }

    const daysRemaining = data.trial_end_date
      ? calculateDaysRemaining(data.trial_end_date)
      : null;

    return {
      day23Sent: data.trial_reminder_day_23_sent || false,
      day28Sent: data.trial_reminder_day_28_sent || false,
      day29Sent: data.trial_reminder_day_29_sent || false,
      trialEndDate: data.trial_end_date,
      daysRemaining,
    };
  } catch (err) {
    console.error('Error getting trial reminder status:', err);
    return null;
  }
}

/**
 * Calculate days remaining until trial ends
 */
export function calculateDaysRemaining(trialEndDate: string): number {
  const now = new Date();
  const endDate = new Date(trialEndDate);
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check if user should see trial reminder in UI
 * Returns the appropriate reminder message if applicable
 */
export async function getTrialReminderMessage(): Promise<{
  shouldShow: boolean;
  title?: string;
  message?: string;
  daysRemaining?: number;
} | null> {
  const status = await getTrialReminderStatus();

  if (!status || !status.trialEndDate || status.daysRemaining === null) {
    return null;
  }

  const { daysRemaining, day23Sent, day28Sent, day29Sent } = status;

  // Show day 23 reminder (7 days remaining)
  if (daysRemaining === 7 && day23Sent) {
    return {
      shouldShow: true,
      title: '🎉 7 Days Left in Your Free Trial!',
      message:
        'Continue enjoying Kids Club+ benefits! Add a payment method to keep your Swap Points active.',
      daysRemaining,
    };
  }

  // Show day 28 reminder (2 days remaining)
  if (daysRemaining === 2 && day28Sent) {
    return {
      shouldShow: true,
      title: '⏰ 2 Days Left in Your Free Trial',
      message:
        'Add a payment method now to keep earning and spending Swap Points. Don\'t lose your rewards!',
      daysRemaining,
    };
  }

  // Show day 29 reminder (1 day remaining)
  if (daysRemaining === 1 && day29Sent) {
    return {
      shouldShow: true,
      title: '🚨 Last Day of Your Free Trial!',
      message:
        'Your trial ends tomorrow! Subscribe now to keep your Swap Points active.',
      daysRemaining,
    };
  }

  // Show generic reminder if trial is ending soon but no reminder sent yet
  if (daysRemaining <= 7 && daysRemaining > 0) {
    return {
      shouldShow: true,
      title: `${daysRemaining} Days Left in Your Trial`,
      message: 'Add a payment method to continue enjoying Kids Club+ benefits.',
      daysRemaining,
    };
  }

  return { shouldShow: false };
}

/**
 * Manually trigger trial reminders (for testing/admin purposes)
 * Note: In production, this is called by the cron job
 */
export async function triggerTrialReminders(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('trial-reminders', {
      body: {},
    });

    if (error) {
      console.error('Error triggering trial reminders:', error);
      return { success: false, error: error.message };
    }

    console.log('Trial reminders triggered successfully:', data);
    return { success: true };
  } catch (err) {
    console.error('Error triggering trial reminders:', err);
    return { success: false, error: String(err) };
  }
}
