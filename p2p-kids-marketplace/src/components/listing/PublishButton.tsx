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
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  buttonDisabled: {
    backgroundColor: '#C8C8C8',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
