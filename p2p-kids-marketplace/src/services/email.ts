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
const initializeSendGrid = () => {
  const apiKey = process.env.EXPO_PUBLIC_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️ SendGrid API key not configured. Email sending will not work. ' +
        'Set EXPO_PUBLIC_SENDGRID_API_KEY in .env.local'
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
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
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
    console.log(`✅ Email sent successfully to: ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error };
  }
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  data: WelcomeEmailData
): Promise<SendEmailResult> => {
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
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
    console.log(`✅ Welcome email sent to: ${data.email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${data.email}:`, error);
    return { success: false, error };
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  data: PasswordResetEmailData
): Promise<SendEmailResult> => {
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email sending skipped.');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const resetLink = data.resetLink || `https://p2pkidsmarketplace.com/reset-password?token=${data.resetToken}`;

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
    console.log(`✅ Password reset email sent to: ${data.email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${data.email}:`, error);
    return { success: false, error };
  }
};

/**
 * Send trade request notification to seller
 */
export const sendTradeNotificationEmail = async (
  data: TradeNotificationEmailData
): Promise<SendEmailResult> => {
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
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
    console.log(`✅ Trade notification email sent to: ${data.sellerEmail}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send trade notification email to ${data.sellerEmail}:`, error);
    return { success: false, error };
  }
};

/**
 * Send transaction confirmation email
 */
export const sendTransactionConfirmationEmail = async (
  data: TransactionConfirmationEmailData
): Promise<SendEmailResult> => {
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
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
    console.log(`✅ Transaction confirmation email sent to: ${data.buyerEmail}`);
    return { success: true };
  } catch (error) {
    console.error(
      `❌ Failed to send transaction confirmation email to ${data.buyerEmail}:`,
      error
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
  if (!process.env.EXPO_PUBLIC_SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY) {
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
    console.log(`✅ Subscription status email sent to: ${data.email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send subscription status email to ${data.email}:`, error);
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
