/**
 * File: p2p-kids-marketplace/src/screens/subscription/SubscriptionSuccessScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 4: Subscription Success
 * 
 * TASK: Redesign SubscriptionSuccessScreen — VISUAL ONLY
 * DO NOT CHANGE: plan name from navigation params, navigation on CTA
 * ONLY CHANGE: StyleSheet, icons → Phosphor
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown } from 'phosphor-react-native';
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
  const { loading } = useSubscription();

  // Animation refs for celebratory effects
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  const isRenewal = route?.params?.isRenewal ?? false;
  
  const planName = 'Kids Club+';

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

  const handleStartSearching = () => {
    // Navigate to Discover screen
    navigation.reset({
      index: 0,
      routes: [{ name: 'Discover' as any }],
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} testID="subscription-success-screen">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DBB8E" />
          <Text style={styles.loadingText}>Confirming your subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="subscription-success-screen">
      <View style={styles.container}>
        {/* Icon - conditional on plan */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: checkmarkScale }],
              opacity: containerOpacity,
            },
          ]}
          testID="success-icon-container"
        >
          <Crown size={64} color="#5DBB8E" weight="fill" testID="crown-icon" />
        </Animated.View>

        {/* Title */}
        <Animated.View style={[styles.headerContainer, { opacity: containerOpacity }]}>
          <Text style={styles.title} testID="title">
            You're now a {planName} member!
          </Text>
          <Text style={styles.subtitle}>
            {isRenewal
              ? "Welcome back! Your subscription is active."
              : "Your subscription is now active. Let's get started!"}
          </Text>
        </Animated.View>

        {/* Benefit Chips Row */}
        <Animated.View style={[styles.benefitsRow, { opacity: containerOpacity }]}>
          <View style={styles.benefitChip} testID="benefit-chip-0">
            <Text style={styles.benefitChipText}>Earn and spend PIPs</Text>
          </View>
          <View style={styles.benefitChip} testID="benefit-chip-1">
            <Text style={styles.benefitChipText}>Low Fees</Text>
          </View>
          <View style={styles.benefitChip} testID="benefit-chip-2">
            <Text style={styles.benefitChipText}>Save Together</Text>
          </View>
        </Animated.View>

        {/* CTA Button */}
        <Animated.View style={[styles.ctaContainer, { opacity: containerOpacity }]}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStartSearching}
            testID="start-exploring-button"
          >
            <Text style={styles.ctaButtonText}>Start Exploring</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
  loadingText: {
    fontSize: 15,
    color: '#6B6B6B',
    marginTop: 12,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  benefitChip: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  benefitChipText: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '500',
  },
  ctaContainer: {
    width: '100%',
  },
  ctaButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
