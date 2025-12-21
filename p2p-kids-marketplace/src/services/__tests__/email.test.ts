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
import * as sgMail from '@sendgrid/mail';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  send: jest.fn(),
  setApiKey: jest.fn(),
}));

const mockSendGrid = sgMail as jest.Mocked<typeof sgMail>;

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful sends by default
    mockSendGrid.send.mockResolvedValue([{ statusCode: 202 }] as any);
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

      mockSendGrid.send.mockRejectedValueOnce(new Error('SendGrid API Error'));

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

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('from', 'noreply@p2pkidsmarketplace.com');
      expect(callArgs).toHaveProperty('replyTo', 'support@p2pkidsmarketplace.com');
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

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('to', 'john@example.com');
      expect(callArgs).toHaveProperty('templateId');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('firstName', 'John');
    });

    it('should use default app download link if not provided', async () => {
      const data = {
        firstName: 'Jane',
        email: 'jane@example.com',
      };

      const result = await sendWelcomeEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect((callArgs as any).dynamicTemplateData).toHaveProperty(
        'appDownloadLink',
        'https://p2pkidsmarketplace.com/app'
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with reset link', async () => {
      const data = {
        email: 'reset@example.com',
        resetToken: 'test-token-123',
        resetLink: 'https://p2pkidsmarketplace.com/reset-password?token=test-token-123',
      };

      const result = await sendPasswordResetEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('to', 'reset@example.com');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('resetLink');
    });

    it('should generate reset link if not provided', async () => {
      const data = {
        email: 'reset@example.com',
        resetToken: 'test-token-123',
      };

      const result = await sendPasswordResetEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      const generatedLink = (callArgs as any).dynamicTemplateData.resetLink;
      expect(generatedLink).toContain('reset-password?token=test-token-123');
    });
  });

  describe('sendTradeNotificationEmail', () => {
    it('should send trade notification email with correct data', async () => {
      const data = {
        sellerEmail: 'seller@example.com',
        buyerName: 'Jane Buyer',
        itemTitle: 'LEGO Set',
        itemPrice: 49.99,
        tradeLink: 'https://p2pkidsmarketplace.com/trades/123',
      };

      const result = await sendTradeNotificationEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('to', 'seller@example.com');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('buyerName', 'Jane Buyer');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('itemTitle', 'LEGO Set');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('itemPrice', '49.99');
    });
  });

  describe('sendTransactionConfirmationEmail', () => {
    it('should send transaction confirmation email', async () => {
      const data = {
        buyerEmail: 'buyer@example.com',
        sellerName: 'Bob Seller',
        itemTitle: 'Bicycle',
        transactionId: 'TXN-001',
        itemPrice: 89.99,
        swapPointsUsed: 20.0,
      };

      const result = await sendTransactionConfirmationEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('to', 'buyer@example.com');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('sellerName', 'Bob Seller');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('swapPointsUsed', '20.00');
    });

    it('should handle zero swap points', async () => {
      const data = {
        buyerEmail: 'buyer@example.com',
        sellerName: 'Bob Seller',
        itemTitle: 'Bicycle',
        transactionId: 'TXN-001',
        itemPrice: 89.99,
      };

      const result = await sendTransactionConfirmationEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('swapPointsUsed', '0');
    });
  });

  describe('sendSubscriptionStatusEmail', () => {
    it('should send subscription activated email', async () => {
      const data = {
        email: 'subscriber@example.com',
        status: 'activated' as const,
        tier: 'Kids Club+',
        expiryDate: '2024-12-15',
      };

      const result = await sendSubscriptionStatusEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect(callArgs).toHaveProperty('to', 'subscriber@example.com');
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('status', 'activated');
    });

    it('should send subscription cancelled email', async () => {
      const data = {
        email: 'subscriber@example.com',
        status: 'cancelled' as const,
        tier: 'Kids Club+',
      };

      const result = await sendSubscriptionStatusEmail(data);

      expect(result.success).toBe(true);

      const callArgs = mockSendGrid.send.mock.calls[0][0];
      expect((callArgs as any).dynamicTemplateData).toHaveProperty('status', 'cancelled');
    });
  });
});
