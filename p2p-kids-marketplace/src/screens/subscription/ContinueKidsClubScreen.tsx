/**
 * File: p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx
 * MODULE-11 TASK SUB-006: Continue Kids Club+ (Trial-to-Paid Conversion)
 *
 * Screen where users can add payment for Kids Club+.
 * - Trial users continue existing trial
 * - Non-trial users start a 30-day free period before first charge
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTrialStatus, TrialStatus } from '../../services/subscriptions/trialConversion';
import { useTrialToPaidConversion } from '../../services/subscriptions/trialToPaidConversion';
import { getSubscriptionPrice, getTrialDays } from '../../services/adminConfig';
import { formatDollarAmount } from '@/utils/formatPrice';
import { LoadingSpinner } from '@/components/ui';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ContinueKidsClubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { convertWithPaymentSheet } = useTrialToPaidConversion();

  const [loading, setLoading] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  // NO HARDCODED PRICE - fetch from admin_config on mount
  const [monthlyPrice, setMonthlyPrice] = useState<number>(0);
  const [trialDays, setTrialDays] = useState<number>(30);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const isActiveSubscription = trialStatus?.status === 'active';
  const isTrialSubscription = trialStatus?.status === 'trial';

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const [status, subscriptionPriceMonthly, trialPeriodDays] = await Promise.all([
        getTrialStatus(),
        getSubscriptionPrice(true),
        getTrialDays(true),
      ]);

      setTrialStatus(status);
      setMonthlyPrice(subscriptionPriceMonthly);
      setTrialDays(trialPeriodDays);
    } catch (error) {
      console.error('[ContinueKidsClub] Error loading status:', error);
      Alert.alert('Error', 'Failed to load trial status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleContinueWithPayment = async () => {
    if (isActiveSubscription) {
      Alert.alert('Already Subscribed', 'Your Kids Club+ subscription is already active.');
      return;
    }

    setLoading(true);

    try {
      const isRenewal = ['grace_period', 'expired', 'cancelled'].includes(
        trialStatus?.status ?? ''
      );
      const result = await convertWithPaymentSheet({ isRenewal });

      if (result.success) {
        Alert.alert(
          '🎉 Success!',
          'Your Kids Club+ subscription is now active! You can continue enjoying all premium features.',
          [
            {
              text: 'Got it!',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      } else {
        if (result.error === 'Payment cancelled') {
          // User cancelled - don't show error
          return;
        }

        Alert.alert('Payment Failed', result.error || 'Unable to process payment');
      }
    } catch (error) {
      console.error('[ContinueKidsClub] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loadingStatus) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isActiveSubscription) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>✅ Kids Club+ Active</Text>
          <Text style={styles.description}>
            Your subscription is already active and your premium benefits are available.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const daysRemaining = trialStatus?.days_remaining ?? 30;
  const trialEnding = daysRemaining <= 7;
  const showDefaultTrialBadge = !isTrialSubscription;

  const priceFormatted = formatDollarAmount(monthlyPrice);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>
            {isTrialSubscription ? 'Continue Kids Club+' : 'Start Kids Club+'}
          </Text>
          {trialEnding && daysRemaining > 0 && (
            <View style={styles.urgencyBadge}>
              <Text style={styles.urgencyText}>
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in trial
              </Text>
            </View>
          )}
          {showDefaultTrialBadge && (
            <View style={styles.urgencyBadge}>
              <Text style={styles.urgencyText}>{trialDays} free days • no charge today</Text>
            </View>
          )}
        </View>

        {/* Benefits Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keep Your Premium Benefits:</Text>
          <View style={styles.benefitsList}>
            <BenefitItem icon="💰" text="Earn & spend Swap Points" />
            <BenefitItem icon="⭐" text="Priority listing visibility" />
            <BenefitItem icon="🎁" text="Donation option for listings" />
            <BenefitItem icon="📊" text="Advanced trading insights" />
            <BenefitItem icon="🏆" text="Exclusive badges & achievements" />
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.pricingCard}>
          <Text style={styles.pricingAmount}>{priceFormatted}</Text>
          <Text style={styles.pricingPeriod}>per month</Text>
          <Text style={styles.pricingNote}>Cancel anytime</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleContinueWithPayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isTrialSubscription ? 'Continue Kids Club+' : `Start ${trialDays}-Day Free Trial`}
            </Text>
          )}
        </TouchableOpacity>

        {/* Secondary Actions */}
        <TouchableOpacity
          style={styles.textButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.textButtonText}>Maybe later</Text>
        </TouchableOpacity>

        {/* Fine Print */}
        <Text style={styles.finePrint}>
          {isTrialSubscription
            ? `By continuing, you'll be charged ${priceFormatted}/month starting when your trial ends. You can cancel anytime before the trial ends to avoid charges.`
            : `By adding a payment method, your Kids Club+ membership starts now with ${trialDays} free days. Your first ${priceFormatted} charge happens after the free period unless you cancel.`}
        </Text>
      </View>
    </ScrollView>
  );
}

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
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  urgencyBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
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
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  pricingCard: {
    backgroundColor: '#6366F1',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  pricingAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pricingPeriod: {
    fontSize: 18,
    color: '#E0E7FF',
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 14,
    color: '#E0E7FF',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  textButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  finePrint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
});
