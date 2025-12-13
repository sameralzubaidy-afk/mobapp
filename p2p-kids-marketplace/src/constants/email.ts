/**
 * Email service constants
 */

export const EMAIL_CONFIG = {
  FROM_EMAIL: 'noreply@p2pkidsmarketplace.com',
  REPLY_TO_EMAIL: 'support@p2pkidsmarketplace.com',
  SUPPORT_EMAIL: 'support@p2pkidsmarketplace.com',
};

// SendGrid template IDs - MUST be updated with actual template IDs from SendGrid dashboard
export const SENDGRID_TEMPLATES = {
  WELCOME: process.env.SENDGRID_TEMPLATE_WELCOME || 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || 'd-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  TRADE_NOTIFICATION: process.env.SENDGRID_TEMPLATE_TRADE_NOTIFICATION || 'd-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  TRANSACTION_CONFIRMATION: process.env.SENDGRID_TEMPLATE_TRANSACTION_CONFIRMATION || 'd-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  SUBSCRIPTION_STATUS: process.env.SENDGRID_TEMPLATE_SUBSCRIPTION_STATUS || 'd-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
};

// Email retry configuration
export const EMAIL_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

// Supported email types
export const SUPPORTED_EMAIL_TYPES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  TRADE_NOTIFICATION: 'trade_notification',
  TRANSACTION_CONFIRMATION: 'transaction_confirmation',
  SUBSCRIPTION_STATUS: 'subscription_status',
} as const;
