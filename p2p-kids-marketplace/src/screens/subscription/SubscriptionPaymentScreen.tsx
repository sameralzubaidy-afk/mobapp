// File: p2p-kids-marketplace/src/screens/subscription/SubscriptionPaymentScreen.tsx
// MODULE-11 SUB-015: Full subscription payment flow screen

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SubscribeButton } from '../../components/subscription/SubscribeButton';
import { useSubscription } from '../../hooks/useSubscription';
import type { RootStackParamList } from '@/navigation/types';

type SubscriptionPaymentRouteProp = RouteProp<RootStackParamList, 'SubscriptionPayment'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function SubscriptionPaymentScreen() {
  const route = useRoute<SubscriptionPaymentRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { subscription, refetch } = useSubscription();

  // Determine if this is a renewal
  const isRenewal =
    subscription?.status === 'grace_period' || subscription?.status === 'expired';

  const handleSuccess = async () => {
    // Refresh subscription data
    await refetch();

    // Navigate to success or status screen
    navigation.navigate('SubscriptionStatus');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            {isRenewal
              ? 'Continue where you left off'
              : 'Unlock Swap Points and reduced fees'}
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What you get:</Text>

          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>✨</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Earn & Spend Swap Points</Text>
              <Text style={styles.benefitDescription}>
                Get points for every sale, use them to save on purchases
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>💰</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Lower Transaction Fees</Text>
              <Text style={styles.benefitDescription}>
                Pay only $0.99 per transaction (vs $2.99 for free users)
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🎁</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Priority Matching</Text>
              <Text style={styles.benefitDescription}>
                Your listings get shown first to interested buyers
              </Text>
            </View>
          </View>

          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>⚡</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Early Access</Text>
              <Text style={styles.benefitDescription}>
                See new listings before free users
              </Text>
            </View>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Monthly subscription</Text>
            <Text style={styles.pricingValue}>$4.99/month</Text>
          </View>

          {!isRenewal && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>30-day free trial</Text>
            </View>
          )}
        </View>

        {/* Subscribe Button */}
        <View style={styles.subscribeButtonContainer}>
          <SubscribeButton
            isRenewal={isRenewal}
            priceCents={499}
            onSuccess={handleSuccess}
            testID="subscription-payment-button"
          />
        </View>

        {/* Terms */}
        <Text style={styles.terms} testID="payment-terms">
          By subscribing, you agree to automatic monthly billing. You can cancel
          anytime from your subscription settings. No refunds for partial months.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  benefitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  pricingCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 16,
    color: '#000000',
  },
  pricingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  trialBadge: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subscribeButtonContainer: {
    marginBottom: 16,
  },
  terms: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
});
