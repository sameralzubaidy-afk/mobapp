/**
 * File: p2p-kids-marketplace/src/screens/profile/PaymentMethodsScreen.tsx
 * MODULE-15.1.2: Payment Methods management screen
 *
 * Allows users to view and manage their saved payment methods.
 * Uses the same backend service (usePaymentSheet + getPaymentMethod) as the
 * subscription flow for consistency.
 *
 * Design System: Pass It Up (v1.0) — Whisk Green
 * - Primary: #5DBB8E (Whisk green)
 * - Neutral 900: #1A1A1A, Neutral 700: #4D4D4D
 * - Typography: Inter, 16px body, 20px H3
 * - Spacing: 8px grid, 16px page margins
 * - Border Radius: 16px cards, 26px buttons (pill shape)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  CreditCard,
  CheckCircle,
  Lock,
} from 'phosphor-react-native';
import { getPaymentMethod, PaymentMethodInfo } from '@/services/subscription';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';
import { supabase } from '@/config/supabase';
import { retryFailedPayment } from '@/services/paymentRetry';
import ScreenLayout from '@/components/ScreenLayout';
import { LoadingSpinner } from '@/components/ui';

// ─── Helper: Attach payment method to Stripe customer via edge function ──────
async function attachPaymentMethodToCustomer(paymentMethodId: string): Promise<{ success: boolean; error?: string }> {
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
      console.error('[PaymentMethodsScreen] Attach payment method error:', error);
      return { success: false, error: error.message || 'Failed to save payment method' };
    }

    if (!data?.success) {
      const errMsg = (data as any)?.error || 'Failed to save payment method';
      console.error('[PaymentMethodsScreen] Attach payment method failed:', errMsg);
      return { success: false, error: errMsg };
    }

    console.log('[PaymentMethodsScreen] Payment method attached successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[PaymentMethodsScreen] Attach payment method exception:', err);
    return { success: false, error: err.message || 'Failed to save payment method' };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { setupPaymentSheet, presentSheet } = usePaymentSheet();

  // Fetch payment method on mount
  const fetchPaymentMethod = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const pm = await getPaymentMethod(forceRefresh);
      setPaymentMethod(pm);
    } catch (error) {
      console.error('[PaymentMethodsScreen] Error fetching payment method:', error);
      setPaymentMethod(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentMethod();
  }, [fetchPaymentMethod]);

  // Handle adding/updating payment method via Stripe Payment Sheet
  const handleAddPaymentMethod = async () => {
    setUpdating(true);
    try {
      // 1. Setup payment sheet for SetupIntent (no immediate charge)
      await setupPaymentSheet({
        amount: 0,
        isRenewal: true,
      });

      // 2. Present the Stripe Payment Sheet
      const result = await presentSheet();

      if (result.success && result.paymentMethodId) {
        // 3. Attach payment method to Stripe customer and persist to DB
        const attachResult = await attachPaymentMethodToCustomer(result.paymentMethodId);

        if (!attachResult.success) {
          Alert.alert('Error', attachResult.error || 'Failed to save payment method. Please try again.');
          return;
        }

        // 4. Refresh payment method details from DB (bypass cache — we just saved a new one)
        await fetchPaymentMethod(true);

        // 5. Try immediate charge retry to clear any payment-failure state
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user?.id) {
          const retryResult = await retryFailedPayment(session.user.id, {
            resolveWithoutInvoice: true,
          });

          if (retryResult.success) {
            Alert.alert('Payment Method Added', 'Your card was saved successfully.');
            return;
          }

          const retryCode = retryResult.error?.code;
          // NO_FAILED_PAYMENT means there was no failed payment to retry — this is normal
          // when adding a new payment method for the first time (no prior failures).
          // NO_OPEN_INVOICE means the subscription is in good standing.
          // NOT_FOUND means the edge function isn't deployed in this env.
          if (
            retryCode === 'NO_FAILED_PAYMENT' ||
            retryCode === 'NO_OPEN_INVOICE' ||
            retryCode === 'NOT_FOUND'
          ) {
            Alert.alert(
              'Payment Method Saved',
              'Your card was saved successfully.'
            );
            return;
          }
        }

        Alert.alert('Success', 'Payment method added successfully.');

      } else if (result.error) {
        const errorLower = result.error.toLowerCase();
        if (!errorLower.includes('cancel')) {
          Alert.alert('Error', result.error || 'Failed to add payment method.');
        }
      }

    } catch (error) {
      console.error('[PaymentMethodsScreen] Error adding payment method:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle removing payment method
  const handleRemovePaymentMethod = () => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method? You will need to add a new one before submitting any paid offers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              const {
                data: { session },
              } = await supabase.auth.getSession();

              if (!session?.user?.id) {
                Alert.alert('Error', 'You must be logged in to manage payment methods.');
                return;
              }

              const { data, error } = await supabase.functions.invoke('detach-payment-method', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });

              if (error) {
                console.error('[PaymentMethodsScreen] Remove error:', error);
                Alert.alert('Error', error.message || 'Failed to remove payment method.');
                return;
              }

              if (!data?.success) {
                const errMsg = (data as any)?.error || 'Failed to remove payment method.';
                console.error('[PaymentMethodsScreen] Remove failed:', errMsg);
                Alert.alert('Error', errMsg);
                return;
              }

              setPaymentMethod(null);
              Alert.alert('Removed', 'Your payment method has been removed.');
            } catch (error) {
              console.error('[PaymentMethodsScreen] Remove error:', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };


  // ─── Render Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Payment Methods">
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={40} color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScreenLayout variant="detail" title="Payment Methods">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Payment Methods</Text>
          <Text style={styles.subtitle}>
            Manage your saved payment methods for secure transactions.
          </Text>
        </View>

        {/* Saved Payment Method Card */}
        {paymentMethod ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <CreditCard size={22} color="#1A1A1A" weight="bold" />
                <Text style={styles.cardTitle}>Saved Card</Text>
              </View>
              <CheckCircle size={22} color="#5DBB8E" weight="fill" />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardBrand}>
                  {paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)}
                </Text>
                <Text style={styles.cardLast4}>•••• •••• •••• {paymentMethod.last4}</Text>
              </View>
            </View>

            {/* Expiry */}
            <View style={styles.expiryRow}>
              <Text style={styles.expiryLabel}>Expiry Date</Text>
              <Text style={styles.expiryValue}>
                {String(paymentMethod.exp_month).padStart(2, '0')}/{String(paymentMethod.exp_year)}

              </Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.primaryButton, updating && styles.primaryButtonDisabled]}
              onPress={handleAddPaymentMethod}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <View style={styles.primaryButtonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
                    Updating...
                  </Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Update Payment Method</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemovePaymentMethod}
              disabled={updating}
              activeOpacity={0.7}
            >
              <Text style={styles.removeButtonText}>Remove This Card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* No Payment Method - Matches screenshot empty state */
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <CreditCard size={40} color="#1A1A1A" weight="regular" />
              </View>
              <Text style={styles.emptyTitle}>No Payment Method</Text>
              <Text style={styles.emptyText}>
                Add a credit or debit card to submit offers on items. Your payment
                information is securely stored with Stripe.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, updating && styles.primaryButtonDisabled]}
                onPress={handleAddPaymentMethod}
                disabled={updating}
                activeOpacity={0.8}
              >
                {updating ? (
                  <View style={styles.primaryButtonLoadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
                      Adding...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Add Payment Method</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Security Info Card - Matches screenshot blue banner */}
        <View style={styles.securityBanner}>
          <View style={styles.securityIconContainer}>
            <Lock size={18} color="#5DBB8E" weight="fill" />
          </View>
          <View style={styles.securityTextContainer}>
            <Text style={styles.securityTitle}>Secure Payments</Text>
            <Text style={styles.securityText}>
              Your payment information is encrypted and processed securely through Stripe.
              We never store your full card details on our servers.
            </Text>
          </View>
        </View>

        {/* Explicit Back Link - Matches screenshot bottom */}
        <TouchableOpacity
          style={styles.bottomBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}
        >
          <Text style={styles.bottomBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#4D4D4D',
    fontFamily: 'Inter',
  },
  headerSection: {
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    fontFamily: 'Inter',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#4D4D4D',
    lineHeight: 22,
    fontFamily: 'Inter',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    // Soft Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Inter',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4D4D4D',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardLast4: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '600',
    fontFamily: 'System', // Better for mono-space feel of digits
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 20,
  },
  expiryLabel: {
    fontSize: 14,
    color: '#717171',
    fontWeight: '500',
  },
  expiryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  primaryButton: {
    backgroundColor: '#5DBB8E',
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A0D7BC',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  primaryButtonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    marginTop: 12,
    width: '100%',
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#FF5252',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
  },
  removeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF5252',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  emptyIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#4D4D4D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  securityBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  securityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(93, 187, 142, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  securityText: {
    fontSize: 13,
    color: '#4D4D4D',
    lineHeight: 18,
  },
  bottomBackBtn: {
    paddingVertical: 12,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomBackBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
    textDecorationLine: 'none',
  },
});
