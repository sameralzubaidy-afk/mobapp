/**
 * File: p2p-kids-marketplace/src/components/listing/PublishButton.tsx
 * MODULE-04 LISTING-V3-008: Publish Button
 * Task: LISTING-V3-008 - Large primary button with loading + disabled states
 *
 * Features:
 * - Loading indicator
 * - Disabled state
 * - Accessibility labels
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

export interface PublishButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  testID?: string;
}

export function PublishButton({
  onPress,
  loading = false,
  disabled = false,
  label = 'Publish Item',
  testID = 'publish-button',
}: PublishButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
