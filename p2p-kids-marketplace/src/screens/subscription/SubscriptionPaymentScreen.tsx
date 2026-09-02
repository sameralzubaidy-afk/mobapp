// File: p2p-kids-marketplace/src/screens/subscription/SubscriptionPaymentScreen.tsx
// MODULE-11 SUB-015: Full subscription payment flow screen
//
// DEPRECATED (Dev Task 86, 2026-09-02): In-app Stripe subscription payment is DEAD —
// joining is web-first (JoinKidsClubScreen → "Join on the web" → passitup.com). This
// screen has NO in-app caller; it is reachable ONLY via a legacy deep link
// ('/subscription/payment') or a legacy push payload. Do NOT add new navigation.
// Removal requires cleaning the AppNavigator route + navigation/types.ts entry + the
// deepLink.ts '/subscription/payment' and 'SubscriptionPayment' mappings.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkle, Coins, Gift, Lightning, CreditCard, CheckCircle } from 'phosphor-react-native';
import { JoinKidsClubButton } from '../../components/subscription/JoinKidsClubButton';
import { useSubscription } from '../../hooks/useSubscription';
import type { RootStackParamList } from '@/navigation/types';
import {
  getSubscriptionPrice,
  getTrialDays,
  getActiveMemberFeeCents,
  invalidateConfigCache,
} from '@/services/adminConfig';
import { formatDollarAmount, formatPrice } from '@/utils/formatPrice';
import { captureException, captureMessage } from '@/services/errorReporter';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// NO HARDCODED PRICES - all values must come from admin_config
const DEFAULT_TRIAL_DAYS = 30;

function formatMonthlyPrice(dollars: number): string {
  return `${formatDollarAmount(dollars)}/month`;
}

export function SubscriptionPaymentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { subscription } = useSubscription();
  // NO HARDCODED PRICE - fetch from admin_config on mount
  const [monthlyPriceDollars, setMonthlyPriceDollars] = useState<number>(0);
  const [trialDays, setTrialDays] = useState<number>(DEFAULT_TRIAL_DAYS);
  // R1 — Tiered Buyer-Fee Engine: flat active-member fee (dynamic).
  const [activeMemberFlatCents, setActiveMemberFlatCents] = useState<number>(149);
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  const loadPricingConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      invalidateConfigCache();
      const [price, days, memberFeeCents] = await Promise.all([
        getSubscriptionPrice(true),
        getTrialDays(true),
        getActiveMemberFeeCents(true),
      ]);

      if (Number.isFinite(price) && price > 0) {
        setMonthlyPriceDollars(price);
      } else {
        // If admin_config is not set, show 0 and log error
        captureMessage(
          `[SubscriptionPaymentScreen] Invalid subscription price from admin_config: ${String(price)}`,
          'warning'
        );
        setMonthlyPriceDollars(0);
      }

      if (Number.isFinite(days) && days > 0) {
        setTrialDays(days);
      } else {
        setTrialDays(DEFAULT_TRIAL_DAYS);
      }

      setActiveMemberFlatCents(memberFeeCents);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'SubscriptionPaymentScreen', action: 'load_pricing_config' },
      });
      // Show 0 to indicate configuration error
      setMonthlyPriceDollars(0);
      setTrialDays(DEFAULT_TRIAL_DAYS);
      setActiveMemberFlatCents(149);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPricingConfig();
    }, [loadPricingConfig])
  );

  // Determine if this is a renewal
  const isRenewal = subscription?.status === 'grace_period' || subscription?.status === 'expired';

  const monthlyPriceLabel = formatMonthlyPrice(monthlyPriceDollars);
  const dueTodayLabel = isRenewal ? monthlyPriceLabel : '$0.00';

  return (
    // DEFERRED-DECISION (2026-07-19): Payment screens had showBell={false} intentionally
    // to avoid subscription payment-flow distractions. Keeping bell hidden — revert if product team decides otherwise.
    <ScreenLayout variant="detail" title="Payment" showBell={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        testID="subscription-payment-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} testID="payment-title">
            {isRenewal ? 'Re-subscribe to Kids Club+' : 'Join Kids Club+'}
          </Text>
          <Text style={styles.subtitle} testID="payment-subtitle">
            {isRenewal ? 'Continue where you left off' : 'Unlock Swap Points and reduced fees'}
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What you get:</Text>

          <View style={styles.benefit}>
            <View style={styles.benefitIconCircle}>
              <Sparkle size={18} color="#5DBB8E" weight="fill" />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Earn & Spend Swap Points</Text>
              <Text style={styles.benefitDescription}>
                Get points for every sale, use them to save on purchases
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <View style={styles.benefitIconCircle}>
              <Coins size={18} color="#5DBB8E" weight="fill" />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Lower Transaction Fees</Text>
              <Text style={styles.benefitDescription}>
                Pay a flat {formatPrice(activeMemberFlatCents)} Safety & Platform Fee on every trade
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <View style={styles.benefitIconCircle}>
              <Gift size={18} color="#5DBB8E" weight="fill" />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Priority Matching</Text>
              <Text style={styles.benefitDescription}>
                Your listings get shown first to interested buyers
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <View style={styles.benefitIconCircle}>
              <Lightning size={18} color="#5DBB8E" weight="fill" />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Early Access</Text>
              <Text style={styles.benefitDescription}>See new listings before free users</Text>
            </View>
          </View>
        </View>

        {/* Checkout Summary */}
        <View style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <View>
              <Text style={styles.pricingLabel}>Kids Club+ monthly membership</Text>
              <Text style={styles.pricingSubLabel}>
                {isRenewal ? 'Billed monthly until canceled' : 'First charge after trial ends'}
              </Text>
            </View>
            {configLoading ? (
              <ActivityIndicator size="small" color="#5DBB8E" />
            ) : (
              <Text style={styles.pricingValue}>{monthlyPriceLabel}</Text>
            )}
          </View>

          {!isRenewal && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>{`${trialDays}-day free trial`}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.paymentMethodRow}>
            <CreditCard size={20} color="#6B6B6B" weight="regular" />
            <View style={styles.paymentMethodTextWrap}>
              <Text style={styles.paymentMethodTitle}>Payment method</Text>
              <Text style={styles.paymentMethodDescription}>Secure checkout with Stripe</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View style={styles.totalLabelWrap}>
              <CheckCircle size={16} color="#5DBB8E" weight="fill" />
              <Text style={styles.totalLabel}>Due today</Text>
            </View>
            <Text style={styles.totalValue}>{dueTodayLabel}</Text>
          </View>
        </View>

        {/* Web-only CTA (R7 — no in-app purchase) */}
        <View style={styles.subscribeButtonContainer}>
          <JoinKidsClubButton />
        </View>

        {/* Terms */}
        <Text style={styles.terms} testID="payment-terms">
          Membership is completed securely on passitup.com. You can cancel anytime from your
          subscription settings after subscribing.
        </Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
  },
  benefitsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  benefitIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 18,
    marginBottom: 24,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pricingLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  pricingSubLabel: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
  },
  pricingValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A73E8',
  },
  trialBadge: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEFEF',
    marginVertical: 14,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  paymentMethodDescription: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    color: '#1A1A1A',
    marginLeft: 8,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subscribeButtonContainer: {
    marginBottom: 16,
  },
  terms: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
