// File: p2p-kids-marketplace/src/screens/profile/SpWalletScreen.tsx
// MODULE-09 SP-002: Swap Points Wallet Screen
// Shows available balance, pending SP, earning history, and expiring batches

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getWalletSummary } from '@/services/sp/wallet';
import { getLedgerHistory, SPLedgerEntry } from '@/services/sp/wallet';
import { getExpiringBatches, SPBatch } from '@/services/sp/wallet';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';

export default function SpWalletScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [walletSummary, setWalletSummary] = useState({
    available_points: 0,
    pending_points: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    wallet_state: 'inactive',
  });

  const [ledgerHistory, setLedgerHistory] = useState<SPLedgerEntry[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<SPBatch[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  }, [user?.id]);

  const loadWalletData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Load wallet summary
      const summary = await getWalletSummary(user.id);
      setWalletSummary(summary);

      // Load ledger history (last 50 entries)
      const history = await getLedgerHistory(user.id, 50, 0);
      setLedgerHistory(history);

      // Load expiring batches (within 30 days)
      const expiring = await getExpiringBatches(user.id, 30);
      setExpiringBatches(expiring);
    } catch (error) {
      console.error('Load wallet data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const renderBalanceCard = () => (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Available Balance</Text>
      <Text style={styles.balanceAmount}>{walletSummary.available_points} SP</Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>{walletSummary.pending_points} SP</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Lifetime Earned</Text>
          <Text style={styles.statValue}>{walletSummary.lifetime_earned} SP</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Lifetime Spent</Text>
          <Text style={styles.statValue}>{walletSummary.lifetime_spent} SP</Text>
        </View>
      </View>

      {walletSummary.wallet_state === 'frozen' && (
        <View style={styles.frozenBanner}>
          <Text style={styles.frozenText}>⚠️ Wallet Frozen - Renew subscription to access SP</Text>
        </View>
      )}

      {walletSummary.wallet_state === 'grace_period' && (
        <View style={styles.graceBanner}>
          <Text style={styles.graceText}>⏳ Grace Period Active - Renew soon to keep your SP</Text>
        </View>
      )}
    </View>
  );

  const renderExpiringBanner = () => {
    if (expiringBatches.length === 0) return null;

    const totalExpiring = expiringBatches.reduce((sum, batch) => sum + batch.remaining_sp, 0);

    return (
      <View style={styles.expiringBanner}>
        <Text style={styles.expiringTitle}>⚠️ SP Expiring Soon</Text>
        <Text style={styles.expiringText}>{totalExpiring} SP will expire in the next 30 days</Text>
        <TouchableOpacity
          style={styles.expiringButton}
          onPress={() => {
            // Navigate to expiring batches detail screen (future)
          }}
        >
          <Text style={styles.expiringButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLedgerEntry = (entry: SPLedgerEntry) => {
    const isEarn = entry.amount > 0;
    const icon = isEarn ? '✅' : '💸';
    const color = isEarn ? '#10b981' : '#ef4444';

    return (
      <View key={entry.id} style={styles.ledgerEntry}>
        <View style={styles.ledgerLeft}>
          <Text style={styles.ledgerIcon}>{icon}</Text>
          <View>
            <Text style={styles.ledgerDescription}>{entry.description}</Text>
            <Text style={styles.ledgerDate}>{new Date(entry.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.ledgerRight}>
          <Text style={[styles.ledgerAmount, { color }]}>
            {isEarn ? '+' : ''}
            {entry.amount} SP
          </Text>
          <Text style={styles.ledgerBalance}>Balance: {entry.balance_after} SP</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {renderBalanceCard()}
      {renderExpiringBanner()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>

        {ledgerHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Earn SP by listing items, completing challenges, and referring friends!
            </Text>
          </View>
        ) : (
          ledgerHistory.map((entry) => renderLedgerEntry(entry))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  frozenBanner: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  frozenText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  graceBanner: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  graceText: {
    fontSize: 14,
    color: '#d97706',
    textAlign: 'center',
  },
  expiringBanner: {
    backgroundColor: '#fff7ed',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  expiringTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ea580c',
    marginBottom: 8,
  },
  expiringText: {
    fontSize: 14,
    color: '#9a3412',
    marginBottom: 12,
  },
  expiringButton: {
    backgroundColor: '#ea580c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  expiringButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  ledgerEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  ledgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ledgerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  ledgerDescription: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 4,
  },
  ledgerDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ledgerBalance: {
    fontSize: 12,
    color: '#6b7280',
  },
});
