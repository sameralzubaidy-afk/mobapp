// File: p2p-kids-marketplace/src/hooks/__tests__/usePaymentSheet.test.ts
// MODULE-11 SUB-015: Unit tests for usePaymentSheet hook

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePaymentSheet } from '../usePaymentSheet';
import * as StripeReactNative from '@stripe/stripe-react-native';
import { supabase } from '../../config/supabase';

// Mock Stripe
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: jest.fn(),
  initPaymentSheet: jest.fn(),
  presentPaymentSheet: jest.fn(),
}));

// Mock supabase
jest.mock('../../config/supabase', () => {
  const mockSupabaseInstance = {
    auth: {
      getSession: jest.fn(),
    },
  };

  return {
    supabase: mockSupabaseInstance,
  };
});

// Mock fetch
global.fetch = jest.fn();

describe('usePaymentSheet', () => {
  const mockSession = {
    access_token: 'test_token',
    user: { id: 'test_user_id', email: 'test@example.com' },
  };

  const mockSetupIntentResponse = {
    client_secret: 'seti_test_secret',
    publishable_key: 'pk_test_123',
    ephemeral_key_secret: 'ek_test_secret',
    customer_id: 'cus_test_123',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock supabase session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock Stripe functions
    (StripeReactNative.initPaymentSheet as jest.Mock).mockResolvedValue({
      error: null,
    });

    (StripeReactNative.presentPaymentSheet as jest.Mock).mockResolvedValue({
      error: null,
    });
  });

  describe('setupPaymentSheet', () => {
    it('should initialize payment sheet successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSetupIntentResponse,
      });

      const { result } = renderHook(() => usePaymentSheet());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      await act(async () => {
        await result.current.setupPaymentSheet({
          amount: 499,
          isRenewal: false,
        });
      });

      // Should call create-payment-setup-intent
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/create-payment-setup-intent'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockSession.access_token}`,
          }),
        })
      );

      // Should initialize Stripe Payment Sheet
      expect(StripeReactNative.initPaymentSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantDisplayName: 'Kids P2P Marketplace',
          customerId: mockSetupIntentResponse.customer_id,
          setupIntentClientSecret: mockSetupIntentResponse.client_secret,
        })
      );

      expect(result.current.error).toBeNull();
    });

    it('should handle API error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API error' }),
      });

      const { result } = renderHook(() => usePaymentSheet());

      await expect(
        act(async () => {
          await result.current.setupPaymentSheet({
            amount: 499,
            isRenewal: false,
          });
        })
      ).rejects.toThrow('API error');
    });

    it('should handle Stripe initialization error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSetupIntentResponse,
      });

      (StripeReactNative.initPaymentSheet as jest.Mock).mockResolvedValueOnce({
        error: { message: 'Stripe initialization failed' },
      });

      const { result } = renderHook(() => usePaymentSheet());

      await expect(
        act(async () => {
          await result.current.setupPaymentSheet({
            amount: 499,
            isRenewal: false,
          });
        })
      ).rejects.toThrow('Stripe initialization failed');
    });

    it('should handle missing authentication', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => usePaymentSheet());

      await expect(
        act(async () => {
          await result.current.setupPaymentSheet({
            amount: 499,
            isRenewal: false,
          });
        })
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('presentSheet', () => {
    it('should present payment sheet successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSetupIntentResponse,
      });

      const { result } = renderHook(() => usePaymentSheet());

      // Setup first
      await act(async () => {
        await result.current.setupPaymentSheet({
          amount: 499,
          isRenewal: false,
        });
      });

      // Present
      let presentResult;
      await act(async () => {
        presentResult = await result.current.presentSheet();
      });

      expect(StripeReactNative.presentPaymentSheet).toHaveBeenCalled();
      expect(presentResult).toEqual({
        success: true,
        paymentMethodId: expect.any(String),
      });
    });

    it('should handle user cancellation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSetupIntentResponse,
      });

      (StripeReactNative.presentPaymentSheet as jest.Mock).mockResolvedValueOnce({
        error: { code: 'Canceled', message: 'User cancelled' },
      });

      const { result } = renderHook(() => usePaymentSheet());

      // Setup first
      await act(async () => {
        await result.current.setupPaymentSheet({
          amount: 499,
          isRenewal: false,
        });
      });

      // Present
      let presentResult;
      await act(async () => {
        presentResult = await result.current.presentSheet();
      });

      expect(presentResult).toEqual({
        success: false,
        error: 'Payment cancelled',
      });
    });

    it('should fail if not initialized', async () => {
      const { result } = renderHook(() => usePaymentSheet());

      let presentResult;
      await act(async () => {
        presentResult = await result.current.presentSheet();
      });

      expect(presentResult).toEqual({
        success: false,
        error: 'Payment sheet not initialized. Call setupPaymentSheet first.',
      });
      expect(result.current.error).toBe('Payment sheet not initialized. Call setupPaymentSheet first.');
    });
  });

  describe('resetError', () => {
    it('should clear error state', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Test error' }),
      });

      const { result } = renderHook(() => usePaymentSheet());

      // Trigger error
      await act(async () => {
        try {
          await result.current.setupPaymentSheet({
            amount: 499,
            isRenewal: false,
          });
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Test error');

      // Reset error
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
