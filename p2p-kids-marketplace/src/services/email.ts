/**
 * SendGrid Email Service
 * Handles all email sending operations for the P2P Kids Marketplace app
 */

import sgMail from '@sendgrid/mail';
import {
  SendEmailParams,
  SendEmailResult,
  WelcomeEmailData,
  PasswordResetEmailData,
  TradeNotificationEmailData,
  TransactionConfirmationEmailData,
  SubscriptionStatusEmailData,
} from '@/types/email';
import { EMAIL_CONFIG, SENDGRID_TEMPLATES, EMAIL_RETRY_CONFIG } from '@/constants/email';

// Initialize SendGrid with API key
//
// PROD-012: SendGrid API key is server-only. We deliberately do NOT read
// EXPO_PUBLIC_SENDGRID_API_KEY — prefixing it with EXPO_PUBLIC_ would bundle
// the secret into the mobile app and leak it to every device. Direct mobile
// SendGrid calls are a fallback path only used when this function runs in a
// server context (Edge Function / Node test). On the device, no key will be
// present and the senders below will gracefully return
// { success: false, error: 'SendGrid API key not configured' }. The production
// email flow MUST go through supabase/functions/send-email/index.ts which
// reads the secret SENDGRID_API_KEY from Edge Function secrets.
const initializeSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️ SendGrid API key not configured. Email sending will not work on the client. ' +
        'Route email sends through supabase/functions/send-email (server-only SENDGRID_API_KEY).'
    );
    return false;
  }

  sgMail.setApiKey(apiKey);
  return true;
};

// Initialize on module load
initializeSendGrid();

/**
 * Send a generic email with HTML content
 */
export const sendEmail = async ({
  to,
  subject,
  html,
}: SendEmailParams): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const msg = {
    to,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ Failed to send email to ${to}:`, error.message);
    return { success: false, error };
  }
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (data: WelcomeEmailData): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const msg = {
    to: data.email,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    templateId: SENDGRID_TEMPLATES.WELCOME,
    dynamicTemplateData: {
      firstName: data.firstName,
      appDownloadLink: data.appDownloadLink || 'https://p2pkidsmarketplace.com/app',
    },
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ Failed to send welcome email to ${data.email}:`, error.message);
    return { success: false, error };
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  data: PasswordResetEmailData
): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const resetLink =
    data.resetLink || `https://p2pkidsmarketplace.com/reset-password?token=${data.resetToken}`;

  const msg = {
    to: data.email,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    templateId: SENDGRID_TEMPLATES.PASSWORD_RESET,
    dynamicTemplateData: {
      resetLink,
      expiryMinutes: 60, // Reset link valid for 1 hour
    },
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ Failed to send password reset email to ${data.email}:`, error.message);
    return { success: false, error };
  }
};

/**
 * Send trade request notification to seller
 */
export const sendTradeNotificationEmail = async (
  data: TradeNotificationEmailData
): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const msg = {
    to: data.sellerEmail,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    templateId: SENDGRID_TEMPLATES.TRADE_NOTIFICATION,
    dynamicTemplateData: {
      buyerName: data.buyerName,
      itemTitle: data.itemTitle,
      itemPrice: data.itemPrice.toFixed(2),
      tradeLink: data.tradeLink || 'https://p2pkidsmarketplace.com/trades',
    },
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(
      `⚠️ Failed to send trade notification email to ${data.sellerEmail}:`,
      error.message
    );
    return { success: false, error };
  }
};

/**
 * Send transaction confirmation email
 */
export const sendTransactionConfirmationEmail = async (
  data: TransactionConfirmationEmailData
): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const msg = {
    to: data.buyerEmail,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    templateId: SENDGRID_TEMPLATES.TRANSACTION_CONFIRMATION,
    dynamicTemplateData: {
      sellerName: data.sellerName,
      itemTitle: data.itemTitle,
      transactionId: data.transactionId,
      itemPrice: data.itemPrice.toFixed(2),
      swapPointsUsed: data.swapPointsUsed ? data.swapPointsUsed.toFixed(2) : '0',
    },
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(
      `⚠️ Failed to send transaction confirmation email to ${data.buyerEmail}:`,
      error.message
    );
    return { success: false, error };
  }
};

/**
 * Send subscription status change notification
 */
export const sendSubscriptionStatusEmail = async (
  data: SubscriptionStatusEmailData
): Promise<SendEmailResult> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const msg = {
    to: data.email,
    from: EMAIL_CONFIG.FROM_EMAIL,
    replyTo: EMAIL_CONFIG.REPLY_TO_EMAIL,
    templateId: SENDGRID_TEMPLATES.SUBSCRIPTION_STATUS,
    dynamicTemplateData: {
      status: data.status,
      tier: data.tier || 'Kids Club+',
      expiryDate: data.expiryDate || 'N/A',
    },
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.warn(`⚠️ Failed to send subscription status email to ${data.email}:`, error.message);
    return { success: false, error };
  }
};

/**
 * Batch email sending with retry logic
 * Useful for sending emails to multiple recipients
 */
export const sendBatchEmails = async (
  emails: SendEmailParams[]
): Promise<(SendEmailResult | null)[]> => {
  const results: (SendEmailResult | null)[] = [];

  for (const email of emails) {
    let retries = 0;
    let result: SendEmailResult | null = null;

    while (retries < EMAIL_RETRY_CONFIG.MAX_RETRIES) {
      result = await sendEmail(email);

      if (result.success) {
        break;
      }

      retries++;
      if (retries < EMAIL_RETRY_CONFIG.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, EMAIL_RETRY_CONFIG.RETRY_DELAY_MS * retries)
        );
      }
    }

    results.push(result);
  }

  return results;
};

export default {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTradeNotificationEmail,
  sendTransactionConfirmationEmail,
  sendSubscriptionStatusEmail,
  sendBatchEmails,
};
