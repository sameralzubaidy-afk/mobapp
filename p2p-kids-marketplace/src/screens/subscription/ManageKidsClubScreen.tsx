/**
 * File: p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx
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
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '@/contexts/AuthContext';
import {
  getSubscriptionSummary,
  cancelSubscription,
  SubscriptionSummary,
  CancelSubscriptionResult,
} from '@/services/subscription';
import { getGracePeriodDays } from '@/services/adminConfig';
import BottomNavBar from '../../components/organisms/BottomNavBar';

// ─── Cancellation Reason Options ──────────────────────────────────────────────
const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using', label: "Not using it enough" },
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

  // State
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [cancelResult, setCancelResult] = useState<CancelSubscriptionResult | null>(null);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(90); // Default 90, fetched dynamically

  // Fetch subscription on mount
  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const [summary, graceDays] = await Promise.all([
        getSubscriptionSummary(userId),
        getGracePeriodDays(true),
      ]);
      setSubscription(summary);
      setGracePeriodDays(graceDays);
    } catch (error) {
      console.error('[ManageKidsClub] Error fetching subscription:', error);
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
      Alert.alert('Please select a reason', 'Help us improve by telling us why you are cancelling.');
      return;
    }

    setCancelling(true);
    setShowCancelModal(false);

    try {
      const result = await cancelSubscription(reason);
      setCancelResult(result);

      if (result.success) {
        // Refresh subscription data
        await fetchSubscription();
          await refreshSession(false);
        
        // Show success message based on new status
        Alert.alert(
          'Cancellation Confirmed',
          result.message,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back or to dashboard
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Cancellation Failed', result.message || 'Please try again later');
      }
    } catch (error) {
      console.error('[ManageKidsClub] Cancellation error:', error);
      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // ─── Render Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading subscription details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render No Subscription ─────────────────────────────────────────────────
  if (!subscription || subscription.status === 'free') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Manage Kids Club+</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.noSubText}>You don&apos;t have an active Kids Club+ subscription.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('ContinueKidsClub' as never)}
            >
              <Text style={styles.primaryButtonText}>Subscribe to Kids Club+</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Render Active/Trial Subscription ───────────────────────────────────────
  const isTrial = subscription.status === 'trial';
  const isActive = subscription.status === 'active';
  const isCancelled = subscription.status === 'cancelled';
  const isGracePeriod = subscription.status === 'grace_period';
  const canCancel = isTrial || isActive;

  const periodEndDate = subscription.subscription_expires_at || subscription.trial_ends_at;
  const daysLeft = daysRemaining(periodEndDate);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Manage Kids Club+</Text>
          <Text style={styles.subtitle}>Your subscription details</Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.statusBadge, styles[`badge_${subscription.status}`]]}>
              <Text style={styles.statusBadgeText}>
                {subscription.status === 'trial'
                  ? 'Free Trial'
                  : subscription.status === 'active'
                  ? 'Active'
                  : subscription.status === 'cancelled'
                  ? 'Cancelled'
                  : subscription.status === 'grace_period'
                  ? 'Grace Period'
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

        {/* Benefits Reminder (only for active/trial) */}
        {canCancel && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kids Club+ Benefits</Text>
            <View style={styles.benefitsList}>
              <Text style={styles.benefitItem}>✓ Earn & spend Swap Points on purchases</Text>
              <Text style={styles.benefitItem}>✓ Lower transaction fees ($0.99 vs $2.99)</Text>
              <Text style={styles.benefitItem}>✓ Priority listing visibility</Text>
              <Text style={styles.benefitItem}>✓ Access to exclusive features</Text>
            </View>
          </View>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <View style={styles.cancelSection}>
            <TouchableOpacity
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

        {/* Re-subscribe Button (for cancelled/grace_period) */}
        {(isCancelled || isGracePeriod) && (
          <View style={styles.resubscribeSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('ContinueKidsClub' as never)}
            >
              <Text style={styles.primaryButtonText}>Re-subscribe to Kids Club+</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Kids Club+?</Text>
            
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
              <TextInput
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
                style={[
                  styles.modalConfirmBtn,
                  !selectedReason && styles.modalConfirmBtnDisabled,
                ]}
                onPress={handleCancel}
                disabled={!selectedReason}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm Cancellation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar showHelp={true} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badge_trial: {
    backgroundColor: '#e3f2fd',
  },
  badge_active: {
    backgroundColor: '#e8f5e9',
  },
  badge_cancelled: {
    backgroundColor: '#fff3e0',
  },
  badge_grace_period: {
    backgroundColor: '#fce4ec',
  },
  badge_free: {
    backgroundColor: '#f5f5f5',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  warningBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#bf360c',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1565c0',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#0d47a1',
    lineHeight: 20,
  },
  benefitsList: {
    marginTop: 4,
  },
  benefitItem: {
    fontSize: 15,
    color: '#2e7d32',
    marginBottom: 8,
    lineHeight: 22,
  },
  cancelSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#d32f2f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelNote: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resubscribeSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  noSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  reasonsList: {
    maxHeight: 250,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  reasonItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  reasonText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: '#ccc',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
