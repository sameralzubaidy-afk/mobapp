/**
 * FILE: p2p-kids-marketplace/src/services/__tests__/paymentRetry.test.ts
 * MODULE-11 TASK SUB-018: Payment Retry Service Unit Tests
 */

import { retryFailedPayment, sendPaymentFailureNotification } from '../paymentRetry';
import { supabase } from '../../config/supabase';

// Mock Supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<typeof supabase.functions.invoke>;

describe('paymentRetry service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryFailedPayment', () => {
    it('should successfully retry failed payment', async () => {
      const mockResponse = {
        success: true,
        message: 'Payment successful!',
        subscription: {
          status: 'active',
          payment_retry_count: 0,
          current_period_end: '2026-04-07T00:00:00Z',
        },
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await retryFailedPayment('user-123');

      expect(mockInvoke).toHaveBeenCalledWith('retry-failed-payment', {
        body: { user_id: 'user-123' },
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment successful!');
      expect(result.subscription?.status).toBe('active');
    });

    it('should handle payment failure', async () => {
      const mockResponse = {
        success: false,
        message: 'Payment failed',
        error: {
          code: 'PAYMENT_FAILED_AGAIN',
          message: 'Your card was declined again',
        },
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await retryFailedPayment('user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYMENT_FAILED_AGAIN');
    });

    it('should handle edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function invocation failed' },
      });

      const result = await retryFailedPayment('user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EDGE_FUNCTION_ERROR');
    });

    it('should parse structured FunctionsHttpError payload from edge function', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: {
            clone: () => ({
              text: async () =>
                JSON.stringify({
                  success: false,
                  error: {
                    code: 'NO_OPEN_INVOICE',
                    message: 'No open invoice found to retry',
                  },
                }),
            }),
          },
        } as any,
      });

      const result = await retryFailedPayment('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No open invoice found to retry');
      expect(result.error?.code).toBe('NO_OPEN_INVOICE');
    });

    it('should parse NOT_FOUND when retry edge function is not deployed', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: {
            clone: () => ({
              text: async () =>
                JSON.stringify({
                  code: 'NOT_FOUND',
                  message: 'Requested function was not found',
                }),
            }),
          },
        } as any,
      });

      const result = await retryFailedPayment('user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.message).toBe('Requested function was not found');
    });

    it('should include resolve_without_invoice flag when requested', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Resolved without invoice',
          subscription: {
            status: 'active',
            payment_retry_count: 0,
            current_period_end: null,
          },
        },
        error: null,
      });

      const result = await retryFailedPayment('user-123', {
        resolveWithoutInvoice: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('retry-failed-payment', {
        body: {
          user_id: 'user-123',
          resolve_without_invoice: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should handle network error', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const result = await retryFailedPayment('user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('sendPaymentFailureNotification', () => {
    it('should send notification for first failure (retry_count = 1)', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await sendPaymentFailureNotification('user-123', 1);

      expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', {
        body: {
          user_id: 'user-123',
          title: 'Payment Failed',
          body: expect.stringContaining('payment was declined'),
          data: {
            type: 'payment_failure',
            retry_count: '1',
            action: 'update_payment_method',
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('should send escalated notification for second failure (retry_count = 2)', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await sendPaymentFailureNotification('user-123', 2);

      expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', {
        body: expect.objectContaining({
          body: expect.stringContaining('declined again'),
        }),
      });
      expect(result.success).toBe(true);
    });

    it('should send grace period notification for third failure (retry_count = 3)', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await sendPaymentFailureNotification('user-123', 3);

      expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', {
        body: expect.objectContaining({
          body: expect.stringContaining('access has been paused'),
        }),
      });
      expect(result.success).toBe(true);
    });

    it('should handle notification failure', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Notification failed' },
      });

      const result = await sendPaymentFailureNotification('user-123', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notification failed');
    });
  });
});
