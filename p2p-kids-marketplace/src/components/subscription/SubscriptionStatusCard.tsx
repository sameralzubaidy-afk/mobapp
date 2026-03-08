/**
 * File: p2p-kids-marketplace/src/components/subscription/SubscriptionStatusCard.tsx
 * Reusable card component showing subscription status and details
 * MODULE-11 TASK SUB-010
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SubscriptionSummary } from '@/services/subscription';
import { formatPrice } from '@/utils/formatPrice';
import { getSubscriptionPrice } from '@/services/adminConfig';

interface SubscriptionStatusCardProps {
  subscription: SubscriptionSummary | null;
  graceMessage?: string | null;
}

/**
 * Displays current subscription status with tier, price, and dates
 * Adapts UI based on subscription state (free, trial, active, cancelled, etc.)
 */
export function SubscriptionStatusCard({
  subscription,
  graceMessage,
}: SubscriptionStatusCardProps) {
  const [subscriptionPrice, setSubscriptionPrice] = useState(799); // $7.99 default

  useEffect(() => {
    getSubscriptionPrice(true).then(price => setSubscriptionPrice(price * 100)).catch(console.error);
  }, []);

  // Free user - show upgrade prompt
  if (!subscription || subscription.status === 'free') {
    return (
      <View style={[styles.card, styles.cardFree]}>
        <Text style={styles.titleBold}>You are on the Free plan</Text>
        <Text style={styles.description}>
          Upgrade to Kids Club+ to unlock Swap Points, reduced fees, priority matching, and more.
        </Text>
      </View>
    );
  }

  const {
    status,
    next_billing_date,
    trial_ends_at,
    subscription_expires_at,
    grace_ends_at,
  } = subscription;
  const legacyCurrentPeriodEnd = (subscription as any).current_period_end as string | null | undefined;
  const legacyGracePeriodEndsAt = (subscription as any).grace_period_ends_at as string | null | undefined;
  const explicitPriceCents = (subscription as any).price_cents as number | undefined;
  const displayPriceCents = explicitPriceCents ?? subscriptionPrice;
  const tierName = 'Kids Club+'; // Single tier for now

  // Determine status label
  const statusLabel = (() => {
    switch (status) {
      case 'trial':
        return 'On 30-day free trial';
      case 'active':
        return 'Kids Club+ is active';
      case 'cancelled':
      case 'canceled':
        return 'Kids Club+ will end soon';
      case 'grace_period':
        return 'Grace period (SP frozen)';
      case 'expired':
        return 'Subscription expired';
      case 'paused':
        return 'Subscription paused';
      default:
        return 'Unknown status';
    }
  })();

  // Determine which date to display
  const displayDate =
    status === 'trial' && trial_ends_at
      ? trial_ends_at
      : status === 'grace_period' && (grace_ends_at || legacyGracePeriodEndsAt)
      ? grace_ends_at || legacyGracePeriodEndsAt
      : next_billing_date || legacyCurrentPeriodEnd || subscription_expires_at;

  // Determine date label
  const dateLabel = (() => {
    if (status === 'trial') return 'Trial ends';
    if (status === 'cancelled' || status === 'canceled') return 'Access until';
    if (status === 'active') return 'Next billing';
    if (status === 'grace_period') return 'Grace ends';
    return 'Period end';
  })();

  // Format date for display
  const formatDate = (isoString: string | null | undefined): string => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Determine card style based on status
  const cardStyleByStatus = (() => {
    switch (status) {
      case 'trial':
        return styles.cardTrial;
      case 'active':
        return styles.cardActive;
      case 'cancelled':
      case 'canceled':
        return styles.cardCancelled;
      case 'grace_period':
        return styles.cardGrace;
      case 'expired':
        return styles.cardExpired;
      default:
        return styles.cardDefault;
    }
  })();

  return (
    <View style={[styles.card, cardStyleByStatus]}>
      {/* Tier name */}
      <Text style={styles.tierName}>{tierName}</Text>

      {/* Status label */}
      <Text style={styles.statusLabel}>{statusLabel}</Text>

      {/* Pricing (for active/cancelled subscribers) */}
      {(status === 'active' || status === 'cancelled' || status === 'canceled') && (
        <Text style={styles.price}>
          {formatPrice(displayPriceCents)} <Text style={styles.pricePeriod}>/ month</Text>
        </Text>
      )}

      {/* Date information */}
      {displayDate && (
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{dateLabel}:</Text>
          <Text style={styles.dateValue}>{formatDate(displayDate)}</Text>
        </View>
      )}

      {/* Grace period message */}
      {graceMessage && (
        <View style={styles.graceMessageContainer}>
          <Text style={styles.graceMessage}>{graceMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardFree: {
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  cardTrial: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
  },
  cardActive: {
    borderColor: '#34d399',
    backgroundColor: '#ecfdf5',
  },
  cardCancelled: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  cardGrace: {
    borderColor: '#f87171',
    backgroundColor: '#fef2f2',
  },
  cardExpired: {
    borderColor: '#9ca3af',
    backgroundColor: '#f3f4f6',
  },
  cardDefault: {
    borderColor: '#ddd',
  },
  titleBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  tierName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6b7280',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dateLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  graceMessageContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7E6',
    borderRadius: 8,
  },
  graceMessage: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});
