// File: p2p-kids-marketplace/src/screens/payouts/PayoutDashboardScreen.tsx
// MODULE-15.1 FLOW-22: Payout Dashboard — UI Redesign (Visual Only)
// DO NOT CHANGE: data fetch, navigation, payout business logic

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  Coins,
  Bank,
  ArrowDown,
  CaretRight,
  Plus,
  CheckCircle,
  Clock,
} from 'phosphor-react-native';
import { RootStackParamList } from '@/navigation/types';
import {
  getSellerBalance,
  formatBalanceForDisplay,
  getRecentPayouts,
  formatPayoutStatus,
  formatCentsToDollars,
  type SellerBalance,
  type SellerPayout,
} from '@/services/sellerBalance';
import { listPayoutMethods } from '@/services/payoutMethods';
import type { SellerPayoutMethod } from '@/types/payout.types';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function PayoutDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [primaryMethod, setPrimaryMethod] = useState<SellerPayoutMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [balanceData, payoutsData, methodsData] = await Promise.all([
        getSellerBalance(),
        getRecentPayouts(10),
        listPayoutMethods(),
      ]);
      setBalance(balanceData);
      setPayouts(payoutsData);
      setPrimaryMethod(methodsData.primary_method ?? methodsData.methods?.[0] ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load payout data');
      console.error('[PayoutDashboard] loadData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const displayBalance = formatBalanceForDisplay(balance);
  // 1 SP = 1 cent; display available_balance_cents as SP count
  const spCount = displayBalance.available_cents;
  const audEquivalent = formatCentsToDollars(spCount);

  const getMethodDisplayName = (method: SellerPayoutMethod): string => {
    switch (method.method_type) {
      case 'stripe_connect':
        return 'Stripe Connect';
      case 'paypal':
        return method.paypal_email ?? 'PayPal';
      case 'venmo':
        return method.venmo_handle ?? 'Venmo';
      case 'bank_ach':
        return method.bank_account_last4
          ? `Bank ••••${method.bank_account_last4}`
          : 'Bank Account';
      default:
        return 'Payment Method';
    }
  };

  const getMethodMasked = (method: SellerPayoutMethod): string => {
    switch (method.method_type) {
      case 'paypal':
        return method.paypal_email
          ? method.paypal_email.replace(/(.{2}).*(@)/, '$1***$2')
          : '';
      case 'bank_ach':
        return method.bank_account_last4 ? `••••${method.bank_account_last4}` : '';
      default:
        return '';
    }
  };

  const renderHistoryIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle testID="icon-completed" size={16} color="#5DBB8E" weight="fill" />;
    }
    return <Clock testID="icon-pending" size={16} color="#F59E0B" weight="fill" />;
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Payouts">
        <LoadingSpinner fullScreen={false} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Payouts">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DBB8E" />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner} testID="error-banner">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Balance Hero Card */}
        <View style={styles.heroCard} testID="balance-hero-card">
          <View style={styles.heroTopRow}>
            <Coins size={24} color="#FFFFFF" weight="fill" testID="coins-icon" />
            <Text style={styles.balanceLabel}>SP Balance</Text>
          </View>
          <Text style={styles.balanceAmount} testID="balance-amount">
            {spCount} SP
          </Text>
          <Text style={styles.balanceAUD} testID="balance-aud">
            ≈ {audEquivalent} AUD
          </Text>

          {/* Request Payout pill on card */}
          <TouchableOpacity
            testID="request-payout-btn"
            style={styles.requestBtn}
            onPress={() => navigation.navigate('RequestPayout')}
            activeOpacity={0.85}
          >
            <ArrowDown size={16} color="#5DBB8E" weight="bold" />
            <Text style={styles.requestBtnText}>Request Payout</Text>
          </TouchableOpacity>
        </View>

        {/* Bank Account Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Payout Method</Text>
          {primaryMethod ? (
            <TouchableOpacity
              testID="bank-row"
              style={styles.bankRow}
              onPress={() => navigation.navigate('PayoutSettings')}
              activeOpacity={0.7}
            >
              <Bank size={20} color="#5DBB8E" weight="regular" />
              <View style={styles.bankInfo}>
                <Text style={styles.bankName} testID="bank-name">
                  {getMethodDisplayName(primaryMethod)}
                </Text>
                {getMethodMasked(primaryMethod) ? (
                  <Text style={styles.bankMasked} testID="bank-masked">
                    {getMethodMasked(primaryMethod)}
                  </Text>
                ) : null}
              </View>
              <CaretRight size={16} color="#999999" weight="regular" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="add-bank-row"
              style={styles.bankRow}
              onPress={() => navigation.navigate('PayoutSettings')}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#5DBB8E" weight="regular" />
              <Text style={styles.addBankText}>Add Bank Account</Text>
              <CaretRight size={16} color="#999999" weight="regular" />
            </TouchableOpacity>
          )}
        </View>

        {/* Payout History Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Payout History</Text>
          {payouts.length === 0 ? (
            <Text style={styles.emptyHistory} testID="empty-history">
              No payouts yet
            </Text>
          ) : (
            payouts.map((payout) => {
              const statusInfo = formatPayoutStatus(payout.status);
              return (
                <View
                  key={payout.id}
                  style={styles.historyRow}
                  testID={`history-row-${payout.id}`}
                >
                  {renderHistoryIcon(payout.status)}
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyAmount} testID={`history-amount-${payout.id}`}>
                      {formatCentsToDollars(payout.net_amount_cents)} AUD
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(payout.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[styles.historyStatus, { color: statusInfo.color }]}
                    testID={`history-status-${payout.id}`}
                  >
                    {statusInfo.label}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backArrow: {
    fontSize: 24,
    color: '#5DBB8E',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  // Hero card
  heroCard: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  balanceAUD: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 16,
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  requestBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  // Section card
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  // Bank row
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  bankMasked: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  addBankText: {
    flex: 1,
    fontSize: 15,
    color: '#5DBB8E',
    fontWeight: '500',
  },
  // History rows
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  historyInfo: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  historyDate: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyHistory: {
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
