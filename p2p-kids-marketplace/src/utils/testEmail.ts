/**
 * Email testing utilities
 * Use these functions to test email sending in development
 */

import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTradeNotificationEmail,
  sendTransactionConfirmationEmail,
  sendSubscriptionStatusEmail,
} from '@/services/email';

/**
 * Test sending a welcome email
 */
export const testWelcomeEmail = async (testEmail: string = 'test@example.com') => {
  const result = await sendWelcomeEmail({
    firstName: 'John',
    email: testEmail,
    appDownloadLink: 'https://p2pkidsmarketplace.com/app',
  });

  if (!result.success) {
    console.warn('⚠️ Welcome email test failed:', result.error);
  }

  return result;
};

/**
 * Test sending a password reset email
 */
export const testPasswordResetEmail = async (testEmail: string = 'test@example.com') => {
  const result = await sendPasswordResetEmail({
    email: testEmail,
    resetToken: 'test-reset-token-12345',
    resetLink: 'https://p2pkidsmarketplace.com/reset-password?token=test-reset-token-12345',
  });

  if (!result.success) {
    console.warn('⚠️ Password reset email test failed:', result.error);
  }

  return result;
};

/**
 * Test sending a trade notification email
 */
export const testTradeNotificationEmail = async (testEmail: string = 'test@example.com') => {
  const result = await sendTradeNotificationEmail({
    sellerEmail: testEmail,
    buyerName: 'Jane Smith',
    itemTitle: 'LEGO Building Set',
    itemPrice: 45.99,
    tradeLink: 'https://p2pkidsmarketplace.com/trades/123',
  });

  if (!result.success) {
    console.warn('⚠️ Trade notification email test failed:', result.error);
  }

  return result;
};

/**
 * Test sending a transaction confirmation email
 */
export const testTransactionConfirmationEmail = async (testEmail: string = 'test@example.com') => {
  const result = await sendTransactionConfirmationEmail({
    buyerEmail: testEmail,
    sellerName: 'Bob Johnson',
    itemTitle: 'Kids Bicycle',
    transactionId: 'TXN-20231215-001',
    itemPrice: 89.99,
    swapPointsUsed: 20.0,
  });

  if (!result.success) {
    console.warn('⚠️ Transaction confirmation email test failed:', result.error);
  }

  return result;
};

/**
 * Test sending a subscription status email
 */
export const testSubscriptionStatusEmail = async (testEmail: string = 'test@example.com') => {
  const result = await sendSubscriptionStatusEmail({
    email: testEmail,
    status: 'activated',
    tier: 'Kids Club+',
    expiryDate: '2024-12-15',
  });

  if (!result.success) {
    console.warn('⚠️ Subscription status email test failed:', result.error);
  }

  return result;
};

/**
 * Run all email tests
 */
export const runAllEmailTests = async (testEmail: string = 'test@example.com') => {
  console.log(`\n🧪 Running all email service tests...\n`);

  const tests = [
    { name: 'Welcome Email', fn: () => testWelcomeEmail(testEmail) },
    { name: 'Password Reset Email', fn: () => testPasswordResetEmail(testEmail) },
    { name: 'Trade Notification Email', fn: () => testTradeNotificationEmail(testEmail) },
    {
      name: 'Transaction Confirmation Email',
      fn: () => testTransactionConfirmationEmail(testEmail),
    },
    { name: 'Subscription Status Email', fn: () => testSubscriptionStatusEmail(testEmail) },
  ];

  const results: { name: string; result: { success: boolean; error?: unknown } }[] = [];

  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, result });
  }

  const passedCount = results.filter((r) => r.result.success).length;
  return results;
};
