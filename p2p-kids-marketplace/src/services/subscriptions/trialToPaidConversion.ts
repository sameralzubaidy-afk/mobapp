/**
 * File: p2p-kids-marketplace/src/services/subscriptions/trialToPaidConversion.ts
 * MODULE-11 TASK SUB-006: Trial-to-Paid Conversion with Stripe Payment
 *
 * Handles converting a trial subscription to paid by collecting payment via Stripe
 */

import { supabase } from '../../config/supabase';
import { useStripe, usePaymentSheet, PaymentSheetError } from '@stripe/stripe-react-native';

export interface PaymentSheetSetupResult {
  setupIntent?: string;
  setupIntentId?: string;
  ephemeralKey?: string;
  customer?: string;
  publishableKey?: string;
}

export interface ConversionResult {
  success: boolean;
  error?: string;
  subscription?: {
    id: string;
    status: string;
    current_period_end: number;
  };
}

/**
 * Setup payment sheet for subscription payment
 * This prepares the Stripe Payment Sheet with ephemeral key
 */
export async function setupSubscriptionPaymentSheet(): Promise<PaymentSheetSetupResult | null> {
  try {
    const { data: setupData, error } = await supabase.functions.invoke(
      'setup-subscription-payment',
      {
        method: 'POST',
      }
    );

    if (error) {
      console.error('[trialToPaid] Error setting up payment sheet:', error);
      return null;
    }

    return setupData as PaymentSheetSetupResult;
  } catch (error) {
    console.error('[trialToPaid] Unexpected error:', error);
    return null;
  }
}

/**
 * Convert trial to paid subscription using Stripe payment
 * @param paymentMethodId - Stripe payment method ID from Payment Sheet
 * @returns Conversion result
 */
export async function convertTrialToPaidSubscription(
  paymentMethodId: string,
  isRenewal = false
): Promise<ConversionResult> {
  try {
    console.log('[trialToPaid] Converting trial to paid with payment method:', paymentMethodId);

    let sessionUserId: string | null = null;
    if (isRenewal) {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        return {
          success: false,
          error: 'Not authenticated',
        };
      }

      sessionUserId = session.user.id;
    }

    const functionName = isRenewal
      ? 'create-subscription-from-payment-method'
      : 'create-subscription-payment';

    const requestBody = isRenewal
      ? {
          user_id: sessionUserId,
          payment_method_id: paymentMethodId,
          is_renewal: true,
        }
      : {
          paymentMethodId,
        };

    const { data, error } = await supabase.functions.invoke(functionName, {
      method: 'POST',
      body: requestBody,
    });

    if (error) {
      console.error('[trialToPaid] Error creating subscription:', error);

      let errorMessage =
        data && typeof data === 'object' && data.error
          ? data.error
          : error.message || 'Failed to create subscription';

      const errorContext = (error as any)?.context;
      if (errorContext && typeof errorContext.json === 'function') {
        try {
          const errorPayload = await errorContext.json();
          if (errorPayload?.error) {
            errorMessage = String(errorPayload.error);
          }
        } catch (parseError) {
          console.warn('[trialToPaid] Could not parse edge error payload:', parseError);
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    if (!data || !data.success) {
      if (isRenewal && data?.subscription_id) {
        return {
          success: true,
          subscription: {
            id: data.subscription_id,
            status: data.status || 'active',
            current_period_end: new Date(data.current_period_end).getTime() / 1000,
          },
        };
      }

      return {
        success: false,
        error: data?.error || 'Unknown error',
      };
    }

    console.log('[trialToPaid] Subscription created successfully:', data.subscription);

    return {
      success: true,
      subscription: data.subscription,
    };
  } catch (error) {
    console.error('[trialToPaid] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Hook to use trial-to-paid conversion with Stripe Payment Sheet
 * Handles the complete flow: setup → present → confirm → convert
 */
export function useTrialToPaidConversion() {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { retrieveSetupIntent } = useStripe();

  /**
   * Initialize and present payment sheet, then convert trial to paid
   */
  const convertWithPaymentSheet = async ({
    isRenewal = false,
  }: {
    isRenewal?: boolean;
  } = {}): Promise<ConversionResult> => {
    try {
      // Step 1: Setup payment sheet
      console.log('[useTrialToPaid] Setting up payment sheet...');
      const setupResult = await setupSubscriptionPaymentSheet();

      if (!setupResult) {
        return {
          success: false,
          error: 'Failed to setup payment sheet',
        };
      }

      if (!setupResult.setupIntent) {
        return {
          success: false,
          error: 'Setup intent secret missing from setup response',
        };
      }

      const setupIntentClientSecret = setupResult.setupIntent;

      // Step 2: Initialize Stripe Payment Sheet
      const paymentSheetConfig = {
        merchantDisplayName: 'Kids Marketplace',
        setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: 'kids-marketplace://payment-return',
        ...(setupResult.customer && setupResult.ephemeralKey
          ? {
              customerId: setupResult.customer,
              customerEphemeralKeySecret: setupResult.ephemeralKey,
            }
          : {}),
      };

      const { error: initError } = await initPaymentSheet(paymentSheetConfig);

      if (initError) {
        console.error('[useTrialToPaid] Payment sheet init error:', initError);
        return {
          success: false,
          error: `Payment setup failed: ${initError.message}`,
        };
      }

      // Step 3: Present payment sheet to user
      console.log('[useTrialToPaid] Presenting payment sheet...');
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled - not an error
        if (
          presentError.code === PaymentSheetError.Canceled ||
          (presentError as any).code === 'Canceled'
        ) {
          console.log('[useTrialToPaid] Payment sheet presentation canceled');
          return {
            success: false,
            error: 'Payment cancelled',
          };
        }

        console.error('[useTrialToPaid] Payment sheet presentation error:', presentError);
        return {
          success: false,
          error: `Payment failed: ${presentError.message}`,
        };
      }

      // Step 4: Payment successful - we need to get the payment method ID from the SetupIntent
      console.log('[useTrialToPaid] Payment sheet successful. Retrieving setup intent...');

      const { setupIntent, error: retrieveError } =
        await retrieveSetupIntent(setupIntentClientSecret);

      if (retrieveError) {
        console.error('[useTrialToPaid] Error retrieving setup intent:', retrieveError);
        return {
          success: false,
          error: `Failed to verify payment: ${retrieveError.message}`,
        };
      }

      const paymentMethodId = setupIntent?.paymentMethodId;

      if (!paymentMethodId) {
        console.error('[useTrialToPaid] Payment method ID missing from setup intent');
        return {
          success: false,
          error: 'Could not retrieve payment method. Please try again.',
        };
      }

      console.log('[useTrialToPaid] Payment method ID retrieved:', paymentMethodId);

      // Step 5: Convert trial to paid subscription using the retrieved payment method
      console.log('[useTrialToPaid] Creating subscription...');
      return await convertTrialToPaidSubscription(paymentMethodId, isRenewal);
    } catch (error) {
      console.error('[useTrialToPaid] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    convertWithPaymentSheet,
  };
}
