/**
 * Seller Earnings Screen
 * File: p2p-kids-marketplace/src/screens/seller/SellerEarningsScreen.tsx
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-008 (Minimal Admin + Seller Earnings Views)
 *
 * Displays seller's payout history with status, net amount, and method
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getSellerPayouts, getPayoutMethodDisplayName } from '../../services/payoutService';
import type { SellerPayout } from '../../types/payout.types';

type PayoutDisplayItem = SellerPayout & {
  methodName: string;
  statusLabel: string;
  statusColor: string;
};

export default function SellerEarningsScreen() {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const [payouts, setPayouts] = useState<PayoutDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const data = await getSellerPayouts(user.id, 20);
      console.log('[DEBUG] Fetched payouts:', {
        count: data.length,
        data: data.map((p) => ({ status: p.status, net_amount_cents: p.net_amount_cents })),
      });

      // Enrich payouts with display data
      const enriched: PayoutDisplayItem[] = data.map((payout) => {
        // Normalize trade_id to null when undefined so it matches SellerPayout type (string | null)
        const normalized = { ...payout, trade_id: payout.trade_id ?? null } as SellerPayout;
        return {
          ...normalized,
          methodName: getPayoutMethodLabel(normalized),
          statusLabel: getPayoutStatusLabel(normalized.status),
          statusColor: getPayoutStatusColor(normalized.status),
        };
      });

      setPayouts(enriched);
    } catch (err: any) {
      setError(err.message || 'Failed to load earnings');
      console.error('Error loading payouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPayouts();
  };

  const getPayoutMethodLabel = (payout: SellerPayout): string => {
    if (!payout.provider) return 'Not Set';

    switch (payout.provider) {
      case 'stripe':
        return 'Stripe';
      case 'paypal':
        return 'PayPal';
      case 'ach':
        return 'Bank Transfer';
      default:
        return 'Unknown';
    }
  };

  const getPayoutStatusLabel = (status: string): string => {
    switch (status) {
      case 'requires_action':
        return 'Action Required';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const getPayoutStatusColor = (status: string): string => {
    switch (status) {
      case 'requires_action':
        return '#F59E0B'; // Amber
      case 'pending':
        return '#6B7280'; // Gray
      case 'processing':
        return '#3B82F6'; // Blue
      case 'completed':
        return '#10B981'; // Green
      case 'failed':
        return '#EF4444'; // Red
      default:
        return '#6B7280';
    }
  };

  const formatAmount = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateTotalEarnings = (): number => {
    return payouts
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.net_amount_cents, 0);
  };

  const calculatePendingEarnings = (): number => {
    return payouts
      .filter((p) => ['pending', 'processing'].includes(p.status))
      .reduce((sum, p) => sum + p.net_amount_cents, 0);
  };

  const renderPayoutItem = ({ item }: { item: PayoutDisplayItem }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutHeader}>
        <View style={styles.payoutInfo}>
          <Text style={styles.payoutDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.payoutMethod}>{item.methodName}</Text>
        </View>
        <View style={styles.payoutAmounts}>
          <Text style={styles.payoutNet}>{formatAmount(item.net_amount_cents)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.statusColor }]}>
            <Text style={styles.statusText}>{item.statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.payoutDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Gross</Text>
          <Text style={styles.detailValue}>{formatAmount(item.gross_amount_cents)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payout Fee</Text>
          <Text style={styles.detailValue}>-{formatAmount(item.payout_fee_cents)}</Text>
        </View>
        {item.platform_fee_cents > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Platform Fee</Text>
            <Text style={styles.detailValue}>-{formatAmount(item.platform_fee_cents)}</Text>
          </View>
        )}
      </View>

      {item.failure_reason && (
        <View style={styles.failureReason}>
          <Text style={styles.failureText}>⚠️ {item.failure_reason}</Text>
        </View>
      )}

      {item.status === 'requires_action' && (
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Set Up Payout Method</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSummary = () => (
    <View>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryHeaderEmoji}>💰</Text>
        <Text style={styles.summaryHeaderTitle}>Your Earnings</Text>
      </View>
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Earnings</Text>
          <Text style={styles.summaryAmount}>{formatAmount(calculateTotalEarnings())}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryAmount, styles.pendingAmount]}>
            {formatAmount(calculatePendingEarnings())}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Earnings Yet</Text>
      <Text style={styles.emptyText}>Complete trades to start earning and receiving payouts</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Failed to Load Earnings</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPayouts}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={payouts}
        renderItem={renderPayoutItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummary}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryHeaderEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  summaryHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  pendingAmount: {
    color: '#F59E0B',
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  payoutMethod: {
    fontSize: 12,
    color: '#6B7280',
  },
  payoutAmounts: {
    alignItems: 'flex-end',
  },
  payoutNet: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payoutDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  failureReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  failureText: {
    fontSize: 12,
    color: '#991B1B',
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
