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
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { enrollInTrialSubscription } from '@/services/auth';
import { supabase } from '@/config/supabase';
import {
  getSubscriptionPrice,
  getTrialDays,
  isTrialEnabled,
  getAdminConfig,
  invalidateConfigCache,
  getSPMaxPercentage,
} from '@/services/adminConfig';

interface RouteParams {
  userId: string;
}

export default function SubscriptionChoiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as RouteParams;

  const [loading, setLoading] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [subscriptionPrice, setSubscriptionPrice] = useState('7.99');
  const [trialDays, setTrialDays] = useState(30);
  const [spMaxPercentage, setSpMaxPercentage] = useState(50);

  // Fetch config every time screen is focused (ensures fresh values from admin changes)
  useFocusEffect(
    React.useCallback(() => {
      loadConfigSettings();
    }, [])
  );

  const loadConfigSettings = async () => {
    try {
      // Invalidate cache to force fresh fetch
      invalidateConfigCache();

      // Fetch all config values dynamically
      const price = await getSubscriptionPrice();
      const days = await getTrialDays();
      const trialEnabledStatus = await isTrialEnabled();
      const spMaxPercent = await getSPMaxPercentage();

      setSubscriptionPrice(price.toFixed(2));
      setTrialDays(days);
      setTrialEnabled(trialEnabledStatus);
      setSpMaxPercentage(spMaxPercent);

      console.log('Config loaded:', { price, days, trialEnabledStatus, spMaxPercent });
    } catch (error) {
      console.error('Error loading config settings:', error);
      // Use defaults on error - these should always be set
      setSubscriptionPrice('7.99');
      setTrialDays(30);
      setTrialEnabled(true);
      setSpMaxPercentage(50);
    }
  };

  const handleChooseFree = async () => {
    try {
      setLoading(true);

      // Mark profile as complete
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

      // Navigate directly to Home (no trial, free user)
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete setup');
      console.error('Choose Free error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChooseTrial = async () => {
    try {
      setLoading(true);

      if (!trialEnabled) {
        Alert.alert('Trial Unavailable', 'Trial subscription is not currently available. Please choose Free Tier.');
        return;
      }

      // Check if user already has a subscription (from signup flow)
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (existingSubscription?.status === 'trial') {
        // User already has trial from signup, just complete onboarding
        console.log('User already enrolled in trial from signup');
        
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
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              },
            },
          ]
        );
        return;
      }

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

      // Enroll in trial subscription (if not already enrolled)
      const { subscription, wallet, error: enrollError } = await enrollInTrialSubscription(userId);

      if (enrollError) {
        throw enrollError;
      }

      Alert.alert(
        'Welcome to Kids Club+!',
        'Your 30-day free trial has been activated. Enjoy unlimited Swap Points!',
        [
          {
            text: 'Get Started',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
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
            {loading ? <ActivityIndicator color="#333" /> : <Text style={styles.freeButtonText}>Choose Free</Text>}
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
              style={[styles.button, styles.premiumButton]}
              onPress={handleChooseTrial}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.premiumButtonText}>Start Free Trial</Text>}
            </TouchableOpacity>
            <Text style={styles.trialDisclaimer}>
              Your trial will automatically end in {trialDays} days. Cancel anytime, no charges until trial ends.
            </Text>
          </View>
        )}

        {/* Error state if trial disabled */}
        {!trialEnabled && (
          <View style={styles.trialDisabledCard}>
            <Text style={styles.trialDisabledText}>Trial subscriptions are temporarily unavailable.</Text>
            <Text style={styles.trialDisabledSubtext}>You can choose Free Tier, or check back later for Kids Club+ availability.</Text>
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
  premiumButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trialDisclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
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
