// File: p2p-kids-marketplace/src/components/TrialReminderBanner.tsx
// Banner component to display trial reminder notifications

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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
    // Navigate to subscription payment screen
    // @ts-ignore - type will be added when navigation types are updated
    navigation.navigate('SubscriptionPayment');
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (!reminder?.shouldShow || isDismissed) {
    return null;
  }

  const getBannerColor = (daysRemaining?: number) => {
    if (!daysRemaining) return '#3B82F6';
    if (daysRemaining <= 1) return '#EF4444'; // Red for last day
    if (daysRemaining <= 2) return '#F59E0B'; // Orange for 2 days
    return '#3B82F6'; // Blue for 7 days
  };

  return (
    <View style={[styles.banner, { backgroundColor: getBannerColor(reminder.daysRemaining) }]}>
      <View style={styles.content}>
        <Text style={styles.title}>{reminder.title}</Text>
        <Text style={styles.message}>{reminder.message}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddPayment}>
            <Text style={styles.primaryButtonText}>Add Payment Method</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  banner: {
    padding: 16,
    borderRadius: 8,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
