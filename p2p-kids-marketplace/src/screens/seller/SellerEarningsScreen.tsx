/**
 * Seller Earnings Screen
 * File: p2p-kids-marketplace/src/screens/seller/SellerEarningsScreen.tsx
 * MODULE-15.1 FLOW-08: SellerEarningsScreen — Pass It Up design system
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
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getSellerPayouts } from '../../services/payoutService';
import type { SellerPayout } from '../../types/payout.types';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

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
        return '#FFA726'; // Warning 500
      case 'pending':
        return '#808080'; // Neutral
      case 'processing':
        return '#29B6F6'; // Info 500
      case 'completed':
        return '#4CAF50'; // Success 500
      case 'failed':
        return '#E53935'; // Error 500
      default:
        return '#808080';
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
      <ScreenLayout variant="detail" title="My Earnings">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout variant="detail" title="My Earnings">
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to Load Earnings</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPayouts}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="My Earnings">
      <FlatList
        data={payouts}
        renderItem={renderPayoutItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummary}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4A7C59']} />
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#808080',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#4D4D4D',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4A7C59',
    borderRadius: 12,
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
    color: '#1A1A1A',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pendingAmount: {
    color: '#FFA726',
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  payoutMethod: {
    fontSize: 12,
    color: '#808080',
  },
  payoutAmounts: {
    alignItems: 'flex-end',
  },
  payoutNet: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A7C59',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payoutDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#808080',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4D4D4D',
  },
  failureReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
  },
  failureText: {
    fontSize: 12,
    color: '#E53935',
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#4A7C59',
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
});
