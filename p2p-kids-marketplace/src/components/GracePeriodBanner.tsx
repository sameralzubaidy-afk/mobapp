// File: p2p-kids-marketplace/src/components/GracePeriodBanner.tsx
// MODULE-11 SUB-009: Grace Period Countdown Banner — Whisk Design System
// VISUAL ONLY — logic, navigation, and prop contracts unchanged.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Warning } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface GracePeriodBannerProps {
  gracePeriodEndsAt: string; // ISO date string
  daysRemaining: number;
}

export default function GracePeriodBanner({
  gracePeriodEndsAt,
  daysRemaining,
}: GracePeriodBannerProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  // ── Unchanged logic ─────────────────────────────────────────────────────────
  const handleResubscribe = () => {
    navigation.navigate('ManageKidsClub');
  };

  const isUrgent = daysRemaining <= 7;
  const isCritical = daysRemaining <= 1;

  const getMessage = () => {
    if (isCritical) {
      return 'Your grace period ends today! Re-subscribe now to keep your Swap Points.';
    } else if (isUrgent) {
      return `Only ${daysRemaining} days left! Re-subscribe to keep your Swap Points.`;
    } else {
      return `You have ${daysRemaining} days to re-subscribe before your Swap Points are deleted.`;
    }
  };

  const title = isCritical
    ? 'Final Day!'
    : isUrgent
      ? 'Grace Period Ending Soon'
      : 'Grace Period Active';
  // ── End logic ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Warning size={20} color="#E85D75" weight="fill" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{getMessage()}</Text>
        <Pressable style={styles.ctaBtn} onPress={handleResubscribe}>
          <Text style={styles.ctaText}>Re-subscribe Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#E85D75',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  ctaBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
