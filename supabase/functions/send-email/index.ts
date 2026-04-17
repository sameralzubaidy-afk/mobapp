/**
 * Supabase Edge Function: send-email
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email Notifications with tracking and unsubscribe support
 * 
 * Send emails via SendGrid API with delivery tracking
 * 
 * POST /functions/v1/send-email
 * 
 * Request body:
 * {
 *   "type": "welcome" | "password_reset" | "payment_failed" | "trial_expiring" | "subscription_cancelled" | "security_alert",
 *   "to": "recipient@example.com",
 *   "userId": "uuid", // Required for tracking and unsubscribe
 *   "category": "subscription" | "sp_events" | "badges" | "trades" | "system", // For unsubscribe link
 *   "isCritical": false, // Critical emails bypass preference checks
 *   "data": {
 *     // Type-specific data
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface SendEmailRequest {
  type: 'welcome' | 'password_reset' | 'trade_notification' | 'transaction_confirmation' | 'subscription_status' | 
        'payment_failed' | 'trial_expiring' | 'subscription_cancelled' | 'security_alert' | 'password_changed' |
        'id_badge_approved' | 'id_badge_rejected' | 'id_badge_submission';
  to: string;
  userId?: string;
  category?: 'subscription' | 'sp_events' | 'badges' | 'trades' | 'system';
  isCritical?: boolean;
  data?: Record<string, any>;
}

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@p2pkidsmarketplace.com';
const SENDGRID_REPLY_TO_EMAIL = Deno.env.get('SENDGRID_REPLY_TO_EMAIL') || 'support@p2pkidsmarketplace.com';
const APP_URL = Deno.env.get('APP_URL') || 'https://p2pkidsmarketplace.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Template IDs from SendGrid (or admin_config)
const TEMPLATES = {
  welcome: Deno.env.get('SENDGRID_TEMPLATE_WELCOME') || 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  password_reset: Deno.env.get('SENDGRID_TEMPLATE_PASSWORD_RESET') || 'd-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  trade_notification: Deno.env.get('SENDGRID_TEMPLATE_TRADE_NOTIFICATION') || 'd-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  transaction_confirmation: Deno.env.get('SENDGRID_TEMPLATE_TRANSACTION_CONFIRMATION') || 'd-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  subscription_status: Deno.env.get('SENDGRID_TEMPLATE_SUBSCRIPTION_STATUS') || 'd-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  payment_failed: Deno.env.get('SENDGRID_TEMPLATE_PAYMENT_FAILED') || 'd-payment-failed-xxxxx',
  trial_expiring: Deno.env.get('SENDGRID_TEMPLATE_TRIAL_EXPIRING') || 'd-trial-expiring-xxxxx',
  subscription_cancelled: Deno.env.get('SENDGRID_TEMPLATE_SUBSCRIPTION_CANCELLED') || 'd-subscription-cancelled-xxxxx',
  security_alert: Deno.env.get('SENDGRID_TEMPLATE_SECURITY_ALERT') || 'd-security-alert-xxxxx',
  password_changed: Deno.env.get('SENDGRID_TEMPLATE_PASSWORD_CHANGED') || 'd-password-changed-xxxxx',
};

interface SendGridRequest {
  personalizations: {
    to: { email: string }[];
    dynamic_template_data: Record<string, any>;
  }[];
  from: { email: string };
  reply_to: { email: string };
  template_id: string;
  tracking_settings?: {
    click_tracking: { enable: boolean };
    open_tracking: { enable: boolean };
  };
  custom_args?: Record<string, string>;
}

/**
 * Create email log entry in database for tracking
 */
async function createEmailLog(
  userId: string | undefined,
  recipientEmail: string,
  templateType: string,
  templateData: Record<string, any>
): Promise<{ logId: string | null; error?: string }> {
  if (!userId) {
    console.warn('[send-email] No userId provided, skipping log creation');
    return { logId: null };
  }

  try {
    const { data, error } = await supabase.rpc('create_email_log', {
      p_user_id: userId,
      p_recipient_email: recipientEmail,
      p_template_type: templateType,
      p_template_data: templateData,
    });

    if (error) {
      console.error('[send-email] Error creating email log:', error);
      return { logId: null, error: error.message };
    }

    return { logId: data as string };
  } catch (err) {
    console.error('[send-email] Exception creating email log:', err);
    return { logId: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Update email log status after send attempt
 */
async function updateEmailLogStatus(
  logId: string,
  sendgridMessageId: string | undefined,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.rpc('update_email_log_status', {
      p_log_id: logId,
      p_sendgrid_message_id: sendgridMessageId || null,
      p_status: status,
      p_error_message: errorMessage || null,
    });
  } catch (err) {
    console.error('[send-email] Error updating email log:', err);
  }
}

/**
 * Generate unsubscribe token for category
 */
async function generateUnsubscribeToken(
  userId: string,
  category: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('generate_unsubscribe_token', {
      p_user_id: userId,
      p_category: category,
    });

    if (error) {
      console.error('[send-email] Error generating unsubscribe token:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('[send-email] Exception generating unsubscribe token:', err);
    return null;
  }
}

/**
 * Check if user has email notifications enabled for category
 */
async function checkEmailPreference(
  userId: string,
  category: string,
  isCritical: boolean
): Promise<boolean> {
  // Critical emails always sent
  if (isCritical) {
    return true;
  }

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('email_enabled')
      .eq('user_id', userId)
      .eq('category', category)
      .single();

    if (error) {
      console.error('[send-email] Error checking email preference:', error);
      // Default to true if can't check (fail open for now)
      return true;
    }

    return data?.email_enabled ?? true;
  } catch (err) {
    console.error('[send-email] Exception checking email preference:', err);
    return true;
  }
}

async function sendViaSendGrid(
  to: string,
  templateId: string,
  dynamicData: Record<string, any>,
  logId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const payload: SendGridRequest = {
    personalizations: [
      {
        to: [{ email: to }],
        dynamic_template_data: dynamicData,
      },
    ],
    from: { email: SENDGRID_FROM_EMAIL },
    reply_to: { email: SENDGRID_REPLY_TO_EMAIL },
    template_id: templateId,
    tracking_settings: {
      click_tracking: { enable: true },
      open_tracking: { enable: true },
    },
    custom_args: logId ? { email_log_id: logId } : undefined,
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`SendGrid API error: ${response.status}`, errorData);

      let sendgridMessage = errorData;
      try {
        const parsed = JSON.parse(errorData);
        const firstError = parsed?.errors?.[0];
        if (firstError?.message) {
          sendgridMessage = firstError.message;
        }
      } catch {
        // Keep raw errorData when response is not JSON
      }

      return {
        success: false,
        error: `SendGrid API returned ${response.status}: ${sendgridMessage}`,
      };
    }

    // Try to get message ID from response headers
    const messageId = response.headers.get('x-message-id');

    return {
      success: true,
      messageId: messageId || undefined,
    };
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function validateRequest(req: SendEmailRequest): { valid: boolean; error?: string } {
  if (!req.type) {
    return { valid: false, error: 'Missing email type' };
  }

  if (!req.to) {
    return { valid: false, error: 'Missing recipient email' };
  }

  if (!req.to.includes('@')) {
    return { valid: false, error: 'Invalid email address' };
  }

  const validTypes = [
    'welcome', 
    'password_reset', 
    'trade_notification', 
    'transaction_confirmation', 
    'subscription_status',
    'payment_failed',
    'trial_expiring',
    'subscription_cancelled',
    'security_alert',
    'password_changed',
    'id_badge_approved', 
    'id_badge_rejected', 
    'id_badge_submission'
  ];
  
  if (!validTypes.includes(req.type)) {
    return { valid: false, error: `Invalid email type: ${req.type}` };
  }

  return { valid: true };
}

async function processWelcomeEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const result = await sendViaSendGrid(to, TEMPLATES.welcome, {
    firstName: data?.firstName || 'User',
    appDownloadLink: data?.appDownloadLink || 'https://p2pkidsmarketplace.com/app',
  });

  return { success: result.success, error: result.error };
}

async function processPasswordResetEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.resetToken) {
    return { success: false, error: 'Missing resetToken in request data' };
  }

  const resetLink = data.resetLink || `https://p2pkidsmarketplace.com/reset-password?token=${data.resetToken}`;

  const result = await sendViaSendGrid(to, TEMPLATES.password_reset, {
    resetLink,
    expiryMinutes: 60,
  });

  return { success: result.success, error: result.error };
}

async function processTradeNotificationEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.buyerName || !data?.itemTitle || !data?.itemPrice) {
    return { success: false, error: 'Missing required fields: buyerName, itemTitle, itemPrice' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.trade_notification, {
    buyerName: data.buyerName,
    itemTitle: data.itemTitle,
    itemPrice: data.itemPrice.toFixed(2),
    tradeLink: data.tradeLink || 'https://p2pkidsmarketplace.com/trades',
  });

  return { success: result.success, error: result.error };
}

async function processTransactionConfirmationEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.sellerName || !data?.itemTitle || !data?.transactionId || !data?.itemPrice) {
    return {
      success: false,
      error: 'Missing required fields: sellerName, itemTitle, transactionId, itemPrice',
    };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.transaction_confirmation, {
    sellerName: data.sellerName,
    itemTitle: data.itemTitle,
    transactionId: data.transactionId,
    itemPrice: data.itemPrice.toFixed(2),
    swapPointsUsed: (data.swapPointsUsed || 0).toFixed(2),
  });

  return { success: result.success, error: result.error };
}

async function processSubscriptionStatusEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string,
  unsubscribeToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!data?.status) {
    return { success: false, error: 'Missing status in request data' };
  }

  const unsubscribeLink = unsubscribeToken 
    ? `${APP_URL}/unsubscribe?token=${unsubscribeToken}`
    : undefined;

  const result = await sendViaSendGrid(to, TEMPLATES.subscription_status, {
    status: data.status,
    tier: data.tier || 'Kids Club+',
    expiryDate: data.expiryDate || 'N/A',
    unsubscribe_link: unsubscribeLink,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send payment failure email (CRITICAL - always sent)
 */
async function processPaymentFailedEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!data?.subscriptionId || !data?.amount || !data?.reason) {
    return { success: false, error: 'Missing required fields: subscriptionId, amount, reason' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.payment_failed, {
    subscription_id: data.subscriptionId,
    amount: parseFloat(data.amount).toFixed(2),
    reason: data.reason,
    retry_link: `${APP_URL}/subscription/payment`,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send trial expiring reminder email
 */
async function processTrialExpiringEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string,
  unsubscribeToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!data?.daysRemaining || !data?.trialEndsAt) {
    return { success: false, error: 'Missing required fields: daysRemaining, trialEndsAt' };
  }

  const unsubscribeLink = unsubscribeToken 
    ? `${APP_URL}/unsubscribe?token=${unsubscribeToken}`
    : undefined;

  const result = await sendViaSendGrid(to, TEMPLATES.trial_expiring, {
    days_remaining: data.daysRemaining,
    trial_ends_at: new Date(data.trialEndsAt).toLocaleDateString(),
    subscribe_link: `${APP_URL}/subscription/payment`,
    unsubscribe_link: unsubscribeLink,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send subscription cancelled confirmation email (CRITICAL - always sent)
 */
async function processSubscriptionCancelledEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!data?.gracePeriodEndsAt) {
    return { success: false, error: 'Missing required field: gracePeriodEndsAt' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.subscription_cancelled, {
    grace_period_ends_at: new Date(data.gracePeriodEndsAt).toLocaleDateString(),
    reactivate_link: `${APP_URL}/subscription`,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send security alert email (CRITICAL - always sent)
 */
async function processSecurityAlertEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!data?.alertType || !data?.alertMessage) {
    return { success: false, error: 'Missing required fields: alertType, alertMessage' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.security_alert, {
    alert_type: data.alertType,
    alert_message: data.alertMessage,
    timestamp: new Date().toLocaleString(),
    support_link: `${APP_URL}/support`,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send password changed confirmation email (CRITICAL - always sent)
 */
async function processPasswordChangedEmail(
  to: string,
  data?: Record<string, any>,
  logId?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await sendViaSendGrid(to, TEMPLATES.password_changed, {
    timestamp: new Date().toLocaleString(),
    support_link: `${APP_URL}/support`,
  }, logId);

  return { success: result.success, error: result.error };
}

/**
 * Send ID badge verification email (submission, approval, rejection)
 */
async function processIDBadgeEmail(
  to: string,
  emailType: 'id_badge_approved' | 'id_badge_rejected' | 'id_badge_submission',
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.subject || !data?.body) {
    return { success: false, error: 'Missing subject or body in request data' };
  }

  // For ID badge emails, we send simple HTML emails (no template yet)
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">${data.subject}</h2>
          <div style="white-space: pre-line;">
            ${data.body}
          </div>
          ${emailType === 'id_badge_rejected' && data.rejectionReason ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #fef2f2; border-left: 4px solid #ef4444;">
              <strong>Reason:</strong> ${data.rejectionReason}<br/>
              ${data.adminNotes ? `<strong>Additional Notes:</strong> ${data.adminNotes}` : ''}
            </div>
          ` : ''}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p>Best regards,<br/>P2P Kids Marketplace Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: to }],
      },
    ],
    from: { email: SENDGRID_FROM_EMAIL },
    reply_to: { email: SENDGRID_REPLY_TO_EMAIL },
    subject: data.subject,
    content: [
      {
        type: 'text/html',
        value: htmlBody,
      },
    ],
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`SendGrid API error: ${response.status}`, errorData);

      let sendgridMessage = errorData;
      try {
        const parsed = JSON.parse(errorData);
        const firstError = parsed?.errors?.[0];
        if (firstError?.message) {
          sendgridMessage = firstError.message;
        }
      } catch {
        // Keep raw errorData when response is not JSON
      }

      return {
        success: false,
        error: `SendGrid API returned ${response.status}: ${sendgridMessage}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const request = body as SendEmailRequest;

    console.log(`[send-email] Processing ${request.type} email to ${request.to}`);

    // Validate request
    const validation = validateRequest(request);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { userId, category, isCritical = false } = request;

    // Check email preferences (skip if critical or no userId/category provided)
    if (userId && category && !isCritical) {
      const emailEnabled = await checkEmailPreference(userId, category, isCritical);
      if (!emailEnabled) {
        console.log(`[send-email] User ${userId} has email disabled for ${category}, skipping`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'User has email notifications disabled' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create email log for tracking
    let logId: string | null = null;
    if (userId) {
      const logResult = await createEmailLog(userId, request.to, request.type, request.data || {});
      logId = logResult.logId;
      console.log(`[send-email] Created log entry: ${logId}`);
    }

    // Generate unsubscribe token (for non-critical emails with userId and category)
    let unsubscribeToken: string | null = null;
    if (userId && category && !isCritical) {
      unsubscribeToken = await generateUnsubscribeToken(userId, category);
      console.log(`[send-email] Generated unsubscribe token for ${userId}/${category}`);
    }

    // Process email based on type
    let result: { success: boolean; messageId?: string; error?: string };

    switch (request.type) {
      case 'welcome':
        result = await sendViaSendGrid(request.to, TEMPLATES.welcome, {
          firstName: request.data?.firstName || 'User',
          appDownloadLink: request.data?.appDownloadLink || `${APP_URL}/app`,
        }, logId || undefined);
        break;

      case 'password_reset':
        if (!request.data?.resetToken) {
          throw new Error('Missing resetToken');
        }
        result = await sendViaSendGrid(request.to, TEMPLATES.password_reset, {
          resetLink: request.data?.resetLink || `${APP_URL}/reset-password?token=${request.data.resetToken}`,
          expiryMinutes: 60,
        }, logId || undefined);
        break;

      case 'payment_failed':
        result = await processPaymentFailedEmail(request.to, request.data, logId || undefined);
        break;

      case 'trial_expiring':
        result = await processTrialExpiringEmail(request.to, request.data, logId || undefined, unsubscribeToken || undefined);
        break;

      case 'subscription_cancelled':
        result = await processSubscriptionCancelledEmail(request.to, request.data, logId || undefined);
        break;

      case 'security_alert':
        result = await processSecurityAlertEmail(request.to, request.data, logId || undefined);
        break;

      case 'password_changed':
        result = await processPasswordChangedEmail(request.to, request.data, logId || undefined);
        break;

      case 'trade_notification':
        result = await sendViaSendGrid(request.to, TEMPLATES.trade_notification, {
          buyerName: request.data?.buyerName || 'A buyer',
          itemTitle: request.data?.itemTitle || 'an item',
          itemPrice: parseFloat(request.data?.itemPrice || 0).toFixed(2),
          tradeLink: request.data?.tradeLink || `${APP_URL}/trades`,
          unsubscribe_link: unsubscribeToken ? `${APP_URL}/unsubscribe?token=${unsubscribeToken}` : undefined,
        }, logId || undefined);
        break;

      case 'transaction_confirmation':
        result = await sendViaSendGrid(request.to, TEMPLATES.transaction_confirmation, {
          sellerName: request.data?.sellerName || 'a seller',
          itemTitle: request.data?.itemTitle || 'an item',
          transactionId: request.data?.transactionId || 'N/A',
          itemPrice: parseFloat(request.data?.itemPrice || 0).toFixed(2),
          swapPointsUsed: parseFloat(request.data?.swapPointsUsed || 0).toFixed(2),
          unsubscribe_link: unsubscribeToken ? `${APP_URL}/unsubscribe?token=${unsubscribeToken}` : undefined,
        }, logId || undefined);
        break;

      case 'subscription_status':
        result = await processSubscriptionStatusEmail(request.to, request.data, logId || undefined, unsubscribeToken || undefined);
        break;

      case 'id_badge_approved':
      case 'id_badge_rejected':
      case 'id_badge_submission':
        result = await processIDBadgeEmail(request.to, request.type, request.data);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown email type' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Update email log with result
    if (logId && result) {
      await updateEmailLogStatus(
        logId,
        result.messageId,
        result.success ? 'sent' : 'failed',
        result.error
      );
    }

    const statusCode = result.success ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-email] Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
