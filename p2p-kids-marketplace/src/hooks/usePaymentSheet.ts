// File: p2p-kids-marketplace/src/hooks/usePaymentSheet.ts
// MODULE-11 SUB-015: Hook for Stripe Payment Sheet integration

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useStripe } from '@stripe/stripe-react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

interface PaymentSheetOptions {
  amount: number; // Amount in cents (for display only)
  isRenewal?: boolean;
  userId?: string;
}

interface PaymentSheetResult {
  success: boolean;
  paymentMethodId?: string;
  error?: string;
}

export interface UsePaymentSheetReturn {
  setupPaymentSheet: (options: PaymentSheetOptions) => Promise<void>;
  presentSheet: () => Promise<PaymentSheetResult>;
  loading: boolean;
  error: string | null;
  resetError: () => void;
}

/**
 * Hook for managing Stripe Payment Sheet
 * 
 * Usage:
 * ```tsx
 * const { setupPaymentSheet, presentSheet, loading, error } = usePaymentSheet();
 * 
 * // When user clicks "Subscribe"
 * await setupPaymentSheet({ amount: dynamicPriceCents, isRenewal: false });
 * const result = await presentSheet();
 * if (result.success) {
 *   // Call create-subscription-from-payment-method with result.paymentMethodId
 * }
 * ```
 */
export function usePaymentSheet(): UsePaymentSheetReturn {
  const { retrieveSetupIntent } = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentSheetReadyRef = useRef(false);
  const setupIntentClientSecretRef = useRef<string | null>(null);

  const setupPaymentSheet = useCallback(
    async (options: PaymentSheetOptions): Promise<void> => {
      setLoading(true);
      setError(null);
      paymentSheetReadyRef.current = false;
      setupIntentClientSecretRef.current = null;

      try {
        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error('Not authenticated');
        }

        const accessToken = session.access_token;
        const userId = options.userId || session.user.id;

        // Call edge function to create SetupIntent
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-setup-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
          },
          body: JSON.stringify({
            user_id: userId,
            for_renewal: options.isRenewal || false,
          }),
        });

        const rawBody = await response.text();
        let data: any = null;
        try {
          data = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          data = null;
        }

        if (!response.ok) {
          const serverMessage = data?.error || data?.message || rawBody;
          throw new Error(serverMessage || 'Failed to create payment setup');
        }

        if (!data?.client_secret || !data?.customer_id || !data?.ephemeral_key_secret) {
          throw new Error('Payment setup response missing required Stripe fields');
        }

        setupIntentClientSecretRef.current = data.client_secret;

        const { initPaymentSheet } = require('@stripe/stripe-react-native');

        // Initialize Payment Sheet with SetupIntent
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Kids P2P Marketplace',
          customerId: data.customer_id,
          customerEphemeralKeySecret: data.ephemeral_key_secret,
          setupIntentClientSecret: data.client_secret,
          allowsDelayedPaymentMethods: false,
          returnURL: 'p2pkidsmarketplace://stripe-redirect',
          appearance: {
            colors: {
              primary: '#007AFF',
              background: '#FFFFFF',
            },
          },
          // Show price in payment sheet (for display only with SetupIntent)
          applePay: {
            merchantCountryCode: 'US',
          },
          googlePay: {
            merchantCountryCode: 'US',
            testEnv: __DEV__,
            currencyCode: 'USD',
          },
        });

        if (initError) {
          throw new Error(initError.message || 'Failed to initialize payment sheet');
        }

        paymentSheetReadyRef.current = true;
        console.log('[usePaymentSheet] Payment sheet initialized successfully');
      } catch (err: any) {
        console.error('[usePaymentSheet] Setup error:', err);
        setError(err.message || 'Failed to setup payment');
        paymentSheetReadyRef.current = false;
        setupIntentClientSecretRef.current = null;
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const presentSheet = useCallback(async (): Promise<PaymentSheetResult> => {
    if (!paymentSheetReadyRef.current) {
      const errorMsg = 'Payment sheet not initialized. Call setupPaymentSheet first.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setLoading(true);
    setError(null);

    try {
      const { presentPaymentSheet } = require('@stripe/stripe-react-native');
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled
        if (presentError.code === 'Canceled') {
          console.log('[usePaymentSheet] User cancelled payment sheet');
          return { success: false, error: 'Payment cancelled' };
        }

        // Other error
        throw new Error(presentError.message || 'Payment failed');
      }

      if (!setupIntentClientSecretRef.current) {
        throw new Error('Setup intent client secret missing after payment sheet completion');
      }

      const { setupIntent, error: retrieveError } = await retrieveSetupIntent(
        setupIntentClientSecretRef.current
      );

      if (retrieveError) {
        throw new Error(retrieveError.message || 'Failed to verify payment method');
      }

      const paymentMethodId = setupIntent?.paymentMethodId;

      if (!paymentMethodId) {
        throw new Error('Payment method was not returned from Stripe');
      }

      console.log('[usePaymentSheet] Payment sheet completed successfully');

      return {
        success: true,
        paymentMethodId,
      };
    } catch (err: any) {
      console.error('[usePaymentSheet] Present error:', err);
      const errorMessage = err.message || 'Payment failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
      paymentSheetReadyRef.current = false;
      setupIntentClientSecretRef.current = null;
    }
  }, [retrieveSetupIntent]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    setupPaymentSheet,
    presentSheet,
    loading,
    error,
    resetError,
  };
}
