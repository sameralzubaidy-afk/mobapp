/**
 * FILE: p2p-kids-marketplace/src/components/subscription/AutoRenewToggle.tsx
 * MODULE-11 TASK SUB-017: Auto-Renew Toggle Component
 *
 * Allows users to enable/disable auto-renewal for their subscription.
 * Shows warning when disabling and updates both Stripe and database.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, ActivityIndicator } from 'react-native';
import { updateAutoRenew } from '@/services/subscription';

interface AutoRenewToggleProps {
  initialValue: boolean;
  onToggled?: (newValue: boolean) => void;
}

export function AutoRenewToggle({ initialValue, onToggled }: AutoRenewToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (newValue: boolean) => {
    // Show confirmation when disabling
    if (!newValue) {
      Alert.alert(
        'Disable Auto-Renew?',
        'Your subscription will end at the end of your current billing period. You can re-enable auto-renew at any time',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => performToggle(newValue),
          },
        ]
      );
    } else {
      performToggle(newValue);
    }
  };

  const performToggle = async (newValue: boolean) => {
    try {
      setIsUpdating(true);

      const result = await updateAutoRenew(newValue);

      if (result.success) {
        setIsEnabled(newValue);
        Alert.alert('Success', result.message);
        onToggled?.(newValue);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('[AutoRenewToggle] Error updating auto-renew:', error);
      Alert.alert('Error', 'Failed to update auto-renew setting. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Auto-Renew</Text>
          <Text style={styles.description}>
            {isEnabled
              ? 'Your subscription will automatically renew'
              : 'Your subscription will end after the current period'}
          </Text>
        </View>

        {isUpdating ? (
          <ActivityIndicator size="small" color="#5DBB8E" />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            // Branded green ON switch — matches the app-wide convention
            // (SettingsScreen / NotificationPreferencesScreen): #5DBB8E track +
            // white thumb (design-system-passitup.md). Replaces the iOS-blue
            // (#93C5FD track / #0066CC thumb) pairing (QA Task 21 finding 7).
            trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0E0E0"
            disabled={isUpdating}
          />
        )}
      </View>

      {!isEnabled && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Auto-renew is disabled. Your subscription will end after this period unless you
            re-enable it.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#FFA726',
    lineHeight: 18,
  },
});
