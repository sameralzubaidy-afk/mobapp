/**
 * File: p2p-kids-marketplace/src/screens/subscription/SubscriptionExpiredScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 8: Subscription Expired
 *
 * DEV-TASK-100 item 1 (C09/D03): the "plan ended on" date is now derived from
 * the user's subscription row via useSubscription(), NOT a navigation route
 * param — no production navigation path ever passed {planName, expiredDate}
 * (the navigator mounts this screen as an initialRouteName with no params), so
 * genuinely expired users always saw the fallback copy. Fallback copy (no
 * row-derived date, e.g. never-subscribed) still applies.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSubscription } from '@/hooks/useSubscription';
import type { RootStackParamList } from '@/navigation/types';
import {
  WarningCircle,
  CheckCircle,
  CaretRight,
  XCircle,
  ClockCounterClockwise,
  SealCheck,
  TrendUp,
} from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { LoadingSpinner } from '@/components/ui';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BENEFITS = [
  {
    icon: SealCheck,
    title: 'Trade with PIPs',
    description: 'Use your points to buy items and save cash.',
    color: '#5DBB8E',
  },
  {
    icon: TrendUp,
    title: 'Reduced Fees',
    description: 'Save significantly on every transaction fee.',
    color: '#4A90E2',
  },
  {
    icon: ClockCounterClockwise,
    title: 'Keep Your Points',
    description: 'Your earned PIPs never expire. They are waiting for you!',
    color: '#F5A623',
  },
];

export default function SubscriptionExpiredScreen() {
  const navigation = useNavigation<NavigationProp>();
  // DEV-TASK-100: read the real expiry from the subscription row (same fetch
  // logic as MySubscriptionScreen / ManageKidsClubScreen via useSubscription).
  const { subscription, loading } = useSubscription();

  // Genuinely-expired users were Kids Club+ members, so the plan name is fixed.
  const planName = 'Kids Club+';
  // subscription_expires_at = trial_ends_at || current_period_end (the last day
  // of paid access — the same date grace-period messaging tells users their
  // subscription ended on). Null only when there is no subscription row at all
  // (e.g. a never-subscribed account that lands here).
  const endedDate = subscription?.subscription_expires_at || null;
  // DEV-TASK-94 (2026-09-03): a parent with no real expiration date previously
  // saw the placeholder "Your Kids Club+ plan ended on recently" — awkward. When
  // no row-derived date exists we say the plan is simply no longer active.
  const hasEndedDate = Boolean(endedDate);
  const expiredDate = hasEndedDate
    ? new Date(endedDate!).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const handleRenew = () => {
    navigation.navigate('JoinKidsClub');
  };

  const handleContinueFree = () => {
    navigation.navigate('Discover');
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Subscription Expired">
        <LoadingSpinner />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Subscription Expired">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <XCircle size={64} color="#FF6B6B" weight="fill" />
            <View style={styles.warningBadge}>
              <WarningCircle size={20} color="#FFFFFF" weight="fill" />
            </View>
          </View>

          <Text style={styles.title} testID="title">
            Subscription Expired
          </Text>

          {hasEndedDate ? (
            <View style={styles.dateContainer}>
              <Text style={styles.message} testID="message">
                Your {planName} plan ended on
              </Text>
              <Text style={styles.dateHighlight}>{expiredDate}</Text>
            </View>
          ) : (
            <Text style={styles.messageNoDate} testID="message">
              Your {planName} plan is no longer active.
            </Text>
          )}
        </View>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>What you're missing out on:</Text>

          {BENEFITS.map((benefit, index) => (
            <View key={index} style={styles.benefitCard}>
              <View
                style={[styles.benefitIconContainer, { backgroundColor: benefit.color + '15' }]}
              >
                <benefit.icon size={24} color={benefit.color} weight="duotone" />
              </View>
              <View style={styles.benefitTextContent}>
                <Text style={styles.benefitCardTitle}>{benefit.title}</Text>
                <Text style={styles.benefitCardDescription}>{benefit.description}</Text>
              </View>
              <CheckCircle size={20} color="#E0E0E0" weight="light" />
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't let your benefits slip away. Renew now to continue enjoying the full Pass It Up
            experience.
          </Text>

          <TouchableOpacity
            style={styles.renewButton}
            onPress={handleRenew}
            testID="renew-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Renew button"
            activeOpacity={0.8}
          >
            <Text style={styles.renewButtonText}>Renew Plan</Text>
            <CaretRight size={20} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueLink}
            onPress={handleContinueFree}
            testID="continue-free-link"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Continue free link"
          >
            <Text style={styles.continueLinkText}>Continue with Free Plan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  warningBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  message: {
    fontSize: 14,
    color: '#6B6B6B',
    marginRight: 4,
  },
  dateHighlight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  messageNoDate: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  benefitsContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitTextContent: {
    flex: 1,
  },
  benefitCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  benefitCardDescription: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  renewButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  renewButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  continueLink: {
    paddingVertical: 8,
  },
  continueLinkText: {
    fontSize: 15,
    color: '#6B6B6B',
    fontWeight: '500',
  },
});
