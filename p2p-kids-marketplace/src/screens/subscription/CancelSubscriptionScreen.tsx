/**
 * File: p2p-kids-marketplace/src/screens/subscription/CancelSubscriptionScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 7: Cancel Subscription
 *
 * TASK: Redesign CancelSubscriptionScreen — VISUAL ONLY
 * DO NOT CHANGE: cancel handler, keep handler, navigation
 * ONLY CHANGE: StyleSheet, icons → Phosphor
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WarningCircle, X, Check, Heart, ShieldCheck } from 'phosphor-react-native';
import { cancelSubscription } from '@/services/subscription';
import { captureException } from '@/services/errorReporter';
import { useSubscription } from '@/hooks/useSubscription';
import type { RootStackParamList } from '@/navigation/types';
import { MY_SUBSCRIPTION_BENEFITS } from '@/constants/subscriptionPlans';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CancelSubscriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { refetch } = useSubscription();
  const [cancelling, setCancelling] = useState(false);

  const handleKeepSubscription = () => {
    navigation.goBack();
  };

  const handleCancelConfirm = async () => {
    Alert.alert(
      'Cancel Subscription?',
      "Are you sure? You'll lose access to all Kids Club+ benefits.",
      [
        {
          text: 'Go Back',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelSubscription('user_requested');
              await refetch();
              Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled.');
              navigation.navigate('ManageKidsClub');
            } catch (error) {
              captureException(error, {
                tags: { screen: 'CancelSubscriptionScreen', action: 'cancel' },
              });
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenLayout variant="detail" title="Cancel Subscription">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Retention Header */}
        <View style={styles.retentionHeader}>
          <View style={styles.heartIconContainer}>
            <Heart size={40} color="#E85D75" weight="fill" />
          </View>
          <Text style={styles.retentionTitle}>We'll miss you!</Text>
          <Text style={styles.retentionSubtitle}>
            Before you go, here's a quick reminder of what you'll be leaving behind.
          </Text>
        </View>

        {/* Benefits Loss Section */}
        <View style={styles.lossCard}>
          <View style={styles.lossHeader}>
            <WarningCircle size={20} color="#E85D75" weight="fill" />
            <Text style={styles.lossHeaderText}>Benefits you'll lose immediately</Text>
          </View>

          <View style={styles.benefitsList}>
            {MY_SUBSCRIPTION_BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitRow} testID={`benefit-${index}`}>
                <View style={styles.xIconContainer}>
                  <X size={14} color="#E85D75" weight="bold" />
                </View>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Value Proposition */}
        <View style={styles.valueProp}>
          <ShieldCheck size={20} color="#5DBB8E" weight="duotone" />
          <Text style={styles.valuePropText}>
            Join 1,000+ parents saving an average of $45/month with Kids Club+.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.keepButton}
            onPress={handleKeepSubscription}
            disabled={cancelling}
            testID="keep-subscription-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Keep subscription button"
          >
            <Check size={20} color="#FFFFFF" weight="bold" style={{ marginRight: 8 }} />
            <Text style={styles.keepButtonText}>Keep My Benefits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={handleCancelConfirm}
            disabled={cancelling}
            testID="cancel-anyway-link"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cancel anyway link"
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#94A3B8" />
            ) : (
              <Text style={styles.cancelLinkText}>I still want to cancel</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimerText}>
          Your subscription will remain active until the end of the current billing cycle if you
          decide to stay.
        </Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  retentionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heartIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  retentionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  retentionSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  lossCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  lossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  lossHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E85D75',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  benefitsList: {
    gap: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  xIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitText: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
    lineHeight: 22,
    fontWeight: '500',
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 40,
    width: '100%',
  },
  valuePropText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  keepButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 18,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#5DBB8E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  keepButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelLink: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
