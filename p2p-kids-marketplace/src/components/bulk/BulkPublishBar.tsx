import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface BulkPublishBarProps {
  count: number;
  disabled?: boolean;
  onPress: () => void;
}

export function BulkPublishBar({ count, disabled = false, onPress }: BulkPublishBarProps) {
  const itemLabel = count === 1 ? 'Item' : 'Items';

  return (
    <View style={styles.container} testID="bulk-publish-bar">
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={`Submit ${count} ${itemLabel} for Review`}
        accessibilityHint="Opens submit-for-review confirmation summary"
        testID="bulk-publish-button"
      >
        <Text style={styles.buttonText}>
          Submit {count} {itemLabel} for Review
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Clear the floating pill nav (PersistentTabBar overlays the stack): the
    // pill top sits ~110pt from the bottom, so the fixed Submit CTA must sit
    // above it (same bottom:120 clearance CartScreen's sticky bar uses).
    bottom: 120,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  button: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
