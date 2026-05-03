/**
 * File: p2p-kids-marketplace/src/screens/subscription/SubscriptionSuccessScreen.tsx
 * MODULE-11 SUB-016/017: Subscription Success Screen
 *
 * Purpose: Displays a celebratory confirmation after successful subscription or re-subscription
 * Provides clear CTAs to explore the app and enjoy Kids Club+ benefits
 * Shown after payment completion, before returning to main app
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSubscription } from '@/hooks/useSubscription';
import type { RootStackParamList } from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SubscriptionSuccessScreenProps {
  route?: {
    params?: {
      isRenewal?: boolean;
    };
  };
}

export default function SubscriptionSuccessScreen({ route }: SubscriptionSuccessScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { subscription, loading } = useSubscription();

  // Animation refs for celebratory effects
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  const isRenewal = route?.params?.isRenewal ?? false;

  // Refresh subscription data on mount
  useFocusEffect(
    React.useCallback(() => {
      // Trigger any needed refreshes here if needed
      return () => {
        // Cleanup
      };
    }, [])
  );

  // Animate in on mount
  useEffect(() => {
    // Checkmark pop animation
    Animated.spring(checkmarkScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    // Container fade in
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [checkmarkScale, containerOpacity]);

  const handleGoToDashboard = () => {
    // Reset to Home tab stack
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleStartSearching = () => {
    // Navigate to Home with Search tab focused
    // Using HomeTabNavigator's structure
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Home',
          params: {
            screen: 'Search',
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Confirming your subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        scrollEnabled={false}
      >
        {/* Animated Checkmark */}
        <Animated.View
          style={[
            styles.checkmarkContainer,
            {
              transform: [{ scale: checkmarkScale }],
              opacity: containerOpacity,
            },
          ]}
        >
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkIcon}>✓</Text>
          </View>
        </Animated.View>

        {/* Success Title */}
        <Animated.View style={[styles.headerContainer, { opacity: containerOpacity }]}>
          <Text style={styles.title}>
            {isRenewal ? 'Re-subscription\nSuccessful!' : 'Welcome to Kids Club+!'}
          </Text>
          <Text style={styles.subtitle}>
            {isRenewal
              ? "You're back in! Your subscription is active."
              : "Your subscription is now active. Let's get started!"}
          </Text>
        </Animated.View>

        {/* Benefits Highlight */}
        <Animated.View style={[styles.benefitsCard, { opacity: containerOpacity }]}>
          <Text style={styles.benefitsTitle}>You now have access to:</Text>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✨</Text>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitItemTitle}>Earn Swap Points</Text>
              <Text style={styles.benefitItemDesc}>Get points for every sale</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💰</Text>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitItemTitle}>Lower Fees</Text>
              <Text style={styles.benefitItemDesc}>$0.99 per transaction</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🚀</Text>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitItemTitle}>Priority Listings</Text>
              <Text style={styles.benefitItemDesc}>Your items get shown first</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>⚡</Text>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitItemTitle}>Early Access</Text>
              <Text style={styles.benefitItemDesc}>See new listings before others</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View style={[styles.buttonsContainer, { opacity: containerOpacity }]}>
          {/* Primary Button: Start Searching */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStartSearching}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>🔍 Start Searching</Text>
            <Text style={styles.primaryButtonSubtext}>Browse amazing deals nearby</Text>
          </TouchableOpacity>

          {/* Secondary Button: Go to Dashboard */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoToDashboard}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryButtonText}>📊 Go to Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Helpful Text */}
        <Animated.View style={[styles.footerText, { opacity: containerOpacity }]}>
          <Text style={styles.footerContent}>
            Your subscription will renew automatically. Manage or cancel anytime from your
            subscription settings.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Checkmark Animation
  checkmarkContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  checkmark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  checkmarkIcon: {
    fontSize: 60,
    color: '#fff',
    fontWeight: '800',
  },

  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 35,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Benefits Card
  benefitsCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  benefitContent: {
    flex: 1,
  },
  benefitItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  benefitItemDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  // Buttons
  buttonsContainer: {
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  primaryButtonSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },

  // Footer
  footerText: {
    alignItems: 'center',
  },
  footerContent: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
});
