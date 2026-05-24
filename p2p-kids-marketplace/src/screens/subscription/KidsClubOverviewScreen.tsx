/**
 * File: p2p-kids-marketplace/src/screens/subscription/KidsClubOverviewScreen.tsx
 * Marketing + benefit explanation and primary entry point for Kids Club+
 * MODULE-11 TASK SUB-010
 */

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '@/hooks/useSubscription';
import { useGracePeriodStatus } from '@/hooks/useGracePeriodStatus';
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard';
import { cancelSubscription } from '../../services/subscription';
import { AuthContext } from '@/contexts/AuthContext';
import { formatPrice } from '@/utils/formatPrice';
import {
  getSubscriptionPrice,
  getTransactionFeeNonSubscriberCents,
  getTransactionFeeSubscriberCents,
} from '@/services/adminConfig';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

/**
 * Kids Club+ overview screen
 * Shows benefits, current status, and state-appropriate CTAs
 */

const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using_enough', label: 'Not using it enough' },
  { id: 'child_outgrown', label: 'Child outgrown items' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'found_alternative', label: 'Found an alternative' },
  { id: 'other', label: 'Other' },
];

export default function KidsClubOverviewScreen() {
  const navigation = useNavigation();
  const { subscription, loading, refetch } = useSubscription();
  const { refreshSession } = useContext(AuthContext);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Calculate grace period status if applicable
  const { message: graceMessage, gracePeriodDays } = useGracePeriodStatus({
    status: subscription?.status || 'free',
    grace_period_ends_at: subscription?.grace_ends_at || null,
  });

  // NO HARDCODED PRICE - fetch from admin_config on mount
  const [monthlyPrice, setMonthlyPrice] = useState<number | null>(null);
  const [subscriberFeeCents, setSubscriberFeeCents] = useState<number>(0);
  const [nonSubscriberFeeCents, setNonSubscriberFeeCents] = useState<number>(0);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [price, subscriberFee, nonSubscriberFee] = await Promise.all([
          getSubscriptionPrice(true),
          getTransactionFeeSubscriberCents(true),
          getTransactionFeeNonSubscriberCents(true),
        ]);
        setMonthlyPrice(price);
        setSubscriberFeeCents(Number.isFinite(subscriberFee) ? subscriberFee : 0);
        setNonSubscriberFeeCents(Number.isFinite(nonSubscriberFee) ? nonSubscriberFee : 0);
      } catch (err) {
        console.error('[KidsClubOverview] Failed to load config:', err);
        setMonthlyPrice(0); // Show 0 if config missing
        setSubscriberFeeCents(0);
        setNonSubscriberFeeCents(0);
      }
    };

    void loadConfig();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Kids Club+">
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </ScreenLayout>
    );
  }

  const status = subscription?.status || 'free';

  const handleCancelSubscription = async () => {
    if (!selectedReasonId) {
      Alert.alert('Error', 'Please select a reason for cancellation');
      return;
    }

    const finalReason = selectedReasonId === 'other' ? cancellationReason : selectedReasonId;

    if (selectedReasonId === 'other' && !cancellationReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    try {
      setCancelling(true);
      const result = await cancelSubscription(finalReason);

      if (!result.success) {
        throw new Error(result.message);
      }

      Alert.alert(
        'Subscription Cancelled',
        'Your subscription has been cancelled. You will continue to have access until the end of your current billing period.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowCancelModal(false);
              setSelectedReasonId(null);
              setCancellationReason('');
              refetch();
              refreshSession();
            },
          },
        ]
      );
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // Determine primary CTA label and navigation based on status
  const {
    primaryCtaLabel,
    primaryCtaRoute,
  }: { primaryCtaLabel: string | null; primaryCtaRoute: string } = (() => {
    switch (status) {
      case 'free':
        return {
          primaryCtaLabel: 'Start 30-Day Free Trial',
          primaryCtaRoute: 'ContinueKidsClub',
        };
      case 'trial':
        return {
          primaryCtaLabel: null, // Trial users should see management section (cancel button)
          primaryCtaRoute: '',
        };
      case 'active':
        return {
          primaryCtaLabel: null, // Will render management section
          primaryCtaRoute: '',
        };
      case 'cancelled':
      case 'canceled':
        return {
          primaryCtaLabel: 'Reactivate Membership',
          primaryCtaRoute: 'ManageKidsClub',
        };
      case 'grace_period':
        return {
          primaryCtaLabel: 'Re-subscribe and Unlock SP',
          primaryCtaRoute: 'ManageKidsClub',
        };
      case 'expired':
        return {
          primaryCtaLabel: 'Re-subscribe (SP will start fresh)',
          primaryCtaRoute: 'ManageKidsClub',
        };
      default:
        return {
          primaryCtaLabel: 'Start Free Trial',
          primaryCtaRoute: 'ContinueKidsClub',
        };
    }
  })();

  const handlePrimaryCta = () => {
    navigation.navigate(primaryCtaRoute as never);
  };

  return (
    <ScreenLayout variant="detail" title="Kids Club+">
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Kids Club+</Text>
          <Text style={styles.subtitle}>
            Unlock Swap Points, reduced fees, and priority access for your family. Kids Club+ is
            designed for parents who want to stretch their budget while teaching kids the value of
            reuse.
          </Text>
        </View>

        {/* Current Status Card */}
        <SubscriptionStatusCard subscription={subscription} graceMessage={graceMessage} />

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why parents love Kids Club+</Text>
          <View style={styles.benefitsList}>
            <BenefitItem icon="💰" text="Earn Swap Points every time you sell items" />
            <BenefitItem
              icon="🎯"
              text="Use points for discounts on future finds (up to 50% off)"
            />
            <BenefitItem
              icon="💵"
              text={`Pay only ${formatPrice(subscriberFeeCents)} per transaction (vs ${formatPrice(nonSubscriberFeeCents)})`}
            />
            <BenefitItem icon="⚡" text="Get early access to new listings" />
            <BenefitItem icon="🌱" text="Help your child learn smart money habits" />
            <BenefitItem icon="♻️" text="Reduce waste and support sustainable shopping" />
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsList}>
            <StepItem
              number="1"
              title="Start your free trial"
              description="30 days free, no credit card required"
            />
            <StepItem
              number="2"
              title="List and sell items"
              description="Earn Swap Points with every sale you complete"
            />
            <StepItem
              number="3"
              title="Shop and save"
              description="Use your Swap Points for discounts on purchases"
            />
          </View>
        </View>

        {/* Primary CTA or Management Section */}
        {primaryCtaLabel ? (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={handlePrimaryCta}>
              <Text style={styles.primaryButtonText}>{primaryCtaLabel}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.managementSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => navigation.navigate('ManageKidsClub' as never)}
            >
              <Text style={styles.secondaryButtonText}>Update Payment Method</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.destructiveButton]}
              onPress={() => setShowCancelModal(true)}
            >
              <Text style={styles.destructiveButtonText}>Cancel Membership</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.finePrintSection}>
          <Text style={styles.finePrintTitle}>Fine print</Text>
          <Text style={styles.finePrint}>
            After your free trial, Kids Club+ is just{' '}
            {monthlyPrice ? formatPrice(monthlyPrice * 100) : 'loading...'}/month. Cancel anytime
            with no penalty. Your Swap Points remain frozen for {gracePeriodDays} days if you
            cancel.
          </Text>
        </View>
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Subscription</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel? You'll lose access to exclusive badges, zero fees,
              and monthly rewards at the end of your billing cycle.
            </Text>

            <View style={styles.reasonList}>
              {CANCELLATION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReasonId === reason.id && styles.selectedReasonItem,
                  ]}
                  onPress={() => setSelectedReasonId(reason.id)}
                >
                  <View
                    style={[
                      styles.radioButton,
                      selectedReasonId === reason.id && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedReasonId === reason.id && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReasonId === reason.id && styles.selectedReasonText,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedReasonId === 'other' && (
              <TextInput
                style={styles.modalInput}
                placeholder="Tell us why you're leaving..."
                value={cancellationReason}
                onChangeText={setCancellationReason}
                multiline
                numberOfLines={3}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedReasonId(null);
                  setCancellationReason('');
                }}
                disabled={cancelling}
              >
                <Text style={styles.secondaryButtonText}>Keep Membership</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.destructiveButton]}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#DC2626" size="small" />
                ) : (
                  <Text style={styles.destructiveButtonText}>Confirm Cancellation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar showHelp={true} />
    </ScreenLayout>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

interface BenefitItemProps {
  icon: string;
  text: string;
}

function BenefitItem({ icon, text }: BenefitItemProps) {
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitIcon}>{icon}</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

interface StepItemProps {
  number: string;
  title: string;
  description: string;
}

function StepItem({ number, title, description }: StepItemProps) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  benefitsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  howItWorksSection: {
    marginBottom: 32,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  finePrint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  finePrintSection: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  finePrintTitle: {
    textTransform: 'uppercase',
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  managementSection: {
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  destructiveButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  modalText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F0F0F0',
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    marginTop: 12,
  },
  reasonList: {
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  selectedReasonItem: {
    borderColor: '#5DBB8E',
    backgroundColor: '#E8F5F0',
  },
  reasonText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  selectedReasonText: {
    color: '#5DBB8E',
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#5DBB8E',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5DBB8E',
  },
  modalButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
