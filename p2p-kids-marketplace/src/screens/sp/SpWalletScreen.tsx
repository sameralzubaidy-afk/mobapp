// File: p2p-kids-marketplace/src/screens/sp/SpWalletScreen.tsx
// MODULE-15.1 FLOW-10: SP Wallet Screen — UI Redesign (Visual Only)
// Premium SP wallet with gold accents, hero balance card, quick actions

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
import {
  Wallet,
  Coins,
  ArrowUp,
  Receipt,
  Storefront,
  ArrowsLeftRight,
  UserPlus,
  TrendUp,
} from 'phosphor-react-native';
import {
  getWallet,
  getLedgerHistory,
  getExpiringBatches,
  getSPConfig,
  type SPWallet,
  type SPLedgerEntry,
} from '@/services/sp/wallet';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import WalletWarningBanner, { type WalletState } from '@/components/molecules/WalletWarningBanner';
import BottomNavBar from '../../components/organisms/BottomNavBar';

export default function SpWalletScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();

  const [wallet, setWallet] = useState<SPWallet | null>(null);
  const [expiringSoonTotal, setExpiringSoonTotal] = useState(0);
  const [ledgerHistory, setLedgerHistory] = useState<SPLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expirationDays, setExpirationDays] = useState(90); // Will be updated from config

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error('[SpWallet] User not authenticated');
        return;
      }

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

  const walletState = ((session?.wallet_state as WalletState | undefined) ??
    (wallet.state as WalletState) ??
    'inactive') as WalletState;

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <WalletWarningBanner walletState={walletState} />

          {/* Hero Balance Card */}
          <View style={styles.heroCard} testID="sp-wallet-balance-card">
            <Coins size={40} color="rgba(255,255,255,0.9)" weight="regular" />
            <Text style={styles.balanceAmount} testID="sp-wallet-balance-amount">
              {wallet.available_balance}
            </Text>
            <Text style={styles.balanceLabel}>Swap Points</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              testID="sp-wallet-redeem-btn"
              onPress={() => {/* TODO: Navigate to redeem screen */}}
            >
              <ArrowUp size={24} color="#5DBB8E" weight="regular" />
              <Text style={styles.actionLabel}>Redeem</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              testID="sp-wallet-earn-more-btn"
              onPress={() => {/* TODO: Navigate to earn tips */}}
            >
              <Coins size={24} color="#F59E0B" weight="regular" />
              <Text style={styles.actionLabel}>Earn More</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              testID="sp-wallet-history-btn"
              onPress={() => navigation.navigate('SpTransactionHistory' as any)}
            >
              <Receipt size={24} color="#1A1A1A" weight="regular" />
              <Text style={styles.actionLabel}>History</Text>
            </TouchableOpacity>
          </View>

          {/* How to Earn Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Earn SP</Text>
            <View style={styles.earnRow}>
              <Storefront size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.earnLabel}>Sell an item</Text>
              <View style={styles.spacer} />
              <View style={styles.spChip}>
                <Coins size={12} color="#F59E0B" weight="fill" />
                <Text style={styles.spChipText}>50-500 SP</Text>
              </View>
            </View>
            <View style={styles.earnRow}>
              <ArrowsLeftRight size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.earnLabel}>Complete a trade</Text>
              <View style={styles.spacer} />
              <View style={styles.spChip}>
                <Coins size={12} color="#F59E0B" weight="fill" />
                <Text style={styles.spChipText}>25 SP</Text>
              </View>
            </View>
            <View style={styles.earnRow}>
              <UserPlus size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.earnLabel}>Refer a friend</Text>
              <View style={styles.spacer} />
              <View style={styles.spChip}>
                <Coins size={12} color="#F59E0B" weight="fill" />
                <Text style={styles.spChipText}>100 SP</Text>
              </View>
            </View>
          </View>

          {/* Lifetime Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statAmount}>{wallet.lifetime_earned}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statAmount}>{wallet.lifetime_spent}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statAmount}>{wallet.pending_balance}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* Expiring Soon Alert */}
          {expiringSoonTotal > 0 && (
            <View style={styles.expiringAlert}>
              <Text style={styles.expiringText}>
                ⚠️ {expiringSoonTotal} SP will expire in 30 days
              </Text>
            </View>
          )}

          {/* Ledger History Section - Removed, now in separate screen */}

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              💡 Swap Points expire after {expirationDays} days of inactivity
            </Text>
            <Text style={styles.footerText}>🔒 SP can only be used for item purchases</Text>
          </View>
        </ScrollView>
        <BottomNavBar />
      </View>
    </SafeAreaView>
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
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  // Hero Balance Card
  heroCard: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actionLabel: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 4,
    fontWeight: '500',
  },
  // How to Earn Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  earnLabel: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  spChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  spChipText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  // Lifetime Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 12,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 2,
  },
  // Expiring Alert
  expiringAlert: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  expiringText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Footer
  footer: {
    padding: 20,
    marginBottom: 80,
  },
  footerText: {
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 8,
  },
});
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
