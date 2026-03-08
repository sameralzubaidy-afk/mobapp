/**
 * FILE: p2p-kids-marketplace/src/components/subscription/PaymentMethodSection.tsx
 * MODULE-11 TASK SUB-017: Payment Method Display Component
 * 
 * Displays saved payment method details (card brand, last 4, expiry).
 * Allows users to update their payment method via Stripe Payment Sheet.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getPaymentMethod, PaymentMethodInfo } from '@/services/subscription';
import { usePaymentSheet } from '@/hooks/usePaymentSheet';

interface PaymentMethodSectionProps {
  onPaymentMethodUpdated?: () => void;
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

  const fetchPaymentMethod = async () => {
    try {
      setLoading(true);
      const pm = await getPaymentMethod();
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

      if (result.success) {
        // 3. Refresh payment method details from database
        await fetchPaymentMethod();
        
        // 4. Notify parent if callback provided
        onPaymentMethodUpdated?.();
        
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
          <ActivityIndicator size="small" color="#0066CC" />
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
          >
            {updating ? (
              <ActivityIndicator size="small" color="#0066CC" />
            ) : (
              <Text style={styles.updateButtonText}>Update Payment Method</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noPaymentMethod}>
          <Text style={styles.noPaymentMethodText}>
            No payment method on file
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleUpdatePaymentMethod}
            disabled={updating}
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
    color: '#111827',
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
    color: '#6B7280',
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
    color: '#111827',
    marginBottom: 2,
  },
  cardLast4: {
    fontSize: 16,
    color: '#6B7280',
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
    color: '#6B7280',
  },
  expiryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  updateButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
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
    color: '#6B7280',
    marginBottom: 16,
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#0066CC',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
