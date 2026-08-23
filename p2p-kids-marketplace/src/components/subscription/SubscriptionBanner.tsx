/**
 * File: p2p-kids-marketplace/src/components/subscription/SubscriptionBanner.tsx
 * Thin banner for encouraging upgrade or resubscribe
 * MODULE-11 TASK SUB-010
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '@/hooks/useSubscription';

/**
 * Banner shown in key screens (home, SP wallet, listing flow) for non-active users
 * Encourages upgrade (free), trial continuation, or resubscribe (grace/expired)
 */
export function SubscriptionBanner() {
  const navigation = useNavigation();
  const { subscription } = useSubscription();

  const status = subscription?.status || 'free';

  // Don't show banner for active or cancelled subscribers
  if (status === 'active' || status === 'cancelled') {
    return null;
  }

  const isTrial = status === 'trial';
  const isGrace = status === 'grace_period';
  const isExpired = status === 'expired';

  // Determine message based on status
  const message = (() => {
    if (isTrial) {
      return 'You are on a free trial of Kids Club+. Add a card to keep your Swap Points.';
    }
    if (isGrace) {
      return 'Your Swap Points are frozen. Re-subscribe to use them again.';
    }
    if (isExpired) {
      return 'Kids Club+ expired. Re-subscribe to start earning Swap Points again.';
    }
    // Default: free user
    return 'Unlock Swap Points and lower fees with Kids Club+.';
  })();

  // Determine CTA label
  const ctaLabel = (() => {
    if (isTrial) return 'Continue Kids Club+';
    if (isGrace || isExpired) return 'Re-subscribe';
    return 'Start Free Trial';
  })();

  // Handle navigation
  const handlePress = () => {
    if (status === 'free') {
      navigation.navigate('JoinKidsClub' as never);
    } else if (isTrial) {
      navigation.navigate('JoinKidsClub' as never);
    } else {
      // grace_period or expired routes through ManageKidsClub for the correct renewal logic
      navigation.navigate('ManageKidsClub' as never);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
      testID="subscription-banner"
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${ctaLabel} banner`}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Kids Club+</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.cta}>{ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#E6F3FF',
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  cta: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
  },
});
