// filepath: p2p-kids-marketplace/src/components/GracePeriodBanner.tsx
/**
 * MODULE-11 SUB-009: Grace Period Countdown Banner
 * 
 * Displays a prominent countdown banner when user is in grace_period status
 * Shows days remaining and urgent CTA to re-subscribe
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface GracePeriodBannerProps {
  gracePeriodEndsAt: string; // ISO date string
  daysRemaining: number;
}

export default function GracePeriodBanner({ gracePeriodEndsAt, daysRemaining }: GracePeriodBannerProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleResubscribe = () => {
    // Navigate to subscription management screen
    navigation.navigate('ManageKidsClub');
  };

  // Determine urgency level and colors
  const isUrgent = daysRemaining <= 7;
  const isCritical = daysRemaining <= 1;

  const bannerStyle = isCritical
    ? styles.bannerCritical
    : isUrgent
    ? styles.bannerUrgent
    : styles.bannerWarning;

  const getMessage = () => {
    if (isCritical) {
      return 'Your grace period ends today! Re-subscribe now to keep your Swap Points.';
    } else if (isUrgent) {
      return `Only ${daysRemaining} days left! Re-subscribe to keep your Swap Points.`;
    } else {
      return `You have ${daysRemaining} days to re-subscribe before your Swap Points are deleted.`;
    }
  };

  return (
    <View style={[styles.container, bannerStyle]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{isCritical ? '⛔' : isUrgent ? '⚠️' : '⏰'}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isCritical ? 'Final Day!' : isUrgent ? 'Grace Period Ending Soon' : 'Grace Period Active'}
          </Text>
          <Text style={styles.message}>{getMessage()}</Text>
        </View>
      </View>
      <Pressable style={styles.ctaButton} onPress={handleResubscribe}>
        <Text style={styles.ctaText}>Re-Subscribe Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerWarning: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  bannerUrgent: {
    backgroundColor: '#FFE5E5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  bannerCritical: {
    backgroundColor: '#FFD6D6',
    borderLeftWidth: 4,
    borderLeftColor: '#DC3545',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
