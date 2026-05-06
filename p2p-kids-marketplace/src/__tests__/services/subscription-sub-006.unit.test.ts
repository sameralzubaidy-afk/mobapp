/**
 * File: p2p-kids-marketplace/src/__tests__/services/subscription-sub-006.unit.test.ts
 * MODULE-11 TASK SUB-006: Unit Tests for Trial-to-Paid Conversion
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { supabase } from '../../config/supabase';

import {
  setupSubscriptionPaymentSheet,
  convertTrialToPaidSubscription,
} from '../../services/subscriptions/trialToPaidConversion';

jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: jest.fn(() => ({
    retrieveSetupIntent: jest.fn(),
  })),
  usePaymentSheet: jest.fn(() => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  })),
  PaymentSheetError: {
    Canceled: 'Canceled',
  },
}));

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('SUB-006: Trial-to-Paid Conversion Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupSubscriptionPaymentSheet', () => {
    it('should return payment setup data on success', async () => {
      const mockSetupData = {
        setupIntent: 'si_test_123',
        ephemeralKey: 'ek_test_123',
        customer: 'cus_test_123',
        publishableKey: 'pk_test_123',
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockSetupData,
        error: null,
      });

      const result = await setupSubscriptionPaymentSheet();

      expect(result).toEqual(mockSetupData);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('setup-subscription-payment', {
        method: 'POST',
      });
    });

    it('should return null on error', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Setup failed' },
      });

      const result = await setupSubscriptionPaymentSheet();

      expect(result).toBeNull();
    });

    it('should handle unexpected errors', async () => {
      (supabase.functions.invoke as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await setupSubscriptionPaymentSheet();

      expect(result).toBeNull();
    });
  });

  describe('convertTrialToPaidSubscription', () => {
    const mockPaymentMethodId = 'pm_test_123';

    it('should successfully convert trial to paid subscription', async () => {
      const mockSubscription = {
        id: 'sub_test_123',
        status: 'active',
        current_period_end: 1234567890,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          subscription: mockSubscription,
        },
        error: null,
      });

      const result = await convertTrialToPaidSubscription(mockPaymentMethodId);

      expect(result.success).toBe(true);
      expect(result.subscription).toEqual(mockSubscription);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-subscription-payment', {
        method: 'POST',
        body: { paymentMethodId: mockPaymentMethodId },
      });
    });

    it('should handle API errors', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Payment failed' },
      });

      const result = await convertTrialToPaidSubscription(mockPaymentMethodId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });

    it('should handle missing payment method', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Missing paymentMethodId',
        },
        error: null,
      });

      const result = await convertTrialToPaidSubscription('');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle unexpected errors', async () => {
      (supabase.functions.invoke as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await convertTrialToPaidSubscription(mockPaymentMethodId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
