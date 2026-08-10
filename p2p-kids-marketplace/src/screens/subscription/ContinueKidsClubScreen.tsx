/**
 * File: p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx
 * MODULE-15.1 FLOW-12: ContinueKidsClubScreen — Pass It Up design system
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
import { getSubscriptionPrice, getTrialDays } from '../../services/adminConfig';
import { openJoinKidsClubWeb } from '../../utils/subscriptionWeb';
import { formatDollarAmount } from '@/utils/formatPrice';
import { LoadingSpinner } from '@/components/ui';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ContinueKidsClubScreen() {
  const navigation = useNavigation<NavigationProp>();

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
      // R7 — Web-first subscription: open the external browser (passitup.com).
      // There is NO in-app payment collection.
      await openJoinKidsClubWeb();
    } catch (error) {
      console.error('[ContinueKidsClub] Error opening web checkout:', error);
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
    <ScrollView style={styles.container} testID="kids-club-overview-screen">
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
          testID="subscribe-cta-button"
          onPress={handleContinueWithPayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isTrialSubscription ? 'Continue on the web' : 'Join Kids Club+ on the web'}
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
            ? `Membership is managed on passitup.com. Your ${priceFormatted}/month charge starts when your trial ends — cancel anytime before then to avoid charges.`
            : `Membership is completed on passitup.com. Your Kids Club+ membership starts with ${trialDays} free days — your first ${priceFormatted} charge happens after the free period unless you cancel.`}
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
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#808080',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  urgencyBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA726',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#4D4D4D',
    flex: 1,
  },
  pricingCard: {
    backgroundColor: '#4A7C59',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4A7C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  pricingAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pricingPeriod: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#4A7C59',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4A7C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A7C59',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A7C59',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  textButtonText: {
    fontSize: 14,
    color: '#808080',
  },
  finePrint: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  description: {
    fontSize: 14,
    color: '#4D4D4D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
});
