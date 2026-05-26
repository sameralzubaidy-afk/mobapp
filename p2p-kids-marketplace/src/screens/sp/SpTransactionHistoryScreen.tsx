// File: p2p-kids-marketplace/src/screens/sp/SpTransactionHistoryScreen.tsx
// MODULE-15.1 FLOW-10/11: SP Transaction History — UI Redesign (Visual Only)
// Transaction history with tabs, type-based icons, and color-coded amounts

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Storefront,
  ArrowsLeftRight,
  ArrowUp,
  UserPlus,
  Clock,
  Coins,
} from 'phosphor-react-native';
import { getLedgerHistory, type SPLedgerEntry } from '@/services/sp/wallet';
import { supabase } from '@/config/supabase';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type TabFilter = 'all' | 'earned' | 'spent';

export default function SpTransactionHistoryScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [transactions, setTransactions] = useState<SPLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error('[SpTransactionHistory] User not authenticated');
        return;
      }

      const history = await getLedgerHistory(user.id, 50);
      setTransactions(history);
    } catch (error) {
      console.error('[SpTransactionHistory] Load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'earned') return tx.amount > 0;
    if (activeTab === 'spent') return tx.amount < 0;
    return true;
  });

  const getTransactionIcon = (type: string) => {
    const iconSize = 20;
    const iconColor = '#5DBB8E';
    if (type.includes('sale') || type.includes('sell')) {
      return <Storefront size={iconSize} color={iconColor} weight="regular" />;
    }
    if (type.includes('trade') || type.includes('purchase')) {
      return <ArrowsLeftRight size={iconSize} color={iconColor} weight="regular" />;
    }
    if (type.includes('redeem') || type.includes('spend')) {
      return <ArrowUp size={iconSize} color="#F59E0B" weight="regular" />;
    }
    if (type.includes('referral')) {
      return <UserPlus size={iconSize} color={iconColor} weight="regular" />;
    }
    if (type.includes('pending')) {
      return <Clock size={iconSize} color="#999999" weight="regular" />;
    }
    return <Coins size={iconSize} color="#F59E0B" weight="regular" />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <ScreenLayout variant="detail" title="SP History">
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            testID="sp-history-tab-all"
            style={styles.tabButton}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All
            </Text>
            {activeTab === 'all' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            testID="sp-history-tab-earned"
            style={styles.tabButton}
            onPress={() => setActiveTab('earned')}
          >
            <Text style={[styles.tabText, activeTab === 'earned' && styles.tabTextActive]}>
              Earned
            </Text>
            {activeTab === 'earned' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            testID="sp-history-tab-spent"
            style={styles.tabButton}
            onPress={() => setActiveTab('spent')}
          >
            <Text style={[styles.tabText, activeTab === 'spent' && styles.tabTextActive]}>
              Spent
            </Text>
            {activeTab === 'spent' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState} testID="sp-history-empty-state">
              <Coins size={64} color="#E0E0E0" weight="regular" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => (
              <View key={tx.id} style={styles.txRow} testID={`sp-history-tx-${tx.id}`}>
                <View style={styles.txIconCircle}>{getTransactionIcon(tx.transaction_type)}</View>
                <View style={styles.txContent}>
                  <Text style={styles.txTitle}>
                    {tx.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString()} at{' '}
                    {new Date(tx.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    tx.amount > 0 ? styles.txAmountEarned : styles.txAmountSpent,
                  ]}
                  testID={`sp-history-amount-${tx.id}`}
                >
                  {tx.amount > 0 ? '+' : ''}
                  {tx.amount} SP
                </Text>
              </View>
            ))
          )}
        </ScrollView>
        <PersistentTabBar />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#5DBB8E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B6B6B',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999999',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#5DBB8E',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  // Transaction List
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txContent: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  txAmountEarned: {
    color: '#5DBB8E',
  },
  txAmountSpent: {
    color: '#E85D75',
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    marginTop: 16,
  },
});
