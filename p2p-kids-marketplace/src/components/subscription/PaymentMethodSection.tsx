/**
 * FILE: p2p-kids-marketplace/src/components/subscription/PaymentMethodSection.tsx
 * MODULE-11 TASK SUB-017: Payment Method Display Component
 *
 * Displays saved payment method details (card brand, last 4, expiry).
 * Allows users to update their payment method via Stripe Payment Sheet.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getPaymentMethod, PaymentMethodInfo } from '@/services/subscription';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';
import { retryFailedPayment } from '@/services/paymentRetry';
import { supabase } from '@/config/supabase';
import { extractEdgeInvokeErrorMessage } from '@/services/trade';
import { captureException } from '@/services/errorReporter';

interface PaymentMethodSectionProps {
  onPaymentMethodUpdated?: () => void | Promise<void>;
}

// DEV-TASK-83 (D2): mirror PaymentMethodsScreen's working persistence path —
// invoke the attach-payment-method EF so the new card is actually saved to
// Stripe (default_payment_method) + DB (subscriptions / user_subscriptions
// stripe_payment_method_id) before any success alert.
async function attachPaymentMethodToCustomer(
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('attach-payment-method', {
      body: {
        payment_method_id: paymentMethodId,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      // BP-39: FunctionsHttpError.message is hardcoded — parse the real body
      // from .context so the user sees the actual EF error, not the wrapper.
      const msg = await extractEdgeInvokeErrorMessage(error, data, 'Failed to save payment method');
      captureException(error, {
        tags: { screen: 'PaymentMethodSection', action: 'attach_error' },
      });
      return { success: false, error: msg };
    }

    if (!data?.success) {
      const errMsg = (data as any)?.error || 'Failed to save payment method';
      captureException(errMsg, {
        tags: { screen: 'PaymentMethodSection', action: 'attach_failed' },
      });
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    captureException(err, {
      tags: { screen: 'PaymentMethodSection', action: 'attach_exception' },
      extra: { message: err?.message },
    });
    return { success: false, error: err.message || 'Failed to save payment method' };
  }
}

export function PaymentMethodSection({ onPaymentMethodUpdated }: PaymentMethodSectionProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { setupPaymentSheet, presentSheet } = usePaymentSheet();

  // Fetch payment method on mount
  useEffect(() => {
    fetchPaymentMethod();
  }, []);

  const fetchPaymentMethod = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const pm = await getPaymentMethod(forceRefresh);
      setPaymentMethod(pm);
    } catch (error) {
      console.error('[PaymentMethodSection] Error fetching payment method:', error);
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setUpdating(true);
    try {
      // 1. Setup payment sheet for renewal (collects payment method without immediate charge)
      await setupPaymentSheet({
        amount: 0, // Not used for SetupIntent but required by hook signature
        isRenewal: true,
      });

      // 2. Present the sheet
      const result = await presentSheet();

      if (result.success && result.paymentMethodId) {
        // DEV-TASK-83 (D2): persist the new card via attach-payment-method BEFORE
        // showing success. Previously this handler never attached — the old card
        // stayed active in Stripe + DB and the success alert was misleading.
        const attachResult = await attachPaymentMethodToCustomer(result.paymentMethodId);

        if (!attachResult.success) {
          Alert.alert(
            'Error',
            attachResult.error || 'Failed to save payment method. Please try again.'
          );
          return;
        }

        // Resolve current user for optional retry flow
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 3. Refresh payment method details from database — forceRefresh bypasses
        // the in-memory cache so the newly-added card is shown instead of the stale
        // old one (DEV-TASK-81).
        await fetchPaymentMethod(true);

        // 4. Notify parent if callback provided
        await onPaymentMethodUpdated?.();

        // 5. Try immediate charge retry to clear payment-failure state after card update
        if (session?.user?.id) {
          const retryResult = await retryFailedPayment(session.user.id, {
            resolveWithoutInvoice: true,
          });

          if (retryResult.success) {
            await onPaymentMethodUpdated?.();
            Alert.alert('Success', 'Payment method updated and payment retry succeeded.');
            return;
          }

          const retryCode = retryResult.error?.code;
          if (retryCode === 'NO_OPEN_INVOICE' || retryCode === 'NOT_FOUND') {
            Alert.alert(
              'Payment Method Saved',
              retryCode === 'NOT_FOUND'
                ? 'Your card was updated. Immediate retry is unavailable in this environment, but your next billing retry will run automatically.'
                : 'Your card was updated. There is no open invoice to charge right now, and your next retry will run automatically.'
            );
            return;
          }
        }

        Alert.alert('Success', 'Payment method updated successfully.');
      } else if (result.error) {
        // Only show error if it's not a user cancellation
        const errorLower = result.error.toLowerCase();
        if (!errorLower.includes('cancel')) {
          Alert.alert('Error', result.error || 'Failed to update payment method.');
        }
        // If user cancelled, silently return (no error message)
      }
    } catch (error) {
      console.error('[PaymentMethodSection] Error updating payment method:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Payment Method</Text>

      {paymentMethod ? (
        <View style={styles.paymentMethodCard}>
          {/* Card Icon and Details */}
          <View style={styles.cardRow}>
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIcon}>💳</Text>
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardBrand}>
                {paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)}
              </Text>
              <Text style={styles.cardLast4}>•••• {paymentMethod.last4}</Text>
            </View>
          </View>

          {/* Expiry Date */}
          <View style={styles.expiryRow}>
            <Text style={styles.expiryLabel}>Expires</Text>
            <Text style={styles.expiryValue}>
              {String(paymentMethod.exp_month).padStart(2, '0')}/{paymentMethod.exp_year}
            </Text>
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdatePaymentMethod}
            disabled={updating}
            testID="update-payment-method-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel={updating ? 'Processing' : 'Update Payment Method'}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#5DBB8E" />
            ) : (
              <Text style={styles.updateButtonText}>Update Payment Method</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noPaymentMethod}>
          <Text style={styles.noPaymentMethodText}>No payment method on file</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleUpdatePaymentMethod}
            disabled={updating}
            testID="add-payment-method-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel={updating ? 'Processing' : 'Add Payment Method'}
          >
            <Text style={styles.addButtonText}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B6B6B',
  },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  cardLast4: {
    fontSize: 16,
    color: '#6B6B6B',
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  expiryLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  expiryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Secondary-outline pill (design-system-passitup.md §Primary Button outline
  // variant): white bg + 2px primary-green border + primary-green text.
  updateButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#5DBB8E',
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  noPaymentMethod: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  noPaymentMethodText: {
    fontSize: 16,
    color: '#6B6B6B',
    marginBottom: 16,
  },
  // Primary-green pill (design-system-passitup.md §Primary Button default).
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#5DBB8E',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
