// File: p2p-kids-marketplace/src/components/TrialReminderBanner.tsx
// Banner component to display trial reminder notifications — Whisk Design System
// VISUAL ONLY — data fetch, state logic, and handlers unchanged.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Clock } from 'phosphor-react-native';
import { getTrialReminderMessage } from '../services/subscriptions/trialReminders';
import { useNavigation } from '@react-navigation/native';

interface TrialReminderBannerProps {
  onDismiss?: () => void;
}

export function TrialReminderBanner({ onDismiss }: TrialReminderBannerProps) {
  const navigation = useNavigation();
  const [reminder, setReminder] = useState<{
    shouldShow: boolean;
    title?: string;
    message?: string;
    daysRemaining?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    loadReminderStatus();
  }, []);

  // ── Unchanged logic ─────────────────────────────────────────────────────────
  const loadReminderStatus = async () => {
    try {
      const reminderMessage = await getTrialReminderMessage();
      setReminder(reminderMessage);
    } catch (error) {
      console.error('Error loading trial reminder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = () => {
    // @ts-expect-error - type will be added when navigation types are updated
    navigation.navigate('JoinKidsClub');
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };
  // ── End logic ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#5DBB8E" />
      </View>
    );
  }

  if (!reminder?.shouldShow || isDismissed) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Clock size={20} color="#FF9500" weight="fill" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{reminder.title}</Text>
        <Text style={styles.message}>{reminder.message}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddPayment}>
            <Text style={styles.primaryButtonText}>Add Payment Method</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDismiss}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
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
    backgroundColor: '#FFF3E0',
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissText: {
    fontSize: 13,
    color: '#6B6B6B',
  },
});
