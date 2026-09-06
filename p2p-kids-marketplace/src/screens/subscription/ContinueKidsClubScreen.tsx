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
import { getSubscriptionPrice, getTrialDays, getActiveMemberFeeCents } from '../../services/adminConfig';
import { openJoinKidsClubWeb } from '../../utils/subscriptionWeb';
import { formatDollarAmount, formatPrice } from '@/utils/formatPrice';
import { captureException } from '@/services/errorReporter';
import { LoadingSpinner } from '@/components/ui';
// DT-119 (item 1): source colors from the shared Pass-It-Up semantic tokens so
// the upsell branch can never drift back to the legacy design-system palette
// (#4A7C59 / #4D4D4D / #808080) — BP-82 (see docx/design-system-passitup.md).
import { theme } from '@/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ContinueKidsClubScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  // NO HARDCODED PRICE - fetch from admin_config on mount
  const [monthlyPrice, setMonthlyPrice] = useState<number>(0);
  const [trialDays, setTrialDays] = useState<number>(30);
  const [loadingStatus, setLoadingStatus] = useState(true);
  // Flat Safety & Platform Fee (Kids Club+ member fee) — canonical default 149c,
  // replaced live from admin_config so copy can't drift from the charged fee
  // (JoinKidsClubScreen pattern; BP-13/BP-28).
  const [activeMemberFlatCents, setActiveMemberFlatCents] = useState<number>(149);

  const isActiveSubscription = trialStatus?.status === 'active';
  const isTrialSubscription = trialStatus?.status === 'trial';

  useEffect(() => {
    loadStatus();
  }, []);

  // DT-118 benefits fix: fetch the member flat fee independently so a config
  // failure never breaks the trial/active status load (keeps the 149 default).
  useEffect(() => {
    let mounted = true;
    getActiveMemberFeeCents()
      .then((cents) => {
        if (mounted && Number.isFinite(cents) && cents >= 0) {
          setActiveMemberFlatCents(Math.round(cents));
        }
      })
      .catch(() => {
        // Keep the canonical 149 default on a config-fetch failure.
      });
    return () => {
      mounted = false;
    };
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
      captureException(error, {
        tags: { screen: 'ContinueKidsClubScreen', action: 'load_status' },
      });
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
      captureException(error, {
        tags: { screen: 'ContinueKidsClubScreen', action: 'open_web_checkout' },
      });
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
    // DT-118 (item 8): the active state was a near-empty dead-end (one line +
    // Go Back). Enrich it into an "you're all set" landing: header, benefits
    // recap, and a primary Manage Kids Club+ action (route manage-kids-club
    // exists) so an active member who lands here has a clear next step.
    return (
      <ScrollView style={styles.container} testID="kids-club-active-screen">
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>Kids Club+ Active</Text>
            <View style={styles.activeStatusPill}>
              <Text style={styles.activeStatusPillText}>✓ You're all set</Text>
            </View>
          </View>

          <Text style={styles.description}>
            Your subscription is already active and your premium benefits are available.
          </Text>

          {/* Benefits recap (DT-118 fix: canonical Kids Club+ membership benefits,
              matching the ManageKidsClub 'Kids Club+ Benefits' card) */}
          <View style={styles.section} testID="continue-active-benefits">
            <Text style={styles.sectionTitle}>Your Premium Benefits:</Text>
            <View style={styles.benefitsList}>
              <BenefitItem icon="💰" text="Earn & spend Swap Points on purchases" />
              <BenefitItem
                icon="🧾"
                text={`Flat ${formatPrice(activeMemberFlatCents)} Safety & Platform Fee on every trade`}
              />
              <BenefitItem icon="⭐" text="Priority listing visibility" />
              <BenefitItem icon="✨" text="Access to exclusive features" />
            </View>
          </View>

          {/* Primary action: manage membership (status / next billing / auto-renew) */}
          <TouchableOpacity
            style={styles.manageButton}
            testID="continue-active-manage-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Manage Kids Club Plus"
            onPress={() => navigation.navigate('ManageKidsClub')}
          >
            <Text style={styles.manageButtonText}>Manage Kids Club+</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.activeGoBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.activeGoBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
          {/* DT-119 (item 6): "X free days • no charge today" is a benefit message,
              NOT a deadline — positive green-tint pill, distinct from the warning
              treatment kept for the genuine trial countdown above. */}
          {showDefaultTrialBadge && (
            <View style={styles.freeTrialBadge}>
              <Text style={styles.freeTrialText}>
                {trialDays} free days • no charge today
              </Text>
            </View>
          )}
        </View>

        {/* Benefits Reminder (DT-118 fix: canonical Kids Club+ membership benefits) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keep Your Premium Benefits:</Text>
          <View style={styles.benefitsList}>
            <BenefitItem icon="💰" text="Earn & spend Swap Points on purchases" />
            <BenefitItem
              icon="🧾"
              text={`Flat ${formatPrice(activeMemberFlatCents)} Safety & Platform Fee on every trade`}
            />
            <BenefitItem icon="⭐" text="Priority listing visibility" />
            <BenefitItem icon="✨" text="Access to exclusive features" />
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
          accessible
          accessibilityRole="button"
          accessibilityLabel="Subscribe"
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
    color: theme.textColors.secondary,
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
  // Genuine deadline — warning-orange stays (canonical warning.100/warning.500).
  urgencyBadge: {
    backgroundColor: theme.colors.warning[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.warning[500],
  },
  // DT-119 (item 6): positive/benefit pill — primary green tint, mirrors the
  // active branch's "You're all set" treatment (primary.100 + green text).
  freeTrialBadge: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  freeTrialText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary[600],
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
    color: theme.textColors.secondary,
    flex: 1,
  },
  pricingCard: {
    backgroundColor: theme.colors.primary[500],
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: theme.colors.primary[500],
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
    backgroundColor: theme.colors.primary[500],
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary[500],
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
    borderColor: theme.colors.primary[500],
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary[500],
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  textButtonText: {
    fontSize: 14,
    color: theme.textColors.secondary,
  },
  finePrint: {
    fontSize: 12,
    color: theme.textColors.tertiary,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  description: {
    fontSize: 14,
    color: theme.textColors.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  // DT-118 (item 8): active-state elements — on-brand pass-it-up green (#5DBB8E)
  // for the NEW primary action + status pill (the pre-existing trial branch keeps
  // its legacy styling; not touched).
  activeStatusPill: {
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  activeStatusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  manageButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeGoBackButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#5DBB8E',
    marginBottom: 8,
  },
  activeGoBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
  },
});
