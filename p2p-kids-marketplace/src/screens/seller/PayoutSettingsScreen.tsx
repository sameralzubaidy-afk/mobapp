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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  listPayoutMethods,
  createPayoutMethod,
  deletePayoutMethod,
  setPrimaryPayoutMethod,
  formatPayoutMethodDisplay,
  checkPayoutEligibility,
} from '../../services/payoutMethods';
import type {
  SellerPayoutMethod,
  PayoutMethodType,
  PayoutMethodDisplay,
} from '../../types/payout.types';
import {
  getSellerBalance,
  formatBalanceForDisplay,
  requestWithdrawal,
  requestFullWithdrawal,
  getRecentPayouts,
  formatPayoutStatus,
  formatCentsToDollars,
  calculatePayoutFee,
} from '../../services/sellerBalance';
import type {
  SellerBalance,
  SellerPayout,
  BalanceDisplay,
} from '../../services/sellerBalance';

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
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [balanceDisplay, setBalanceDisplay] = useState<BalanceDisplay | null>(null);
  const [recentPayouts, setRecentPayouts] = useState<SellerPayout[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);
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

      // Load recent payouts
      const payoutsData = await getRecentPayouts(5);
      setRecentPayouts(payoutsData);
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
    loadPayoutMethods();
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
    Alert.alert(
      'Delete Payout Method',
      'Are you sure you want to delete this payout method?',
      [
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
      ]
    );
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
      Alert.alert('Action Required', 'Please add and verify a payout method first');
      return;
    }
    setShowWithdrawModal(true);
  };

  const handleWithdrawFull = async () => {
    try {
      setWithdrawing(true);
      const result = await requestFullWithdrawal();
      
      if (result.success) {
        Alert.alert(
          'Withdrawal Requested',
          `Your withdrawal of ${formatCentsToDollars(result.amount_cents || 0)} has been initiated. ` +
          `After fees, you will receive ${formatCentsToDollars(result.net_amount_cents || 0)}.`,
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

  // =============================================================================
  // Render
  // =============================================================================

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading payout methods...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']} // Android
            tintColor="#007AFF"  // iOS
          />
        }
      >
        {/* Balance Card */}
        {balanceDisplay && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>💰 Your Earnings</Text>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Available to Withdraw:</Text>
              <Text style={styles.balanceAmount}>{balanceDisplay.available}</Text>
            </View>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Pending (In Progress):</Text>
              <Text style={styles.balanceAmountSecondary}>{balanceDisplay.pending}</Text>
            </View>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Lifetime Earnings:</Text>
              <Text style={styles.balanceAmountSecondary}>{balanceDisplay.lifetime}</Text>
            </View>

            {balance && balance.available_balance_cents > 0 && (
              <TouchableOpacity 
                style={styles.withdrawButton} 
                onPress={handleWithdrawClick}
                disabled={!primaryMethodId}
              >
                <Text style={styles.withdrawButtonText}>💳 Withdraw Now</Text>
              </TouchableOpacity>
            )}

            {balance && balance.available_balance_cents === 0 && (
              <View style={styles.noBalanceNotice}>
                <Text style={styles.noBalanceText}>Complete trades to build your balance</Text>
              </View>
            )}
          </View>
        )}

        {/* Recent Payouts */}
        {recentPayouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
            {recentPayouts.map((payout) => (
              <PayoutHistoryCard key={payout.id} payout={payout} />
            ))}
          </View>
        )}

        {/* Eligibility Status */}
        <View style={[styles.statusCard, eligibility.can_receive_payouts ? styles.statusOk : styles.statusWarning]}>
          <Text style={styles.statusTitle}>
            {eligibility.can_receive_payouts ? '✓ Ready for Payouts' : '⚠ Action Required'}
          </Text>
          <Text style={styles.statusMessage}>{eligibility.message}</Text>
        </View>

        {/* Existing Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Payout Methods</Text>
          
          {methods.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No payout methods configured yet</Text>
              <Text style={styles.emptyStateSubtext}>Add a method to start receiving payments</Text>
            </View>
          ) : (
            methods.map((method) => (
              <PayoutMethodCard
                key={method.id}
                method={method}
                isPrimary={method.id === primaryMethodId}
                onSetPrimary={() => handleSetPrimary(method.id)}
                onDelete={() => handleDeleteMethod(method.id)}
              />
            ))
          )}
        </View>

        {/* Add Method Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddMethod}>
          <Text style={styles.addButtonText}>+ Add Payout Method</Text>
        </TouchableOpacity>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Payouts</Text>
          <Text style={styles.infoText}>
            • Payouts are processed when a trade is completed{'\n'}
            • You must have a verified primary payout method{'\n'}
            • Payout fees vary by method (displayed transparently){'\n'}
            • Platform transaction fee: $0 (you only pay payout provider fees)
          </Text>
        </View>
      </ScrollView>

      {/* Add Method Modal */}
      {showAddMethodModal && (
        <AddPayoutMethodModal onClose={handleCloseAddMethod} />
      )}

      {/* Withdraw Modal */}
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
    </View>
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
  const date = new Date(payout.created_at).toLocaleDateString();

  return (
    <View style={styles.payoutCard}>
      <View style={styles.payoutHeader}>
        <View style={styles.payoutInfo}>
          <Text style={styles.payoutAmount}>{formatCentsToDollars(payout.net_amount_cents)}</Text>
          <Text style={styles.payoutDate}>{date}</Text>
        </View>
        <View style={[styles.payoutStatusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Text style={[styles.payoutStatusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>
      {payout.payout_fee_cents > 0 && (
        <Text style={styles.payoutFee}>Fee: {formatCentsToDollars(payout.payout_fee_cents)}</Text>
      )}
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
}

function AddPayoutMethodModal({ onClose }: AddPayoutMethodModalProps) {
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

      switch (selectedType) {
        case 'stripe_connect':
          // Stripe onboarding will be handled separately via edge function
          Alert.alert(
            'Stripe Connect',
            'Stripe onboarding is not yet implemented. This will redirect you to Stripe onboarding.',
            [{ text: 'OK', onPress: onClose }]
          );
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
            style={[styles.methodTypeButton, selectedType === 'stripe_connect' && styles.methodTypeButtonActive]}
            onPress={() => setSelectedType('stripe_connect')}
          >
            <Text style={styles.methodTypeButtonText}>Stripe Connect</Text>
            <Text style={styles.methodTypeButtonSubtext}>Bank deposits via Stripe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodTypeButton, selectedType === 'paypal' && styles.methodTypeButtonActive]}
            onPress={() => setSelectedType('paypal')}
          >
            <Text style={styles.methodTypeButtonText}>PayPal</Text>
            <Text style={styles.methodTypeButtonSubtext}>2% fee, capped at $20</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodTypeButton, selectedType === 'venmo' && styles.methodTypeButtonActive]}
            onPress={() => setSelectedType('venmo')}
          >
            <Text style={styles.methodTypeButtonText}>Venmo</Text>
            <Text style={styles.methodTypeButtonSubtext}>2% fee, capped at $20</Text>
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
          <TouchableOpacity style={styles.modalCancelButton} onPress={() => onClose(false)} disabled={submitting}>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 60,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  statusOk: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
  },
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#007AFF',
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
    borderColor: '#dc3545',
  },
  deleteButtonText: {
    color: '#dc3545',
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
  addButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Modal styles
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
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
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
    backgroundColor: '#007AFF',
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
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#000',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28a745',
  },
  balanceAmountSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  withdrawButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noBalanceNotice: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  noBalanceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Payout History Card styles
  payoutCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 13,
    color: '#666',
  },
  payoutStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payoutFee: {
    fontSize: 13,
    color: '#999',
  },
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
    color: '#28a745',
  },
  withdrawMethodInfo: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#e3f2fd',
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
    color: '#007AFF',
  },
});
