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
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/navigation/types';
import {
  Coins,
  MagnifyingGlass,
  Tag,
  Receipt,
  Storefront,
  UserPlus,
  Info,
  CaretRight,
} from 'phosphor-react-native';
import {
  getWallet,
  getExpiringBatches,
  type SPWallet,
} from '@/services/sp/wallet';
import { getSPExpirationDays } from '@/services/adminConfig';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import WalletWarningBanner, { type WalletState } from '@/components/molecules/WalletWarningBanner';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

export default function SpWalletScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();

  const [wallet, setWallet] = useState<SPWallet | null>(null);
  const [expiringSoonTotal, setExpiringSoonTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expirationDays, setExpirationDays] = useState<number | null>(null);

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

      // Load admin-configurable SP settings
      try {
        const expiryDays = await getSPExpirationDays();
        setExpirationDays(expiryDays);
      } catch (error) {
        console.error('[SpWallet] Error fetching SP config:', error);
      }

      // Load wallet
      const walletData = await getWallet(user.id);
      setWallet(walletData);

      // Load all batches to calculate expiring soon in next 30 days
      const allBatches = await getExpiringBatches(user.id, 30);
      const expiringTotal = allBatches.reduce((sum, batch) => sum + batch.remaining_sp, 0);
      setExpiringSoonTotal(expiringTotal);
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
        <LoadingSpinner />
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
    <ScreenLayout variant="detail" title="Swap Points">
      <View style={styles.container}>
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
              testID="sp-wallet-shop-btn"
              onPress={() => navigation.navigate('Discover')}
            >
              <MagnifyingGlass size={24} color="#5DBB8E" weight="regular" />
              <Text style={styles.actionLabel}>Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              testID="sp-wallet-sell-btn"
              onPress={() => navigation.navigate('ItemCreate')}
            >
              <Tag size={24} color="#F59E0B" weight="regular" />
              <Text style={styles.actionLabel}>Sell</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              testID="sp-wallet-history-btn"
              onPress={() => navigation.navigate('SpTransactionHistory')}
            >
              <Receipt size={24} color="#1A1A1A" weight="regular" />
              <Text style={styles.actionLabel}>History</Text>
            </TouchableOpacity>
          </View>

          {/* How to Earn Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Earn SP</Text>
            <TouchableOpacity
              style={styles.earnRow}
              testID="sp-wallet-earn-sell-btn"
              onPress={() => navigation.navigate('ItemCreate')}
              activeOpacity={0.7}
            >
              <Storefront size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.earnLabel}>Sell an item</Text>
              <View style={styles.spacer} />
              <Text style={styles.earnHint}>Accept SP on listing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.earnRow}
              testID="sp-wallet-earn-refer-btn"
              onPress={() => navigation.navigate('ReferralDashboard')}
              activeOpacity={0.7}
            >
              <UserPlus size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.earnLabel}>Refer a friend</Text>
              <View style={styles.spacer} />
              <Text style={styles.learnMoreText}>Learn More</Text>
              <CaretRight size={16} color="#5DBB8E" weight="regular" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.learnRow}
              testID="sp-wallet-how-trading-works-btn"
              onPress={() => navigation.navigate('Help')}
              activeOpacity={0.7}
            >
              <Info size={18} color="#5DBB8E" weight="regular" />
              <View>
                <Text style={styles.learnLabel}>How Trading Works</Text>
                <Text style={styles.learnSublabel}>Tap here to learn more about how to use and earn points</Text>
              </View>
              <View style={styles.spacer} />
              <CaretRight size={16} color="#5DBB8E" weight="regular" />
            </TouchableOpacity>
          </View>

          {/* Expiration Info Alert - PROMINENT */}
          {expirationDays !== null && (
            <View style={styles.expirationInfoBox}>
              <View style={styles.expirationInfoIcon}>
                <Text style={styles.expirationInfoIconText}>⏰</Text>
              </View>
              <View style={styles.expirationInfoContent}>
                <Text style={styles.expirationInfoTitle}>Swap Points Expire</Text>
                <Text style={styles.expirationInfoText}>
                  Points expire after {expirationDays} days of inactivity. Use them or lose them!
                </Text>
              </View>
            </View>
          )}

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
            <Text style={styles.footerText}>🔒 SP can only be used for item purchases</Text>
          </View>
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
  learnMoreText: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '500',
    marginRight: 6,
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
  earnHint: {
    fontSize: 12,
    color: '#6B6B6B',
    fontStyle: 'italic',
  },
  learnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 4,
  },
  learnLabel: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  learnSublabel: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 2,
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
  // Expiration Info Box (Prominent)
  expirationInfoBox: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#E0F7F3',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5DBB8E',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  expirationInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -2,
  },
  expirationInfoIconText: {
    fontSize: 20,
  },
  expirationInfoContent: {
    flex: 1,
  },
  expirationInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F6B52',
    marginBottom: 4,
  },
  expirationInfoText: {
    fontSize: 13,
    color: '#247659',
    fontWeight: '500',
    lineHeight: 18,
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

