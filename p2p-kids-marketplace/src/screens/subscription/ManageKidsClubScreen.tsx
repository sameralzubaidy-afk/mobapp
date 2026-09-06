/**
 * File: p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx
 * MODULE-15.1 FLOW-12: ManageKidsClubScreen — Pass It Up design system
 * MODULE-11 TASK SUB-008: User-Initiated Cancellation Flow
 *
 * This screen allows subscribed users (active/trial) to:
 * - View their current subscription status
 * - See when their billing period ends
 * - Cancel their Kids Club+ subscription with confirmation
 * - Collect cancellation reason for analytics
 *
 * V2 Rules:
 * - Active users keep benefits until period end, then move to grace_period
 * - Trial users with SP activity move to grace_period
 * - Trial users without SP activity move to free
 * - Clear parent-friendly explanations throughout
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  AccessibilityInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '@/contexts/AuthContext';
import { captureException } from '@/services/errorReporter';
import {
  getSubscriptionSummary,
  cancelSubscription,
  getPaymentMethod,
  resubscribe,
  SubscriptionSummary,
} from '@/services/subscription';
import { getGracePeriodDays, getActiveMemberFeeCents } from '@/services/adminConfig';
import { formatPrice } from '@/utils/formatPrice';
import { PaymentMethodSection } from '@/components/subscription/PaymentMethodSection';
import { AutoRenewToggle } from '@/components/subscription/AutoRenewToggle';
import { BillingHistoryLink } from '@/components/subscription/BillingHistoryLink';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

// ─── Cancellation Reason Options ──────────────────────────────────────────────
const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using', label: 'Not using it enough' },
  { id: 'child_lost_interest', label: 'My child lost interest' },
  { id: 'found_alternative', label: 'Found an alternative' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'other', label: 'Other reason' },
];

// ─── Helper: Format date for display ──────────────────────────────────────────
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

// ─── Helper: Calculate days remaining ─────────────────────────────────────────
function daysRemaining(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  try {
    const endDate = new Date(dateString);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManageKidsClubScreen() {
  const navigation = useNavigation();
  const { session, refreshSession } = useContext(AuthContext);
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();

  // State
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(90); // Default 90, fetched dynamically
  // R1 — Tiered Buyer-Fee Engine: flat active-member fee (dynamic).
  const [activeMemberFlatCents, setActiveMemberFlatCents] = useState<number>(149);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [checkingPaymentMethod, setCheckingPaymentMethod] = useState(false);
  const [renewing, setRenewing] = useState(false);

  // DEV-TASK-67 item 1: imperative screen-reader announcement when the cancel
  // modal becomes visible. The passive `accessible` + `accessibilityRole="alert"` +
  // `accessibilityLabel` on the modal container is flattened by iOS (QA Task 10
  // FV2b — container absent from the AX tree), so announce explicitly on
  // visibility change (mirrors SuccessToast's DT-63 announce pattern), IN
  // ADDITION to the passive attrs.
  useEffect(() => {
    if (showCancelModal) {
      AccessibilityInfo.announceForAccessibility('Cancel Reason dialog');
    }
  }, [showCancelModal]);

  // Fetch subscription on mount
  const fetchPaymentMethodStatus = useCallback(
    async (currentSummary?: SubscriptionSummary) => {
      if (!userId) {
        setHasPaymentMethod(false);
        return;
      }

      setCheckingPaymentMethod(true);
      try {
        const paymentMethod = await getPaymentMethod();
        if (paymentMethod) {
          setHasPaymentMethod(true);
          return;
        }

        setHasPaymentMethod(Boolean(currentSummary?.stripe_payment_method_id));
      } catch (error) {
        console.warn('[ManageKidsClub] Failed fetching payment method:', error);
        setHasPaymentMethod(Boolean(currentSummary?.stripe_payment_method_id));
      } finally {
        setCheckingPaymentMethod(false);
      }
    },
    [userId]
  );

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const [summary, graceDays, memberFeeCents] = await Promise.all([
        getSubscriptionSummary(userId),
        getGracePeriodDays(true),
        getActiveMemberFeeCents(true),
      ]);
      setSubscription(summary);
      setGracePeriodDays(graceDays);
      setActiveMemberFlatCents(memberFeeCents);
      await fetchPaymentMethodStatus(summary);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'ManageKidsClubScreen', action: 'fetch_subscription' },
      });
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchPaymentMethodStatus]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Handle cancellation
  const handleCancel = async () => {
    if (!userId) return;

    // Determine cancel reason
    let reason = selectedReason;
    if (selectedReason === 'other' && customReason.trim()) {
      reason = customReason.trim();
    }

    if (!reason) {
      Alert.alert(
        'Please select a reason',
        'Help us improve by telling us why you are cancelling.'
      );
      return;
    }

    setCancelling(true);
    setShowCancelModal(false);

    try {
      const result = await cancelSubscription(reason);

      if (result.success) {
        // Refresh subscription data
        await fetchSubscription();
        await refreshSession(false);

        // Show success message based on new status
        Alert.alert('Cancellation Confirmed', result.message, [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back or to dashboard
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            },
          },
        ]);
      } else {
        Alert.alert('Cancellation Failed', result.message || 'Please try again later');
      }
    } catch (error) {
      captureException(error, {
        tags: { screen: 'ManageKidsClubScreen', action: 'cancel' },
      });
      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const showAddPaymentAlert = useCallback(() => {
    Alert.alert(
      'Payment Method Required',
      'Please add a payment method to renew your subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Payment',
          onPress: () => {
            navigation.navigate('JoinKidsClub' as never);
          },
        },
      ]
    );
  }, [navigation]);

  const handleResubscribePress = useCallback(async () => {
    if (checkingPaymentMethod || renewing) {
      return;
    }

    if (!hasPaymentMethod) {
      showAddPaymentAlert();
      return;
    }

    setRenewing(true);

    try {
      const result = await resubscribe();

      if (result.success) {
        await fetchSubscription();
        await refreshSession(false);

        Alert.alert(
          'Subscription Renewed',
          result.message || 'Successfully renewed your Kids Club+ subscription!',
          [{ text: 'OK' }]
        );
        return;
      }

      if (result.error === 'NO_PAYMENT_METHOD') {
        showAddPaymentAlert();
        return;
      }

      if (result.error === 'PAYMENT_REQUIRED' || result.error === 'CARD_DECLINED') {
        Alert.alert(
          'Payment Failed',
          result.message ||
            'Your card was declined. Please update your payment method and try again.'
        );
        return;
      }

      Alert.alert('Renewal Failed', result.message || 'Please try again later.');
    } catch (error) {
      captureException(error, {
        tags: { screen: 'ManageKidsClubScreen', action: 'renew' },
      });
      Alert.alert('Error', 'Failed to renew subscription. Please try again.');
    } finally {
      setRenewing(false);
    }
  }, [
    checkingPaymentMethod,
    renewing,
    hasPaymentMethod,
    showAddPaymentAlert,
    fetchSubscription,
    refreshSession,
  ]);

  // ─── Render Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Manage Kids Club+">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading subscription details...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ─── Render No Subscription ─────────────────────────────────────────────────
  if (!subscription || subscription.status === 'free') {
    return (
      <ScreenLayout variant="detail" title="Manage Kids Club+">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Manage Kids Club+</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.noSubText}>
              You don&apos;t have an active Kids Club+ subscription.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('JoinKidsClub' as never)}
            >
              <Text style={styles.primaryButtonText}>Subscribe to Kids Club+</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenLayout>
    );
  }

  // ─── Render Active/Trial Subscription ───────────────────────────────────────
  const isTrial = subscription.status === 'trial';
  const isActive = subscription.status === 'active';
  const isCancelled = subscription.status === 'cancelled' || subscription.status === 'canceled';
  const isGracePeriod = subscription.status === 'grace_period';
  const isExpired = subscription.status === 'expired';
  const canCancel = isTrial || isActive;

  const periodEndDate = subscription.subscription_expires_at || subscription.trial_ends_at;
  const daysLeft = daysRemaining(periodEndDate);

  return (
    <ScreenLayout variant="detail" title="Manage Kids Club+">
      <ScrollView style={styles.screenScroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Manage Kids Club+</Text>
          <Text style={styles.subtitle}>Your subscription details</Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                (styles as Record<string, unknown>)[`badge_${subscription.status}`] as object,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {subscription.status === 'trial'
                  ? 'Free Trial'
                  : subscription.status === 'active'
                    ? 'Active'
                    : subscription.status === 'cancelled'
                      ? 'Cancelled'
                      : subscription.status === 'grace_period'
                        ? 'Grace Period'
                        : subscription.status === 'expired'
                          ? 'Expired'
                          : subscription.status}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Billing Info */}
          {(isTrial || isActive || isCancelled) && periodEndDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {isTrial ? 'Trial Ends' : isCancelled ? 'Access Until' : 'Next Billing Date'}
              </Text>
              <Text style={styles.infoValue}>{formatDate(periodEndDate)}</Text>
            </View>
          )}

          {daysLeft > 0 && (isTrial || isActive || isCancelled) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Days Remaining</Text>
              <Text style={styles.infoValue}>{daysLeft} days</Text>
            </View>
          )}

          {/* Grace Period Info */}
          {isGracePeriod && subscription.grace_ends_at && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Grace Period Active</Text>
              <Text style={styles.warningText}>
                Your Swap Points are frozen. Re-subscribe before{' '}
                <Text style={styles.bold}>{formatDate(subscription.grace_ends_at)}</Text> to restore
                access, or they will be permanently deleted.
              </Text>
            </View>
          )}

          {isExpired && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Your subscription has expired</Text>
              <Text style={styles.infoBoxText}>
                Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points.
              </Text>
            </View>
          )}

          {/* Cancelled Status Info */}
          {isCancelled && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Your subscription is cancelled</Text>
              <Text style={styles.infoBoxText}>
                You will continue to have Kids Club+ benefits until your billing period ends. After
                that, your Swap Points will be frozen for a {gracePeriodDays}-day grace period.
              </Text>
            </View>
          )}
        </View>

        {/* Management Section (Payment Method & Auto-Renew) */}
        {(isActive || isTrial || isCancelled) && (
          <View style={styles.card}>
            <PaymentMethodSection onPaymentMethodUpdated={fetchSubscription} />
            <AutoRenewToggle initialValue={isActive || isTrial} onToggled={fetchSubscription} />
          </View>
        )}

        {/* Billing History */}
        <BillingHistoryLink />

        {/* Benefits Reminder (only for active/trial) */}
        {canCancel && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kids Club+ Benefits</Text>
            <View style={styles.benefitsList}>
              <Text style={styles.benefitItem}>✓ Earn & spend Swap Points on purchases</Text>
              <Text style={styles.benefitItem}>
                ✓ Flat {formatPrice(activeMemberFlatCents)} Safety & Platform Fee on every trade
              </Text>
              <Text style={styles.benefitItem}>✓ Priority listing visibility</Text>
              <Text style={styles.benefitItem}>✓ Access to exclusive features</Text>
            </View>
          </View>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <View style={styles.cancelSection}>
            <TouchableOpacity
              testID="cancel-kids-club-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cancel Kids Club+"
              style={styles.cancelButton}
              onPress={() => setShowCancelModal(true)}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Kids Club+</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.cancelNote}>
              {isTrial
                ? 'Cancelling your trial will end it immediately.'
                : 'You will keep your benefits until the end of your billing period.'}
            </Text>
          </View>
        )}

        {/* Go Back (non-grace states). In grace/expired the resubscribe CTA and
            Go Back live in the sticky footer below the ScrollView (DT-124 Item 9). */}
        {(isGracePeriod || isExpired) ? null : (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sticky bottom footer — grace_period / expired only (DT-124 Item 9): the
          primary action must stay visible without scrolling. */}
      {(isGracePeriod || isExpired) && (
        <View style={[styles.graceFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.footerPrimaryButton]}
            onPress={handleResubscribePress}
            disabled={checkingPaymentMethod || renewing}
            testID="resubscribe-kids-club-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              checkingPaymentMethod || renewing ? 'Processing' : 'Re-subscribe to Kids Club+'
            }
          >
            {checkingPaymentMethod || renewing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Re-subscribe to Kids Club+</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, styles.footerBackButton]}
            onPress={() => navigation.goBack()}
            testID="grace-footer-back-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go Back"
            hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancellation Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.modalContent}
            testID="cancel-reason-modal"
            accessible
            accessibilityRole="alert"
            accessibilityLabel="Cancel Reason dialog"
          >
            <Text style={styles.modalTitle} accessibilityRole="header">Cancel Kids Club+?</Text>

            <Text style={styles.modalSubtitle}>
              {isTrial
                ? "We're sorry to see you go! Before you cancel, please tell us why:"
                : "You'll keep your benefits until the end of your billing period. Please tell us why you're leaving:"}
            </Text>

            {/* Reason Selection */}
            <ScrollView style={styles.reasonsList}>
              {CANCELLATION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  testID={`cancel-reason-${reason.id}`}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={reason.label}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason.id && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <View style={styles.radioButton}>
                    {selectedReason === reason.id && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.reasonText}>{reason.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Custom Reason Input */}
            {selectedReason === 'other' && (
              <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                testID="cancel-reason-other-input"
                accessibilityLabel="Other cancellation reason"
                style={styles.customReasonInput}
                placeholder="Please tell us more..."
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                maxLength={500}
              />
            )}

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                testID="cancel-keep-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Keep Subscription"
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedReason('');
                  setCustomReason('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Keep Subscription</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="cancel-confirm-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Confirm Cancellation"
                style={[styles.modalConfirmBtn, !selectedReason && styles.modalConfirmBtnDisabled]}
                onPress={handleCancel}
                disabled={!selectedReason}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm Cancellation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // DT-124 (Item 9): the ScrollView fills the space above the sticky grace
  // footer so the footer is pinned to the bottom of the screen.
  screenScroll: {
    flex: 1,
  },
  // DT-124 (Item 9): sticky bottom footer for grace_period / expired.
  graceFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerPrimaryButton: {
    alignSelf: 'stretch',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B6B6B',
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  // Status badges — Pass It Up semantic palette (design-system-passitup.md):
  // active→success #5DBB8E, trial→info #5B8FB9, grace→error #E85D75, cancelled→warning #FFA726.
  badge_trial: {
    backgroundColor: '#5B8FB9',
  },
  badge_active: {
    backgroundColor: '#5DBB8E',
  },
  badge_cancelled: {
    backgroundColor: '#FFA726',
  },
  badge_canceled: {
    backgroundColor: '#FFA726',
  },
  badge_grace_period: {
    backgroundColor: '#E85D75',
  },
  // DEV-TASK-127 (QA Task 39 F-3): 'expired' is a lost-access problem state on
  // the same screen family as grace — treat it consistently with the grace
  // branch's semantic error pill (#E85D75), not the neutral-gray fill it got in
  // the DT-119 sweep. Revert to a neutral fill if a terminal/inactive reading is
  // preferred (one-line change here).
  badge_expired: {
    backgroundColor: '#E85D75',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA726',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#EBF4F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5B8FB9',
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  benefitsList: {
    marginTop: 4,
  },
  benefitItem: {
    fontSize: 14,
    color: '#5DBB8E',
    marginBottom: 8,
    lineHeight: 22,
  },
  cancelSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E85D75',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resubscribeSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  // DEV-TASK-127 (QA Task 39 UX): grace/expired footer Go Back gets the standard
  // ≥44pt touch target (the shared backButton has no minHeight, so its hit area
  // was just the text line) + hitSlop set on the TouchableOpacity for reliable
  // taps on all device sizes.
  footerBackButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#5DBB8E',
  },
  noSubText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  reasonsList: {
    maxHeight: 250,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  reasonItemSelected: {
    backgroundColor: '#E8F5F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5DBB8E',
  },
  reasonText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    color: '#1A1A1A',
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#5DBB8E',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#E85D75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: '#CCCCCC',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
