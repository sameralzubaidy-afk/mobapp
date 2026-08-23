/**
 * File: p2p-kids-marketplace/src/components/subscription/PaymentFailureBanner.tsx
 * MODULE-11 TASK SUB-018: Payment Failure Handling
 *
 * Banner displayed when a user's payment has failed
 * Shows different messages based on retry count and provides action button
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Warning } from 'phosphor-react-native';
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

  return (
    <View
      style={[styles.container, failureInfo.urgencyLevel === 'high' && styles.containerHigh]}
      testID={testID}
    >
      <View style={styles.iconCircle}>
        <Warning size={20} color="#E85D75" weight="fill" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.message}>{failureInfo.message}</Text>
        {failureInfo.retryCount > 0 && !failureInfo.isMaxRetriesReached && (
          <Text style={styles.retryInfo}>
            Retry {failureInfo.retryCount} of 3 • Next retry in{' '}
            {failureInfo.retryCount === 1 ? '3' : failureInfo.retryCount === 2 ? '7' : '14'} days
          </Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            accessible
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={handleUpdatePayment}
            activeOpacity={0.8}
            testID={`${testID}-updatePayment`}
          >
            <Text style={styles.primaryButtonText}>Update Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessible
            accessibilityRole="button"
            onPress={handleDismiss}
            activeOpacity={0.8}
            testID={`${testID}-dismiss`}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#E85D75',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  containerHigh: {
    borderLeftColor: '#CC1F3A',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  retryInfo: {
    fontSize: 12,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#E85D75',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissText: {
    fontSize: 13,
    color: '#6B6B6B',
  },
});
