/**
 * Email service types
 * Used for SendGrid email template data and email operations
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: unknown;
}

export interface WelcomeEmailData {
  firstName: string;
  email: string;
  appDownloadLink?: string;
}

export interface PasswordResetEmailData {
  email: string;
  resetToken: string;
  resetLink?: string;
}

export interface TradeNotificationEmailData {
  sellerEmail: string;
  buyerName: string;
  itemTitle: string;
  itemPrice: number;
  tradeLink?: string;
}

export interface TransactionConfirmationEmailData {
  buyerEmail: string;
  sellerName: string;
  itemTitle: string;
  transactionId: string;
  itemPrice: number;
  swapPointsUsed?: number;
}

export interface SubscriptionStatusEmailData {
  email: string;
  status: 'activated' | 'cancelled' | 'expired';
  tier?: string;
  expiryDate?: string;
}

export enum EmailTemplate {
  WELCOME = 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  PASSWORD_RESET = 'd-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  TRADE_NOTIFICATION = 'd-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  TRANSACTION_CONFIRMATION = 'd-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  SUBSCRIPTION_STATUS = 'd-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
}

export interface EmailConfig {
  fromEmail: string;
  replyToEmail: string;
  supportEmail: string;
  templates: Record<string, string>;
}
