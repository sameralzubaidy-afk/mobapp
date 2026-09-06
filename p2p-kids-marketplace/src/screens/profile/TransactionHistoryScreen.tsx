/**
 * File: p2p-kids-marketplace/src/screens/profile/TransactionHistoryScreen.tsx
 * MODULE-11 TASK SUB-015: Billing History Screen
 *
 * Displays the user's Stripe billing history entries from the billing_history table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { getBillingHistory } from '@/services/billingHistory';
import { captureException } from '@/services/errorReporter';
import { getSimulatedPayoutFetchFailure } from '@/services/devTestingService';
import type { BillingHistory } from '@/types/billingHistory.types';
import { Receipt } from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

export default function TransactionHistoryScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;

    try {
      // DT-118 (item 7): forced-fetch-failure QA toggle (SUB-TC-K02 error/retry
      // leg) — when armed, throw before the network call so the screen renders
      // its error state + Retry. Fail-closed outside dev.
      const simulatedFetchFailure = await getSimulatedPayoutFetchFailure();
      if (simulatedFetchFailure === 'fetch_failure') {
        throw new Error('Simulated billing history fetch failure (QA toggle payout_fetch_failure)');
      }

      const data = await getBillingHistory({ user_id: userId, limit: 50 });
      setHistory(data);
      setError(null);
    } catch (err: any) {
      captureException(err, {
        tags: { screen: 'TransactionHistoryScreen', action: 'load_history' },
        extra: { message: err?.message },
      });
      setError('Failed to load billing history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatAmount = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: BillingHistory }) => (
    <View style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.description}>{item.description || 'Kids Club+ Subscription'}</Text>
        <Text style={styles.amount}>{formatAmount(item.amount, item.currency)}</Text>
      </View>
      <View style={styles.itemFooter}>
        <Text style={styles.date}>{formatDate(item.charged_at)}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'succeeded' ? '#4CAF50' : '#E53935' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.status === 'succeeded' ? '#FFFFFF' : '#FFFFFF' },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* DEV-TASK-101: surface WHY a charge failed — the stored error message from
          renew-subscription / retry-failed-payment / the invoice.payment_failed
          webhook, so a parent knows to update their payment method. */}
      {item.status === 'failed' && item.error_message ? (
        <Text style={styles.failureReason}>{item.error_message}</Text>
      ) : null}
    </View>
  );

  return (
    <ScreenLayout variant="detail" title="Transaction History">
      <View style={styles.content}>
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.center}>
            <Receipt size={64} color="#ccc" weight="regular" />
            <Text style={styles.emptyText}>No billing history yet.</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  loader: {
    marginTop: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
  },
  historyItem: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#808080',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // DEV-TASK-101: caption under a failed charge (billing_history.error_message).
  // Mirrors the on-screen FAILED red + date sizing for visual consistency.
  failureReason: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 8,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4A7C59',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#808080',
    marginTop: 12,
  },
});
