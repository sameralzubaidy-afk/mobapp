// File: p2p-kids-marketplace/src/screens/sp/SpWalletScreen.tsx
// MODULE-09 SP-004: SP Wallet Screen with Expiration Warnings
// Full SP wallet UI with balance, expiring batches, and ledger history

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getWallet, getLedgerHistory, getExpiringBatches, getSPConfig, type SPWallet, type SPLedgerEntry } from '@/services/sp/wallet';
import { supabase } from '@/config/supabase';

export default function SpWalletScreen() {
  const navigation = useNavigation();
  
  const [wallet, setWallet] = useState<SPWallet | null>(null);
  const [expiringSoonTotal, setExpiringSoonTotal] = useState(0); 
  const [ledgerHistory, setLedgerHistory] = useState<SPLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState(90); // Will be updated from config

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[SpWallet] User not authenticated');
        return;
      }

      setUserId(user.id);

      // Load SP expiration config (default 90 days if not set)
      try {
        const configValue = await getSPConfig('expiration_period_days');
        const days = configValue ? parseInt(configValue, 10) : 90;
        setExpirationDays(days);
        console.log('[SpWallet] SP expiration period:', days, 'days');
      } catch (error) {
        console.error('[SpWallet] Error fetching SP config:', error);
        setExpirationDays(90); // Default fallback
      }

      // Load wallet
      const walletData = await getWallet(user.id);
      setWallet(walletData);

      // Load all batches to calculate expiring soon in next 30 days
      const allBatches = await getExpiringBatches(user.id, 30);
      const expiringTotal = allBatches.reduce((sum, batch) => sum + batch.remaining_sp, 0);
      setExpiringSoonTotal(expiringTotal);

      // Load ledger history
      const history = await getLedgerHistory(user.id, 20);
      setLedgerHistory(history);
    } catch (error) {
      console.error('[SpWallet] Load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your wallet...</Text>
      </View>
    );
  }

  if (!wallet) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>💳</Text>
        <Text style={styles.errorTitle}>Wallet Not Found</Text>
        <Text style={styles.errorText}>Unable to load your SP wallet.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            testID="sp-wallet-back-button"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Swap Points Wallet</Text>
          <View style={styles.headerSpacer} />
        </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>{wallet.available_balance} SP</Text>

        {/* Sub-balances */}
        <View style={styles.subBalances}>
          <View style={styles.subBalanceItem}>
            <Text style={styles.subBalanceLabel}>Pending</Text>
            <Text style={styles.subBalanceValue}>{wallet.pending_balance} SP</Text>
          </View>
          <View style={styles.subBalanceDivider} />
          <View style={styles.subBalanceItem}>
            <Text style={styles.subBalanceLabel}>Lifetime Earned</Text>
            <Text style={styles.subBalanceValue}>{wallet.lifetime_earned} SP</Text>
          </View>
          <View style={styles.subBalanceDivider} />
          <View style={styles.subBalanceItem}>
            <Text style={styles.subBalanceLabel}>Lifetime Spent</Text>
            <Text style={styles.subBalanceValue}>{wallet.lifetime_spent} SP</Text>
          </View>
        </View>

        {/* Expiring Soon Info */}
        {expiringSoonTotal > 0 && (
          <View style={styles.expiringSoonContainer}>
            <Text style={styles.expiringSoonText}>
              ⚠️ {expiringSoonTotal} SP will expire in the next 30 days
            </Text>
          </View>
        )}
      </View>

      {/* Ledger History Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {ledgerHistory.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          ledgerHistory.map((entry) => (
            <View key={entry.id} style={styles.ledgerCard}>
              <View style={styles.ledgerHeader}>
                <Text style={styles.ledgerType}>
                  {entry.transaction_type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.ledgerAmount,
                    { color: entry.amount >= 0 ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {entry.amount >= 0 ? '+' : ''}
                  {entry.amount} SP
                </Text>
              </View>
              <Text style={styles.ledgerDescription}>{entry.description}</Text>
              <Text style={styles.ledgerDate}>
                {new Date(entry.created_at).toLocaleDateString()} at{' '}
                {new Date(entry.created_at).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Swap Points expire after 365 days of inactivity
        </Text>
        <Text style={styles.footerText}>🔒 SP can only be used for item purchases</Text>
      </View>
    </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 60, // Same width as back button to center title
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#F3F4F6',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  warningEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  warningCta: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  balanceCard: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 24,
  },
  subBalances: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  subBalanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  subBalanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  subBalanceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  subBalanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  expiringSoonContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    width: '100%',
  },
  expiringSoonText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  ledgerCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    marginBottom: 12,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ledgerType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  ledgerDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  ledgerDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 24,
  },
  footer: {
    padding: 16,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
});
