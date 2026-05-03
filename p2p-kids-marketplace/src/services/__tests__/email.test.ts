/**
 * Email service unit tests
 */

import {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTradeNotificationEmail,
  sendTransactionConfirmationEmail,
  sendSubscriptionStatusEmail,
} from '@/services/email';

// Mock SendGrid before importing
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

import sgMail from '@sendgrid/mail';

const mockSendGrid = sgMail as jest.Mocked<typeof sgMail>;

// Mock environment variables
beforeAll(() => {
  process.env.EXPO_PUBLIC_SENDGRID_API_KEY = 'test-api-key';
  process.env.EXPO_PUBLIC_FROM_EMAIL = 'noreply@p2pkidsmarketplace.com';
  process.env.EXPO_PUBLIC_REPLY_TO_EMAIL = 'support@p2pkidsmarketplace.com';
});

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSendGrid.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);
  });

  describe('sendEmail', () => {
    it('should send a generic email successfully', async () => {
      const params = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
      };

      const result = await sendEmail(params);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalled();
    });

    it('should handle send failures gracefully', async () => {
      const params = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
      };

      (mockSendGrid.send as jest.Mock).mockRejectedValueOnce(new Error('SendGrid API Error'));

      const result = await sendEmail(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include correct from and reply-to addresses', async () => {
      const params = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
      };

      await sendEmail(params);

      expect(mockSendGrid.send).toHaveBeenCalled();
      const callArgs = (mockSendGrid.send as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('from');
      expect(callArgs).toHaveProperty('replyTo');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct template data', async () => {
      const data = {
        firstName: 'John',
        email: 'john@example.com',
        appDownloadLink: 'https://p2pkidsmarketplace.com/app',
      };

      const result = await sendWelcomeEmail(data);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalled();
    });

    it('should use default app download link if not provided', async () => {
      const data = {
        firstName: 'Jane',
        email: 'jane@example.com',
      };

      const result = await sendWelcomeEmail(data);

      expect(result.success).toBe(true);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with reset link', async () => {
      const data = {
        email: 'reset@example.com',
        resetLink: 'https://p2pkidsmarketplace.com/reset?token=abc123',
        firstName: 'Bob',
      };

      const result = await sendPasswordResetEmail(data);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalled();
    });

    it('should generate reset link if not provided', async () => {
      const data = {
        email: 'reset2@example.com',
        firstName: 'Alice',
      };

      const result = await sendPasswordResetEmail(data);

      expect(result.success).toBe(true);
    });
  });

  describe('sendTradeNotificationEmail', () => {
    it('should send trade notification email with correct data', async () => {
      const data = {
        sellerEmail: 'seller@example.com',
        sellerName: 'Seller Name',
        buyerName: 'Buyer Name',
        itemTitle: 'Test Item',
        itemPrice: 29.99,
        tradeLink: 'https://p2pkidsmarketplace.com/trades/123',
      };

      const result = await sendTradeNotificationEmail(data);

      expect(result.success).toBe(true);
    });
  });

  describe('sendTransactionConfirmationEmail', () => {
    it('should send transaction confirmation email', async () => {
      const data = {
        buyerEmail: 'buyer@example.com',
        sellerName: 'Seller',
        itemTitle: 'Test Item',
        transactionId: 'txn-123',
        itemPrice: 9.99,
        swapPointsUsed: 5,
      };

      const result = await sendTransactionConfirmationEmail(data);

      expect(result.success).toBe(true);
    });

    it('should handle zero swap points', async () => {
      const data = {
        buyerEmail: 'buyer2@example.com',
        sellerName: 'Seller2',
        itemTitle: 'Test Item 2',
        transactionId: 'txn-124',
        itemPrice: 15.99,
        swapPointsUsed: 0,
      };

      const result = await sendTransactionConfirmationEmail(data);

      expect(result.success).toBe(true);
    });
  });

  describe('sendSubscriptionStatusEmail', () => {
    it('should send subscription activated email', async () => {
      const data = {
        email: 'subscriber@example.com',
        firstName: 'John',
        status: 'activated',
      };

      const result = await sendSubscriptionStatusEmail(data);

      expect(result.success).toBe(true);
    });

    it('should send subscription cancelled email', async () => {
      const data = {
        email: 'cancelled@example.com',
        firstName: 'Jane',
        status: 'cancelled',
      };

      const result = await sendSubscriptionStatusEmail(data);

      expect(result.success).toBe(true);
    });
  });
});
