/**
 * File: p2p-kids-marketplace/src/screens/profile/TransactionHistoryScreen.tsx
 * MODULE-11 TASK SUB-015: Billing History Screen
 * 
 * Displays the user's Stripe billing history entries from the billing_history table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { getBillingHistory } from '@/services/billingHistory';
import type { BillingHistory } from '@/types/billingHistory.types';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import { Ionicons } from '@expo/vector-icons';

export default function TransactionHistoryScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getBillingHistory({ user_id: userId, limit: 50 });
      setHistory(data);
      setError(null);
    } catch (err: any) {
      console.error('[TransactionHistoryScreen] Error:', err);
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
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'succeeded' ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={[styles.statusText, { color: item.status === 'succeeded' ? '#166534' : '#991b1b' }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Billing History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
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

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
});
