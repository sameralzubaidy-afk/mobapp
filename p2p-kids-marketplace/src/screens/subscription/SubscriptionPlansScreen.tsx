/**
 * File: p2p-kids-marketplace/src/screens/subscription/SubscriptionPlansScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 1: Subscription Plans
 * 
 * TASK: Redesign SubscriptionPlansScreen — VISUAL ONLY
 * DO NOT CHANGE: plan data, upgrade handlers, current plan detection, navigation
 * ONLY CHANGE: StyleSheet, icons → Phosphor
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown, CrownSimple, CheckCircle } from 'phosphor-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { getSubscriptionPrice, getTrialDays } from '@/services/adminConfig';
import { formatDollarAmount } from '@/utils/formatPrice';
import {
  TIER_COMPARISON_ROWS,
  TIER_ID_FREE,
  TIER_ID_KIDS_CLUB_PLUS,
} from '@/constants/subscriptionPlans';
import type { RootStackParamList } from '@/navigation/types';
import { LoadingSpinner } from '@/components/ui';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  billingPeriod: string;
  trialText?: string;
  features: PlanFeature[];
}

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { subscription, loading } = useSubscription();
  const [monthlyPrice, setMonthlyPrice] = useState<number>(0);
  const [trialDays, setTrialDays] = useState<number>(30);
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [price, trial] = await Promise.all([
          getSubscriptionPrice(true),
          getTrialDays(true),
        ]);
        setMonthlyPrice(price || 0);
        setTrialDays(trial || 30);
      } catch (error) {
        console.error('[SubscriptionPlansScreen] Failed to load config:', error);
        setMonthlyPrice(0);
        setTrialDays(30);
      } finally {
        setConfigLoading(false);
      }
    };
    loadConfig();
  }, []);

  const isSubscriber = subscription?.status === 'active' || subscription?.status === 'trial';
  const currentPlanId = isSubscriber ? TIER_ID_KIDS_CLUB_PLUS : TIER_ID_FREE;

  const freeFeatures: PlanFeature[] = TIER_COMPARISON_ROWS.filter(
    (row) => row.key !== 'monthly_subscription' && row.key !== 'trial_period'
  ).map((row) => ({
    text: row.name,
    included: typeof row.free === 'boolean' ? row.free : true,
  }));

  const kidsClubPlusFeatures: PlanFeature[] = TIER_COMPARISON_ROWS.filter(
    (row) => row.key !== 'monthly_subscription' && row.key !== 'trial_period'
  ).map((row) => ({
    text: row.name,
    included: typeof row.kidsClubPlus === 'boolean' ? row.kidsClubPlus : true,
  }));

  const plans: PlanConfig[] = [
    {
      id: TIER_ID_FREE,
      name: 'Free',
      price: 0,
      billingPeriod: 'forever',
      features: freeFeatures,
    },
    {
      id: TIER_ID_KIDS_CLUB_PLUS,
      name: 'Kids Club+',
      price: monthlyPrice,
      billingPeriod: '/month',
      trialText: `${trialDays}-day free trial`,
      features: kidsClubPlusFeatures,
    },
  ];

  const handlePlanSelect = (planId: string) => {
    if (planId === TIER_ID_FREE) {
      // Already free or downgrade flow
      return;
    }
    navigation.navigate('SubscriptionPayment', { isRenewal: false });
  };

  if (loading || configLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="subscription-plans-screen">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>Unlock the full Pass It Up experience</Text>
        </View>

        {/* Plan Cards */}
        {plans.map((plan) => {
          const isFree = plan.id === TIER_ID_FREE;
          const isKidsClub = plan.id === TIER_ID_KIDS_CLUB_PLUS;
          const isCurrent = plan.id === currentPlanId;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                isFree && styles.planCardFree,
                isKidsClub && styles.planCardKidsClub,
              ]}
              testID={`plan-card-${plan.id}`}
            >
              {/* Icon */}
              <View style={styles.planIconContainer}>
                {isFree ? (
                  <CrownSimple size={24} color="#6B6B6B" weight="regular" testID={`icon-${plan.id}`} />
                ) : (
                  <Crown
                    size={24}
                    color="#5DBB8E"
                    weight="fill"
                    testID={`icon-${plan.id}`}
                  />
                )}
              </View>

              {/* Plan Name */}
              <Text style={styles.planName} testID={`plan-name-${plan.id}`}>
                {plan.name}
              </Text>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text
                  style={[
                    styles.price,
                    isKidsClub && styles.priceKidsClub,
                  ]}
                  testID={`price-${plan.id}`}
                >
                  {formatDollarAmount(plan.price)}
                </Text>
                <Text style={styles.billingPeriod}>
                  {plan.billingPeriod}
                </Text>
              </View>

              {plan.trialText ? <Text style={styles.trialText}>{plan.trialText}</Text> : null}

              {/* Features */}
              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow} testID={`feature-${plan.id}-${index}`}>
                    <CheckCircle
                      size={16}
                      color={
                        feature.included
                          ? isKidsClub
                            ? '#5DBB8E'
                            : '#6B6B6B'
                          : '#E0E0E0'
                      }
                      weight={feature.included ? 'fill' : 'regular'}
                    />
                    <Text
                      style={[
                        styles.featureText,
                        !feature.included && styles.featureTextDisabled,
                      ]}
                    >
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[
                  styles.ctaButton,
                  isFree && styles.ctaButtonFree,
                  isKidsClub && styles.ctaButtonKidsClub,
                  isCurrent && styles.ctaButtonDisabled,
                ]}
                onPress={() => handlePlanSelect(plan.id)}
                disabled={isCurrent}
                testID={`cta-button-${plan.id}`}
              >
                <Text
                  style={[
                    styles.ctaButtonText,
                    isFree && styles.ctaButtonTextFree,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isCurrent ? 'Current Plan' : isFree ? 'Current' : `Start ${trialDays}-day Trial`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Compare Link */}
        <TouchableOpacity
          style={styles.compareLink}
          onPress={() => navigation.navigate('PlanComparison')}
          testID="compare-plans-link"
        >
          <Text style={styles.compareLinkText}>Compare Plans →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 20,
    marginBottom: 16,
    position: 'relative',
  },
  planCardFree: {
    borderColor: '#E0E0E0',
  },
  planCardKidsClub: {
    borderWidth: 2,
    borderColor: '#5DBB8E',
  },
  planIconContainer: {
    marginBottom: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  priceKidsClub: {
    color: '#5DBB8E',
  },
  billingPeriod: {
    fontSize: 14,
    color: '#6B6B6B',
    marginLeft: 4,
  },
  trialText: {
    fontSize: 13,
    color: '#5DBB8E',
    marginBottom: 12,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  featureTextDisabled: {
    color: '#999999',
  },
  ctaButton: {
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButtonFree: {
    backgroundColor: '#F0F0F0',
  },
  ctaButtonKidsClub: {
    backgroundColor: '#5DBB8E',
  },
  ctaButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ctaButtonTextFree: {
    color: '#6B6B6B',
  },
  compareLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  compareLinkText: {
    fontSize: 15,
    color: '#5DBB8E',
    fontWeight: '500',
  },
});
