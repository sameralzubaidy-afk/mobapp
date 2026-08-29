// File: p2p-kids-marketplace/src/screens/payouts/RequestPayoutScreen.tsx
// MODULE-15.1 FLOW-22: Request Payout Screen — UI Redesign (Visual Only)
// DO NOT CHANGE: data fetch, navigation, payout business logic

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Coins, Bank, CaretRight } from 'phosphor-react-native';
import { RootStackParamList } from '@/navigation/types';
import {
  getSellerBalance,
  calculatePayoutFee,
  formatCentsToDollars,
  requestWithdrawal,
  type SellerBalance,
} from '@/services/sellerBalance';
import { listPayoutMethods } from '@/services/payoutMethods';
import { captureException } from '@/services/errorReporter';
import type { SellerPayoutMethod } from '@/types/payout.types';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function RequestPayoutScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [primaryMethod, setPrimaryMethod] = useState<SellerPayoutMethod | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [balanceData, methodsData] = await Promise.all([
        getSellerBalance(),
        listPayoutMethods(),
      ]);
      setBalance(balanceData);
      setPrimaryMethod(methodsData.primary_method ?? methodsData.methods?.[0] ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data');
      captureException(err, {
        tags: { screen: 'RequestPayoutScreen', action: 'load_data' },
        extra: { message: err?.message },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableCents = balance?.available_balance_cents ?? 0;
  // Amount entered as SP (integer, 1 SP = 1 cent)
  const enteredSP = parseInt(amountInput, 10);
  const enteredCents = isNaN(enteredSP) ? 0 : enteredSP;
  const feeCents = primaryMethod ? calculatePayoutFee(primaryMethod.method_type, enteredCents) : 0;
  const netCents = Math.max(enteredCents - feeCents, 0);

  const isValidAmount = enteredCents > 0 && enteredCents <= availableCents;
  const canSubmit = isValidAmount && primaryMethod !== null && !submitting;

  const getFeeDescription = (method: SellerPayoutMethod): string => {
    switch (method.method_type) {
      case 'stripe_connect':
        return 'Stripe fee: $0.25 + 0.25%';
      case 'paypal':
      case 'venmo':
        return 'PayPal/Venmo fee: 2% (max $20.00)';
      case 'bank_ach':
        return 'Bank transfer fee: $0.25';
      default:
        return 'No fee';
    }
  };

  const getMethodDisplayName = (method: SellerPayoutMethod): string => {
    switch (method.method_type) {
      case 'stripe_connect':
        return 'Stripe Connect';
      case 'paypal':
        return method.paypal_email ?? 'PayPal';
      case 'venmo':
        return method.venmo_handle ?? 'Venmo';
      case 'bank_ach':
        return method.bank_account_last4 ? `Bank ••••${method.bank_account_last4}` : 'Bank Account';
      default:
        return 'Payment Method';
    }
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;

    if (!primaryMethod) {
      Alert.alert('No Payout Method', 'Please add a bank account or payout method first.', [
        { text: 'Add Method', onPress: () => navigation.navigate('PayoutSettings') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await requestWithdrawal(enteredCents);
      if (response.success) {
        Alert.alert(
          'Payout Requested',
          `Your payout of ${formatCentsToDollars(response.net_amount_cents ?? netCents)} AUD is being processed.`,
          [
            {
              text: 'Done',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (response.action_required === 'add_payout_method') {
        Alert.alert(
          'Payout Method Required',
          'Please add a verified payout method to request a payout.',
          [
            { text: 'Add Method', onPress: () => navigation.navigate('PayoutSettings') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else if (response.action_required === 'verify_payout_method') {
        Alert.alert(
          'Verification Required',
          'Your payout method needs to be verified before withdrawing.',
          [
            { text: 'Verify', onPress: () => navigation.navigate('PayoutSettings') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        setError(response.error ?? 'Payout request failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred');
      captureException(err, {
        tags: { screen: 'RequestPayoutScreen', action: 'handle_confirm' },
        extra: { message: err?.message },
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    // DEFERRED-DECISION (2026-07-19): Payout screens had showBell={false} intentionally
    // to avoid financial-flow distractions. Keeping bell hidden — revert if product team decides otherwise.
    return (
      <ScreenLayout variant="detail" title="Request Payout" showBell={false}>
        <LoadingSpinner fullScreen={false} />
      </ScreenLayout>
    );
  }

  // DEFERRED-DECISION (2026-07-19): Keep bell hidden on payout — see first instance
  return (
    <ScreenLayout variant="detail" title="Request Payout" showBell={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorBanner} testID="error-banner">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Available Balance */}
          <View style={styles.availableRow} testID="available-balance">
            <Text style={styles.availableLabel}>Available</Text>
            <Text style={styles.availableValue} testID="available-amount">
              {availableCents} SP
            </Text>
          </View>

          {/* R3 — Delayed Seller Payout + Buffer: explain locked funds */}
          {balance && balance.pending_balance_cents > 0 && availableCents === 0 && (
            <View style={styles.pendingNote} testID="pending-buffer-note">
              <Text style={styles.pendingNoteText}>
                Your recent earnings are pending their payout release date and aren't withdrawable
                yet. Check My Earnings for the release date.
              </Text>
            </View>
          )}

          {/* Amount Input — filled style */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Amount (SP)</Text>
            <View
              style={[
                styles.inputWrapper,
                !isValidAmount && amountInput.length > 0 && styles.inputWrapperError,
              ]}
              testID="amount-input-wrapper"
            >
              <Coins size={20} color="#F59E0B" weight="fill" />
              <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                testID="amount-input"
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#999999"
                keyboardType="number-pad"
                returnKeyType="done"
                value={amountInput}
                onChangeText={setAmountInput}
                maxLength={10}
                accessibilityLabel="Amount in SP"
              />
              {amountInput.length > 0 && (
                <TouchableOpacity
                  testID="clear-amount-btn"
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Clear amount btn"
                  onPress={() => setAmountInput('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {amountInput.length > 0 && enteredCents > availableCents && (
              <Text style={styles.validationError} testID="amount-exceeds-error">
                Amount exceeds available balance ({availableCents} SP)
              </Text>
            )}
            {enteredCents > 0 && (
              <Text style={styles.audEquivalent} testID="aud-equivalent">
                ≈ {formatCentsToDollars(enteredCents)} AUD
              </Text>
            )}
          </View>

          {/* Bank Selector — filled input row */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Payout To</Text>
            <TouchableOpacity
              testID="bank-selector"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Bank selector"
              style={styles.bankRow}
              onPress={() => navigation.navigate('PayoutSettings')}
              activeOpacity={0.7}
            >
              <Bank size={20} color="#5DBB8E" weight="regular" />
              <Text
                style={[styles.bankRowText, !primaryMethod && styles.bankRowPlaceholder]}
                testID="bank-selector-text"
                numberOfLines={1}
              >
                {primaryMethod ? getMethodDisplayName(primaryMethod) : 'Add payout method'}
              </Text>
              <CaretRight size={16} color="#999999" weight="regular" />
            </TouchableOpacity>
          </View>

          {/* Summary (only when amount + method are set) */}
          {primaryMethod && enteredCents > 0 && (
            <View style={styles.summaryCard} testID="payout-summary">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue} testID="summary-amount">
                  {enteredCents} SP ({formatCentsToDollars(enteredCents)} AUD)
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transfer fee</Text>
                <Text style={styles.summaryValue} testID="summary-fee">
                  {feeCents > 0 ? formatCentsToDollars(feeCents) : 'Free'} AUD
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowLast]}>
                <Text style={styles.summaryLabelBold}>You receive</Text>
                <Text style={styles.summaryValueBold} testID="summary-net">
                  {formatCentsToDollars(netCents)} AUD
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom actions (sticky) */}
        <View style={styles.bottomActions}>
          {/* Fee note */}
          <Text style={styles.feeNote} testID="fee-note">
            {primaryMethod ? getFeeDescription(primaryMethod) : 'Add a payout method to continue'}
          </Text>

          {/* Confirm button — green pill */}
          <TouchableOpacity
            testID="confirm-payout-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Confirm payout btn"
            style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <LoadingSpinner fullScreen={false} color="#FFFFFF" size={20} />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm Payout</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  errorBanner: {
    marginBottom: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  // Available balance row
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  availableLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  availableValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  pendingNote: {
    marginTop: -12,
    marginBottom: 20,
    backgroundColor: '#EAF6F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pendingNoteText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#3D7A5B',
  },
  // Field groups
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Amount input — filled style
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    gap: 10,
  },
  inputWrapperError: {
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 0,
  },
  clearText: {
    fontSize: 16,
    color: '#999999',
  },
  validationError: {
    fontSize: 13,
    color: '#E85D75',
    marginTop: 6,
  },
  audEquivalent: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 6,
  },
  // Bank selector — filled row
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    gap: 10,
  },
  bankRowText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  bankRowPlaceholder: {
    color: '#999999',
    fontWeight: '400',
  },
  // Summary card
  summaryCard: {
    backgroundColor: '#F8FDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6F4ED',
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6F4ED',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  summaryLabelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summaryValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  // Bottom sticky actions
  bottomActions: {
    paddingHorizontal: 20,
    // Clear the floating pill nav (PersistentTabBar overlays the stack — pill
    // top sits ~110pt from the bottom), so the confirm button is never hidden
    // behind it (Dev Task 41 item 6, BP-58 principle screen-wide).
    paddingBottom: 120,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  feeNote: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 12,
  },
  // Confirm button — green pill
  confirmBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
