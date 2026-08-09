// File: p2p-kids-marketplace/src/components/subscription/SubscribeButton.tsx
// MODULE-11 SUB-015: Subscribe button with integrated payment flow

import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePaymentSheet } from '../../hooks/usePaymentSheet';
import { supabase } from '../../config/supabase';
import type { RootStackParamList } from '@/navigation/types';

interface SubscribeButtonProps {
  /** Whether this is a renewal from grace_period/expired */
  isRenewal?: boolean;
  /** Price in cents, sourced from admin config/tier settings */
  priceCents: number;
  /** Custom label */
  label?: string;
  /** Callback after successful subscription creation */
  onSuccess?: () => void;
  /** Trial days for copy text when not renewal */
  trialDays?: number;
  /** Test ID for Maestro */
  testID?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatPriceLabel(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}/month`;
}

export function SubscribeButton({
  isRenewal = false,
  priceCents,
  label,
  onSuccess,
  trialDays = 30,
  testID = 'subscribe-button',
}: SubscribeButtonProps) {
  const navigation = useNavigation<NavigationProp>();
  const { setupPaymentSheet, presentSheet, loading, error, resetError } = usePaymentSheet();
  const [processing, setProcessing] = useState(false);

  const buttonLabel = label || (isRenewal ? 'Re-subscribe Now' : 'Subscribe to Kids Club+');
  const priceLabel = formatPriceLabel(priceCents);

  const handleSubscribe = async () => {
    try {
      setProcessing(true);
      resetError();

      // Step 1: Setup Payment Sheet
      console.log('[SubscribeButton] Setting up payment sheet...');
      await setupPaymentSheet({
        amount: priceCents,
        isRenewal,
      });

      // Step 2: Present Payment Sheet
      console.log('[SubscribeButton] Presenting payment sheet...');
      const result = await presentSheet();

      if (!result.success) {
        if (result.error === 'Payment cancelled') {
          // User cancelled - don't show error
          console.log('[SubscribeButton] User cancelled payment');
          return;
        }

        throw new Error(result.error || 'Payment failed');
      }

      // Step 3: Create subscription with payment method
      console.log('[SubscribeButton] Payment method collected, creating subscription...');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      // Note: We need to get the actual payment_method_id from the SetupIntent
      // For now, we'll let the webhook handle the subscription creation
      // Alternative: retrieve SetupIntent and get payment_method from it

      const { data: subscriptionData, error: createSubError } = await supabase.functions.invoke(
        'create-subscription-from-payment-method',
        {
          body: {
            user_id: session.user.id,
            payment_method_id: result.paymentMethodId,
            is_renewal: isRenewal,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (createSubError) {
        // FunctionsHttpError.message is always the generic "Edge Function returned a
        // non-2xx status code" — the real reason (e.g. ADMIN_PRICE_MISSING,
        // PAYMENT_REQUIRED, SUBSCRIPTION_NOT_ACTIVATED) is in the response body.
        let serverMessage: string | undefined;
        const context = (createSubError as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.clone().json();
            serverMessage = body?.error;
          } catch {
            // Body wasn't JSON or already consumed — fall back below.
          }
        }
        console.error('[SubscribeButton] Edge Function error body:', serverMessage || '(unavailable)');
        throw new Error(serverMessage || createSubError.message || 'Failed to create subscription');
      }

      console.log('[SubscribeButton] Subscription created:', subscriptionData);

      // Show success message
      Alert.alert(
        'Success!',
        isRenewal
          ? 'Welcome back to Kids Club+! Your Swap Points have been unfrozen.'
          : 'Welcome to Kids Club+! Your 30-day free trial has started.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else {
                // Navigate to subscription status screen
                navigation.navigate('SubscriptionStatus');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[SubscribeButton] Error:', err);

      Alert.alert('Payment Error', err.message || 'Unable to process payment. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const isLoading = loading || processing;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubscribe}
        disabled={isLoading}
        testID={testID}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" testID={`${testID}-loading`} />
        ) : (
          <Text style={styles.buttonText} testID={`${testID}-label`}>
            {buttonLabel}
          </Text>
        )}
      </Pressable>

      {error && (
        <Text style={styles.errorText} testID={`${testID}-error`}>
          {error}
        </Text>
      )}

      <Text style={styles.disclaimer} testID={`${testID}-disclaimer`}>
        {isRenewal
          ? `Your card will be charged ${priceLabel}. Cancel anytime.`
          : `${priceLabel} after ${trialDays}-day free trial. Cancel anytime.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#AEB7C2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#E85D75',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  disclaimer: {
    color: '#999999',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
