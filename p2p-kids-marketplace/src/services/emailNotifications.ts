/**
 * Email Notification Service (Critical Events)
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email Notifications for critical events
 *
 * Handles email notifications for subscription events, payment failures,
 * and security alerts with delivery tracking.
 */

import { supabase } from '../config/supabase';

export interface EmailResult {
  success: boolean;
  logId?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Send payment failure email (CRITICAL - always sent)
 */
export async function sendPaymentFailureEmail(
  userId: string,
  userEmail: string,
  subscriptionId: string,
  amount: number,
  reason: string
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'payment_failed',
        to: userEmail,
        userId,
        category: 'subscription',
        isCritical: true,
        data: {
          subscriptionId,
          amount,
          reason,
        },
      },
    });

    if (error) {
      console.error('[sendPaymentFailureEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: data.success, logId: data.logId };
  } catch (err) {
    console.error('[sendPaymentFailureEmail] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send trial expiring reminder email (non-critical, respects preferences)
 */
export async function sendTrialExpiringEmail(
  userId: string,
  userEmail: string,
  daysRemaining: number,
  trialEndsAt: string
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'trial_expiring',
        to: userEmail,
        userId,
        category: 'subscription',
        isCritical: false,
        data: {
          daysRemaining,
          trialEndsAt,
        },
      },
    });

    if (error) {
      console.error('[sendTrialExpiringEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: data.success,
      logId: data.logId,
      skipped: data.skipped,
    };
  } catch (err) {
    console.error('[sendTrialExpiringEmail] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send subscription cancelled confirmation email (CRITICAL - always sent)
 */
export async function sendSubscriptionCancelledEmail(
  userId: string,
  userEmail: string,
  gracePeriodEndsAt: string
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'subscription_cancelled',
        to: userEmail,
        userId,
        category: 'subscription',
        isCritical: true,
        data: {
          gracePeriodEndsAt,
        },
      },
    });

    if (error) {
      console.error('[sendSubscriptionCancelledEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: data.success, logId: data.logId };
  } catch (err) {
    console.error('[sendSubscriptionCancelledEmail] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send security alert email (CRITICAL - always sent)
 */
export async function sendSecurityAlertEmail(
  userId: string,
  userEmail: string,
  alertType: string,
  alertMessage: string
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'security_alert',
        to: userEmail,
        userId,
        category: 'system',
        isCritical: true,
        data: {
          alertType,
          alertMessage,
        },
      },
    });

    if (error) {
      console.error('[sendSecurityAlertEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: data.success, logId: data.logId };
  } catch (err) {
    console.error('[sendSecurityAlertEmail] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send password changed confirmation email (CRITICAL - always sent)
 */
export async function sendPasswordChangedEmail(
  userId: string,
  userEmail: string
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'password_changed',
        to: userEmail,
        userId,
        category: 'system',
        isCritical: true,
        data: {},
      },
    });

    if (error) {
      console.error('[sendPasswordChangedEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: data.success, logId: data.logId };
  } catch (err) {
    console.error('[sendPasswordChangedEmail] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get email delivery statistics for a user
 */
export async function getUserEmailStats(userId: string): Promise<{
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}> {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      console.error('[getUserEmailStats] Error:', error);
      return { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    }

    type EmailLogRow = { status: string | null };
    type EmailStats = { total: number; sent: number; delivered: number; opened: number; clicked: number; bounced: number };
    const stats = data.reduce(
      (acc: EmailStats, log: EmailLogRow) => {
        acc.total++;
        if (log.status === 'sent') acc.sent++;
        if (log.status === 'delivered') acc.delivered++;
        if (log.status === 'opened') acc.opened++;
        if (log.status === 'clicked') acc.clicked++;
        if (log.status === 'bounced') acc.bounced++;
        return acc;
      },
      { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
    );

    return stats;
  } catch (err) {
    console.error('[getUserEmailStats] Exception:', err);
    return { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
  }
}
