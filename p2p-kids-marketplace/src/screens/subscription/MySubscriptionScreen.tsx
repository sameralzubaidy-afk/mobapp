/**
 * File: p2p-kids-marketplace/src/screens/subscription/MySubscriptionScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 5: My Subscription
 * 
 * TASK: Redesign MySubscriptionScreen — VISUAL ONLY
 * DO NOT CHANGE: subscription data fetch, cancel navigation, upgrade navigation
 * ONLY CHANGE: StyleSheet, icons → Phosphor
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown, CrownSimple, CheckCircle, Question, Receipt, CreditCard } from 'phosphor-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { MY_SUBSCRIPTION_BENEFITS } from '@/constants/subscriptionPlans';
import type { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const SUPPORT_CONTACT_EMAIL = 'admin-support@kidsmarketplace.app';

function formatRenewalDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A';
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MySubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { subscription, loading } = useSubscription();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5DBB8E" />
      </SafeAreaView>
    );
  }

  const status = subscription?.status || 'free';
  const isPaid = status === 'active' || status === 'trial';
  const planName = isPaid ? 'Kids Club+' : 'Free';
  const renewalDateSource =
    subscription?.next_billing_date || subscription?.subscription_expires_at || subscription?.trial_ends_at;
  const renewalDate = formatRenewalDate(renewalDateSource);

  const handleUpgrade = () => {
    navigation.navigate('UpgradePlan');
  };

  const handleCancel = () => {
    navigation.navigate('CancelSubscription');
  };

  const handleBillingHistory = () => {
    navigation.navigate('TransactionHistory');
  };

  const handlePaymentMethod = () => {
    navigation.navigate('ManageKidsClub');
  };

  const handleGetHelp = () => {
    Alert.alert('Contact Support', `For subscription help, contact ${SUPPORT_CONTACT_EMAIL}.`);
  };

  const handleLearnMore = () => {
    navigation.navigate('Help', { section: 'sp_definition' });
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="my-subscription-screen">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Membership</Text>
          <Text style={styles.headerSubtitle}>Manage your Kids Club+ experience</Text>
        </View>

        {/* Active Plan Card with Gradient-like feel */}
        <View
          style={[
            styles.planCard,
            isPaid ? styles.planCardPaid : styles.planCardFree,
          ]}
          testID="plan-card"
        >
          <View style={styles.planCardHeader}>
            <View style={[styles.planIcon, isPaid ? styles.planIconPaid : styles.planIconFree]}>
              {isPaid ? (
                <Crown size={28} color="#FFFFFF" weight="fill" testID="crown-icon" />
              ) : (
                <CrownSimple size={28} color="#6B6B6B" weight="regular" testID="crown-simple-icon" />
              )}
            </View>
            <View style={styles.planCardTitleContainer}>
              <Text style={[styles.planName, isPaid && styles.planNamePaid]} testID="plan-name">
                {planName} Plan
              </Text>
              {isPaid && (
                <View style={styles.statusBadge} testID="active-badge">
                  <Text style={styles.statusBadgeText}>ACTIVE member</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.planCardFooter}>
            <View>
              <Text style={styles.infoLabel}>Renew Date</Text>
              <Text style={styles.infoValue} testID="renewal-date">{renewalDate}</Text>
            </View>
            {isPaid && (
              <View style={styles.infoRight}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>May 2024</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Menu */}
        <View style={styles.quickMenu}>
          <TouchableOpacity
            style={styles.menuItem}
            testID="billing-button"
            onPress={handleBillingHistory}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F0F9FF' }]}>
              <Receipt size={22} color="#0EA5E9" weight="duotone" />
            </View>
            <Text style={styles.menuLabel}>Billing History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            testID="payment-button"
            onPress={handlePaymentMethod}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F5F3FF' }]}>
              <CreditCard size={22} color="#8B5CF6" weight="duotone" />
            </View>
            <Text style={styles.menuLabel}>Payment Method</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            testID="support-button"
            onPress={handleGetHelp}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFF7ED' }]}>
              <Question size={22} color="#F59E0B" weight="duotone" />
            </View>
            <Text style={styles.menuLabel}>Get Help</Text>
          </TouchableOpacity>
        </View>

        {/* Benefits List */}
        {isPaid && (
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitsHeader}>
              <Text style={styles.benefitsTitle}>Kids Club+ Benefits</Text>
              <TouchableOpacity onPress={handleLearnMore} testID="benefits-learn-more-button">
                <Text style={styles.benefitsLink}>Learn More</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.benefitsCard}>
              {MY_SUBSCRIPTION_BENEFITS.map((benefit, index) => (
                <View key={index} style={styles.benefitRow} testID={`benefit-${index}`}>
                  <View style={styles.checkIcon}>
                    <CheckCircle size={18} color="#5DBB8E" weight="fill" />
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Upgrade Button (only for Free users) */}
        {!isPaid && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleUpgrade}
            testID="upgrade-button"
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
          </TouchableOpacity>
        )}

        {/* Subscription Management Actions */}
        {isPaid && (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={handleCancel}
              testID="cancel-link"
            >
              <Text style={styles.cancelLinkText}>Cancel Subscription</Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>
              You can cancel anytime. If you cancel, your benefits will remain active until the end of your current billing period.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    paddingVertical: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  planCardFree: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  planCardPaid: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planIconPaid: {
    backgroundColor: '#5DBB8E',
  },
  planIconFree: {
    backgroundColor: '#F1F5F9',
  },
  planCardTitleContainer: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  planNamePaid: {
    color: '#0F172A',
  },
  statusBadge: {
    backgroundColor: '#E8F5F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#5DBB8E',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  planCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  infoRight: {
    alignItems: 'flex-end',
  },
  quickMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  menuItem: {
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  benefitsContainer: {
    marginBottom: 32,
  },
  benefitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  benefitsLink: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  benefitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    marginRight: 12,
  },
  benefitText: {
    fontSize: 15,
    color: '#475569',
    flex: 1,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerActions: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelLink: {
    paddingVertical: 12,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
