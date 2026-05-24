/**
 * Payout Settings Screen
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-003 (Seller Payout Setup UI)
 *
 * Seller-facing screen for managing payout methods
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase/client';
import {
  listPayoutMethods,
  createPayoutMethod,
  deletePayoutMethod,
  setPrimaryPayoutMethod,
  formatPayoutMethodDisplay,
  checkPayoutEligibility,
  syncStripeConnectStatus,
} from '../../services/payoutMethods';
import type {
  SellerPayoutMethod,
  PayoutMethodType,
} from '../../types/payout.types';
import {
  getSellerBalance,
  formatBalanceForDisplay,
  requestFullWithdrawal,
  submitPayPalPayout,
  getRecentPayouts,
  formatPayoutStatus,
  formatCentsToDollars,
  calculatePayoutFee,
} from '../../services/sellerBalance';
import type { SellerBalance, SellerPayout, BalanceDisplay } from '../../services/sellerBalance';
import { getAdminPayoutConfig } from '../../services/payoutRouter';
import type { AdminPayoutConfig } from '../../services/payoutRouter';
import { LoadingSpinner } from '@/components/ui';
import {
  Coins,
  Bank,
  ArrowLeft,
  ArrowDown,
  Plus,
  CaretRight,
  CheckCircle,
  Clock,
} from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// =============================================================================
// Main Component
// =============================================================================

export default function PayoutSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [methods, setMethods] = useState<SellerPayoutMethod[]>([]);
  const [primaryMethodId, setPrimaryMethodId] = useState<string | null>(null);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showNoMethodModal, setShowNoMethodModal] = useState(false);
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [balanceDisplay, setBalanceDisplay] = useState<BalanceDisplay | null>(null);
  const [recentPayouts, setRecentPayouts] = useState<SellerPayout[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [payoutLimit, setPayoutLimit] = useState(5); // Start with 5, increase on "Load More"
  const [loadingMore, setLoadingMore] = useState(false);
  const [adminPayoutConfig, setAdminPayoutConfig] = useState<AdminPayoutConfig | null>(null);
  const [eligibility, setEligibility] = useState({
    can_receive_payouts: false,
    message: '',
  });

  // Load payout methods on mount
  useEffect(() => {
    loadPayoutMethods();
  }, []);

  // =============================================================================
  // Data Loading
  // =============================================================================

  const loadPayoutMethods = async () => {
    try {
      setLoading(true);

      // Best-effort: sync Stripe Connect onboarding state from Stripe -> DB
      // so the UI and payout eligibility reflect completion immediately.
      try {
        await syncStripeConnectStatus();
      } catch (e) {
        // Don't block the screen on sync failures; user can pull-to-refresh.
        console.warn('Stripe Connect status sync failed:', e);
      }

      const response = await listPayoutMethods();
      setMethods(response.methods);
      setPrimaryMethodId(response.primary_method?.id || null);

      // Check eligibility
      const eligibilityCheck = await checkPayoutEligibility();
      setEligibility({
        can_receive_payouts: eligibilityCheck.can_receive_payouts,
        message: eligibilityCheck.blocking_reason || 'Ready to receive payouts',
      });

      // Load balance
      const balanceData = await getSellerBalance();
      setBalance(balanceData);
      setBalanceDisplay(formatBalanceForDisplay(balanceData));

      // Load recent payouts (use current limit)
      const payoutsData = await getRecentPayouts(payoutLimit);
      setRecentPayouts(payoutsData);

      const payoutConfig = await getAdminPayoutConfig();
      setAdminPayoutConfig(payoutConfig);
    } catch (error) {
      console.error('Failed to load payout data:', error);
      Alert.alert('Error', 'Failed to load payout data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPayoutLimit(5); // Reset to initial limit on refresh
    loadPayoutMethods();
  };

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as any);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const newLimit = payoutLimit + 5;
      setPayoutLimit(newLimit);
      const payoutsData = await getRecentPayouts(newLimit);
      setRecentPayouts(payoutsData);
    } catch (error) {
      console.error('Failed to load more payouts:', error);
      Alert.alert('Error', 'Failed to load more payouts. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  // =============================================================================
  // Actions
  // =============================================================================

  const handleSetPrimary = async (methodId: string) => {
    try {
      await setPrimaryPayoutMethod(methodId);
      Alert.alert('Success', 'Primary payout method updated');
      loadPayoutMethods();
    } catch (error) {
      console.error('Failed to set primary method:', error);
      Alert.alert('Error', 'Failed to update primary method. Please try again.');
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    Alert.alert('Delete Payout Method', 'Are you sure you want to delete this payout method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePayoutMethod(methodId);
            Alert.alert('Success', 'Payout method deleted');
            loadPayoutMethods();
          } catch (error) {
            console.error('Failed to delete method:', error);
            Alert.alert('Error', String(error) || 'Failed to delete payout method');
          }
        },
      },
    ]);
  };

  const handleAddMethod = () => {
    setShowAddMethodModal(true);
  };

  const handleCloseAddMethod = (shouldRefresh: boolean = false) => {
    setShowAddMethodModal(false);
    if (shouldRefresh) {
      // Use refreshing state instead of loading to keep UI visible
      setRefreshing(true);
      loadPayoutMethods();
    }
  };

  const handleWithdrawClick = () => {
    if (!balance || balance.available_balance_cents <= 0) {
      Alert.alert('No Balance', 'You have no available balance to withdraw');
      return;
    }
    if (!primaryMethodId) {
      setShowNoMethodModal(true);
      return;
    }
    setShowWithdrawModal(true);
  };

  const handleWithdrawFull = async () => {
    try {
      setWithdrawing(true);
      const result = await requestFullWithdrawal();

      if (result.success) {
        let providerSubmissionLine = '';
        if (
          result.payout_id &&
          (result.method_type === 'paypal' || result.method_type === 'venmo')
        ) {
          const submitRes = await submitPayPalPayout(result.payout_id);
          if (submitRes.success) {
            providerSubmissionLine = `\n\nSubmitted to PayPal. Status: ${submitRes.status || 'processing'}.`;
          } else {
            providerSubmissionLine = `\n\nPayPal submission failed: ${submitRes.error || 'Unknown error'}.`;
          }
        }

        Alert.alert(
          'Withdrawal Requested',
          `Your withdrawal of ${formatCentsToDollars(result.amount_cents || 0)} has been initiated. ` +
            `After fees, you will receive ${formatCentsToDollars(result.net_amount_cents || 0)}.` +
            providerSubmissionLine,
          [{ text: 'OK', onPress: () => setShowWithdrawModal(false) }]
        );
        loadPayoutMethods(); // Refresh data
      } else {
        Alert.alert('Withdrawal Failed', result.error || 'Unable to process withdrawal');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCloseWithdrawModal = () => {
    setShowWithdrawModal(false);
  };

  const payoutFeeSummary = adminPayoutConfig
    ? `${adminPayoutConfig.paypal_payout_fee_percentage}% fee, capped at ${formatCentsToDollars(
        adminPayoutConfig.paypal_payout_fee_cap_cents
      )}`
    : 'Fee based on current admin settings';

  // =============================================================================
  // Render
  // =============================================================================

  // Guard skipped during pull-to-refresh to prevent blank screen flash.
  if (loading && !refreshing) {
    return (
      <ScreenLayout variant="detail" title="Payout Settings">
        <View style={styles.centerContainer}>
          <LoadingSpinner />
        </View>
      </ScreenLayout>
    );
  }

  const primaryMethod = methods.find((m) => m.id === primaryMethodId);
  const primaryDisplay = primaryMethod ? formatPayoutMethodDisplay(primaryMethod) : null;

  return (
    <ScreenLayout variant="detail" title="Payout Settings">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#5DBB8E']}
            tintColor="#5DBB8E"
          />
        }
      >
        {/* ── Hero Balance Card ── */}
        <View style={styles.heroCard} testID="balance-hero-card">
          <View style={styles.heroTopRow}>
            <Coins size={24} color="white" weight="fill" testID="coins-icon" />
            <Text style={styles.heroLabel}>Available Balance</Text>
          </View>
          <Text style={styles.heroBalance} testID="balance-amount">
            {balanceDisplay?.available ?? '$0.00'}
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Pending</Text>
              <Text style={styles.heroStatValue} testID="balance-pending">
                {balanceDisplay?.pending ?? '$0.00'}
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Lifetime Earned</Text>
              <Text style={styles.heroStatValue} testID="balance-lifetime">
                {balanceDisplay?.lifetime ?? '$0.00'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.requestPayoutBtn}
            onPress={handleWithdrawClick}
            testID="request-payout-btn"
          >
            <ArrowDown size={16} color="#5DBB8E" />
            <Text style={styles.requestPayoutBtnText}>Withdraw Now</Text>
          </TouchableOpacity>
        </View>

        {/* ── Payout Method ── */}
        <Text style={styles.sectionLabel}>PAYOUT METHOD</Text>
        {methods.length > 0 ? (
          <>
            {methods.map((method) => {
              const display = formatPayoutMethodDisplay(method);
              return (
                <TouchableOpacity
                  key={method.id}
                  style={styles.methodRow}
                  onPress={() => handleSetPrimary(method.id)}
                  testID={`method-row-${method.id}`}
                >
                  <Bank size={20} color="#5DBB8E" />
                  <View style={styles.methodRowTextWrap}>
                    <View style={styles.methodRowTitleRow}>
                      <Text style={styles.methodRowName} testID="bank-name">
                        {display.label}
                      </Text>
                      {method.is_primary && (
                        <View style={styles.primaryPill}>
                          <Text style={styles.primaryPillText}>Primary</Text>
                        </View>
                      )}
                    </View>
                    {display.status_message ? (
                      <Text style={styles.methodRowMasked} testID="bank-masked">
                        {display.status_message}
                      </Text>
                    ) : null}
                  </View>
                  <CaretRight size={16} color="#999999" />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.addAnotherRow}
              onPress={handleAddMethod}
              testID="add-another-method-row"
            >
              <Plus size={18} color="#5DBB8E" />
              <Text style={styles.addAnotherText}>Add Another Method</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.methodRow}
            onPress={handleAddMethod}
            testID="add-bank-row"
          >
            <Plus size={20} color="#5DBB8E" />
            <Text style={styles.addBankText}>Add Bank Account</Text>
            <CaretRight size={16} color="#999999" />
          </TouchableOpacity>
        )}

        {/* ── Payout History ── */}
        <Text style={styles.sectionLabel}>PAYOUT HISTORY</Text>
        {recentPayouts.length === 0 ? (
          <View style={styles.emptyHistory} testID="empty-history">
            <Text style={styles.emptyHistoryText}>No payouts yet</Text>
          </View>
        ) : (
          <>
            {recentPayouts.map((payout) => (
              <PayoutHistoryCard key={payout.id} payout={payout} />
            ))}
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#5DBB8E" />
              ) : (
                <Text style={styles.loadMoreButtonText}>Load More</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Modals (logic unchanged) ── */}
      {showNoMethodModal && (
        <NoMethodModal
          onClose={() => setShowNoMethodModal(false)}
          onAddMethod={() => {
            setShowNoMethodModal(false);
            setShowAddMethodModal(true);
          }}
        />
      )}
      {showAddMethodModal && (
        <AddPayoutMethodModal onClose={handleCloseAddMethod} payoutFeeSummary={payoutFeeSummary} />
      )}
      {showWithdrawModal && (
        <WithdrawModal
          balance={balance}
          balanceDisplay={balanceDisplay}
          primaryMethod={methods.find((m) => m.id === primaryMethodId)}
          onClose={handleCloseWithdrawModal}
          onWithdrawFull={handleWithdrawFull}
          withdrawing={withdrawing}
        />
      )}
    </ScreenLayout>
  );
}

// =============================================================================
// Payout History Card Component
// =============================================================================

interface PayoutHistoryCardProps {
  payout: SellerPayout;
}

function PayoutHistoryCard({ payout }: PayoutHistoryCardProps) {
  const statusInfo = formatPayoutStatus(payout.status);
  const date = new Date(payout.created_at).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const isCompleted = payout.status === 'completed';
  const isPending =
    payout.status === 'pending' ||
    payout.status === 'processing' ||
    payout.status === 'requires_action';

  return (
    <View testID={`history-row-${payout.id}`}>
      <View style={styles.historyRow}>
        {isCompleted ? (
          <CheckCircle size={16} color="#5DBB8E" weight="fill" testID="icon-completed" />
        ) : isPending ? (
          <Clock size={16} color="#F59E0B" weight="fill" testID="icon-pending" />
        ) : (
          <Clock size={16} color="#999999" weight="fill" />
        )}
        <View style={styles.historyInfo}>
          <Text style={styles.historyAmount} testID={`history-amount-${payout.id}`}>
            {formatCentsToDollars(payout.net_amount_cents)}
          </Text>
          <Text style={styles.historyDate}>{date}</Text>
        </View>
        <View style={styles.historyStatus}>
          <Text
            style={[styles.historyStatusText, { color: statusInfo.color }]}
            testID={`history-status-${payout.id}`}
          >
            {statusInfo.label}
          </Text>
          {payout.payout_fee_cents > 0 && (
            <Text style={styles.historyFee}>
              Fee: {formatCentsToDollars(payout.payout_fee_cents)}
            </Text>
          )}
        </View>
      </View>
      {payout.failure_reason && (
        <View style={styles.failureReasonBox}>
          <Text style={styles.failureReasonText}>⚠️ {payout.failure_reason}</Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// No Method Modal Component
// =============================================================================

interface NoMethodModalProps {
  onClose: () => void;
  onAddMethod: () => void;
}

function NoMethodModal({ onClose, onAddMethod }: NoMethodModalProps) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.noMethodModalContent}>
        <Bank size={40} color="#5DBB8E" weight="fill" style={styles.noMethodIcon} />
        <Text style={styles.noMethodTitle}>Payment Method Required</Text>
        <Text style={styles.noMethodMessage}>
          To withdraw your earnings, you need to add and verify a payout method first.
        </Text>
        <TouchableOpacity
          style={styles.noMethodAddBtn}
          onPress={onAddMethod}
          testID="no-method-add-btn"
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.noMethodAddBtnText}>Add Payout Method</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.noMethodCancelBtn} onPress={onClose}>
          <Text style={styles.noMethodCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// Withdraw Modal Component
// =============================================================================

interface WithdrawModalProps {
  balance: SellerBalance | null;
  balanceDisplay: BalanceDisplay | null;
  primaryMethod: SellerPayoutMethod | undefined;
  onClose: () => void;
  onWithdrawFull: () => void;
  withdrawing: boolean;
}

function WithdrawModal({
  balance,
  balanceDisplay,
  primaryMethod,
  onClose,
  onWithdrawFull,
  withdrawing,
}: WithdrawModalProps) {
  if (!balance || !balanceDisplay || !primaryMethod) return null;

  const fee = calculatePayoutFee(primaryMethod.method_type, balance.available_balance_cents);
  const netAmount = balance.available_balance_cents - fee;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.withdrawModalContent}>
        <Text style={styles.modalTitle}>Withdraw Funds</Text>

        <View style={styles.withdrawSummary}>
          <View style={styles.withdrawRow}>
            <Text style={styles.withdrawLabel}>Available Balance:</Text>
            <Text style={styles.withdrawValue}>{balanceDisplay.available}</Text>
          </View>
          <View style={styles.withdrawRow}>
            <Text style={styles.withdrawLabel}>Payout Fee:</Text>
            <Text style={styles.withdrawValue}>-{formatCentsToDollars(fee)}</Text>
          </View>
          <View style={[styles.withdrawRow, styles.withdrawRowTotal]}>
            <Text style={styles.withdrawLabelTotal}>You'll Receive:</Text>
            <Text style={styles.withdrawValueTotal}>{formatCentsToDollars(netAmount)}</Text>
          </View>
        </View>

        <View style={styles.withdrawMethodInfo}>
          <Text style={styles.withdrawMethodLabel}>Payout Method:</Text>
          <Text style={styles.withdrawMethodValue}>
            {formatPayoutMethodDisplay(primaryMethod).label}
          </Text>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={onClose}
            disabled={withdrawing}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSubmitButton, withdrawing && styles.modalSubmitButtonDisabled]}
            onPress={onWithdrawFull}
            disabled={withdrawing}
          >
            {withdrawing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSubmitButtonText}>Confirm Withdrawal</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Payout Method Card Component
// =============================================================================

interface PayoutMethodCardProps {
  method: SellerPayoutMethod;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}

function PayoutMethodCard({ method, isPrimary, onSetPrimary, onDelete }: PayoutMethodCardProps) {
  const display = formatPayoutMethodDisplay(method);

  return (
    <View style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <View style={styles.methodInfo}>
          <Text style={styles.methodLabel}>{display.label}</Text>
          <Text style={styles.methodStatus}>{display.status_message}</Text>
        </View>
        {isPrimary && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
          </View>
        )}
      </View>

      <View style={styles.methodActions}>
        {!isPrimary && method.is_verified && (
          <TouchableOpacity style={styles.actionButton} onPress={onSetPrimary}>
            <Text style={styles.actionButtonText}>Set as Primary</Text>
          </TouchableOpacity>
        )}
        {!isPrimary && (
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {!method.is_verified && (
        <View style={styles.verificationWarning}>
          <Text style={styles.verificationWarningText}>
            ⚠ Verification required before setting as primary
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Add Payout Method Modal Component
// =============================================================================

interface AddPayoutMethodModalProps {
  onClose: (shouldRefresh?: boolean) => void;
  payoutFeeSummary: string;
}

function AddPayoutMethodModal({ onClose, payoutFeeSummary }: AddPayoutMethodModalProps) {
  const [selectedType, setSelectedType] = useState<PayoutMethodType | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a payout method type');
      return;
    }

    try {
      setSubmitting(true);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Your session has expired. Please log in again.');
        setSubmitting(false);
        return;
      }

      const token = session.access_token;
      const userId = session.user.id;

      switch (selectedType) {
        case 'stripe_connect':
          // Call Edge Function to create Stripe Connect account
          try {
            console.log('[Stripe] Creating account for user:', userId);
            const response = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-connect-account`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  userId: userId,
                }),
              }
            );

            const result = await response.json();
            console.log('[Stripe] Create account result:', result);

            if (!response.ok || !result.success) {
              Alert.alert('Error', result.error || 'Failed to create Stripe account');
              return;
            }

            // Store the account ID and method ID
            const methodId = result.methodId;

            // Generate Stripe onboarding link
            console.log('[Stripe] Generating onboarding link for method:', methodId);

            const redirectBaseUrl = process.env.EXPO_PUBLIC_STRIPE_REDIRECT_BASE_URL;
            if (!redirectBaseUrl) {
              Alert.alert(
                'Configuration Error',
                'Missing EXPO_PUBLIC_STRIPE_REDIRECT_BASE_URL. This must be an https:// URL to a hosted redirect page.'
              );
              return;
            }

            // Build a deep link that works for the current runtime:
            // - Expo Go: exp://...
            // - Standalone builds: p2pkidsmarketplace://...
            const deepLinkSuccess = ExpoLinking.createURL('payout-settings', {
              queryParams: { success: 'true' },
            });
            const deepLinkRefresh = ExpoLinking.createURL('payout-settings', {
              queryParams: { refresh: 'true' },
            });

            const base = redirectBaseUrl.replace(/\/$/, '');

            const linkResponse = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-account-link`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  userId: userId,
                  methodId,
                  returnUrl: `${base}/stripe-redirect?status=success&dl=${encodeURIComponent(deepLinkSuccess)}`,
                  refreshUrl: `${base}/stripe-redirect?status=refresh&dl=${encodeURIComponent(deepLinkRefresh)}`,
                }),
              }
            );

            const linkResult = await linkResponse.json();
            console.log('[Stripe] Link result:', linkResult);

            if (!linkResponse.ok || !linkResult.success) {
              Alert.alert('Error', linkResult.error || 'Failed to generate onboarding link');
              return;
            }

            Alert.alert(
              'Success',
              'Stripe account created! You will now be redirected to complete your onboarding.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    // Open Stripe onboarding URL
                    const url = linkResult.url;
                    if (url) {
                      try {
                        const supported = await Linking.canOpenURL(url);
                        if (supported) {
                          await Linking.openURL(url);
                          onClose(true);
                        } else {
                          Alert.alert(
                            'Stripe Onboarding',
                            'Please open this URL in your browser to complete setup:\n\n' + url,
                            [{ text: 'OK', onPress: () => onClose(true) }]
                          );
                        }
                      } catch (err) {
                        console.error('Failed to open URL:', err);
                        Alert.alert(
                          'Stripe Onboarding',
                          'Please open this URL in your browser to complete setup:\n\n' + url,
                          [{ text: 'OK', onPress: () => onClose(true) }]
                        );
                      }
                    } else {
                      onClose(true);
                    }
                  },
                },
              ]
            );
          } catch (error) {
            console.error('Failed to create Stripe Connect account:', error);
            Alert.alert('Error', String(error) || 'Failed to create Stripe account');
          }
          break;

        case 'paypal':
          if (!paypalEmail) {
            Alert.alert('Error', 'Please enter your PayPal email');
            return;
          }
          await createPayoutMethod({
            method_type: 'paypal',
            paypal_email: paypalEmail,
            set_as_primary: false,
          });
          Alert.alert('Success', 'PayPal payout method added. Please verify your email.');
          onClose(true); // Refresh data after adding
          break;

        case 'venmo':
          if (!venmoHandle) {
            Alert.alert('Error', 'Please enter your Venmo handle or phone');
            return;
          }
          await createPayoutMethod({
            method_type: 'venmo',
            venmo_handle: venmoHandle,
            set_as_primary: false,
          });
          Alert.alert('Success', 'Venmo payout method added. Verification may be required.');
          onClose(true); // Refresh data after adding
          break;

        default:
          Alert.alert('Error', 'Unsupported payout method type');
      }
    } catch (error) {
      console.error('Failed to add payout method:', error);
      Alert.alert('Error', String(error) || 'Failed to add payout method');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Add Payout Method</Text>

        {/* Method Type Selection */}
        <View style={styles.methodTypeSection}>
          <TouchableOpacity
            style={[
              styles.methodTypeButton,
              selectedType === 'stripe_connect' && styles.methodTypeButtonActive,
            ]}
            onPress={() => setSelectedType('stripe_connect')}
          >
            <Text style={styles.methodTypeButtonText}>Stripe Connect</Text>
            <Text style={styles.methodTypeButtonSubtext}>Bank deposits via Stripe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodTypeButton,
              selectedType === 'paypal' && styles.methodTypeButtonActive,
            ]}
            onPress={() => setSelectedType('paypal')}
          >
            <Text style={styles.methodTypeButtonText}>PayPal</Text>
            <Text style={styles.methodTypeButtonSubtext}>{payoutFeeSummary}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodTypeButton,
              selectedType === 'venmo' && styles.methodTypeButtonActive,
            ]}
            onPress={() => setSelectedType('venmo')}
          >
            <Text style={styles.methodTypeButtonText}>Venmo</Text>
            <Text style={styles.methodTypeButtonSubtext}>{payoutFeeSummary}</Text>
          </TouchableOpacity>
        </View>

        {/* Method-Specific Inputs */}
        {selectedType === 'paypal' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>PayPal Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={paypalEmail}
              onChangeText={setPaypalEmail}
            />
          </View>
        )}

        {selectedType === 'venmo' && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Venmo Handle or Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="@username or +1234567890"
              autoCapitalize="none"
              value={venmoHandle}
              onChangeText={setVenmoHandle}
            />
          </View>
        )}

        {/* Actions */}
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => onClose(false)}
            disabled={submitting}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSubmitButtonText}>Add Method</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Screen ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerRight: {
    width: 40,
  },
  // ── Scroll ──────────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // ── Hero Card ───────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  heroBalance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestPayoutBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
  },
  requestPayoutBtnText: {
    color: '#5DBB8E',
    fontSize: 15,
    fontWeight: '600',
  },
  // ── Section label ───────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 4,
  },
  // ── Payout method row ───────────────────────────────────────────────────────
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    marginBottom: 24,
  },
  methodRowTextWrap: {
    flex: 1,
  },
  methodRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodRowName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  primaryPill: {
    backgroundColor: '#E8F5F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  primaryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  methodRowMasked: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  addBankText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#5DBB8E',
  },
  addAnotherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  addAnotherText: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '500',
  },
  // ── No Method Modal ───────────────────────────────────────────────────────────────────────────────────────────
  noMethodModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  noMethodIcon: {
    marginBottom: 16,
  },
  noMethodTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
  },
  noMethodMessage: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  noMethodAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  noMethodAddBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noMethodCancelBtn: {
    paddingVertical: 12,
  },
  noMethodCancelText: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  // ── Payout history rows ─────────────────────────────────────────────────────
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    gap: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  historyStatus: {
    alignItems: 'flex-end',
  },
  historyStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  historyFee: {
    fontSize: 11,
    color: '#999999',
    marginTop: 2,
  },
  emptyHistory: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999999',
  },
  loadMoreButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5DBB8E',
  },
  // ── PayoutMethodCard (management via Add Method modal) ──────────────────────
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  methodStatus: {
    fontSize: 14,
    color: '#666',
  },
  primaryBadge: {
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  methodActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  deleteButtonText: {
    color: '#E85D75',
  },
  verificationWarning: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
  },
  verificationWarningText: {
    fontSize: 12,
    color: '#856404',
  },
  // ── Failure reason inline ───────────────────────────────────────────────────
  failureReasonBox: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E85D75',
  },
  failureReasonText: {
    fontSize: 12,
    color: '#991B1B',
  },
  // ── Modal styles (kept for AddPayoutMethodModal + WithdrawModal) ─────────────
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    color: '#000',
  },
  methodTypeSection: {
    marginBottom: 20,
  },
  methodTypeButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  methodTypeButtonActive: {
    borderColor: '#5DBB8E',
    backgroundColor: '#F0FAF5',
  },
  methodTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  methodTypeButtonSubtext: {
    fontSize: 14,
    color: '#666',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Balance Card styles
  // Withdraw Modal styles
  withdrawModalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  withdrawSummary: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  withdrawRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  withdrawLabel: {
    fontSize: 14,
    color: '#666',
  },
  withdrawValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  withdrawRowTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  withdrawLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  withdrawValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  withdrawMethodInfo: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F0FAF5',
    borderRadius: 8,
  },
  withdrawMethodLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  withdrawMethodValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5DBB8E',
  },
});
