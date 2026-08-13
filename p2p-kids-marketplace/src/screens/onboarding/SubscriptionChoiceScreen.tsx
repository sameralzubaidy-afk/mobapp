// File: src/screens/onboarding/SubscriptionChoiceScreen.tsx
// MODULE-03 AUTH-V2-003: User chooses subscription tier after profile completion

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { enrollInTrialSubscription } from '@/services/auth';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';
import {
  getSubscriptionPrice,
  getTrialDays,
  isTrialEnabled,
  invalidateConfigCache,
  getSPMaxPercentage,
  getConfigValue,
} from '@/services/adminConfig';
import { getTrialLimitStatus, TrialLimitStatus } from '@/services/subscription';

export default function SubscriptionChoiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { session } = useAuth();

  // Get userId from route params (during onboarding) or from session (when navigating from app)
  const userIdFromParams = (route.params as any)?.userId;
  const userId = userIdFromParams || session?.user?.id;

  // Determine if we're in onboarding flow (has userId param) or authenticated app flow (no userId param)
  const isOnboardingFlow = !!userIdFromParams;

  const [loading, setLoading] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [subscriptionPrice, setSubscriptionPrice] = useState('0.00');
  const [trialDays, setTrialDays] = useState(30);
  const [spMaxPercentage, setSpMaxPercentage] = useState(50);
  const [isReferred, setIsReferred] = useState(false);
  const [trialLimitStatus, setTrialLimitStatus] = useState<TrialLimitStatus | null>(null);

  // Fetch config every time screen is focused (ensures fresh values from admin changes)
  useFocusEffect(
    React.useCallback(() => {
      loadConfigSettings();
      checkReferralStatus();
      loadTrialLimitStatus();
    }, [userId])
  );

  const loadTrialLimitStatus = async () => {
    if (!userId) {
      setTrialLimitStatus(null);
      return;
    }

    try {
      const status = await getTrialLimitStatus(userId);
      setTrialLimitStatus(status);
    } catch (error) {
      console.warn('Error loading trial limit status:', error);
      setTrialLimitStatus(null);
    }
  };

  const checkReferralStatus = async () => {
    if (!userId) return;
    try {
      const eligibility = await ReferralCodeServiceV2.checkEligibility(userId);
      setIsReferred(eligibility.rewards_pending);

      if (eligibility.rewards_pending) {
        await ReferralRewardsService.getConfiguredRewardAmounts();
      }
    } catch (error) {
      console.warn('Error checking referral status:', error);
    }
  };

  const loadConfigSettings = async () => {
    try {
      // Invalidate cache to force fresh fetch
      invalidateConfigCache();

      // Fetch all config values dynamically
      const price = await getSubscriptionPrice();
      const days = await getTrialDays();
      const trialEnabledStatus = await isTrialEnabled();
      const spMaxPercent = await getSPMaxPercentage();
      const maxTrialUses = await getConfigValue('max_trial_uses');

      setSubscriptionPrice(price.toFixed(2));
      setTrialDays(days);
      setTrialEnabled(trialEnabledStatus);
      setSpMaxPercentage(spMaxPercent);

      console.log('Config loaded:', {
        price,
        days,
        trialEnabledStatus,
        spMaxPercent,
        maxTrialUses,
      });
    } catch (error) {
      console.error('Error loading config settings:', error);
      // Keep price dynamic; do not fall back to a hardcoded tier price.
      setSubscriptionPrice('0.00');
      setTrialDays(30);
      setTrialEnabled(true);
      setSpMaxPercentage(50);
    }
  };

  const handleChooseFree = async () => {
    try {
      // If referred, show warning about losing bonus
      if (isReferred) {
        Alert.alert(
          'Wait! Potential Bonus Loss',
          `As a referred member, you are eligible for a sign-up Swap Points bonus. By selecting the Free Tier and skipping the Trial membership, you will lose this sign-up bonus.\n\nAre you sure you want to proceed?`,
          [
            {
              text: 'Back to Select Screen',
              style: 'cancel',
            },
            {
              text: 'Proceed with Free tier',
              style: 'destructive',
              onPress: () => performChooseFree(),
            },
          ]
        );
        return;
      }

      await performChooseFree();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete setup');
      console.error('Choose Free error:', error);
    }
  };

  const performChooseFree = async () => {
    try {
      setLoading(true);

      console.log('🎯 SUBSCRIPTION FLOW: User chose FREE tier');

      if (isOnboardingFlow) {
        // Mark profile as complete
        // Note: User already has free subscription from signup (create_free_subscription RPC)
        // No need to modify subscription - it's already 'free' status
        const { error } = await supabase
          .from('profiles')
          .update({
            profile_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        console.log('✅ SUBSCRIPTION FLOW: Profile marked complete with FREE tier');

        // Navigate to FeatureHighlights to complete onboarding
        // The session will be automatically established after profile_completed is true
        (navigation as any).navigate('FeatureHighlights', { userId });
      } else {
        // Already authenticated user (e.g. from TradeSuccessScreen) — go to Home
        (navigation as any).navigate('Home');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChooseTrial = async () => {
    try {
      setLoading(true);

      if (!trialEnabled) {
        Alert.alert(
          'Trial Unavailable',
          'Trial subscription is not currently available. Please choose Free Tier.'
        );
        return;
      }

      if (trialLimitStatus && !trialLimitStatus.can_start_trial) {
        Alert.alert(
          "You've already used your free trial",
          "You've used your free trial. Subscribe to Kids Club+ to continue.",
          [
            { text: 'Contact Support', style: 'cancel' },
            {
              text: 'Subscribe Now',
              onPress: () => (navigation as any).navigate('ContinueKidsClub'),
            },
          ]
        );
        return;
      }

      console.log('🎯 SUBSCRIPTION FLOW: User chose TRIAL tier');

      // Check if user already has a subscription (from signup flow)
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      // Subscription should exist and be 'free' from signup
      // We need to upgrade it to 'trial'
      if (existingSubscription?.status === 'free') {
        console.log('🔄 SUBSCRIPTION FLOW: Upgrading free subscription to trial');

        // Mark profile as complete first
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            profile_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }

        // Upgrade free subscription to trial using RPC
        // (This is the same function used for mid-session upgrades)
        const { error: upgradeError } = await (supabase.rpc('upgrade_free_subscription_to_trial', {
          p_user_id: userId,
        }) as any);

        if (upgradeError) {
          console.error('❌ SUBSCRIPTION FLOW: Upgrade failed:', upgradeError);
          throw upgradeError;
        }

        console.log('✅ SUBSCRIPTION FLOW: Successfully upgraded to trial');

        Alert.alert(
          'Welcome to Kids Club+!',
          'Your 30-day free trial has been activated. Enjoy unlimited Swap Points!',
          [
            {
              text: 'Get Started',
              onPress: () => {
                // If coming from onboarding, navigate to FeatureHighlights screen (tutorials)
                // If coming from authenticated app (TradeSuccessScreen), go to Home
                if (isOnboardingFlow) {
                  setTimeout(() => {
                    (navigation as any).navigate('FeatureHighlights', { userId });
                  }, 100);
                } else {
                  // User upgraded from app context — go to Home
                  (navigation as any).navigate('Home');
                }
              },
            },
          ]
        );
        return;
      }

      if (existingSubscription?.status === 'trial') {
        // Already in trial (shouldn't happen with new flow, but handle it)
        console.log('✅ SUBSCRIPTION FLOW: User already in trial');

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            profile_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }

        Alert.alert(
          'Welcome to Kids Club+!',
          'Your 30-day free trial has been activated. Enjoy unlimited Swap Points!',
          [
            {
              text: 'Get Started',
              onPress: () => {
                if (isOnboardingFlow) {
                  setTimeout(() => {
                    (navigation as any).navigate('FeatureHighlights', { userId });
                  }, 100);
                } else {
                  (navigation as any).navigate('Home');
                }
              },
            },
          ]
        );
        return;
      }

      // Fallback: subscription doesn't exist yet (shouldn't happen)
      // Try to create trial subscription
      console.warn('⚠️ SUBSCRIPTION FLOW: No existing subscription, creating trial from scratch');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      const { subscription, wallet, error: enrollError } = await enrollInTrialSubscription(userId);

      if (enrollError) {
        console.error('❌ SUBSCRIPTION FLOW: Enrollment failed:', enrollError);
        throw enrollError;
      }

      console.log('✅ SUBSCRIPTION FLOW: Trial created from scratch:', { subscription, wallet });

      Alert.alert(
        'Welcome to Kids Club+!',
        'Your 30-day free trial has been activated. Enjoy unlimited Swap Points!',
        [
          {
            text: 'Get Started',
            onPress: () => {
              // If coming from onboarding, navigate to FeatureHighlights screen (tutorials)
              // If coming from authenticated app (TradeSuccessScreen), go to Home
              if (isOnboardingFlow) {
                console.log('[SubscriptionChoice] ✅ Navigating to tutorials (FeatureHighlights)');
                setTimeout(() => {
                  (navigation as any).navigate('FeatureHighlights', { userId });
                }, 100);
              } else {
                // User upgraded from app context — go to Home
                console.log(
                  '[SubscriptionChoice] ✅ Navigating to Home after trial activation'
                );
                (navigation as any).navigate('Home');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to activate trial');
      console.error('Choose Trial error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Pick the plan that works best for you</Text>

        {/* Free Tier Option */}
        <View style={styles.planCard}>
          <Text style={styles.planName}>Free Tier</Text>
          <Text style={styles.planPrice}>$0/month</Text>
          <View style={styles.featuresList}>
            <FeatureItem text="Create & browse listings" included={true} />
            <FeatureItem text="In-app messaging" included={true} />
            <FeatureItem text="Buy & sell with cash only" included={true} />
            <FeatureItem text="Swap Points" included={false} />
            <FeatureItem text="Custom payment preferences" included={false} />
          </View>
          <TouchableOpacity
            style={[styles.button, styles.freeButton]}
            onPress={handleChooseFree}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <Text style={styles.freeButtonText}>Choose Free</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Kids Club+ Trial Option */}
        {trialEnabled && (
          <View style={[styles.planCard, styles.premiumCard]}>
            <View style={styles.badgeContainer}>
              <Text style={styles.badge}>RECOMMENDED</Text>
            </View>
            <Text style={styles.planName}>Kids Club+</Text>
            <Text style={styles.trialOffer}>{trialDays}-Day Free Trial</Text>
            <Text style={styles.trialPrice}>then ${subscriptionPrice}/month</Text>
            <View style={styles.featuresList}>
              <FeatureItem text="All Free tier features" included={true} />
              <FeatureItem text="Earn Swap Points (SP)" included={true} />
              <FeatureItem text={`Spend Swap Points (up to ${spMaxPercentage}%)`} included={true} />
              <FeatureItem text="Set payment preferences" included={true} />
              <FeatureItem text="No credit card required" included={true} />
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                styles.premiumButton,
                trialLimitStatus && !trialLimitStatus.can_start_trial
                  ? styles.premiumButtonDisabled
                  : null,
              ]}
              onPress={handleChooseTrial}
              disabled={loading || Boolean(trialLimitStatus && !trialLimitStatus.can_start_trial)}
              testID="subscription-choice-start-trial"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.premiumButtonText}>
                  {trialLimitStatus && !trialLimitStatus.can_start_trial
                    ? 'Trial Limit Reached'
                    : 'Start Free Trial'}
                </Text>
              )}
            </TouchableOpacity>
            {trialLimitStatus && !trialLimitStatus.can_start_trial ? (
              <View style={styles.trialLimitWarning}>
                <Text style={styles.trialLimitWarningTitle}>
                  You've already used your free trial. Subscribe now to access Kids Club+.
                </Text>
                <TouchableOpacity
                  style={styles.trialLimitSubscribeButton}
                  onPress={() => (navigation as any).navigate('ContinueKidsClub')}
                  testID="subscription-choice-subscribe-now"
                >
                  <Text style={styles.trialLimitSubscribeButtonText}>Subscribe Now</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={styles.trialDisclaimer}>
              Your trial will automatically end in {trialDays} days. Cancel anytime, no charges
              until trial ends.
            </Text>
          </View>
        )}

        {/* Keep Free Tier — for non-onboarding users who want to stay on current plan */}
        {!isOnboardingFlow && (
          <TouchableOpacity
            style={styles.keepFreeButton}
            onPress={() => navigation.goBack()}
            testID="subscription-choice-keep-free"
          >
            <Text style={styles.keepFreeButtonText}>Keep Free Tier — No Thanks</Text>
          </TouchableOpacity>
        )}

        {/* Error state if trial disabled */}
        {!trialEnabled && (
          <View style={styles.trialDisabledCard}>
            <Text style={styles.trialDisabledText}>
              Trial subscriptions are temporarily unavailable.
            </Text>
            <Text style={styles.trialDisabledSubtext}>
              You can choose Free Tier, or check back later for Kids Club+ availability.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ text, included }: { text: string; included: boolean }) {
  return (
    <View style={styles.featureItem}>
      <Text style={[styles.featureCheck, included ? styles.checkIncluded : styles.checkExcluded]}>
        {included ? '✓' : '✗'}
      </Text>
      <Text style={[styles.featureText, included ? {} : styles.featureExcluded]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  premiumCard: {
    borderColor: '#4a90e2',
    borderWidth: 2,
    backgroundColor: '#f9fbff',
  },
  badgeContainer: {
    marginBottom: 12,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#4a90e2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 16,
  },
  trialOffer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2ecc71',
    marginBottom: 4,
  },
  trialPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 16,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureCheck: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
    minWidth: 20,
  },
  checkIncluded: {
    color: '#2ecc71',
  },
  checkExcluded: {
    color: '#ccc',
  },
  featureText: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
  },
  featureExcluded: {
    color: '#999',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  freeButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  freeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  premiumButton: {
    backgroundColor: '#4a90e2',
  },
  premiumButtonDisabled: {
    opacity: 0.55,
  },
  premiumButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trialLimitWarning: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  trialLimitWarningTitle: {
    color: '#9F1239',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  trialLimitSubscribeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4ED8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trialLimitSubscribeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  trialDisclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  keepFreeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  keepFreeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  trialDisabledCard: {
    backgroundColor: '#fef3cd',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    marginTop: 16,
  },
  trialDisabledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6f00',
    marginBottom: 4,
  },
  trialDisabledSubtext: {
    fontSize: 13,
    color: '#ff6f00',
  },
});
