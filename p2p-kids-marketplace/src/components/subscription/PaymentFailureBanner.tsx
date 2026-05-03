/**
 * File: p2p-kids-marketplace/src/components/subscription/PaymentFailureBanner.tsx
 * MODULE-11 TASK SUB-018: Payment Failure Handling
 *
 * Banner displayed when a user's payment has failed
 * Shows different messages based on retry count and provides action button
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePaymentFailure } from '@/hooks/usePaymentFailure';
import { SubscriptionSummary } from '@/services/subscription';

export interface PaymentFailureBannerProps {
  onDismiss?: () => void;
  testID?: string;
  subscription?: SubscriptionSummary | null;
  loading?: boolean;
}

/**
 * Banner component that shows payment failure status and recovery options
 * Automatically shows/hides based on payment failure state
 */
export function PaymentFailureBanner({
  onDismiss,
  testID = 'paymentFailureBanner',
  subscription,
  loading,
}: PaymentFailureBannerProps) {
  const navigation = useNavigation();
  const {
    failureInfo,
    loading: failureLoading,
    dismissBanner,
    bannerDismissed,
  } = usePaymentFailure({
    subscriptionOverride: subscription,
    loadingOverride: loading,
  });

  // Don't show if no failure, not recent, or dismissed
  if (
    failureLoading ||
    !failureInfo.hasFailure ||
    !failureInfo.isRecentFailure ||
    bannerDismissed
  ) {
    return null;
  }

  const handleUpdatePayment = () => {
    // Navigate to ManageKidsClub screen where user can update payment method
    navigation.navigate('ManageKidsClub' as never);
  };

  const handleDismiss = () => {
    dismissBanner();
    onDismiss?.();
  };

  // Determine banner styling based on urgency
  const containerStyle = [
    styles.container,
    failureInfo.urgencyLevel === 'high' && styles.containerHigh,
    failureInfo.urgencyLevel === 'medium' && styles.containerMedium,
  ];

  return (
    <View style={containerStyle} testID={testID}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        {/* Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.title}>Payment Failed</Text>
          <Text style={styles.message}>{failureInfo.message}</Text>

          {/* Retry count indicator */}
          {failureInfo.retryCount > 0 && !failureInfo.isMaxRetriesReached && (
            <Text style={styles.retryInfo}>
              Retry {failureInfo.retryCount} of 3 • Next retry in{' '}
              {failureInfo.retryCount === 1 ? '3' : failureInfo.retryCount === 2 ? '7' : '14'} days
            </Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleUpdatePayment}
          activeOpacity={0.8}
          testID={`${testID}-updatePayment`}
        >
          <Text style={styles.primaryButtonText}>Update Payment Method</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.8}
          testID={`${testID}-dismiss`}
        >
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF4E5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerMedium: {
    backgroundColor: '#FFF4E5',
    borderLeftColor: '#FF9800',
  },
  containerHigh: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#F44336',
  },
  content: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  messageContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 6,
  },
  retryInfo: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
